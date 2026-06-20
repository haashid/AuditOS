from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import io
import time
import openai

from core.database import get_db
from core.security import get_current_user
from core.permissions import require_module
from core.config import settings
from models.operational_audit import ProcessRisk, KPIRecord

router = APIRouter()


def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )


class ProcessRiskCreate(BaseModel):
    process_name: str
    risk_name: str
    risk_description: str
    risk_category: str
    inherent_likelihood: int    # 1-5
    inherent_impact: int        # 1-5
    control_description: Optional[str] = None
    control_effectiveness: Optional[str] = "not_tested"
    residual_likelihood: Optional[int] = None
    residual_impact: Optional[int] = None
    owner: Optional[str] = None


@router.post("/operational/engagements/{engagement_id}/process-risks")
def create_process_risk(
    engagement_id: str,
    body: ProcessRiskCreate,
    current_user=Depends(require_module("operational_audit")),
    db: Session = Depends(get_db)
):
    for field in ["inherent_likelihood", "inherent_impact"]:
        val = getattr(body, field)
        if not 1 <= val <= 5:
            raise HTTPException(status_code=400,
                                detail=f"{field} must be between 1 and 5")

    inherent_score = body.inherent_likelihood * body.inherent_impact
    residual_score = (
        (body.residual_likelihood or body.inherent_likelihood) *
        (body.residual_impact or body.inherent_impact)
    )

    rating = (
        "critical" if residual_score >= 20 else
        "high" if residual_score >= 12 else
        "medium" if residual_score >= 6 else
        "low"
    )

    risk = ProcessRisk(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        process_name=body.process_name,
        risk_name=body.risk_name,
        risk_description=body.risk_description,
        risk_category=body.risk_category,
        inherent_likelihood=body.inherent_likelihood,
        inherent_impact=body.inherent_impact,
        inherent_risk_score=inherent_score,
        control_description=body.control_description,
        control_effectiveness=body.control_effectiveness,
        residual_likelihood=body.residual_likelihood or body.inherent_likelihood,
        residual_impact=body.residual_impact or body.inherent_impact,
        residual_risk_score=residual_score,
        risk_rating=rating,
        owner=body.owner
    )
    db.add(risk)
    db.commit()
    db.refresh(risk)

    return {
        "id": str(risk.id),
        "risk_name": risk.risk_name,
        "inherent_risk_score": risk.inherent_risk_score,
        "residual_risk_score": risk.residual_risk_score,
        "risk_rating": risk.risk_rating
    }


@router.get("/operational/engagements/{engagement_id}/process-risks")
def list_process_risks(
    engagement_id: str,
    current_user=Depends(require_module("operational_audit")),
    db: Session = Depends(get_db)
):
    risks = db.query(ProcessRisk).filter(
        ProcessRisk.engagement_id == engagement_id,
        ProcessRisk.org_id == current_user.org_id
    ).order_by(ProcessRisk.residual_risk_score.desc()).all()

    return {
        "total": len(risks),
        "by_rating": {
            "critical": len([r for r in risks if r.risk_rating == "critical"]),
            "high": len([r for r in risks if r.risk_rating == "high"]),
            "medium": len([r for r in risks if r.risk_rating == "medium"]),
            "low": len([r for r in risks if r.risk_rating == "low"]),
        },
        "risks": [
            {
                "id": str(r.id),
                "process_name": r.process_name,
                "risk_name": r.risk_name,
                "risk_category": r.risk_category,
                "inherent_likelihood": r.inherent_likelihood,
                "inherent_impact": r.inherent_impact,
                "inherent_risk_score": r.inherent_risk_score,
                "residual_likelihood": r.residual_likelihood,
                "residual_impact": r.residual_impact,
                "residual_risk_score": r.residual_risk_score,
                "risk_rating": r.risk_rating,
                "control_effectiveness": r.control_effectiveness,
                "owner": r.owner,
                "ai_recommendation": r.ai_recommendation
            }
            for r in risks
        ]
    }


