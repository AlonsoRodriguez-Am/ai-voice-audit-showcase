from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas.evaluation import EvaluationUpdate
from app.services import evaluation_service
from app.api import deps
import logging
from app.core.error_responses import ERROR_RESPONSES
import os
import tempfile
from celery import chain
from app.tasks.evaluation_tasks import transcribe_audio_task, analyze_transcript_task
from app.core.celery_app import celery_app

from app.models.evaluation import Evaluation
from app.models.lob import LOB

logger = logging.getLogger(__name__)

# Router prefix is set in main.py as /api/evaluation
router = APIRouter()

@router.get("/recent",
            summary="Get Recent Evaluations",
            response_model=List[dict])
def get_recent_evaluations(
    limit: int = Query(5, description="Number of recent evaluations to fetch"),
    db: Session = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Get the most recent evaluations for the current user's tenant.
    """
    evaluations = db.query(Evaluation)\
        .filter(Evaluation.tenant_id == current_user.tenant_id)\
        .order_by(Evaluation.evaluation_date.desc(), Evaluation.id.desc())\
        .limit(limit)\
        .all()

    result = []
    for ev in evaluations:
        lob_name = "General"
        if ev.lob_id:
            lob = db.query(LOB).filter(LOB.id == ev.lob_id).first()
            if lob:
                lob_name = lob.name

        score = ev.final_score if ev.final_score is not None else ev.initial_score or 0

        result.append({
            "id": ev.id,
            "call_id": ev.call_id,
            "eval_call_uid": ev.eval_call_uid,
            "lob_name": lob_name,
            "score": score,
            "date": ev.evaluation_date.isoformat() if ev.evaluation_date else None,
            "had_error": ev.had_error,
            "eval_model": ev.eval_model,
            "eval_provider": ev.eval_provider,
        })
    return result

@router.get("/{evaluation_id}",
            summary="Get Evaluation Details",
            responses={404: ERROR_RESPONSES[404]})
def get_evaluation(
    evaluation_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Get full evaluation details (transcript, answers, score, lob).
    """
    details = evaluation_service.get_evaluation_details(db, evaluation_id, current_user)
    if not details:
        raise HTTPException(status_code=404, detail="Evaluation not found or access denied")
    return details

@router.post("/save",
             summary="Save Manual Evaluation",
             responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403], 404: ERROR_RESPONSES[404]})
def save_evaluation(
    data: EvaluationUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(deps.require_role(['admin', 'qa_manager', 'analyst']))
):
    """
    Save the final score and answers for an evaluation after manual review.
    """
    user_role = current_user.role.lower().replace(' ', '_')
    evaluation_service.save_evaluation(
        db, data.evaluation_id, data.final_score, data.ttch, data.final_answers, data.human_observations, current_user, user_role
    )
    return {"success": True, "message": "Evaluation updated successfully."}


@router.post("/process-audio",
             summary="Process Audio File",
             responses={401: ERROR_RESPONSES[401], 400: ERROR_RESPONSES[400]})
async def process_audio(
    file: UploadFile = File(..., description="The audio file to process (wav/mp3)"),
    lob_id: Optional[int] = Query(None, description="Line of Business ID"),
    eval_call_uid: Optional[str] = Query(None, description="Unique call UID (frontend-generated)"),
    db: Session = Depends(get_db),
    current_user = Depends(deps.require_role(['admin', 'qa_manager', 'analyst']))
):
    """
    Upload an audio recording to be transcribed and analyzed asynchronously by AI.
    """
    logger.info(f"Received audio process request: {file.filename}, LOB: {lob_id}, User: {current_user.email}, UID: {eval_call_uid}")

    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)

    file_extension = os.path.splitext(file.filename)[1]
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension, dir=upload_dir)
    content = await file.read()
    temp_file.write(content)
    temp_file.close()

    call_id = os.path.splitext(file.filename)[0]

    task_chain = chain(
        transcribe_audio_task.s(
            temp_file.name,
            lob_id,
            current_user.id,
            current_user.tenant_id,
            call_id,
            eval_call_uid,
        ),
        analyze_transcript_task.s()
    ).apply_async()

    return {"status": "PENDING", "task_id": task_chain.id, "eval_call_uid": eval_call_uid}


