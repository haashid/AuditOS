from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from core.database import get_db
from core.security import get_current_user
from models.time_entry import TimeEntry
from models.user import User

router = APIRouter(tags=["time_tracking"])


class TimeEntryCreate(BaseModel):
    audit_area: str
    description: str
    minutes: int
    billable: str = "yes"


@router.post("/engagements/{engagement_id}/time")
def log_time(
    engagement_id: str,
    body: TimeEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log time spent on an audit area for an engagement."""
    if body.minutes <= 0:
        raise HTTPException(status_code=400, detail="minutes must be greater than 0")
    if body.billable not in ("yes", "no"):
        raise HTTPException(status_code=400, detail="billable must be 'yes' or 'no'")

    entry = TimeEntry(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        user_id=current_user.id,
        audit_area=body.audit_area,
        description=body.description,
        minutes=body.minutes,
        billable=body.billable
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {
        "id": str(entry.id),
        "minutes": entry.minutes,
        "hours": round(entry.minutes / 60, 2),
        "audit_area": entry.audit_area,
        "billable": entry.billable,
        "created_at": entry.created_at.isoformat()
    }


@router.get("/engagements/{engagement_id}/time/summary")
def get_time_summary(
    engagement_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get time summary grouped by area and team member."""
    entries = db.query(TimeEntry).filter(
        TimeEntry.engagement_id == engagement_id,
        TimeEntry.org_id == current_user.org_id
    ).all()

    total_minutes = sum(e.minutes for e in entries)
    billable_minutes = sum(e.minutes for e in entries if e.billable == "yes")

    # Group by audit area
    by_area: dict = {}
    for e in entries:
        area = e.audit_area or "General"
        by_area[area] = by_area.get(area, 0) + e.minutes

    # Group by team member
    by_member: dict = {}
    for e in entries:
        member = db.query(User).filter(User.id == e.user_id).first()
        name = member.full_name if member else "Unknown"
        by_member[name] = by_member.get(name, 0) + e.minutes

    return {
        "total_hours": round(total_minutes / 60, 2),
        "total_minutes": total_minutes,
        "billable_hours": round(billable_minutes / 60, 2),
        "by_area": {k: round(v / 60, 2) for k, v in by_area.items()},
        "by_member": {k: round(v / 60, 2) for k, v in by_member.items()},
        "entries": [
            {
                "id": str(e.id),
                "audit_area": e.audit_area,
                "description": e.description,
                "hours": round(e.minutes / 60, 2),
                "minutes": e.minutes,
                "billable": e.billable,
                "entry_date": e.created_at.isoformat() if e.created_at else None
            }
            for e in sorted(entries, key=lambda x: x.created_at, reverse=True)
        ]
    }
