from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from core.database import get_db
from core.security import get_current_user
from models.observation import Observation
from models.user import User

router = APIRouter(tags=["observations"])


class ObservationCreate(BaseModel):
    content: str
    audit_area: Optional[str] = None
    is_private: bool = False
    tags: Optional[str] = None


class ObservationUpdate(BaseModel):
    content: Optional[str] = None
    audit_area: Optional[str] = None
    tags: Optional[str] = None


class ConvertToFindingRequest(BaseModel):
    severity: str = "medium"
    finding_type: str = "anomaly"


@router.post("/engagements/{engagement_id}/observations")
def create_observation(
    engagement_id: str,
    body: ObservationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a quick observation note during fieldwork."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Observation content cannot be empty")

    obs = Observation(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        created_by=current_user.id,
        content=body.content,
        audit_area=body.audit_area,
        is_private=body.is_private,
        tags=body.tags
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)

    return _obs_to_dict(obs, current_user, db)


@router.get("/engagements/{engagement_id}/observations")
def list_observations(
    engagement_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all observations for an engagement.
    Private observations are only shown to their creator.
    """
    all_obs = db.query(Observation).filter(
        Observation.engagement_id == engagement_id,
        Observation.org_id == current_user.org_id
    ).order_by(Observation.created_at.desc()).all()

    visible = [
        o for o in all_obs
        if not o.is_private or str(o.created_by) == str(current_user.id)
    ]
    return [_obs_to_dict(o, current_user, db) for o in visible]


@router.patch("/engagements/{engagement_id}/observations/{obs_id}")
def update_observation(
    engagement_id: str,
    obs_id: str,
    body: ObservationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Edit an observation's content or tags. Only the creator can edit."""
    obs = _get_own_observation(engagement_id, obs_id, current_user, db)
    if body.content is not None:
        obs.content = body.content
    if body.audit_area is not None:
        obs.audit_area = body.audit_area
    if body.tags is not None:
        obs.tags = body.tags
    db.commit()
    db.refresh(obs)
    return _obs_to_dict(obs, current_user, db)


@router.delete("/engagements/{engagement_id}/observations/{obs_id}", status_code=204)
def delete_observation(
    engagement_id: str,
    obs_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an observation. Only the creator can delete their own notes."""
    obs = _get_own_observation(engagement_id, obs_id, current_user, db)
    db.delete(obs)
    db.commit()
    return None


@router.post("/engagements/{engagement_id}/observations/{obs_id}/convert-to-finding")
def convert_to_finding(
    engagement_id: str,
    obs_id: str,
    body: ConvertToFindingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Convert an observation into a formal Finding.
    Marks the observation as converted and links to the new finding.
    """
    obs = db.query(Observation).filter(
        Observation.id == obs_id,
        Observation.engagement_id == engagement_id,
        Observation.org_id == current_user.org_id
    ).first()
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")

    if obs.converted_to_finding:
        raise HTTPException(
            status_code=400,
            detail="This observation has already been converted to a finding"
        )

    # Create the finding
    from models.finding import Finding
    finding = Finding(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        title=obs.content[:150],      # First 150 chars as title
        description=obs.content,
        severity=body.severity,
        finding_type=body.finding_type,
        status="open",
        created_by=current_user.id,
    )
    db.add(finding)
    db.flush()  # Get the finding ID

    # Mark observation as converted
    obs.converted_to_finding = True
    obs.finding_id = finding.id
    db.commit()

    return {
        "message": "Observation successfully converted to finding",
        "finding_id": str(finding.id),
        "finding_severity": finding.severity,
        "observation_id": str(obs.id)
    }


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_own_observation(
    engagement_id: str,
    obs_id: str,
    current_user: User,
    db: Session
) -> Observation:
    obs = db.query(Observation).filter(
        Observation.id == obs_id,
        Observation.engagement_id == engagement_id,
        Observation.org_id == current_user.org_id,
        Observation.created_by == current_user.id
    ).first()
    if not obs:
        raise HTTPException(
            status_code=404,
            detail="Observation not found or you do not have permission to edit it"
        )
    return obs


def _obs_to_dict(obs: Observation, current_user: User, db: Session) -> dict:
    creator = db.query(User).filter(User.id == obs.created_by).first()
    return {
        "id": str(obs.id),
        "content": obs.content,
        "audit_area": obs.audit_area,
        "is_private": obs.is_private,
        "tags": obs.tags.split(",") if obs.tags else [],
        "converted_to_finding": obs.converted_to_finding,
        "finding_id": str(obs.finding_id) if obs.finding_id else None,
        "created_by_name": creator.full_name if creator else "Unknown",
        "is_own": str(obs.created_by) == str(current_user.id),
        "created_at": obs.created_at.isoformat() if obs.created_at else None,
    }
