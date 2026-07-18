from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any

from app.api.deps import get_current_user
from app.models.user import User
from app.services.telemetry_service import telemetry_service

router = APIRouter()

@router.get("/gpu", response_model=Dict[str, Any])
def get_telemetry_stats(current_user: User = Depends(get_current_user)):
    """Fetch current system and GPU telemetry data."""
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    stats = telemetry_service.get_gpu_stats()
    return stats
