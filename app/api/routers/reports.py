from fastapi import APIRouter, Depends, Response, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.services import report_service
from app.api import deps

from app.core.error_responses import ERROR_RESPONSES

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/full-report", 
            summary="Export Full Evaluation Report",
            responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
def download_full_report(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)", examples=["2024-01-01"]),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)", examples=["2024-01-31"]),
    lob_id: Optional[int] = Query(None, description="Filter by LOB ID", examples=[1]),
    format: str = Query("csv", description="Export format: csv, xlsx, pdf"),
    db: Session = Depends(get_db),
    current_user=Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Export a comprehensive report containing all evaluation records and AI analysis details.
    
    ## Example curl:
    ```bash
    curl -H "Authorization: Bearer <token>" "http://localhost:5000/api/reports/full-report?format=xlsx" --output report.xlsx
    ```
    """
    if format == "xlsx":
        output = report_service.generate_full_report_excel(db, current_user.tenant_id, date_from=date_from, date_to=date_to, lob_id=lob_id)
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment;filename=full_database_report.xlsx"}
        )
    elif format == "pdf":
        output = report_service.generate_full_report_pdf(db, current_user.tenant_id, date_from=date_from, date_to=date_to, lob_id=lob_id)
        return Response(
            content=output.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment;filename=full_database_report.pdf"}
        )
    else:
        output = report_service.generate_full_report(db, current_user.tenant_id, date_from=date_from, date_to=date_to, lob_id=lob_id)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment;filename=full_database_report.csv"}
        )


@router.get("/summary-report", 
            summary="Export Summary Report",
            responses={401: ERROR_RESPONSES[401], 403: ERROR_RESPONSES[403]})
def download_summary_report(
    date_from: Optional[str] = Query(None, description="Start date"),
    date_to: Optional[str] = Query(None, description="End date"),
    lob_id: Optional[int] = Query(None, description="Filter by LOB"),
    format: str = Query("csv", description="Export format: csv, xlsx, pdf"),
    db: Session = Depends(get_db),
    current_user=Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Export a high-level summary report with aggregated metrics.
    """
    if format == "xlsx":
        output = report_service.generate_summary_report_excel(db, current_user.tenant_id, date_from=date_from, date_to=date_to, lob_id=lob_id)
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment;filename=summary_report.xlsx"}
        )
    elif format == "pdf":
        output = report_service.generate_summary_report_pdf(db, current_user.tenant_id, date_from=date_from, date_to=date_to, lob_id=lob_id)
        return Response(
            content=output.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment;filename=summary_report.pdf"}
        )
    else:
        output = report_service.generate_summary_report(db, current_user.tenant_id, date_from=date_from, date_to=date_to, lob_id=lob_id)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment;filename=summary_report.csv"}
        )


@router.get("/detailed-ai-analysis", 
            summary="Export Detailed AI Report",
            responses={401: ERROR_RESPONSES[401]})
def download_detailed_ai_report(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    lob_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Export a CSV report specifically focused on AI reasoning and raw predictions.
    """
    output = report_service.generate_full_report(db, current_user.tenant_id, date_from=date_from, date_to=date_to, lob_id=lob_id)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment;filename=detailed_ai_analysis_report.csv"}
    )


@router.get("/ai-performance", 
            summary="Export AI Performance Report",
            responses={401: ERROR_RESPONSES[401]})
def download_ai_performance_report(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    lob_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Export a report detailing cases where manual QA corrected AI predictions.
    """
    output = report_service.generate_ai_performance_report(db, current_user.tenant_id, date_from=date_from, date_to=date_to, lob_id=lob_id)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment;filename=ai_corrections_report.csv"}
    )


@router.get("/pii-audit", 
            summary="Export PII Audit Report",
            responses={401: ERROR_RESPONSES[401]})
def download_pii_audit_report(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(deps.require_role(['admin', 'qa_manager']))
):
    """
    Export a report of all PII redaction activities for compliance auditing.
    """
    output = report_service.generate_pii_audit_report(db, current_user.tenant_id, date_from=date_from, date_to=date_to)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment;filename=pii_redaction_audit_report.csv"}
    )
