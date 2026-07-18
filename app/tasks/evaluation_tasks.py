# app/tasks/evaluation_tasks.py
import os
from app.core.init_models import initialize_whisper, initialize_ollama_host
import time
import json
import asyncio
import re
import datetime
from celery import shared_task
from sqlalchemy.orm import Session
from faster_whisper import WhisperModel

from app.core.database import SessionLocal
from app.models.lob import LOB
from app.models.evaluation import Evaluation
from app.models.token_usage import TokenUsage
from app.models.user import User
from app.core.config import settings
from app.services.llm_service import get_llm_provider
from app.core.encryption import decrypt_api_key, is_encrypted
import hashlib
from app.models.tenant import Tenant
from app.models.pii_audit_log import PIIAuditLog
from app.core.pii_redactor import PIIRedactor

# Global STT model instance for the worker
STT_MODEL = None

def get_stt_model(model_size="tiny"):
    global STT_MODEL
    if STT_MODEL is None or getattr(STT_MODEL, '_model_size', None) != model_size:
        STT_MODEL = initialize_whisper(model_size)
        STT_MODEL._model_size = model_size
    return STT_MODEL

# Initialize Ollama host for networking
initialize_ollama_host()


def _get_llm_provider_for_lob(lob):
    llm_config = None
    if lob.criteria_json and "llm_config" in lob.criteria_json:
        llm_config = lob.criteria_json["llm_config"].copy()
        if llm_config.get("api_key") and is_encrypted(llm_config["api_key"]):
            try:
                llm_config["api_key"] = decrypt_api_key(llm_config["api_key"])
            except ValueError:
                llm_config["api_key"] = ""
    return get_llm_provider(llm_config)


def _get_llm_meta_for_lob(lob):
    """Extract model/provider info and params from LOB config for traceability."""
    if not lob or not lob.criteria_json or "llm_config" not in lob.criteria_json:
        return {"model": "llama3.2", "provider": "ollama", "params": {}}
    cfg = lob.criteria_json["llm_config"]
    provider = cfg.get("provider", "ollama")
    model = cfg.get("model", cfg.get("model_name", "llama3.2"))
    params = {k: v for k, v in cfg.items() if k not in ("api_key", "provider", "model", "model_name", "stt_model")}
    return {"model": model, "provider": provider, "params": params}


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)

def extract_json_from_text(text: str) -> dict | None:
    if not text: return None
    try: return json.loads(text.strip())
    except json.JSONDecodeError: pass
    try:
        match = re.search(r'(\{.*\})', text, re.DOTALL)
        if match: return json.loads(match.group(1))
    except (json.JSONDecodeError, AttributeError): pass
    try:
        cleaned = text.strip()
        if cleaned.startswith('```json'): cleaned = cleaned[7:]
        if cleaned.startswith('```'): cleaned = cleaned[3:]
        if cleaned.endswith('```'): cleaned = cleaned[:-3]
        return json.loads(cleaned.strip())
    except json.JSONDecodeError: pass
    return None


@shared_task(bind=True, name="app.tasks.evaluation_tasks.transcribe_audio_task", max_retries=3)
def transcribe_audio_task(self, filepath, lob_id, user_id, tenant_id, call_id, eval_call_uid=None):
    db = SessionLocal()
    start_time = time.time()
    try:
        # Stage 1: In Queue → picking up worker
        self.update_state(state='PROGRESS', meta={
            'stage': 1,
            'stage_label': 'In Queue',
            'stage_sub': 'Waiting for AI worker',
            'progress_pct': 5,
            'message': 'Waiting for AI worker...'
        })

        lob = db.query(LOB).filter(LOB.id == lob_id).first()
        if not lob: lob = db.query(LOB).filter(LOB.is_active == True, LOB.tenant_id == tenant_id).first()
        if not lob: raise ValueError("No active LOB found.")

        llm_meta = _get_llm_meta_for_lob(lob)

        # Stage 2: STT transcribing
        self.update_state(state='PROGRESS', meta={
            'stage': 2,
            'stage_label': 'STT',
            'stage_sub': 'Transforming audio to text',
            'progress_pct': 15,
            'message': 'Transcribing audio with Whisper...',
            'eval_model': llm_meta['model'],
            'eval_provider': llm_meta['provider'],
        })

        stt_model_size = lob.criteria_json.get("llm_config", {}).get("stt_model", "tiny")
        stt_model = get_stt_model(stt_model_size)
        segments, info = stt_model.transcribe(filepath, beam_size=5)

        segments_data = []
        full_transcript = ""
        for i, segment in enumerate(segments):
            timestamp = f"[{segment.start:.2f}s - {segment.end:.2f}s]"
            text = segment.text.strip()
            segments_data.append({"id": i, "timestamp": timestamp, "text": text})
            full_transcript += f"{i}. {timestamp}: {text}\n"

        self.update_state(state='PROGRESS', meta={
            'stage': 2,
            'stage_label': 'STT Complete',
            'stage_sub': f'Detected language: {info.language}',
            'progress_pct': 35,
            'message': f'Transcription complete — {len(segments_data)} segments',
            'partial_transcript': full_transcript,
            'eval_model': llm_meta['model'],
            'eval_provider': llm_meta['provider'],
        })

        return {
            "filepath": filepath,
            "lob_id": lob.id,
            "user_id": user_id,
            "tenant_id": tenant_id,
            "call_id": call_id,
            "eval_call_uid": eval_call_uid,
            "full_transcript": full_transcript,
            "segments_data": segments_data,
            "detected_language": info.language,
            "start_time": start_time,
            "llm_meta": llm_meta,
        }
    except Exception as e:
        if os.path.exists(filepath): os.remove(filepath)
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()


