from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import time
import openai
import pandas as pd
import io

from core.database import get_db
from core.security import get_current_user
from core.permissions import require_module
from core.config import settings
from models.supply_chain import Vendor, VendorRiskAssessment

router = APIRouter()

def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )

# ── Vendor Management ─────────────────────────────────────────

class VendorCreate(BaseModel):
    vendor_code: str
    vendor_name: str
    category: str
    criticality: str
    annual_spend: float
    financial_risk_score: Optional[int] = None
    cyber_risk_score: Optional[int] = None
    esg_risk_score: Optional[int] = None


@router.get("/supply-chain/engagements/{engagement_id}/vendors")
def list_vendors(
    engagement_id: str,
    current_user=Depends(require_module("supply_chain_audit")),
    db: Session = Depends(get_db)
):
    vendors = db.query(Vendor).filter(
        Vendor.engagement_id == engagement_id,
        Vendor.org_id == current_user.org_id
    ).order_by(Vendor.annual_spend.desc()).all()
    
    return {
        "vendors": [
            {
                "id": str(v.id),
                "vendor_code": v.vendor_code,
                "vendor_name": v.vendor_name,
                "category": v.category,
                "criticality": v.criticality,
                "annual_spend": float(v.annual_spend or 0),
                "financial_risk_score": v.financial_risk_score,
                "cyber_risk_score": v.cyber_risk_score,
                "esg_risk_score": v.esg_risk_score,
                "overall_risk_score": v.overall_risk_score,
                "status": v.status
            }
            for v in vendors
        ]
    }