@router.post("/operational/engagements/{engagement_id}/kpis/upload")
async def upload_kpis_csv(
    engagement_id: str,
    file: UploadFile = File(...),
    current_user=Depends(require_module("operational_audit")),
    db: Session = Depends(get_db)
):
    """
    Upload KPI data as CSV.
    Columns: department, kpi_name, kpi_category, unit,
             actual_value, target_value, prior_period_value, period
    """
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse CSV")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    db.query(KPIRecord).filter(
        KPIRecord.engagement_id == engagement_id
    ).delete()

    adverse_count = 0
    for _, row in df.iterrows():
        try:
            actual = float(str(row.get("actual_value", 0)).replace(",", ""))
            target = float(str(row.get("target_value", 0)).replace(",", ""))
            prior = float(str(row.get("prior_period_value", 0)).replace(",", ""))
        except (ValueError, TypeError):
            continue

        threshold = 10.0
        var_target = ((actual - target) / max(abs(target), 1)) * 100 if target else 0
        var_prior = ((actual - prior) / max(abs(prior), 1)) * 100 if prior else 0
        is_adverse = abs(var_target) > threshold

        if is_adverse:
            adverse_count += 1

        db.add(KPIRecord(
            org_id=current_user.org_id,
            engagement_id=engagement_id,
            department=str(row.get("department", "")),
            kpi_name=str(row.get("kpi_name", "")),
            kpi_category=str(row.get("kpi_category", "")),
            unit=str(row.get("unit", "")),
            actual_value=actual,
            target_value=target,
            prior_period_value=prior,
            period=str(row.get("period", "")),
            variance_vs_target=round(var_target, 2),
            variance_vs_prior=round(var_prior, 2),
            is_adverse=is_adverse
        ))

    db.commit()
    return {
        "total_kpis": len(df),
        "adverse_variances": adverse_count
    }


@router.get("/operational/engagements/{engagement_id}/kpis/summary")
def get_kpi_summary(
    engagement_id: str,
    current_user=Depends(require_module("operational_audit")),
    db: Session = Depends(get_db)
):
    kpis = db.query(KPIRecord).filter(
        KPIRecord.engagement_id == engagement_id,
        KPIRecord.org_id == current_user.org_id
    ).all()

    return {
        "total_kpis": len(kpis),
        "adverse_variances": len([k for k in kpis if k.is_adverse]),
        "kpis": [
            {
                "id": str(k.id),
                "department": k.department,
                "kpi_name": k.kpi_name,
                "kpi_category": k.kpi_category,
                "actual_value": float(k.actual_value or 0),
                "target_value": float(k.target_value or 0),
                "prior_period_value": float(k.prior_period_value or 0),
                "variance_vs_target": float(k.variance_vs_target or 0),
                "variance_vs_prior": float(k.variance_vs_prior or 0),
                "is_adverse": k.is_adverse,
                "unit": k.unit,
                "period": k.period
            }
            for k in sorted(kpis, key=lambda x: abs(float(x.variance_vs_target or 0)), reverse=True)
        ]
    }


@router.post("/operational/engagements/{engagement_id}/ai-analysis")
def run_operational_analysis(
    engagement_id: str,
    current_user=Depends(require_module("operational_audit")),
    db: Session = Depends(get_db)
):
    """Streams AI analysis of operational risks and KPI variances."""
    risks = db.query(ProcessRisk).filter(
        ProcessRisk.engagement_id == engagement_id
    ).order_by(ProcessRisk.residual_risk_score.desc()).limit(10).all()

    kpis = db.query(KPIRecord).filter(
        KPIRecord.engagement_id == engagement_id,
        KPIRecord.is_adverse == True
    ).limit(10).all()

    prompt = f"""You are a senior operational auditor reviewing an organization's risk and performance profile.

TOP PROCESS RISKS (by residual score):
{chr(10).join([f"- [{r.risk_rating.upper()}] {r.process_name}: {r.risk_name} (Score: {r.residual_risk_score}/25)" for r in risks]) or "No risks documented yet"}

ADVERSE KPI VARIANCES:
{chr(10).join([f"- {k.department} | {k.kpi_name}: Actual {k.actual_value:.1f} vs Target {k.target_value:.1f} ({k.variance_vs_target:+.1f}%)" for k in kpis]) or "No adverse variances identified"}

Provide:
1. Overall operational health assessment (1 paragraph)
2. Top 3 risk areas requiring immediate management attention
3. KPI patterns — are the variances isolated or systemic?
4. Root cause hypotheses for the most significant issues
5. Three specific recommendations with expected outcomes

Be direct, concise, and actionable."""

    client = get_ai_client()

    def generate():
        for attempt in range(3):
            try:
                response = client.chat.completions.create(
                    model="openai/gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=1500,
                    stream=True
                )
                for chunk in response:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
                return
            except Exception as e:
                if "429" in str(e) and attempt < 2:
                    wait = 20 * (attempt + 1)
                    yield f"\n[Rate limit. Retrying in {wait}s...]\n"
                    time.sleep(wait)
                else:
                    yield f"\n[Error: {str(e)}]"
                    return

    return StreamingResponse(generate(), media_type="text/plain")
