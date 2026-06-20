from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import time
import openai

from core.database import get_db
from core.security import get_current_user
from core.permissions import require_module
from core.config import settings
from core.esg_audit_seed import seed_brsr_metrics
from models.esg_audit import EmissionRecord, ESGMetric, BRSRResponse

router = APIRouter()


def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )


class EmissionEntry(BaseModel):
    scope: int                   # 1, 2, or 3
    category: str
    activity_data: float
    activity_unit: str
    emission_factor: float
    period: str
    data_source: Optional[str] = None
    notes: Optional[str] = None


@router.post("/esg/engagements/{engagement_id}/emissions/add")
def add_emission_record(
    engagement_id: str,
    body: EmissionEntry,
    current_user=Depends(require_module("esg_audit")),
    db: Session = Depends(get_db)
):
    if body.scope not in [1, 2, 3]:
        raise HTTPException(status_code=400, detail="scope must be 1, 2, or 3")

    co2e = body.activity_data * body.emission_factor / 1000  # convert kg to tonnes

    record = EmissionRecord(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        scope=body.scope,
        category=body.category,
        activity_data=body.activity_data,
        activity_unit=body.activity_unit,
        emission_factor=body.emission_factor,
        co2e_tonnes=co2e,
        data_source=body.data_source,
        period=body.period,
        notes=body.notes
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": str(record.id),
        "scope": record.scope,
        "category": record.category,
        "co2e_tonnes": float(record.co2e_tonnes)
    }


@router.get("/esg/engagements/{engagement_id}/emissions/summary")
def get_emissions_summary(
    engagement_id: str,
    current_user=Depends(require_module("esg_audit")),
    db: Session = Depends(get_db)
):
    records = db.query(EmissionRecord).filter(
        EmissionRecord.engagement_id == engagement_id,
        EmissionRecord.org_id == current_user.org_id
    ).all()

    scope1 = sum(float(r.co2e_tonnes or 0) for r in records if r.scope == 1)
    scope2 = sum(float(r.co2e_tonnes or 0) for r in records if r.scope == 2)
    scope3 = sum(float(r.co2e_tonnes or 0) for r in records if r.scope == 3)
    total = scope1 + scope2 + scope3

    by_category = {}
    for r in records:
        by_category[r.category] = by_category.get(r.category, 0) + float(r.co2e_tonnes or 0)

    return {
        "total_co2e_tonnes": round(total, 4),
        "scope_1_tonnes": round(scope1, 4),
        "scope_2_tonnes": round(scope2, 4),
        "scope_3_tonnes": round(scope3, 4),
        "by_category": {k: round(v, 4) for k, v in by_category.items()},
        "total_records": len(records)
    }


class ESGMetricEntry(BaseModel):
    pillar: str    # 'environmental', 'social', 'governance'
    category: str
    metric_name: str
    value: float
    unit: str
    period: str
    target_value: Optional[float] = None
    notes: Optional[str] = None


@router.post("/esg/engagements/{engagement_id}/metrics/add")
def add_esg_metric(
    engagement_id: str,
    body: ESGMetricEntry,
    current_user=Depends(require_module("esg_audit")),
    db: Session = Depends(get_db)
):
    if body.pillar not in ["environmental", "social", "governance"]:
        raise HTTPException(status_code=400,
                            detail="pillar must be environmental, social, or governance")

    metric = ESGMetric(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        **body.model_dump()
    )
    db.add(metric)
    db.commit()
    return {"id": str(metric.id), "metric_name": metric.metric_name, "value": float(metric.value)}


@router.get("/esg/engagements/{engagement_id}/metrics")
def list_esg_metrics(
    engagement_id: str,
    pillar: Optional[str] = None,
    current_user=Depends(require_module("esg_audit")),
    db: Session = Depends(get_db)
):
    query = db.query(ESGMetric).filter(
        ESGMetric.engagement_id == engagement_id,
        ESGMetric.org_id == current_user.org_id
    )
    if pillar:
        query = query.filter(ESGMetric.pillar == pillar)

    metrics = query.all()
    return [
        {
            "id": str(m.id),
            "pillar": m.pillar,
            "category": m.category,
            "metric_name": m.metric_name,
            "value": float(m.value),
            "unit": m.unit,
            "period": m.period,
            "target_value": float(m.target_value) if m.target_value else None,
            "vs_target": (
                round((float(m.value) / float(m.target_value) - 1) * 100, 1)
                if m.target_value and float(m.target_value) > 0 else None
            )
        }
        for m in metrics
    ]


@router.get("/esg/engagements/{engagement_id}/emissions")
def list_emissions(
    engagement_id: str,
    current_user=Depends(require_module("esg_audit")),
    db: Session = Depends(get_db)
):
    records = db.query(EmissionRecord).filter(
        EmissionRecord.engagement_id == engagement_id,
        EmissionRecord.org_id == current_user.org_id
    ).order_by(EmissionRecord.created_at.desc()).all()

    return [
        {
            "id": str(r.id),
            "scope": r.scope,
            "category": r.category,
            "activity_data": float(r.activity_data or 0),
            "activity_unit": r.activity_unit,
            "emission_factor": float(r.emission_factor or 0),
            "co2e_tonnes": float(r.co2e_tonnes or 0),
            "data_source": r.data_source,
            "period": r.period,
            "notes": r.notes
        }
        for r in records
    ]


