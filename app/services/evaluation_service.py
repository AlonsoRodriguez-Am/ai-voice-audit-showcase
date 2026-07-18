import os
import time
import tempfile
import json
from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile
from app.models.lob import LOB
from app.models.evaluation import Evaluation
from app.models.user import User
from app.core.config import settings
from app.services.llm_service import get_llm_provider
import hashlib
from app.models.tenant import Tenant
from app.models.pii_audit_log import PIIAuditLog
from app.core.pii_redactor import PIIRedactor

# We'll expect STT_MODEL to be passed or accessible
STT_MODEL = None

def set_stt_model(model):
    global STT_MODEL
    STT_MODEL = model

async def analyze_call_locally(db: Session, file: UploadFile, current_user: User, lob_id: int = None, llm_provider=None):
    call_id = os.path.splitext(file.filename)[0]
    filepath = None
    start_time = time.time()
    
    try:
        # Fetch Active LOB (filtered by tenant)
        if lob_id:
            lob = db.query(LOB).filter(LOB.id == lob_id, LOB.is_active == True, LOB.tenant_id == current_user.tenant_id).first()
            if not lob:
                raise ValueError(f"Selected LOB (ID: {lob_id}) is not active or not found for this tenant.")
        else:
            lob = db.query(LOB).filter(LOB.is_active == True, LOB.tenant_id == current_user.tenant_id).first()
            if not lob:
                raise ValueError("No active Line of Business (LOB) found for this tenant.")
            
        lob_id = lob.id
        lob_name = lob.name
        system_prompt = lob.system_prompt
        lob_criteria = lob.criteria_json

        print(f"Using LOB: {lob_name} (ID: {lob_id})")

        # 1. Save temp file for processing
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            content = await file.read()
            tmp.write(content)
            filepath = tmp.name

        # 2. Transcription (Local via Faster-Whisper)
        print(f"Transcribing file: {filepath}")
        if STT_MODEL is None:
             raise ValueError("STT Model not initialized")
             
        segments, info = STT_MODEL.transcribe(filepath, beam_size=5)
        
        segments_data = []
        full_transcript = ""
        for i, segment in enumerate(segments):
            timestamp = f"[{segment.start:.2f}s - {segment.end:.2f}s]"
            text = segment.text.strip()
            segments_data.append({"id": i, "timestamp": timestamp, "text": text})
            full_transcript += f"{i}. {timestamp}: {text}\n"

        # 3. Analysis via LLM (NOW DYNAMIC)
        print("Analyzing transcript via LLM...")
        
        # Get LLM provider from LOB config or use passed provider
        if not llm_provider:
            if lob and lob.criteria_json and "llm_config" in lob.criteria_json:
                llm_config = lob.criteria_json["llm_config"]
                llm_provider = get_llm_provider(llm_config)
            else:
                llm_provider = get_llm_provider(None)

        detailed_criteria = []
        ai_evaluation_keys = []
        manual_evaluation_keys = []

        for key, details in lob_criteria.items():
            # Skip llm_config key — it's not a criterion
            if key == "llm_config":
                continue
            if details.get("manual_score_required", False):
                manual_evaluation_keys.append(key)
            else:
                ai_evaluation_keys.append(key)
                ctx = details.get("context", "Evaluate based on standard professional call center protocols.")
                detailed_criteria.append(f"- {key}: {details['question']}\n  Context/Rules: {ctx}")
        
        user_prompt = f"Transcript:\n{full_transcript}\n\nCriteria to evaluate:\n" + "\n".join(detailed_criteria)
        
        dynamic_evaluations_json = ",\n".join(
            [f'    "{key}": {{"answer": "Yes/No/N/A", "explanation": "Specific reason from transcript"}}' for key in ai_evaluation_keys]
        )
        
        enforced_json_instructions = (
            "\n\nOUTPUT FORMAT:\n"
            "You MUST respond ONLY with a JSON object in this exact format. Output nothing else:\n"
            "{\n"
            "  \"topics\": \"comma, separated, list, of, topics\",\n"
            "  \"speaker_map\": {\"0\": \"Agent\", \"1\": \"Customer\"},\n"
            "  \"evaluations\": {\n"
            f"{dynamic_evaluations_json}\n"
            "  }\n"
            "}\n"
            "Identify speakers based on context (e.g., initial greeting is the Agent)."
        )
        
        system_prompt_to_use = system_prompt
        if "OUTPUT FORMAT:" not in system_prompt_to_use:
            system_prompt_to_use += enforced_json_instructions

        response = await llm_provider.chat([
            {'role': 'system', 'content': system_prompt_to_use},
            {'role': 'user', 'content': user_prompt},
        ])

        ai_raw_content = response['content']
        
        try:
            if "{" in ai_raw_content:
                json_start = ai_raw_content.find("{")
                json_end = ai_raw_content.rfind("}") + 1
                ai_raw_analysis = json.loads(ai_raw_content[json_start:json_end])
            else:
                raise ValueError("No JSON object found in response")
        except Exception as e:
            print(f"LLM Parsing Error: {e}")
            ai_raw_analysis = {"topics": "General Inquiry", "evaluations": {}, "speaker_map": {}}

        evaluation_details, ai_predictions, ai_reasoning = [], {}, {}
        ai_evals = ai_raw_analysis.get("evaluations", {})
        
        na_keywords = [
            'not applicable', 'not necessary', 'no payment was attempted', 'was not required', 
            'no payment was discussed', 'hipaa was not applicable', 'not seeking phi', 'general inquiry'
        ]

        for key in ai_evaluation_keys:
            raw_item = ai_evals.get(key, {})
            if isinstance(raw_item, str):
                prediction, explanation = raw_item.capitalize(), "Simple response from AI."
            else:
                prediction = str(raw_item.get("answer", "No")).capitalize()
                explanation = str(raw_item.get("explanation", "No explanation provided."))
            
            if prediction not in ["Yes", "No", "N/A"]:
                prediction = "No"

            if prediction == 'No' and any(kw in explanation.lower() for kw in na_keywords):
                prediction = 'N/A'

            points_value = float(lob_criteria[key].get('points', 0))
            is_mandatory = lob_criteria[key].get('mandatory', False)

            evaluation_details.append({
                "key": key, 
                "question": lob_criteria[key]['question'], 
                "prediction": prediction, 
                "explanation": explanation, 
                "points": points_value,
                "mandatory": is_mandatory
            })
            ai_predictions[key], ai_reasoning[key] = prediction, explanation

        for key in manual_evaluation_keys:
            points_value = float(lob_criteria[key].get('points', 0))
            is_mandatory = lob_criteria[key].get('mandatory', False)
            
            evaluation_details.append({
                "key": key, 
                "question": lob_criteria[key]['question'], 
                "prediction": "N/A", 
                "explanation": "Manual score required.", 
                "points": points_value,
                "mandatory": is_mandatory
            })
            ai_predictions[key] = 'N/A'

        # Scoring Logic
        applicable_points = 0
        earned_points = 0
        fallback_count = 0
        fallback_earned = 0
        has_valid_points = False
        
        for key, prediction in ai_predictions.items():
            if prediction != 'N/A':
                pts = float(lob_criteria[key].get('points', 0))
                if pts > 0:
                    has_valid_points = True
                    applicable_points += pts
                    if prediction == 'Yes':
                        earned_points += pts
                else:
                    fallback_count += 1
                    if prediction == 'Yes':
                        fallback_earned += 1
                    
        if has_valid_points:
            initial_score = round((earned_points / applicable_points) * 100) if applicable_points > 0 else 100
        else:
            initial_score = round((fallback_earned / fallback_count) * 100) if fallback_count > 0 else 100

        ttca_seconds = round(time.time() - start_time)
        detected_language = info.language
        topics = ai_raw_analysis.get("topics", "General Inquiry")

        speaker_map = ai_raw_analysis.get("speaker_map", {})
        labeled_transcript = ""
        for seg in segments_data:
            speaker = speaker_map.get(str(seg['id']), speaker_map.get(seg['id'], "Speaker"))
            labeled_transcript += f"{seg['timestamp']}: {speaker}: {seg['text']}\n"
        
        # 3.5. PII Redaction
        print("Applying PII Redaction if enabled...")
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        pii_config = tenant.pii_config if tenant and tenant.pii_config else {
            "enabled": True,
            "enabled_types": ["phone", "email", "ssn", "credit_card"],
            "redaction_token": "***REDACTED***",
            "log_redactions": True,
            "names_enabled": False,
        }

        redacted_transcript = labeled_transcript
        redacted_count = 0
        redacted_types = {}
        redaction_log = []
        original_hash = hashlib.sha256(labeled_transcript.encode()).hexdigest()

        if pii_config.get("enabled", True):
            redactor = PIIRedactor(pii_config)
            redacted_transcript, redaction_log = redactor.redact_text(labeled_transcript)
            redacted_count = len(redaction_log)
            redacted_types = redactor.get_redaction_stats(redaction_log)

        # 4. Save to Database
        db_eval = Evaluation(
            call_id=call_id,
            lob_id=lob_id,
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            full_transcript=redacted_transcript,
            detected_language=detected_language,
            topics=topics,
            ttca_seconds=ttca_seconds,
            # AI Predictions
            greeting_ai=ai_predictions.get('greeting'),
            hipaa_verification_ai=ai_predictions.get('hipaa_verification'),
            resolve_concern_ai=ai_predictions.get('resolve_concern'),
            pci_compliance_ai=ai_predictions.get('pci_compliance'),
            call_closing_ai=ai_predictions.get('call_closing'),
            professionalism_ai=ai_predictions.get('professionalism'),
            call_management_ai=ai_predictions.get('call_management'),
            documentation_ai=ai_predictions.get('documentation'),
            # AI Reasoning
            greeting_reasoning=ai_reasoning.get('greeting'),
            hipaa_verification_reasoning=ai_reasoning.get('hipaa_verification'),
            resolve_concern_reasoning=ai_reasoning.get('resolve_concern'),
            pci_compliance_reasoning=ai_reasoning.get('pci_compliance'),
            call_closing_reasoning=ai_reasoning.get('call_closing'),
            professionalism_reasoning=ai_reasoning.get('professionalism'),
            call_management_reasoning=ai_reasoning.get('call_management'),
            documentation_reasoning=ai_reasoning.get('documentation'),
            # PII Fields
            pii_redacted=redacted_count > 0,
            redacted_count=redacted_count,
            redacted_types=redacted_types,
            redaction_log=redaction_log if pii_config.get("log_redactions", True) else None,
            original_transcript_hash=original_hash
        )
        db.add(db_eval)
        db.commit()
        db.refresh(db_eval)

        # 4.5. Save PII Audit Logs
        if redacted_count > 0 and pii_config.get("log_redactions", True):
            for entry in redaction_log:
                audit_log = PIIAuditLog(
                    tenant_id=current_user.tenant_id,
                    evaluation_id=db_eval.id,
                    redacted_type=entry["type"],
                    redacted_value_hash=entry["hash"],
                    user_id=current_user.id
                )
                db.add(audit_log)
            db.commit()

        return {
            "status": "success", 
            "data": {
                "evaluation_id": db_eval.id, 
                "call_id": call_id, 
                "initial_score": initial_score, 
                "transcript": redacted_transcript, 
                "details": evaluation_details, 
                "topics": topics, 
                "language": detected_language, 
                "ttca": ttca_seconds
            }
        }

    except Exception as e:
        error_message = str(e)
        print(f"Error in analyze_call_locally: {error_message}")
        
        db_eval_error = Evaluation(
            call_id=call_id,
            tenant_id=current_user.tenant_id,
            had_error=True,
            error_message=error_message
        )
        db.add(db_eval_error)
        db.commit()
        
        return {"status": "error", "message": error_message}
    
    finally:
        if filepath and os.path.exists(filepath): os.remove(filepath)

