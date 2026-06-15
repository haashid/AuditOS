"""
Team Management API — Invitations, Member Listing, Role Management
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import secrets
from datetime import datetime, timedelta

from core.database import get_db
from core.security import get_current_user, hash_password
from core.permissions import require_role
from core.config import settings
from models.user import User
from models.invitation import Invitation

router = APIRouter(prefix="/team", tags=["team"])


class InviteCreate(BaseModel):
    email: EmailStr
    role: str  # 'senior_auditor', 'junior_auditor', 'reviewer'


class AcceptInvite(BaseModel):
    token: str
    password: str
    full_name: str


@router.post("/invite")
def create_invitation(
    body: InviteCreate,
    current_user=Depends(require_role("senior_auditor")),
    db: Session = Depends(get_db),
):
    if body.role not in ["senior_auditor", "junior_auditor", "reviewer"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be: senior_auditor, junior_auditor, or reviewer")

    user_role = current_user.role
    if user_role in ("admin",):
        user_role = "partner"

    if body.role == "senior_auditor" and user_role not in ("partner", "admin"):
        raise HTTPException(status_code=403, detail="Only partners can invite senior auditors")

    # Check if user already exists in this org
    existing = db.query(User).filter(
        User.email == body.email,
        User.org_id == current_user.org_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already in this organization")

    token = secrets.token_urlsafe(32)
    invitation = Invitation(
        org_id=current_user.org_id,
        email=body.email,
        role=body.role,
        token=token,
        invited_by=current_user.id,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(invitation)
    db.commit()

    return {
        "invite_link": f"{settings.FRONTEND_URL}/accept-invite?token={token}",
        "expires_at": invitation.expires_at.isoformat(),
        "email": body.email,
        "role": body.role,
    }


@router.get("/members")
def list_team_members(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    members = db.query(User).filter(User.org_id == current_user.org_id).all()
    return [
        {
            "id": str(m.id),
            "email": m.email,
            "full_name": m.full_name,
            "role": m.role,
            "is_active": m.is_active,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in members
    ]


@router.patch("/members/{user_id}/role")
def update_member_role(
    user_id: str,
    body: dict,
    current_user=Depends(require_role("partner")),
    db: Session = Depends(get_db),
):
    member = db.query(User).filter(
        User.id == user_id,
        User.org_id == current_user.org_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if str(member.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    new_role = body.get("role")
    if new_role not in ["partner", "senior_auditor", "junior_auditor", "reviewer"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    member.role = new_role
    db.commit()

    # Log activity
    from core.activity_logger import log_activity
    log_activity(db, current_user, "role_changed",
                  f"Changed {member.email}'s role to {new_role}",
                  resource_type="user", resource_id=str(member.id))

    return {"id": str(member.id), "role": member.role}


@router.post("/accept-invite")
def accept_invitation(body: AcceptInvite, db: Session = Depends(get_db)):
    invitation = db.query(Invitation).filter(
        Invitation.token == body.token,
        Invitation.accepted == False  # noqa: E712
    ).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or expired invitation")
    if invitation.expires_at.replace(tzinfo=None) < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invitation has expired")

    # Check if user with that email already exists
    existing = db.query(User).filter(User.email == invitation.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    user = User(
        org_id=invitation.org_id,
        email=invitation.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=invitation.role,
        onboarding_completed=True  # skip onboarding for invited members
    )
    db.add(user)
    invitation.accepted = True
    db.commit()
    db.refresh(user)

    from core.security import create_access_token
    token = create_access_token({"sub": str(user.id), "org_id": str(user.org_id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/pending-invites")
def list_pending_invites(
    current_user=Depends(require_role("senior_auditor")),
    db: Session = Depends(get_db),
):
    invites = db.query(Invitation).filter(
        Invitation.org_id == current_user.org_id,
        Invitation.accepted == False,  # noqa: E712
        Invitation.expires_at > datetime.utcnow()
    ).all()
    return [
        {
            "id": str(i.id),
            "email": i.email,
            "role": i.role,
            "expires_at": i.expires_at.isoformat(),
        }
        for i in invites
    ]
