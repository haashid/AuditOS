"""
Fraud Detection API — trigger analysis, list alerts, update status.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_user
from core.permissions import require_role
from models.fraud_alert import FraudAlert
from models.engagement import Engagement
from ai.fraud_detector import run_fraud_detection

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/engagements/{engagement_id}/fraud/analyze")
def run_fraud_analysis(
    engagement_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_role("senior_auditor")),
    db: Session = Depends(get_db)
):
    """Trigger fraud pattern analysis for an engagement. Runs in background."""
    engagement = db.query(Engagement).filter(
        Engagement.id == engagement_id,
        Engagement.org_id == current_user.org_id
    ).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    # Delete old alerts for this engagement before re-running
    db.query(FraudAlert).filter(FraudAlert.engagement_id == engagement_id).delete()
    db.commit()

    # Background task opens its own SessionLocal() — do NOT pass db
    background_tasks.add_task(
        run_fraud_detection,
        engagement_id,
        str(current_user.org_id),
    )

    from core.activity_logger import log_activity
    log_activity(db, current_user, "fraud_analysis_run",
                  f"Ran fraud analysis on engagement",
                  engagement_id=engagement_id,
                  resource_type="engagement", resource_id=engagement_id)

    return {"message": "Fraud analysis started. Results will appear in the Fraud Intelligence tab shortly."}


@router.get("/engagements/{engagement_id}/fraud/alerts")
def get_fraud_alerts(
    engagement_id: str,
    limit: int = 100,
    offset: int = 0,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    alerts = db.query(FraudAlert).filter(
        FraudAlert.engagement_id == engagement_id,
        FraudAlert.org_id == current_user.org_id
    ).order_by(FraudAlert.created_at.desc()).limit(limit).offset(offset).all()

    total = db.query(FraudAlert).filter(
        FraudAlert.engagement_id == engagement_id,
        FraudAlert.org_id == current_user.org_id
    ).count()

    items = [
        {
            "id": str(a.id),
            "pattern_type": a.pattern_type,
            "severity": a.severity,
            "title": a.title,
            "description": a.description,
            "ai_explanation": a.ai_explanation,
            "confidence_score": a.confidence_score,
            "affected_count": len(a.affected_transaction_ids or []),
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in alerts
    ]

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.patch("/engagements/{engagement_id}/fraud/alerts/{alert_id}")
def update_fraud_alert(
    engagement_id: str,
    alert_id: str,
    body: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    alert = db.query(FraudAlert).filter(
        FraudAlert.id == alert_id,
        FraudAlert.engagement_id == engagement_id,
        FraudAlert.org_id == current_user.org_id
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if "status" in body:
        alert.status = body["status"]
    db.commit()
    return {"id": str(alert.id), "status": alert.status}
