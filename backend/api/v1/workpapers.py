"""
Workpapers API — AI-generated formal audit workpapers using Google Gemini.
"""
import logging
from typing import Optional

import openai
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.security import get_current_user
from core.permissions import require_any_role
from models.engagement import Engagement, Transaction
from models.finding import Finding
from models.workpaper import Workpaper
from models.document import Document

logger = logging.getLogger(__name__)

router = APIRouter()

def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )

AUDIT_AREAS = [
    "Revenue",
    "Payroll",
    "Procurement",
    "Cash & Bank",
    "Expenses",
    "Accounts Payable",
    "Accounts Receivable",
]

AREA_KEYWORDS = {
    "Revenue": ["revenue", "sales", "income"],
    "Payroll": ["payroll", "salary", "wages", "employee"],
    "Procurement": ["procurement", "purchase", "vendor", "supplier"],
    "Cash & Bank": ["cash", "bank", "petty cash"],
    "Expenses": ["expense", "operating", "admin"],
    "Accounts Payable": ["payable", "creditor", "ap"],
    "Accounts Receivable": ["receivable", "debtor", "ar"],
}


class WorkpaperRequest(BaseModel):
    engagement_id: str
    audit_area: str


class WorkpaperSave(BaseModel):
    engagement_id: str
    audit_area: str
    full_content: str


