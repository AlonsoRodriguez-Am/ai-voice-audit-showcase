from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime

class TenantPIIConfig(BaseModel):
    enabled: bool = True
    enabled_types: List[str] = ["phone", "email", "ssn", "credit_card"]
    redaction_token: str = "***REDACTED***"
    log_redactions: bool = True
    names_enabled: bool = False

class TenantBase(BaseModel):
    name: str
    slug: str
    settings: Optional[Dict[str, Any]] = {}
    pii_config: Optional[TenantPIIConfig] = None

class TenantCreate(TenantBase):
    pass

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    pii_config: Optional[TenantPIIConfig] = None

class TenantResponse(TenantBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
