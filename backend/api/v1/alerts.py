from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_user
from models.fraud_alert import FraudAlert
from models.finding import Finding

router = APIRouter()

@router.get("/notifications/unread-count")
def get_unread_count(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns count of unacknowledged fraud alerts + open findings for this org."""
    fraud_count = db.query(FraudAlert).filter(
        FraudAlert.org_id == current_user.org_id,
        FraudAlert.status == "open"
    ).count()

    finding_count = db.query(Finding).filter(
        Finding.org_id == current_user.org_id,
        Finding.status == "open"
    ).count()

    return {
        "total": fraud_count + finding_count,
        "fraud_alerts": fraud_count,
        "open_findings": finding_count
    }
