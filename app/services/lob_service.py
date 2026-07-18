from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.lob import LOB
from app.models.llm_audit_log import LLMAuditLog
from app.schemas.lob import LOBCreate, LOBUpdate
from app.core.encryption import encrypt_api_key, decrypt_api_key, is_encrypted
from fastapi import HTTPException
from sqlalchemy.orm.attributes import flag_modified
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def get_lobs(db: Session, tenant_id: int):
    return db.query(LOB).filter(or_(LOB.tenant_id == tenant_id, LOB.tenant_id == None)).order_by(LOB.id.asc()).all()

def create_lob(db: Session, lob_data: LOBCreate, tenant_id: int):
    db_lob = LOB(
        name=lob_data.name,
        tenant_id=tenant_id,
        system_prompt=lob_data.system_prompt,
        criteria_json=lob_data.criteria_json,
        is_builtin=False,
        is_active=lob_data.is_active
    )
    db.add(db_lob)
    try:
        db.commit()
        db.refresh(db_lob)
        return db_lob
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Template name already exists")

def activate_lob(db: Session, lob_id: int, tenant_id: int):
    lob = db.query(LOB).filter(LOB.id == lob_id, or_(LOB.tenant_id == tenant_id, LOB.tenant_id == None)).first()
    if not lob:
        raise HTTPException(status_code=404, detail="LOB not found")
    
    # Just activate selected without deactivating others
    lob.is_active = True
    db.commit()
    return True

def get_active_lobs(db: Session, tenant_id: int):
    return db.query(LOB).filter(LOB.is_active == True, or_(LOB.tenant_id == tenant_id, LOB.tenant_id == None)).order_by(LOB.id.asc()).all()

def update_lob(db: Session, lob_id: int, lob_data: LOBUpdate, tenant_id: int):
    lob = db.query(LOB).filter(LOB.id == lob_id, or_(LOB.tenant_id == tenant_id, LOB.tenant_id == None)).first()
    if not lob:
        raise HTTPException(status_code=404, detail="LOB not found")
    if lob.is_builtin:
        if lob_data.name is not None or lob_data.system_prompt is not None or lob_data.criteria_json is not None:
            raise HTTPException(status_code=400, detail="Cannot edit built-in templates (only activation status can be changed)")
    
    logger.info(f"DEBUG: Updating LOB {lob_id}. Name: {lob_data.name}, Active: {lob_data.is_active}")
    print(f"DEBUG: Updating LOB {lob_id}. Name: {lob_data.name}, Active: {lob_data.is_active}")
    
    if lob_data.name is not None: lob.name = lob_data.name
    if lob_data.system_prompt is not None: lob.system_prompt = lob_data.system_prompt
    
    if lob_data.criteria_json is not None:
        existing_criteria = lob.criteria_json or {}
        new_criteria = dict(lob_data.criteria_json)

        # Handle llm_config specially to preserve/encrypt API key
        if "llm_config" in new_criteria:
            llm_config = dict(new_criteria["llm_config"])
            old_llm_config = existing_criteria.get("llm_config", {})
            
            # If masked, restore old encrypted key
            if llm_config.get("api_key") == "••••••••":
                llm_config["api_key"] = old_llm_config.get("api_key")
            elif llm_config.get("api_key"):
                # New key provided, encrypt it
                try:
                    llm_config["api_key"] = encrypt_api_key(llm_config["api_key"])
                except ValueError:
                    pass
            new_criteria["llm_config"] = llm_config
        
        lob.criteria_json = new_criteria
        flag_modified(lob, "criteria_json")
        logger.info(f"DEBUG: New criteria keys: {list(new_criteria.keys())}")
        print(f"DEBUG: New criteria keys: {list(new_criteria.keys())}")
        
    if lob_data.is_active is not None: lob.is_active = lob_data.is_active
    
    try:
        db.add(lob)
        db.commit()
        db.refresh(lob)
        logger.info(f"DEBUG: LOB {lob_id} updated successfully")
        print(f"DEBUG: LOB {lob_id} updated successfully")
        return lob
    except Exception as e:
        db.rollback()
        logger.error(f"DEBUG: Error updating LOB {lob_id}: {str(e)}")
        print(f"DEBUG: Error updating LOB {lob_id}: {str(e)}")
        if "unique constraint" in str(e).lower() and "name" in str(e).lower():
            raise HTTPException(status_code=400, detail="LOB name already exists")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