@router.post("/supply-chain/engagements/{engagement_id}/vendors")
def add_vendor(
    engagement_id: str,
    body: VendorCreate,
    current_user=Depends(require_module("supply_chain_audit")),
    db: Session = Depends(get_db)
):
    # Calculate overall risk as average if others provided
    scores = [s for s in [body.financial_risk_score, body.cyber_risk_score, body.esg_risk_score] if s is not None]
    overall = sum(scores) // len(scores) if scores else None

    v = Vendor(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        vendor_code=body.vendor_code,
        vendor_name=body.vendor_name,
        category=body.category,
        criticality=body.criticality,
        annual_spend=body.annual_spend,
        financial_risk_score=body.financial_risk_score,
        cyber_risk_score=body.cyber_risk_score,
        esg_risk_score=body.esg_risk_score,
        overall_risk_score=overall
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return {"id": str(v.id), "vendor_name": v.vendor_name}


@router.post("/supply-chain/engagements/{engagement_id}/vendors/upload-csv")
async def upload_vendors_csv(
    engagement_id: str,
    file: UploadFile = File(...),
    current_user=Depends(require_module("supply_chain_audit")),
    db: Session = Depends(get_db)
):
    """
    CSV Columns: Vendor Code, Vendor Name, Category, Criticality, Annual Spend
    """
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse CSV file")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    added = 0
    for _, row in df.iterrows():
        v = Vendor(
            org_id=current_user.org_id,
            engagement_id=engagement_id,
            vendor_code=str(row.get("vendor_code", "")),
            vendor_name=str(row.get("vendor_name", "")),
            category=str(row.get("category", "Services")),
            criticality=str(row.get("criticality", "Medium")).capitalize(),
            annual_spend=float(str(row.get("annual_spend", "0")).replace(",", "")),
            status="active"
        )
        db.add(v)
        added += 1

    db.commit()
    return {"total_vendors": added}


@router.get("/supply-chain/engagements/{engagement_id}/vendors/{vendor_id}")
def get_vendor(
    engagement_id: str,
    vendor_id: str,
    current_user=Depends(require_module("supply_chain_audit")),
    db: Session = Depends(get_db)
):
    v = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.engagement_id == engagement_id,
        Vendor.org_id == current_user.org_id
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    return {
        "id": str(v.id),
        "vendor_code": v.vendor_code,
        "vendor_name": v.vendor_name,
        "category": v.category,
        "criticality": v.criticality,
        "annual_spend": float(v.annual_spend or 0),
        "financial_risk_score": v.financial_risk_score,
        "cyber_risk_score": v.cyber_risk_score,
        "esg_risk_score": v.esg_risk_score,
        "overall_risk_score": v.overall_risk_score,
        "status": v.status
    }


# ── Risk Assessment ───────────────────────────────────────────

class AssessRequest(BaseModel):
    financial_notes: str
    cyber_notes: str
    esg_notes: str


@router.post("/supply-chain/engagements/{engagement_id}/vendors/{vendor_id}/assess")
def run_vendor_assessment(
    engagement_id: str,
    vendor_id: str,
    body: AssessRequest,
    current_user=Depends(require_module("supply_chain_audit")),
    db: Session = Depends(get_db)
):
    v = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.engagement_id == engagement_id
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")

    prompt = f"""You are a supply chain risk auditor assessing vendor: {v.vendor_name} ({v.category}).
Criticality: {v.criticality}
Annual Spend: ${v.annual_spend}

Here are the audit notes collected:
FINANCIAL: {body.financial_notes}
CYBER/IT: {body.cyber_notes}
ESG: {body.esg_notes}

Analyze the risk for this vendor and output exactly a JSON object in this format:
{{
  "financial_risk_score": <int 0-100, 100=highest risk>,
  "cyber_risk_score": <int 0-100>,
  "esg_risk_score": <int 0-100>,
  "overall_risk_score": <int 0-100>,
  "ai_financial_risk_explanation": "<string>",
  "ai_cyber_risk_explanation": "<string>",
  "ai_esg_risk_explanation": "<string>",
  "ai_overall_summary": "<string>",
  "ai_recommended_actions": "<string>"
}}"""

    client = get_ai_client()
    try:
        response = client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            response_format={"type": "json_object"}
        )
        import json
        res_data = json.loads(response.choices[0].message.content)
        
        # Update vendor
        v.financial_risk_score = res_data.get("financial_risk_score")
        v.cyber_risk_score = res_data.get("cyber_risk_score")
        v.esg_risk_score = res_data.get("esg_risk_score")
        v.overall_risk_score = res_data.get("overall_risk_score")
        
        # Create assessment record
        assessment = VendorRiskAssessment(
            org_id=current_user.org_id,
            vendor_id=v.id,
            assessment_date=func.current_date(),
            assessor_name=current_user.full_name,
            financial_notes=body.financial_notes,
            cyber_notes=body.cyber_notes,
            esg_notes=body.esg_notes,
            ai_financial_risk_explanation=res_data.get("ai_financial_risk_explanation"),
            ai_cyber_risk_explanation=res_data.get("ai_cyber_risk_explanation"),
            ai_esg_risk_explanation=res_data.get("ai_esg_risk_explanation"),
            ai_overall_summary=res_data.get("ai_overall_summary"),
            ai_recommended_actions=res_data.get("ai_recommended_actions")
        )
        db.add(assessment)
        db.commit()
        db.refresh(assessment)
        
        return {"status": "success", "assessment_id": str(assessment.id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/supply-chain/engagements/{engagement_id}/vendors/{vendor_id}/assessments")
def list_vendor_assessments(
    engagement_id: str,
    vendor_id: str,
    current_user=Depends(require_module("supply_chain_audit")),
    db: Session = Depends(get_db)
):
    assessments = db.query(VendorRiskAssessment).filter(
        VendorRiskAssessment.vendor_id == vendor_id,
        VendorRiskAssessment.org_id == current_user.org_id
    ).order_by(VendorRiskAssessment.created_at.desc()).all()
    
    return {
        "assessments": [
            {
                "id": str(a.id),
                "assessment_date": a.assessment_date,
                "assessor_name": a.assessor_name,
                "ai_overall_summary": a.ai_overall_summary,
                "ai_financial_risk_explanation": a.ai_financial_risk_explanation,
                "ai_cyber_risk_explanation": a.ai_cyber_risk_explanation,
                "ai_esg_risk_explanation": a.ai_esg_risk_explanation,
                "ai_recommended_actions": a.ai_recommended_actions
            }
            for a in assessments
        ]
    }
