"""
Regulatory Intelligence API — list regulations, run gap analysis.
"""
import logging
import time
import json

import openai
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.security import get_current_user
from models.regulation import Regulation, ComplianceGap
from models.engagement import Engagement, Transaction

logger = logging.getLogger(__name__)

router = APIRouter()

def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )


@router.get("/regulations")
def list_regulations(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    regs = db.query(Regulation).filter(Regulation.is_active == True).all()
    return [
        {
            "id": str(r.id),
            "code": r.code,
            "framework": r.framework,
            "jurisdiction": r.jurisdiction,
            "title": r.title,
            "description": r.description
        }
        for r in regs
    ]


@router.post("/engagements/{engagement_id}/regulations/{regulation_code}/gap-analysis")
def run_gap_analysis(
    engagement_id: str,
    regulation_code: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Runs a gap analysis for a specific regulation against an engagement's data.
    For each required control in the regulation, checks evidence in the transaction data
    and asks Gemini to assess whether the control appears present, partial, or missing.
    Streams results back.
    """
    engagement = db.query(Engagement).filter(
        Engagement.id == engagement_id,
        Engagement.org_id == current_user.org_id
    ).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    regulation = db.query(Regulation).filter(Regulation.code == regulation_code).first()
    if not regulation:
        raise HTTPException(status_code=404, detail="Regulation not found")

    # Get transaction context
    txns = db.query(Transaction).filter(
        Transaction.engagement_id == engagement_id
    ).all()
    total = len(txns)
    flagged = len([t for t in txns if t.is_flagged])
    no_approver = len([t for t in txns if not t.posted_by])
    weekend = len([t for t in txns if t.risk_score and "weekend" in str(t.flag_reasons or "").lower()])

    txn_summary = f"""
Total transactions: {total}
Flagged transactions: {flagged}
Transactions with no approver recorded: {no_approver}
Weekend transactions: {weekend}
"""

    required_controls = regulation.required_controls or []

    prompt = f"""You are a compliance audit expert analyzing whether a company meets {regulation.framework} requirements.

COMPANY CONTEXT:
Company Name: {engagement.client_name or engagement.name}
Audit Period: {engagement.fiscal_year_start} to {engagement.fiscal_year_end}

REGULATION: {regulation.title}
REQUIRED CONTROLS:
{json.dumps(required_controls, indent=2)}

AVAILABLE TRANSACTION DATA EVIDENCE:
{txn_summary}

For each required control, assess:
1. Gap Status: PRESENT / PARTIAL / MISSING
2. Evidence: What in the transaction data supports your assessment
3. Recommendation: What the auditor should do next

Format as a clear structured report. Include the Company Name and Audit Period in the report header. Be specific and professional. Do not invent facts not supported by the evidence."""

    def generate():
        client = get_ai_client()
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
                    wait = (attempt + 1) * 20
                    yield f"\n[Rate limit hit. Retrying in {wait}s...]\n"
                    time.sleep(wait)
                else:
                    yield f"\n[Error generating gap analysis: {str(e)}]"
                    return

    return StreamingResponse(generate(), media_type="text/plain")
