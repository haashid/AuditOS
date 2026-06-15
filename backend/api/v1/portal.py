"""
Client Portal API — separate auth and read-only finding access for audited companies.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from passlib.context import CryptContext

from core.database import get_db
from core.security import create_access_token, get_portal_token
from models.portal_user import PortalUser
from models.finding import Finding
from models.engagement import Engagement

logger = logging.getLogger(__name__)

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class PortalRegister(BaseModel):
    email: str
    password: str
    full_name: str
    company_name: str
    engagement_id: str


class PortalLogin(BaseModel):
    email: str
    password: str


@router.post("/portal/register")
def portal_register(body: PortalRegister, db: Session = Depends(get_db)):
    # Verify engagement exists
    engagement = db.query(Engagement).filter(Engagement.id == body.engagement_id).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    existing = db.query(PortalUser).filter(PortalUser.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = PortalUser(
        engagement_id=body.engagement_id,
        org_id=engagement.org_id,
        email=body.email,
        full_name=body.full_name,
        company_name=body.company_name,
        hashed_password=pwd_context.hash(body.password)
    )
    db.add(user)
    db.commit()

    token = create_access_token({"sub": str(user.id), "role": "portal_user", "engagement_id": body.engagement_id})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/portal/login")
def portal_login(body: PortalLogin, db: Session = Depends(get_db)):
    user = db.query(PortalUser).filter(PortalUser.email == body.email).first()
    if not user or not pwd_context.verify(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({
        "sub": str(user.id),
        "role": "portal_user",
        "engagement_id": str(user.engagement_id),
        "org_id": str(user.org_id)
    })
    return {"access_token": token, "token_type": "bearer"}


@router.get("/portal/findings")
def portal_get_findings(
    token_data: dict = Depends(get_portal_token),
    db: Session = Depends(get_db)
):
    """Returns only open/in-progress findings for the client's engagement. Read-only."""
    engagement_id = token_data.get("engagement_id")
    findings = db.query(Finding).filter(
        Finding.engagement_id == engagement_id,
        Finding.status.in_(["open", "in_progress"])
    ).all()

    return [
        {
            "id": str(f.id),
            "title": f.title,
            "description": f.description,
            "severity": f.severity,
            "status": f.status,
            "recommendation": f.recommendation,
            "management_response": f.management_response,
            "due_date": f.due_date.isoformat() if f.due_date else None
        }
        for f in findings
    ]


@router.patch("/portal/findings/{finding_id}/respond")
def portal_add_response(
    finding_id: str,
    body: dict,
    token_data: dict = Depends(get_portal_token),
    db: Session = Depends(get_db)
):
    """Client can add management response to a finding. That's all they can do."""
    engagement_id = token_data.get("engagement_id")
    finding = db.query(Finding).filter(
        Finding.id == finding_id,
        Finding.engagement_id == engagement_id
    ).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    finding.management_response = body.get("management_response", "")
    db.commit()
    return {"id": str(finding.id), "management_response": finding.management_response}
