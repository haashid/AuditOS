"""
Simple utility to log activity. Call this after any significant action.
Fails silently if logging fails — never block the main operation.
"""
from sqlalchemy.orm import Session
from models.activity_log import ActivityLog


def log_activity(
    db: Session,
    user,
    action_type: str,
    description: str,
    engagement_id: str = None,
    resource_type: str = None,
    resource_id: str = None,
    metadata: dict = None
):
    try:
        import uuid
        log = ActivityLog(
            org_id=user.org_id,
            engagement_id=uuid.UUID(engagement_id) if engagement_id else None,
            user_id=user.id,
            action_type=action_type,
            description=description,
            resource_type=resource_type,
            resource_id=uuid.UUID(resource_id) if resource_id else None,
            log_metadata=metadata or {}
        )
        db.add(log)
        db.commit()
    except Exception as e:
        print(f"[ActivityLogger] Failed to log activity: {e}")
        try:
            db.rollback()
        except Exception:
            pass
