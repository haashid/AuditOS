"""
Activity Log API — Audit trail for all significant actions
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_user
from models.activity_log import ActivityLog
from models.user import User

router = APIRouter(tags=["activity"])


@router.get("/activity")
def get_activity_log(
    engagement_id: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ActivityLog).filter(ActivityLog.org_id == current_user.org_id)
    if engagement_id:
        try:
            import uuid
            query = query.filter(ActivityLog.engagement_id == uuid.UUID(engagement_id))
        except ValueError:
            pass

    total = query.count()
    items = query.order_by(ActivityLog.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    result = []
    for item in items:
        user = db.query(User).filter(User.id == item.user_id).first()
        result.append({
            "id": str(item.id),
            "action_type": item.action_type,
            "description": item.description,
            "user_name": user.full_name if user else "Unknown",
            "user_email": user.email if user else "",
            "resource_type": item.resource_type,
            "resource_id": str(item.resource_id) if item.resource_id else None,
            "engagement_id": str(item.engagement_id) if item.engagement_id else None,
            "created_at": item.created_at.isoformat(),
        })

    return {"total": total, "page": page, "page_size": page_size, "data": result}