def delete_lob(db: Session, lob_id: int, tenant_id: int):
    lob = db.query(LOB).filter(LOB.id == lob_id, or_(LOB.tenant_id == tenant_id, LOB.tenant_id == None)).first()
    if not lob:
        raise HTTPException(status_code=404, detail="LOB not found")
    if lob.is_builtin:
        raise HTTPException(status_code=400, detail="Cannot delete built-in templates")
    if lob.is_active:
        raise HTTPException(status_code=400, detail="Cannot delete active template")
    
    try:
        db.delete(lob)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Cannot delete LOB because it has associated evaluations")


def save_llm_config(db: Session, lob_id: int, llm_config: dict, tenant_id: int, manager_id: int):
    """Save LLM config to LOB's criteria_json (encrypt API key)."""
    lob = db.query(LOB).filter(LOB.id == lob_id, or_(LOB.tenant_id == tenant_id, LOB.tenant_id == None)).first()
    if not lob:
        raise HTTPException(status_code=404, detail="LOB not found")
    
    criteria = lob.criteria_json or {}
    
    # Encrypt API key if present and not already encrypted
    if llm_config.get("api_key") and not is_encrypted(llm_config["api_key"]):
        try:
            llm_config["api_key"] = encrypt_api_key(llm_config["api_key"])
        except ValueError:
            # If encryption key not configured, store as-is (dev mode)
            pass
    
    # Log the action
    audit_log = LLMAuditLog(
        tenant_id=tenant_id,
        lob_id=lob_id,
        manager_id=manager_id,
        action="CONFIG_UPDATED",
        new_provider=llm_config.get("provider"),
        details="LLM configuration updated"
    )
    db.add(audit_log)

    criteria["llm_config"] = llm_config
    # Ensure SQLAlchemy detects the change to the JSONB field
    lob.criteria_json = dict(criteria)
    flag_modified(lob, "criteria_json")
    
    try:
        db.commit()
        db.refresh(lob)
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving LLM config for LOB {lob_id}: {str(e)}")
        print(f"DEBUG: Error saving LLM config for LOB {lob_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save LLM configuration: {str(e)}")


def get_llm_config(db: Session, lob_id: int, tenant_id: int) -> dict:
    """Get LLM config for LOB (without API key for security)."""
    lob = db.query(LOB).filter(LOB.id == lob_id, or_(LOB.tenant_id == tenant_id, LOB.tenant_id == None)).first()
    if not lob:
        raise HTTPException(status_code=404, detail="LOB not found")
    
    criteria = lob.criteria_json or {}
    llm_config = criteria.get("llm_config", {
        "provider": "ollama",
        "model": settings.LOCAL_LLM_MODEL,
        "api_key": "",
        "api_base": settings.LOCAL_LLM_API_BASE,
        "stt_model": "tiny"
    })
    
    # SECURITY: Never return API key to frontend
    safe_config = llm_config.copy()
    if safe_config.get("api_key"):
        safe_config["api_key"] = "••••••••"
        safe_config["has_api_key"] = True
    else:
        safe_config["has_api_key"] = False
    
    return safe_config


def get_llm_config_with_key(db: Session, lob_id: int, tenant_id: int) -> dict:
    """Get LLM config including decrypted API key (for backend use only)."""
    lob = db.query(LOB).filter(LOB.id == lob_id, or_(LOB.tenant_id == tenant_id, LOB.tenant_id == None)).first()
    if not lob:
        raise HTTPException(status_code=404, detail="LOB not found")
    
    criteria = lob.criteria_json or {}
    llm_config = criteria.get("llm_config", {
        "provider": "ollama",
        "model": settings.LOCAL_LLM_MODEL,
        "api_base": settings.LOCAL_LLM_API_BASE,
        "stt_model": "tiny"
    })
    
    # Decrypt API key if encrypted
    if llm_config.get("api_key") and is_encrypted(llm_config["api_key"]):
        try:
            llm_config["api_key"] = decrypt_api_key(llm_config["api_key"])
        except ValueError:
            llm_config["api_key"] = ""
    
    return llm_config