@router.post("/esg/engagements/{engagement_id}/brsr/ai-analysis")
def run_brsr_analysis(
    engagement_id: str,
    current_user=Depends(require_module("esg_audit")),
    db: Session = Depends(get_db)
):
    """Streams an AI analysis of BRSR compliance based on ESG data entered."""
    emissions = db.query(EmissionRecord).filter(
        EmissionRecord.engagement_id == engagement_id
    ).all()

    metrics = db.query(ESGMetric).filter(
        ESGMetric.engagement_id == engagement_id
    ).all()

    scope1 = sum(float(r.co2e_tonnes or 0) for r in emissions if r.scope == 1)
    scope2 = sum(float(r.co2e_tonnes or 0) for r in emissions if r.scope == 2)
    scope3 = sum(float(r.co2e_tonnes or 0) for r in emissions if r.scope == 3)

    social_metrics = [m for m in metrics if m.pillar == "social"]
    gov_metrics = [m for m in metrics if m.pillar == "governance"]

    prompt = f"""You are an ESG auditor assessing BRSR (Business Responsibility and Sustainability Reporting) compliance for a listed Indian company.

AVAILABLE ESG DATA:
Emissions:
- Scope 1: {scope1:.2f} tCO2e (direct emissions)
- Scope 2: {scope2:.2f} tCO2e (purchased electricity)
- Scope 3: {scope3:.2f} tCO2e (value chain)
- Total: {scope1 + scope2 + scope3:.2f} tCO2e

Social Metrics: {len(social_metrics)} data points entered
Governance Metrics: {len(gov_metrics)} data points entered

Analyze BRSR compliance across the 9 principles:
P1: Businesses should conduct and govern themselves with integrity
P2: Products/services should be safe and contribute to sustainability
P3: Respect and promote employee wellbeing
P4: Respect interests of all stakeholders
P5: Respect and promote human rights
P6: Respect and make efforts to protect the environment (FOCUS ON EMISSIONS DATA)
P7: Responsible policy engagement
P8: Promote inclusive growth
P9: Engage with and provide value to consumers

For each principle:
- Assessment: Adequate Data / Insufficient Data / Gap Identified
- Key disclosure requirement
- What the available data tells us
- What additional data is needed for full compliance

End with a BRSR readiness score (0-100%) and top 3 priority actions."""

    client = get_ai_client()

    def generate():
        for attempt in range(3):
            try:
                response = client.chat.completions.create(
                    model="openai/gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=2500,
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
                    yield f"\n[Rate limit hit. Retrying in {wait}s...]\n"
                    time.sleep(wait)
                else:
                    yield f"\n[Error: {str(e)}]"
                    return

    return StreamingResponse(generate(), media_type="text/plain")


# ── BRSR Manual Entry ─────────────────────────────────────────

@router.post("/esg/engagements/{engagement_id}/brsr/initialize")
def initialize_brsr_metrics(
    engagement_id: str,
    current_user=Depends(require_module("esg_audit")),
    db: Session = Depends(get_db)
):
    seed_brsr_metrics(engagement_id, str(current_user.org_id), db)
    count = db.query(ESGMetric).filter(
        ESGMetric.engagement_id == engagement_id,
        ESGMetric.category == "BRSR"
    ).count()
    return {"message": f"Initialized {count} BRSR metrics", "total_metrics": count}


@router.get("/esg/engagements/{engagement_id}/brsr/metrics")
def list_brsr_metrics(
    engagement_id: str,
    current_user=Depends(require_module("esg_audit")),
    db: Session = Depends(get_db)
):
    metrics = db.query(ESGMetric).filter(
        ESGMetric.engagement_id == engagement_id,
        ESGMetric.org_id == current_user.org_id,
        ESGMetric.category == "BRSR"
    ).order_by(ESGMetric.metric_name).all()

    return {
        "metrics": [
            {
                "id": str(m.id),
                "pillar": m.pillar,
                "metric_name": m.metric_name,
                "value": float(m.value),
                "unit": m.unit
            }
            for m in metrics
        ]
    }


class BRSRMetricUpdate(BaseModel):
    value: float


@router.patch("/esg/engagements/{engagement_id}/brsr/metrics/{metric_id}")
def update_brsr_metric(
    engagement_id: str,
    metric_id: str,
    body: BRSRMetricUpdate,
    current_user=Depends(require_module("esg_audit")),
    db: Session = Depends(get_db)
):
    metric = db.query(ESGMetric).filter(
        ESGMetric.id == metric_id,
        ESGMetric.engagement_id == engagement_id,
        ESGMetric.org_id == current_user.org_id,
        ESGMetric.category == "BRSR"
    ).first()
    
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    metric.value = body.value
    db.commit()

    return {
        "id": str(metric.id),
        "value": float(metric.value)
    }
