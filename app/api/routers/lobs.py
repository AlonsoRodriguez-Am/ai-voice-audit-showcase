from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.lob import LOBResponse, LOBCreate, LOBUpdate, LLMTestRequest
from app.services import lob_service
from app.services.llm_service import get_llm_provider
from app.api import deps

from app.core.error_responses import ERROR_RESPONSES

router = APIRouter(prefix="/api/lobs", tags=["lobs"])

@router.get("/", 
            response_model=List[LOBResponse],
            summary="List All LOBs",
            responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
def get_lobs(db: Session = Depends(get_db), current_user = Depends(deps.require_role(['admin', 'qa_manager']))):
    """
    Retrieve all Lines of Business for the current tenant.
    
    ## Example curl:
    ```bash
    curl -H "Authorization: Bearer <access_token>" "http://localhost:5000/api/lobs/"
    ```
    """
    return lob_service.get_lobs(db, current_user.tenant_id)

@router.get("/active", 
            response_model=List[LOBResponse],
            summary="List Active LOBs",
            responses={401: ERROR_RESPONSES[401]})
def get_active_lobs(db: Session = Depends(get_db), current_user = Depends(deps.get_current_user)):
    """
    Retrieve only the active Lines of Business for the current tenant.
    """
    return lob_service.get_active_lobs(db, current_user.tenant_id)

@router.post("/", 
             response_model=dict,
             summary="Create New LOB",
             responses={400: ERROR_RESPONSES[400], 401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
def create_lob(lob_data: LOBCreate, db: Session = Depends(get_db), current_user = Depends(deps.require_role(['admin', 'qa_manager']))):
    """
    Create a new Line of Business with specific evaluation criteria and system prompts.
    
    ## Example curl:
    ```bash
    curl -X POST "http://localhost:5000/api/lobs/" \
         -H "Authorization: Bearer <token>" \
         -H "Content-Type: application/json" \
         -d '{"name": "Support", "system_prompt": "Helpful...", "criteria_json": {}}'
    ```
    """
    new_lob = lob_service.create_lob(db, lob_data, current_user.tenant_id)
    return {"success": True, "id": new_lob.id}

@router.put("/{lob_id}/activate", 
            summary="Activate LOB",
            responses={404: ERROR_RESPONSES[404]})
def activate_lob(lob_id: int, db: Session = Depends(get_db), current_user = Depends(deps.require_role(['admin', 'qa_manager']))):
    """
    Set a specific LOB as active, deactivating others if necessary (based on tenant policy).
    """
    lob_service.activate_lob(db, lob_id, current_user.tenant_id)
    return {"success": True}

@router.put("/{lob_id}", 
            summary="Update LOB",
            responses={404: ERROR_RESPONSES[404]})
def update_lob(lob_id: int, lob_data: LOBUpdate, db: Session = Depends(get_db), current_user = Depends(deps.require_role(['admin', 'qa_manager']))):
    """
    Update the name, prompt, or criteria of an existing LOB.
    
    ## Example criteria_json with llm_config:
    ```json
    {
      "llm_config": {
        "provider": "openai",
        "model": "gpt-4",
        "api_key": "your_api_key_here"
      },
      "custom_field": "value"
    }
    ```
    """
    lob_service.update_lob(db, lob_id, lob_data, current_user.tenant_id)
    return {"success": True}

@router.delete("/{lob_id}", 
               summary="Delete LOB",
               responses={404: ERROR_RESPONSES[404]})
def delete_lob(lob_id: int, db: Session = Depends(get_db), current_user = Depends(deps.require_role(['admin', 'qa_manager']))):
    """
    Permanently delete a Line of Business.
    """
    lob_service.delete_lob(db, lob_id, current_user.tenant_id)
    return {"success": True}


# ─── LLM Configuration Endpoints ──────────────────────────────────────────────

@router.get("/{lob_id}/llm-config", 
            summary="Get LLM Configuration",
            responses={404: ERROR_RESPONSES[404]})
def get_llm_config(
    lob_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Retrieve the AI provider configuration for a specific LOB.
    
    **Security Note:** The API key is masked (`••••••••`) in the response.
    
    ## Example Response:
    ```json
    {
      "provider": "openai",
      "model": "gpt-4",
      "api_key": "••••••••",
      "has_api_key": true
    }
    ```
    """
    return lob_service.get_llm_config(db, lob_id, current_user.tenant_id)


@router.put("/{lob_id}/llm-config", 
            summary="Save LLM Configuration",
            responses={404: ERROR_RESPONSES[404]})
def save_llm_config(
    lob_id: int,
    config: LLMTestRequest,
    db: Session = Depends(get_db),
    current_user = Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Store the AI provider settings (provider, model, API key) for a LOB.
    
    The API key is encrypted at rest using AES-256.
    """
    llm_config = config.model_dump(exclude_none=True)
    lob_service.save_llm_config(db, lob_id, llm_config, current_user.tenant_id, current_user.id)
    return {"success": True, "message": "LLM configuration saved successfully"}


@router.post("/{lob_id}/test-llm", 
             summary="Test LLM Connection",
             responses={404: ERROR_RESPONSES[404]})
async def test_llm_connection(
    lob_id: int,
    config: LLMTestRequest,
    db: Session = Depends(get_db),
    current_user = Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Validate that the provided (or stored) LLM configuration can successfully 
    reach the AI provider and perform a simple handshake/chat.
    
    ## Example Request:
    ```json
    {
      "provider": "openai",
      "model": "gpt-4",
      "api_key": "sk-..."
    }
    ```
    
    ## Example Response:
    ```json
    {
      "status": "success", 
      "message": "Conexión exitosa con OpenAI API"
    }
    ```
    """
    try:
        # Verify LOB exists and belongs to tenant
        from app.models.lob import LOB
        from sqlalchemy import or_
        lob = db.query(LOB).filter(
            LOB.id == lob_id,
            or_(LOB.tenant_id == current_user.tenant_id, LOB.tenant_id == None)
        ).first()
        if not lob:
            raise HTTPException(status_code=404, detail="LOB not found")

        # Build config dict for the provider factory
        provider_config = config.model_dump(exclude_none=True)

        # If no api_key provided but one exists in DB, use the stored one
        if not provider_config.get("api_key") and config.provider != "ollama":
            stored_config = lob_service.get_llm_config_with_key(
                db, lob_id, current_user.tenant_id
            )
            if stored_config.get("api_key"):
                provider_config["api_key"] = stored_config["api_key"]

        # Create LLM provider and test connection
        provider = get_llm_provider(provider_config)
        result = await provider.test_connection()
        return result

    except HTTPException:
        raise
    except Exception as e:
        return {"status": "error", "message": str(e)}
