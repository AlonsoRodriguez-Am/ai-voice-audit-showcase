from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services import dashboard_service
from app.api import deps

from app.core.error_responses import ERROR_RESPONSES

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/metrics", 
            summary="Get Dashboard Metrics",
            responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
def get_dashboard_metrics(
    range: str = Query('all', description="Predefined date range: all, today, week, month"),
    date_from: Optional[str] = Query(None, description="ISO date string (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="ISO date string (YYYY-MM-DD)"),
    lob_id: Optional[int] = Query(None, description="Filter by LOB ID"),
    db: Session = Depends(get_db),
    current_user=Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Fetch high-level performance metrics including average score, total calls, 
    and compliance percentages.
    
    ## Example curl:
    ```bash
    curl -H "Authorization: Bearer <token>" "http://localhost:5000/api/dashboard/metrics?range=week"
    ```
    """
    return dashboard_service.get_dashboard_metrics(
        db, current_user.tenant_id, date_range=range, date_from=date_from, date_to=date_to, lob_id=lob_id
    )


@router.get("/trends", 
            summary="Get Score Trends",
            responses={401: ERROR_RESPONSES[401]})
def get_trends(
    period: str = Query('week', description="Aggregation period: week or month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    lob_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Get average score trends over time, grouped by the specified period.
    """
    return dashboard_service.get_trends(db, current_user.tenant_id, period=period, date_from=date_from, date_to=date_to, lob_id=lob_id)


@router.get("/ctq-distribution", 
            summary="Get CTQ Distribution",
            responses={401: ERROR_RESPONSES[401]})
def get_ctq_distribution(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    lob_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Get the pass/fail distribution for Critical to Quality (CTQ) criteria.
    """
    return dashboard_service.get_ctq_distribution(db, current_user.tenant_id, date_from=date_from, date_to=date_to, lob_id=lob_id)


@router.get("/topic-trends", 
            summary="Get Topic Frequency Trends",
            responses={401: ERROR_RESPONSES[401]})
def get_topic_trends(
    period: str = Query('week', description="Aggregation period: week or month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    lob_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Get topic frequency trends over time, allowing identification of common call drivers.
    """
    return dashboard_service.get_topic_trends(db, current_user.tenant_id, period=period, date_from=date_from, date_to=date_to, lob_id=lob_id)