def save_evaluation(db: Session, eval_id: int, final_score: int, ttch: int, final_answers: dict, human_observations: str, current_user: User, user_role: str):
    eval_record = db.query(Evaluation).filter(Evaluation.id == eval_id, Evaluation.tenant_id == current_user.tenant_id).first()
    if not eval_record:
        raise HTTPException(status_code=404, detail="Evaluation not found or access denied")
    
    if user_role == 'analyst' and eval_record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions to edit this evaluation")

    eval_record.final_score = final_score
    eval_record.ttch_seconds = ttch
    eval_record.had_error = False
    eval_record.human_observations = human_observations
    
    # Store dynamic answers in JSONB
    eval_record.final_answers_json = final_answers
    
    # Backward compatibility for legacy columns (Extract 'answer' if it's a dict)
    def get_ans(k):
        v = final_answers.get(k)
        if isinstance(v, dict): return v.get('answer')
        return v

    eval_record.greeting = get_ans('greeting')
    eval_record.hipaa_verification = get_ans('hipaa_verification')
    eval_record.resolve_concern = get_ans('resolve_concern')
    eval_record.pci_compliance = get_ans('pci_compliance')
    eval_record.call_closing = get_ans('call_closing')
    eval_record.professionalism = get_ans('professionalism')
    eval_record.call_management = get_ans('call_management')
    eval_record.documentation = get_ans('documentation')
    
    db.commit()
    return True

