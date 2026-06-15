from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from core.database import get_db
from core.security import get_current_user
from models.user import User
from models.engagement import Engagement, Transaction
from schemas.engagement import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardStats)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = current_user.org_id

    # Aggregate counts
    total_engagements = db.query(Engagement).filter(Engagement.org_id == org_id).count()

    total_transactions = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.org_id == org_id)
        .scalar()
        or 0
    )

    total_flagged = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.org_id == org_id, Transaction.is_flagged == True)
        .scalar()
        or 0
    )

    avg_risk_score_result = (
        db.query(func.avg(Transaction.risk_score))
        .filter(Transaction.org_id == org_id)
        .scalar()
    )
    avg_risk_score = float(avg_risk_score_result) if avg_risk_score_result else 0.0

    # Per-engagement breakdown
    engagements = (
        db.query(Engagement)
        .filter(Engagement.org_id == org_id)
        .order_by(Engagement.created_at.desc())
        .all()
    )

    engagements_breakdown = []
    for eng in engagements:
        total_txn = (
            db.query(func.count(Transaction.id))
            .filter(Transaction.engagement_id == eng.id)
            .scalar()
            or 0
        )
        flagged_txn = (
            db.query(func.count(Transaction.id))
            .filter(Transaction.engagement_id == eng.id, Transaction.is_flagged == True)
            .scalar()
            or 0
        )
        engagements_breakdown.append(
            {
                "id": str(eng.id),
                "name": eng.name,
                "client_name": eng.client_name,
                "total": total_txn,
                "flagged": flagged_txn,
                "clean": total_txn - flagged_txn,
            }
        )

    # Flag reason breakdown — tally across all transactions for this org
    all_flagged_txns = (
        db.query(Transaction.flag_reasons)
        .filter(Transaction.org_id == org_id, Transaction.is_flagged == True)
        .all()
    )

    flag_reason_counts: dict = {}
    for (reasons,) in all_flagged_txns:
        if reasons:
            for reason in reasons:
                flag_reason_counts[reason] = flag_reason_counts.get(reason, 0) + 1

    return DashboardStats(
        total_engagements=total_engagements,
        total_transactions=total_transactions,
        total_flagged=total_flagged,
        avg_risk_score=round(avg_risk_score, 1),
        engagements_breakdown=engagements_breakdown,
        flag_reasons_breakdown=flag_reason_counts,
    )
