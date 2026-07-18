import time
import os
import psutil
import shutil
from typing import Dict, Any, List
from sqlalchemy import text
from sqlalchemy.orm import Session
from redis import Redis
from datetime import datetime
import io
import zipfile
import csv
import json
import httpx
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user, require_role
from app.api import deps
from app.models.user import User
from app.models.token_usage import TokenUsage
from app.models.pii_audit_log import PIIAuditLog
from app.services.llm_service import get_llm_provider
from app.tasks.evaluation_tasks import get_stt_model
from app.core.database import SessionLocal
from app.core.config import settings
from app.core.celery_app import celery_app

router = APIRouter()

@router.post("/release-workers")
async def release_workers(current_user: User = Depends(deps.require_role(["super_admin", "admin"]))):
    """
    Purge all pending tasks from the Celery queues.
    This effectively 'resets' the worker backlog if tasks are stuck.
    """
    try:
        count = celery_app.control.purge()
        return {"status": "success", "message": f"Successfully purged {count} tasks from queues."}
    except Exception as e:
        return {"status": "error", "message": f"Failed to release workers: {str(e)}"}

@router.post("/test-llm")
async def test_llm_connection(
    provider: str = Form(...),
    model: str = Form(...),
    api_key: str = Form(""),
    api_base: str = Form(""),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    config = {
        "provider": provider,
        "model": model,
        "api_key": api_key,
        "api_base": api_base
    }
    llm_provider = get_llm_provider(config)
    
    start_time = time.time()
    result = await llm_provider.test_connection()
    ttca = round(time.time() - start_time, 2)
    
    result["latency_seconds"] = ttca
    return result


@router.post("/test-stt")
async def test_stt_transcription(
    file: UploadFile = File(...),
    model_size: str = Form("large-v3"),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    os.makedirs("uploads/test", exist_ok=True)
    file_location = f"uploads/test/{file.filename}"
    with open(file_location, "wb+") as file_object:
        file_object.write(file.file.read())

    try:
        start_time = time.time()
        stt_model = get_stt_model(model_size)
        segments, info = stt_model.transcribe(file_location, beam_size=5)
        
        segments_data = []
        full_transcript = ""
        for i, segment in enumerate(segments):
            timestamp = f"[{segment.start:.2f}s - {segment.end:.2f}s]"
            text = segment.text.strip()
            segments_data.append({"id": i, "timestamp": timestamp, "text": text})
            full_transcript += f"{i}. {timestamp}: {text}\n"

        ttca = round(time.time() - start_time, 2)

        return {
            "status": "success",
            "ttca_seconds": ttca,
            "language": info.language,
            "segments": segments_data,
            "transcript": full_transcript
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if os.path.exists(file_location):
            os.remove(file_location)

@router.get("/ollama-models")
async def get_ollama_models(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    hf_hub_path = "/root/.cache/huggingface/hub"
    models = []
    
    if os.path.exists(hf_hub_path):
        try:
            for item in os.listdir(hf_hub_path):
                if item.startswith("models--") and os.path.isdir(os.path.join(hf_hub_path, item)):
                    parts = item.split("--")[1:]
                    if len(parts) >= 2:
                        org = parts[0]
                        repo = "--".join(parts[1:])
                        models.append(f"{org}/{repo}")
                    elif len(parts) == 1:
                        models.append(parts[0])
        except Exception as e:
            print(f"Error scanning HuggingFace cache: {e}")
            
    # Fallback to defaults if no models are detected in directory
    if not models:
        models = [
            "hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4",
            "neuralmagic/Llama-3.2-3B-Instruct-FP8"
        ]
        
    return {"status": "success", "models": models}

@router.get("/health")
async def get_health_status(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_role(["super_admin", "admin"]))
):
    status = {
        "database": "offline",
        "redis": "offline",
        "celery_workers": 0,
        "overall": "unhealthy"
    }

    # 1. Check Database (with timeout-like behavior)
    try:
        # Use a simple query that is fast
        db.execute(text("SELECT 1"))
        status["database"] = "online"
    except Exception as e:
        print(f"Health Check - DB Error: {str(e)}")
        status["database"] = "error"

    # 2. Check Redis (with 1s timeout)
    try:
        redis_client = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        if redis_client.ping():
            status["redis"] = "online"
            
            # 3. Check Celery Workers via Redis
            # In Celery, workers often register themselves in Redis
            # For now, we still mock it to 1 if Redis is up, but we could do more
            status["celery_workers"] = 1
    except Exception as e:
        print(f"Health Check - Redis Error: {str(e)}")
        status["redis"] = "error"

    if status["database"] == "online" and status["redis"] == "online":
        status["overall"] = "healthy"
    elif status["database"] == "error" or status["redis"] == "error":
        status["overall"] = "unhealthy"

    return status

@router.get("/system-stats")
async def get_system_stats(current_user: User = Depends(deps.require_role(["super_admin", "admin"]))):

    cpu_usage = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = shutil.disk_usage("/")

    return {
        "cpu_percent": cpu_usage,
        "memory": {
            "percent": memory.percent,
            "total_gb": round(memory.total / (1024**3), 2),
            "used_gb": round(memory.used / (1024**3), 2)
        },
        "disk": {
            "percent": round((disk.used / disk.total) * 100, 2),
            "total_gb": round(disk.total / (1024**3), 2),
            "used_gb": round(disk.used / (1024**3), 2)
        },
        "timestamp": time.time()
    }

class ApplyModelRequest(BaseModel):
    model: str

@router.post("/apply-model")
async def apply_model(req: ApplyModelRequest, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    model_name = req.model.strip()
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name is required")

    # Ensure cache directory exists and write model to active_model.txt
    cache_dir = "/root/.cache/huggingface"
    try:
        os.makedirs(cache_dir, exist_ok=True)
        active_model_file = os.path.join(cache_dir, "active_model.txt")
        with open(active_model_file, "w") as f:
            f.write(model_name)
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to write model to config cache directory: {e}"
        )

    # Update .env file in /app/.env
    env_path = "/app/.env"
    if not os.path.exists(env_path):
        env_path = ".env"
    
    env_updated = False
    if os.path.exists(env_path):
        try:
            with open(env_path, "r") as f:
                lines = f.readlines()
                
            updated = False
            for i, line in enumerate(lines):
                if line.strip().startswith("LOCAL_LLM_MODEL="):
                    lines[i] = f"LOCAL_LLM_MODEL={model_name}\n"
                    updated = True
                    break
            
            if not updated:
                lines.append(f"\nLOCAL_LLM_MODEL={model_name}\n")
                
            with open(env_path, "w") as f:
                f.writelines(lines)
            env_updated = True
        except Exception as e:
            print(f"Warning: Failed to update .env file: {e}")

    # Call Docker API over UNIX socket to restart container
    uds_path = "/var/run/docker.sock"
    container_restarted = False
    uds_message = ""
    
    if os.path.exists(uds_path):
        try:
            transport = httpx.AsyncHTTPTransport(uds=uds_path)
            async with httpx.AsyncClient(transport=transport) as client:
                response = await client.post("http://localhost/containers/aiaudit-vllm/restart", timeout=30.0)
                if response.status_code == 204:
                    container_restarted = True
                    uds_message = "Container restart request successfully sent via Docker socket."
                else:
                    uds_message = f"Docker daemon returned error status {response.status_code}."
        except Exception as e:
            uds_message = f"Error sending restart to Docker socket: {e}"
    else:
        uds_message = "Docker UNIX socket not found. Manual container restart required."

    return {
        "status": "success",
        "message": f"Successfully updated target model to {model_name}.",
        "env_updated": env_updated,
        "container_restarted": container_restarted,
        "details": uds_message
    }

@router.get("/model-status")
async def get_model_status(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    target_model = "Unknown"
    active_model = None
    container_state = "unknown"
    status = "offline"
    
    # 1. Read target model from active_model.txt
    active_model_file = "/root/.cache/huggingface/active_model.txt"
    if os.path.exists(active_model_file):
        try:
            with open(active_model_file, "r") as f:
                target_model = f.read().strip()
        except Exception as e:
            print(f"Error reading target model file: {e}")
    else:
        # Fallback to env variable
        target_model = os.getenv("LOCAL_LLM_MODEL", "hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4")

    # 2. Check container status via Docker UDS
    uds_path = "/var/run/docker.sock"
    if os.path.exists(uds_path):
        try:
            transport = httpx.AsyncHTTPTransport(uds=uds_path)
            async with httpx.AsyncClient(transport=transport) as client:
                response = await client.get("http://localhost/containers/aiaudit-vllm/json")
                if response.status_code == 200:
                    data = response.json()
                    container_state = data.get("State", {}).get("Status", "unknown")
                elif response.status_code == 404:
                    container_state = "not_found"
        except Exception as e:
            print(f"Error checking container status from Docker socket: {e}")
            container_state = "socket_error"
    else:
        container_state = "no_socket"

    # 3. Check vLLM API server health
    vllm_api_base = os.getenv("LOCAL_LLM_API_BASE", "http://vllm:8899/v1")
    vllm_url = f"{vllm_api_base}/models"
    
    is_vllm_responsive = False
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(vllm_url, timeout=2.0)
            if response.status_code == 200:
                is_vllm_responsive = True
                models_data = response.json()
                if models_data.get("data"):
                    active_model = models_data["data"][0].get("id")
    except Exception:
        pass

    # 4. Resolve status state
    if is_vllm_responsive:
        status = "healthy"
    elif container_state in ["running", "restarting"]:
        status = "loading"
    else:
        status = "offline"

    return {
        "status": status,
        "container_state": container_state,
        "target_model": target_model,
        "active_model": active_model or (target_model if status == "healthy" else None),
    }