@router.post("/workpapers/generate")
def generate_workpaper(
    request: WorkpaperRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream an AI-generated audit workpaper for the given engagement and area."""
    if request.audit_area not in AUDIT_AREAS:
        raise HTTPException(
            status_code=400,
            detail=f"audit_area must be one of: {AUDIT_AREAS}",
        )

    engagement = (
        db.query(Engagement)
        .filter(
            Engagement.id == request.engagement_id,
            Engagement.org_id == current_user.org_id,
        )
        .first()
    )
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    all_txns = (
        db.query(Transaction)
        .filter(
            Transaction.engagement_id == request.engagement_id,
            Transaction.org_id == current_user.org_id,
        )
        .all()
    )

    keywords = AREA_KEYWORDS.get(request.audit_area, [])
    relevant_txns = [
        t for t in all_txns
        if any(kw in (t.account_name or "").lower() for kw in keywords)
    ] or all_txns[:100]

    flagged_in_area = [t for t in relevant_txns if t.is_flagged]

    # Get all findings for context
    findings = (
        db.query(Finding)
        .filter(
            Finding.engagement_id == request.engagement_id,
            Finding.org_id == current_user.org_id,
        )
        .all()
    )

    # Get all documents for context
    docs = (
        db.query(Document)
        .filter(
            Document.engagement_id == request.engagement_id,
            Document.org_id == current_user.org_id,
        )
        .all()
    )

    total_debit = sum(float(t.debit_amount or 0) for t in relevant_txns)
    total_credit = sum(float(t.credit_amount or 0) for t in relevant_txns)

    flagged_summary = "\n".join([
        f"- {t.transaction_date} | {t.account_name} | "
        f"${max(float(t.debit_amount or 0), float(t.credit_amount or 0)):,.2f} | "
        f"Flags: {t.flag_reasons}"
        for t in flagged_in_area[:10]
    ]) or "None"

    related_findings = "\n".join([
        f"- [{f.severity.upper()}] {f.title}"
        for f in findings
        if request.audit_area.lower() in (f.title or "").lower()
    ]) or "None"

    related_docs = "\n".join([
        f"- File: {d.file_name} | Extracted: {d.extracted_data}"
        for d in docs
        if d.extracted_data
    ]) or "None"

    txn_summary = f"""AUDIT AREA: {request.audit_area}
ENGAGEMENT: {engagement.name} | CLIENT: {engagement.client_name}
FISCAL YEAR: {engagement.fiscal_year_start} to {engagement.fiscal_year_end}

TRANSACTIONS IN THIS AREA:
- Total transactions: {len(relevant_txns)}
- Total debit amount: ${total_debit:,.2f}
- Total credit amount: ${total_credit:,.2f}
- Flagged transactions: {len(flagged_in_area)}

TOP FLAGGED ITEMS:
{flagged_summary}

OPEN FINDINGS RELATED TO THIS AREA:
{related_findings}

RELATED EVIDENTIARY DOCUMENTS:
{related_docs}"""

    prompt = f"""You are a senior auditor writing a formal audit workpaper.
Write a professional workpaper for the audit area below following ISA/GAAS standards.

{txn_summary}

Write the workpaper with these exact sections:
1. OBJECTIVE - What this testing aims to achieve (2-3 sentences)
2. PROCEDURE PERFORMED - Step-by-step what the auditor did (bullet points)
3. POPULATION - Description of the full population tested
4. SAMPLE SELECTED - How many items sampled and selection method
5. EXCEPTIONS NOTED - List any exceptions found based on the flagged transactions above. If none, say "No exceptions noted."
6. CONCLUSION - Overall conclusion on the audit area (2-3 sentences)

Be factual, professional, and base the content ONLY on the data provided above."""

    def generate():
        import time
        max_retries = 3
        for attempt in range(max_retries):
            try:
                full_text = ""
                client = get_ai_client()
                response = client.chat.completions.create(
                    model="openai/gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=2000,
                    stream=True
                )
                for chunk in response:
                    content = chunk.choices[0].delta.content
                    if content:
                        full_text += content
                        yield content

                # Save to DB after streaming complete
                try:
                    wp = Workpaper(
                        org_id=current_user.org_id,
                        engagement_id=request.engagement_id,
                        audit_area=request.audit_area,
                        full_content=full_text,
                        status="draft",
                        ai_generated=True,
                        prepared_by=current_user.id,
                    )
                    db.add(wp)
                    db.commit()
                except Exception as e:
                    logger.error(f"Failed to save workpaper: {e}")
                
                return # Success, exit generator
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    sleep_time = 20 * (attempt + 1)
                    logger.warning(f"Workpaper API rate limit hit. Retrying in {sleep_time}s...")
                    yield f"\n\n[Gemini Free Tier rate limit reached. Auto-retrying in {sleep_time} seconds...]\n\n"
                    time.sleep(sleep_time)
                else:
                    logger.error(f"Gemini workpaper error: {e}", exc_info=True)
                    yield f"\n\n[Error generating workpaper: {str(e)}]"
                    return

    return StreamingResponse(generate(), media_type="text/plain")


@router.get("/engagements/{engagement_id}/workpapers")
def list_workpapers(
    engagement_id: str,
    limit: int = 100,
    offset: int = 0,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all saved workpapers for an engagement."""
    workpapers = (
        db.query(Workpaper)
        .filter(
            Workpaper.engagement_id == engagement_id,
            Workpaper.org_id == current_user.org_id,
        )
        .order_by(Workpaper.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    
    total = db.query(Workpaper).filter(
        Workpaper.engagement_id == engagement_id,
        Workpaper.org_id == current_user.org_id
    ).count()

    items = [
        {
            "id": str(w.id),
            "audit_area": w.audit_area,
            "status": w.status,
            "approval_status": w.approval_status or "draft",
            "review_comment": w.review_comment,
            "full_content": w.full_content,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in workpapers
    ]
    
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.patch("/workpapers/{workpaper_id}/submit")
def submit_for_review(
    workpaper_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Any user submits a draft workpaper for review."""
    wp = db.query(Workpaper).filter(
        Workpaper.id == workpaper_id,
        Workpaper.org_id == current_user.org_id
    ).first()
    if not wp:
        raise HTTPException(status_code=404, detail="Workpaper not found")
    wp.approval_status = "submitted"
    db.commit()
    return {"id": str(wp.id), "approval_status": "submitted"}


@router.patch("/workpapers/{workpaper_id}/review")
def review_workpaper(
    workpaper_id: str,
    body: dict,
    current_user=Depends(require_any_role("partner", "senior_auditor", "reviewer", "admin", "auditor")),
    db: Session = Depends(get_db),
):
    """Senior auditor, partner, or reviewer approves/rejects a workpaper."""
    wp = db.query(Workpaper).filter(
        Workpaper.id == workpaper_id,
        Workpaper.org_id == current_user.org_id
    ).first()
    if not wp:
        raise HTTPException(status_code=404, detail="Workpaper not found")

    decision = body.get("decision")
    if decision not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="decision must be 'approved' or 'rejected'")

    wp.approval_status = decision
    wp.reviewed_by = current_user.id
    wp.review_comment = body.get("comment", "")
    db.commit()

    from core.activity_logger import log_activity
    log_activity(db, current_user, "workpaper_review",
                  f"{decision.title()} workpaper for {wp.audit_area}",
                  resource_type="workpaper", resource_id=str(wp.id))

    return {"id": str(wp.id), "approval_status": wp.approval_status}