@shared_task(bind=True, name="app.tasks.evaluation_tasks.analyze_transcript_task", max_retries=3)
def analyze_transcript_task(self, stt_result):
    if not stt_result: return {"status": "FAILURE", "error": "STT failed"}
    db = SessionLocal()
    try:
        llm_meta = stt_result.get("llm_meta", {"model": "unknown", "provider": "unknown", "params": {}})

        self.update_state(state='PROGRESS', meta={
            'stage': 3,
            'stage_label': 'AI Analysis',
            'stage_sub': 'Scoring against criteria',
            'progress_pct': 40,
            'message': 'Step 2/2: AI Analysis & Finalizing...',
            'partial_transcript': stt_result.get("full_transcript", ""),
            'eval_model': llm_meta['model'],
            'eval_provider': llm_meta['provider'],
        })

        tenant = db.query(Tenant).filter(Tenant.id == stt_result["tenant_id"]).first()
        lob = db.query(LOB).filter(LOB.id == stt_result["lob_id"]).first()
        llm_provider = _get_llm_provider_for_lob(lob)

        # PII Redaction BEFORE sending to LLM
        redactor = PIIRedactor(tenant.pii_config if tenant else {})
        redaction_log = []
        redacted_full_transcript = ""

        for seg in stt_result["segments_data"]:
            redacted_text, log = redactor.redact_text(seg["text"])
            seg["text"] = redacted_text
            redaction_log.extend(log)
            redacted_full_transcript += f"{seg['id']}. {seg['timestamp']}: {redacted_text}\n"

        detailed_criteria = []
        ai_evaluation_keys, manual_evaluation_keys = [], []
        for key, details in lob.criteria_json.items():
            if key == "llm_config": continue
            if details.get("manual_score_required", False): manual_evaluation_keys.append(key)
            else:
                ai_evaluation_keys.append(key)
                ctx = details.get("context", "Evaluate based on protocols.")
                detailed_criteria.append(f"- {key}: {details['question']}\n  Rules: {ctx}")

        user_prompt = f"Transcript:\n{redacted_full_transcript}\n\nCriteria:\n" + "\n".join(detailed_criteria)
        dynamic_evaluations_json = ",\n".join([f'    "{key}": {{"answer": "Yes/No/N/A", "explanation": "..."}}' for key in ai_evaluation_keys])

        system_prompt = lob.system_prompt + f"\n\nOUTPUT FORMAT (JSON ONLY):\n{{\"evaluations\": {{\n{dynamic_evaluations_json}\n}}, \"topics\": \"...\", \"speaker_map\": {{}} }}"

        self.update_state(state='PROGRESS', meta={
            'stage': 3,
            'stage_label': 'AI Analysis',
            'stage_sub': f'Evaluating {len(ai_evaluation_keys)} criteria',
            'progress_pct': 50,
            'message': f'Evaluating {len(ai_evaluation_keys)} criteria...',
            'partial_transcript': stt_result.get("full_transcript", ""),
            'eval_model': llm_meta['model'],
            'eval_provider': llm_meta['provider'],
            'total_criteria': len(ai_evaluation_keys),
            'criteria_so_far': {},
        })

        response = _run_async(llm_provider.chat([
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt}
        ]))
        ai_raw_analysis = extract_json_from_text(response['content']) or {"topics": "General", "evaluations": {}, "speaker_map": {}}

        # Token usage
        usage = response.get('usage', {})
        p_tok, c_tok = usage.get('prompt_tokens', 0), usage.get('completion_tokens', 0)
        provider, model = response.get('provider', llm_meta['provider']), response.get('model', llm_meta['model'])
        cost = 0.0
        if provider == 'openai':
            if 'gpt-4o-mini' in model: cost = (p_tok/1e6 * 0.15) + (c_tok/1e6 * 0.60)
            elif 'gpt-4o' in model: cost = (p_tok/1e6 * 5.0) + (c_tok/1e6 * 15.0)

        token_record = TokenUsage(model_name=model, provider=provider, prompt_tokens=p_tok, completion_tokens=c_tok, estimated_cost=cost)
        db.add(token_record); db.commit()

        # Process results — build criteria_so_far progressively
        ai_predictions, ai_reasoning = {}, {}
        ai_evals = ai_raw_analysis.get("evaluations", {})
        criteria_so_far = {}

        for i, key in enumerate(ai_evaluation_keys):
            raw = ai_evals.get(key, {})
            if isinstance(raw, str):
                ai_predictions[key], ai_reasoning[key] = raw.capitalize(), "AI Answer."
            else:
                ai_predictions[key] = str(raw.get("answer", "No")).capitalize()
                ai_reasoning[key] = str(raw.get("explanation", "No reasoning.")).strip()

            criteria_so_far[key] = {
                "answer": ai_predictions[key].lower(),
                "justification": ai_reasoning[key],
            }

            # Emit progressive state per criterion
            pct = 50 + int((i + 1) / len(ai_evaluation_keys) * 40)
            self.update_state(state='PROGRESS', meta={
                'stage': 3,
                'stage_label': 'AI Analysis',
                'stage_sub': f'Criterion {i+1}/{len(ai_evaluation_keys)}: {key.replace("_", " ").title()}',
                'progress_pct': pct,
                'message': f'Analyzing: {key.replace("_", " ").title()}',
                'partial_transcript': stt_result.get("full_transcript", ""),
                'eval_model': llm_meta['model'],
                'eval_provider': llm_meta['provider'],
                'total_criteria': len(ai_evaluation_keys),
                'criteria_done': i + 1,
                'criteria_so_far': criteria_so_far,
                'latest_criterion': key,
            })

        for key in manual_evaluation_keys:
            ai_predictions[key], ai_reasoning[key] = 'N/A', 'Manual score required.'

        # Speaker mapping using already redacted segments
        speaker_map = ai_raw_analysis.get("speaker_map", {})
        labeled_transcript = ""
        for seg in stt_result["segments_data"]:
            speaker = speaker_map.get(str(seg['id']), speaker_map.get(seg['id'], "Speaker"))
            labeled_transcript += f"{seg['timestamp']}: {speaker}: {seg['text']}\n"

        # Score calculation
        app_pts, earned_pts = 0, 0
        for key, pred in ai_predictions.items():
            if pred != 'N/A':
                pts = float(lob.criteria_json.get(key, {}).get('points', 0))
                app_pts += pts
                if pred == 'Yes': earned_pts += pts
        initial_score = round((earned_pts / app_pts) * 100) if app_pts > 0 else 100

        # Stage 4: Finalizing
        self.update_state(state='PROGRESS', meta={
            'stage': 4,
            'stage_label': 'Finalizing',
            'stage_sub': 'Saving results to database',
            'progress_pct': 95,
            'message': 'Saving results...',
            'partial_transcript': stt_result.get("full_transcript", ""),
            'eval_model': llm_meta['model'],
            'eval_provider': llm_meta['provider'],
            'criteria_so_far': criteria_so_far,
        })

        eval_call_uid = stt_result.get("eval_call_uid")

        eval_record = Evaluation(
            call_id=stt_result["call_id"],
            lob_id=lob.id,
            user_id=stt_result["user_id"],
            tenant_id=stt_result["tenant_id"],
            full_transcript=labeled_transcript,
            detected_language=stt_result["detected_language"],
            topics=ai_raw_analysis.get("topics", "General Inquiry"),
            ttca_seconds=round(time.time() - stt_result["start_time"]),
            initial_score=initial_score,
            ai_predictions_json=ai_predictions,
            ai_reasoning_json=ai_reasoning,
            pii_redacted=len(redaction_log) > 0,
            redacted_count=len(redaction_log),
            original_transcript_hash=hashlib.sha256(stt_result["full_transcript"].encode()).hexdigest(),
            redacted_types=redactor.get_redaction_stats(redaction_log),
            redaction_log=redaction_log if (tenant.pii_config.get("log_redactions") if tenant else True) else None,
            # New metadata fields
            eval_call_uid=eval_call_uid,
            eval_model=llm_meta['model'],
            eval_provider=llm_meta['provider'],
            eval_params_json=llm_meta['params'],
            eval_started_at=datetime.datetime.utcfromtimestamp(stt_result["start_time"]),
        )
        db.add(eval_record); db.commit()

        if os.path.exists(stt_result["filepath"]): os.remove(stt_result["filepath"])
        return {
            "status": "SUCCESS",
            "evaluation_id": eval_record.id,
            "call_id": stt_result["call_id"],
            "eval_call_uid": eval_call_uid,
            "eval_model": llm_meta['model'],
            "eval_provider": llm_meta['provider'],
        }
    except Exception as e:
        if os.path.exists(stt_result["filepath"]): os.remove(stt_result["filepath"])
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()
