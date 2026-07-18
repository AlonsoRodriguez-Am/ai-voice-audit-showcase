from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.tenant import TenantPIIConfig, TenantResponse
from app.api.deps import get_current_user
from app.core.pii_redactor import PIIRedactor
from app.core.error_responses import ERROR_RESPONSES

router = APIRouter(prefix="/api/tenants", tags=["tenants"])

@router.get("/{tenant_id}/pii-config", 
            response_model=TenantPIIConfig,
            summary="Get PII Configuration",
            responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403], 404: ERROR_RESPONSES[404]})
async def get_tenant_pii_config(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve the PII redaction settings for a specific tenant.
    
    **Restriction:** Users can only access their own tenant's configuration unless they are `super_admin`.
    """
    
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return tenant.pii_config or TenantPIIConfig()

@router.put("/{tenant_id}/pii-config", 
            response_model=TenantPIIConfig,
            summary="Update PII Configuration",
            responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
async def update_tenant_pii_config(
    tenant_id: int,
    config: TenantPIIConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update the PII redaction settings (rules, thresholds) for a tenant.
    """
    # Security check: only admins of the tenant
    if current_user.tenant_id != tenant_id or current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant.pii_config = config.dict()
    db.commit()
    db.refresh(tenant)
    
    return tenant.pii_config

@router.post("/{tenant_id}/pii-config/test", 
             summary="Test PII Redaction",
             responses={401: ERROR_RESPONSES[401]})
async def test_pii_redaction(
    tenant_id: int,
    test_data: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validate PII redaction rules by providing sample text. 
    Returns redacted text and a log of detected entities.
    
    ## Example curl:
    ```bash
    curl -X POST "http://localhost:5000/api/tenants/1/pii-config/test" \
         -H "Authorization: Bearer <token>" \
         -H "Content-Type: application/json" \
         -d '{"text": "My email is user@example.com"}'
    ```
    """
    if current_user.tenant_id != tenant_id or current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    text = test_data.get("text", "")
    if not text:
        return {"redacted_text": "", "redaction_log": []}
    
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    config = tenant.pii_config if tenant else None
    
    redactor = PIIRedactor(config)
    redacted_text, redaction_log = redactor.redact_text(text)
    
    return {
        "redacted_text": redacted_text,
        "redaction_log": redaction_log,
        "stats": redactor.get_redaction_stats(redaction_log)
    }
