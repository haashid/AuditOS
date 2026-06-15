"""
Industry Risk Library API — get risk items per sector.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_user
from models.risk_library import RiskLibraryItem

router = APIRouter()

INDUSTRIES = ["banking", "healthcare", "manufacturing", "retail", "government", "education"]


@router.get("/industry/risk-library/{industry}")
def get_risk_library(
    industry: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if industry not in INDUSTRIES:
        raise HTTPException(status_code=400, detail=f"Industry must be one of: {INDUSTRIES}")

    items = db.query(RiskLibraryItem).filter(
        RiskLibraryItem.industry == industry
    ).all()

    return [
        {
            "id": str(i.id),
            "risk_area": i.risk_area,
            "risk_title": i.risk_title,
            "risk_description": i.risk_description,
            "likelihood": i.likelihood,
            "impact": i.impact,
            "audit_procedures": i.audit_procedures,
            "red_flags": i.red_flags
        }
        for i in items
    ]