def assign_lob(db: Session, eval_id: int, lob_id: int, current_user: User):
    eval_record = db.query(Evaluation).filter(Evaluation.id == eval_id, Evaluation.tenant_id == current_user.tenant_id).first()
    if not eval_record:
        raise HTTPException(status_code=404, detail="Evaluation not found or access denied")
    
    lob = db.query(LOB).filter(LOB.id == lob_id, LOB.tenant_id == current_user.tenant_id).first()
    if not lob:
        raise HTTPException(status_code=404, detail="LOB not found or access denied")
        
    eval_record.lob_id = lob_id
    db.commit()
    return True
def get_evaluation_details(db: Session, eval_id: int, current_user: User):
    eval_record = db.query(Evaluation).filter(Evaluation.id == eval_id, Evaluation.tenant_id == current_user.tenant_id).first()
    if not eval_record:
        return None
    
    lob = db.query(LOB).filter(LOB.id == eval_record.lob_id).first()
    lob_criteria = lob.criteria_json if lob else {}
    
    final_answers = {}
    
    # Try reading from dynamic JSONB columns first (New records)
    # Prefer manual overrides (final_answers_json) if available
    preds = eval_record.final_answers_json or eval_record.ai_predictions_json
    
    if preds:
        reasons = eval_record.ai_reasoning_json or {}
        for key in preds:
            if key == "llm_config": continue
            
            # For final_answers_json, the value might be a string (answer) or an object (answer + justification)
            val = preds[key]
            if isinstance(val, dict):
                final_answers[key] = {
                    "answer": str(val.get("answer", "")).lower(),
                    "justification": str(val.get("justification", reasons.get(key, "No explanation provided.")))
                }
            else:
                final_answers[key] = {
                    "answer": str(val).lower(),
                    "justification": str(reasons.get(key, "No explanation provided."))
                }
    else:
        # Fallback to legacy hardcoded columns (Old records)
        criteria_keys = [
            'greeting', 'hipaa_verification', 'resolve_concern', 'pci_compliance', 
            'call_closing', 'professionalism', 'call_management', 'documentation'
        ]
        for key in criteria_keys:
            ans = getattr(eval_record, f"{key}_ai")
            reason = getattr(eval_record, f"{key}_reasoning", "No explanation provided.")
            if ans:
                final_answers[key] = {
                    "answer": ans.lower(),
                    "justification": reason
                }
            
    return {
        "evaluation_id": eval_record.id,
        "call_id": eval_record.call_id,
        "eval_call_uid": eval_record.eval_call_uid,
        "eval_model": eval_record.eval_model,
        "eval_provider": eval_record.eval_provider,
        "eval_params_json": eval_record.eval_params_json,
        "eval_started_at": eval_record.eval_started_at.isoformat() if eval_record.eval_started_at else None,
        "final_score": eval_record.final_score or eval_record.initial_score or 0,
        "initial_score": eval_record.initial_score or 0,
        "transcript": eval_record.full_transcript,
        "final_answers": final_answers,
        "topics": eval_record.topics,
        "language": eval_record.detected_language,
        "ttca_seconds": eval_record.ttca_seconds or 0,
        "ttch": eval_record.ttch_seconds or 0,
        "pii_redacted": eval_record.pii_redacted,
        "redacted_count": eval_record.redacted_count,
        "redacted_types": eval_record.redacted_types,
        "human_observations": eval_record.human_observations,
        "call_summary": getattr(eval_record, 'call_summary', None),
    }
