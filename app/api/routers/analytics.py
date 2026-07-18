from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.core.database import get_db
from app.models.token_usage import TokenUsage
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/usage", response_model=List[Dict[str, Any]])
def get_analytics_usage(
    period: str = Query("today", description="today, week, month, 30plus"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    now = datetime.utcnow()
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "30plus":
        start_date = datetime(2000, 1, 1)  # All time
    else:
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)

    print(f"DEBUG: Fetching analytics for period='{period}', starting from {start_date}")

    results = db.query(
        TokenUsage.model_name,
        TokenUsage.provider,
        func.sum(TokenUsage.prompt_tokens).label('total_prompt'),
        func.sum(TokenUsage.completion_tokens).label('total_completion'),
        func.sum(TokenUsage.estimated_cost).label('total_cost'),
        func.count(TokenUsage.id).label('request_count')
    ).filter(
        TokenUsage.timestamp >= start_date
    ).group_by(
        TokenUsage.model_name,
        TokenUsage.provider
    ).all()

    print(f"DEBUG: Query returned {len(results)} model/provider groups")

    analytics_data = []
    for r in results:
        analytics_data.append({
            "model": r.model_name,
            "provider": r.provider,
            "prompt_tokens": int(r.total_prompt or 0),
            "completion_tokens": int(r.total_completion or 0),
            "total_tokens": int((r.total_prompt or 0) + (r.total_completion or 0)),
            "requests": int(r.request_count or 0),
            "estimated_cost": float(r.total_cost or 0.0)
        })

    return analytics_data