@router.get("/task-status/{task_id}",
            summary="Get Task Status",
            responses={404: ERROR_RESPONSES[404]})
async def get_task_status(
    task_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Check the status of a background audio processing task.
    Returns rich stage metadata including partial_transcript and criteria_so_far.
    """
    task_result = celery_app.AsyncResult(task_id)

    response = {
        "task_id": task_id,
        "status": task_result.status,
    }

    if task_result.status == 'SUCCESS':
        eval_info = task_result.result
        if isinstance(eval_info, dict) and eval_info.get("status") == "FAILURE":
            response["status"] = "FAILURE"
            response["error"] = eval_info.get("error", "Internal task failure")
        elif isinstance(eval_info, dict) and "evaluation_id" in eval_info:
            details = evaluation_service.get_evaluation_details(db, eval_info["evaluation_id"], current_user)
            if details:
                response["result"] = details
                # Include metadata from task result
                response["eval_call_uid"] = eval_info.get("eval_call_uid")
                response["eval_model"] = eval_info.get("eval_model")
                response["eval_provider"] = eval_info.get("eval_provider")
            else:
                response["status"] = "FAILURE"
                response["error"] = "Evaluation record found but details could not be retrieved."
        else:
            response["status"] = "FAILURE"
            response["error"] = "Task completed but returned an invalid result format."
    elif task_result.status == 'FAILURE':
        response["error"] = str(task_result.info)
    elif task_result.status == 'PROGRESS':
        meta = task_result.info or {}
        response["meta"] = meta
        # Surface key fields at top level for easy frontend access
        response["stage"] = meta.get("stage", 0)
        response["stage_label"] = meta.get("stage_label", "")
        response["stage_sub"] = meta.get("stage_sub", "")
        response["progress_pct"] = meta.get("progress_pct", 0)
        response["message"] = meta.get("message", "")
        response["partial_transcript"] = meta.get("partial_transcript", "")
        response["criteria_so_far"] = meta.get("criteria_so_far", {})
        response["criteria_done"] = meta.get("criteria_done", 0)
        response["total_criteria"] = meta.get("total_criteria", 0)
        response["latest_criterion"] = meta.get("latest_criterion", "")
        response["eval_model"] = meta.get("eval_model", "")
        response["eval_provider"] = meta.get("eval_provider", "")

    return response


@router.post("/cancel-task/{task_id}",
             summary="Cancel a Running Task",
             responses={404: ERROR_RESPONSES[404]})
async def cancel_task(
    task_id: str,
    current_user = Depends(deps.get_current_user)
):
    """
    Revoke and terminate a running Celery task.
    """
    celery_app.control.revoke(task_id, terminate=True, signal='SIGKILL')
    return {"success": True, "message": f"Task {task_id} revocation signal sent."}


@router.post("/{evaluation_id}/assign-lob",
             summary="Assign LOB to Evaluation",
             responses={404: ERROR_RESPONSES[404]})
def assign_lob(
    evaluation_id: int,
    lob_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Manually assign or change the Line of Business associated with an evaluation record.
    """
    evaluation_service.assign_lob(db, evaluation_id, lob_id, current_user)
    return {"success": True}


@router.post("/process-bulk-audio",
             summary="Process Bulk Audio",
             responses={400: ERROR_RESPONSES[400]})
async def process_bulk_audio(
    files: List[UploadFile] = File(..., description="List of audio files (max 10)"),
    lob_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(deps.require_role(['admin', 'qa_manager', 'analyst']))
):
    """
    Upload multiple audio files for parallel background processing.
    """
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files selected")
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Cannot process more than 10 files at a time")

    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)

    task_ids = []
    for file in files:
        file_extension = os.path.splitext(file.filename)[1]
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension, dir=upload_dir)
        content = await file.read()
        temp_file.write(content)
        temp_file.close()

        call_id = os.path.splitext(file.filename)[0]

        task_chain = chain(
            transcribe_audio_task.s(
                temp_file.name,
                lob_id,
                current_user.id,
                current_user.tenant_id,
                call_id,
                None,  # no eval_call_uid for bulk
            ),
            analyze_transcript_task.s()
        ).apply_async()
        task_ids.append({"filename": file.filename, "task_id": task_chain.id})

    return {"status": "PENDING", "tasks": task_ids}
