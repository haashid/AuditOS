"""
Findings API — create, list, and update audit findings.
"""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user
from models.engagement import Engagement
from models.finding import Finding

logger = logging.getLogger(__name__)

router = APIRouter()


class FindingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    finding_type: Optional[str] = "anomaly"
    severity: str  # 'low', 'medium', 'high', 'critical'
    recommendation: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None


class FindingUpdate(BaseModel):
    status: Optional[str] = None
    management_response: Optional[str] = None
    recommendation: Optional[str] = None
    severity: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None


@router.post("/engagements/{engagement_id}/findings", status_code=201)
def create_finding(
    engagement_id: str,
    body: FindingCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new audit finding for an engagement."""
    engagement = (
        db.query(Engagement)
        .filter(
            Engagement.id == engagement_id,
            Engagement.org_id == current_user.org_id,
        )
        .first()
    )
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    finding = Finding(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        title=body.title,
        description=body.description,
        finding_type=body.finding_type,
        severity=body.severity,
        recommendation=body.recommendation,
        assigned_to=body.assigned_to,
        due_date=body.due_date,
        ai_generated=False,
        created_by=current_user.id,
    )
    db.add(finding)
    db.commit()
    db.refresh(finding)

    return _serialize_finding(finding)


@router.get("/engagements/{engagement_id}/findings")
def list_findings(
    engagement_id: str,
    limit: int = 100,
    offset: int = 0,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all findings for an engagement with pagination."""
    findings = (
        db.query(Finding)
        .filter(
            Finding.engagement_id == engagement_id,
            Finding.org_id == current_user.org_id,
        )
        .order_by(Finding.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    total = db.query(Finding).filter(
        Finding.engagement_id == engagement_id,
        Finding.org_id == current_user.org_id
    ).count()

    return {
        "items": [_serialize_finding(f) for f in findings],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.patch("/engagements/{engagement_id}/findings/{finding_id}")
def update_finding(
    engagement_id: str,
    finding_id: str,
    body: FindingUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update status, response, or other fields on a finding."""
    finding = (
        db.query(Finding)
        .filter(
            Finding.id == finding_id,
            Finding.engagement_id == engagement_id,
            Finding.org_id == current_user.org_id,
        )
        .first()
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    update_data = body.dict(exclude_none=True)
    for field, value in update_data.items():
        setattr(finding, field, value)

    db.commit()
    db.refresh(finding)
    return _serialize_finding(finding)


def _serialize_finding(f: Finding) -> dict:
    return {
        "id": str(f.id),
        "title": f.title,
        "description": f.description,
        "finding_type": f.finding_type,
        "severity": f.severity,
        "status": f.status,
        "recommendation": f.recommendation,
        "management_response": f.management_response,
        "ai_generated": f.ai_generated,
        "due_date": f.due_date.isoformat() if f.due_date else None,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }
