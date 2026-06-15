from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
import time
import json
import openai

from core.database import get_db
from core.security import get_current_user
from core.permissions import require_module
from core.config import settings
from models.tax import GSTReturn, ITCMismatch, TDSRecord, Form3CDResponse
from models.engagement import Engagement
from connectors.gst_parser import (
    parse_gstr1_json, parse_gstr3b_json,
    parse_gstr2b_json, parse_26as_csv
)

router = APIRouter()

def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )

# ── GST Return Upload ─────────────────────────────────────────

@router.post("/tax/engagements/{engagement_id}/gst-returns/upload")
async def upload_gst_return(
    engagement_id: str,
    return_type: str,   # 'GSTR-1', 'GSTR-3B', 'GSTR-2B'
    file: UploadFile = File(...),
    current_user=Depends(require_module("tax_audit")),
    db: Session = Depends(get_db)
):
    engagement = db.query(Engagement).filter(
        Engagement.id == engagement_id,
        Engagement.org_id == current_user.org_id
    ).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    if return_type not in ["GSTR-1", "GSTR-3B", "GSTR-2B"]:
        raise HTTPException(status_code=400, detail="return_type must be GSTR-1, GSTR-3B, or GSTR-2B")

    content = await file.read()

    try:
        if return_type == "GSTR-1":
            parsed = parse_gstr1_json(content)
        elif return_type == "GSTR-3B":
            parsed = parse_gstr3b_json(content)
        else:
            parsed = parse_gstr2b_json(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    gst_return = GSTReturn(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        return_type=return_type,
        filing_period=parsed.get("filing_period", ""),
        gstin=parsed.get("gstin", ""),
        raw_data=parsed,
        total_taxable_value=parsed.get("total_taxable_value", 0),
        total_igst=parsed.get("total_igst", 0),
        total_cgst=parsed.get("total_cgst", 0),
        total_sgst=parsed.get("total_sgst", 0),
        total_tax=parsed.get("total_tax", 0),
        file_name=file.filename,
        uploaded_by=current_user.id
    )
    db.add(gst_return)
    db.commit()

    return {
        "id": str(gst_return.id),
        "return_type": return_type,
        "filing_period": gst_return.filing_period,
        "gstin": gst_return.gstin,
        "total_taxable_value": float(gst_return.total_taxable_value or 0),
        "total_tax": float(gst_return.total_tax or 0)
    }


@router.get("/tax/engagements/{engagement_id}/gst-returns")
def list_gst_returns(
    engagement_id: str,
    current_user=Depends(require_module("tax_audit")),
    db: Session = Depends(get_db)
):
    returns = db.query(GSTReturn).filter(
        GSTReturn.engagement_id == engagement_id,
        GSTReturn.org_id == current_user.org_id
    ).order_by(GSTReturn.created_at.desc()).all()

    return [
        {
            "id": str(r.id),
            "return_type": r.return_type,
            "filing_period": r.filing_period,
            "gstin": r.gstin,
            "total_taxable_value": float(r.total_taxable_value or 0),
            "total_tax": float(r.total_tax or 0),
            "file_name": r.file_name,
            "created_at": r.created_at.isoformat()
        }
        for r in returns
    ]


# ── GST Reconciliation ────────────────────────────────────────

@router.post("/tax/engagements/{engagement_id}/gst-reconciliation/run")
def run_gst_reconciliation(
    engagement_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_module("tax_audit")),
    db: Session = Depends(get_db)
):
    """
    Runs reconciliation between GSTR-1, GSTR-3B, and GSTR-2B for
    all uploaded periods. Detects ITC mismatches and saves them.
    """
    returns = db.query(GSTReturn).filter(
        GSTReturn.engagement_id == engagement_id,
        GSTReturn.org_id == current_user.org_id
    ).all()

    has_3b = any(r.return_type == "GSTR-3B" for r in returns)
    has_2b = any(r.return_type == "GSTR-2B" for r in returns)

    if not has_3b or not has_2b:
        raise HTTPException(
            status_code=400,
            detail="Upload both GSTR-3B and GSTR-2B before running reconciliation"
        )

    background_tasks.add_task(
        _run_itc_reconciliation,
        engagement_id,
        str(current_user.org_id),
        str(current_user.id)
    )

    return {"message": "GST reconciliation started. Results will appear shortly."}


def _run_itc_reconciliation(engagement_id: str, org_id: str, user_id: str):
    """
    Background task: compares ITC in GSTR-2B vs GSTR-3B.
    Creates ITCMismatch records for differences > ₹100.
    """
    from core.database import SessionLocal
    db = SessionLocal()
    try:
        # Get GSTR-2B data (available ITC)
        gstr2b = db.query(GSTReturn).filter(
            GSTReturn.engagement_id == engagement_id,
            GSTReturn.return_type == "GSTR-2B"
        ).first()

        # Get GSTR-3B data (claimed ITC)
        gstr3b = db.query(GSTReturn).filter(
            GSTReturn.engagement_id == engagement_id,
            GSTReturn.return_type == "GSTR-3B"
        ).first()

        if not gstr2b or not gstr3b:
            return

        # Delete existing mismatches for this engagement
        db.query(ITCMismatch).filter(
            ITCMismatch.engagement_id == engagement_id
        ).delete()

        # Compare at summary level
        available_igst = float(gstr2b.total_igst or 0)
        available_cgst = float(gstr2b.total_cgst or 0)
        available_sgst = float(gstr2b.total_sgst or 0)

        claimed_igst = float(gstr3b.raw_data.get("itc_claimed_igst", 0))
        claimed_cgst = float(gstr3b.raw_data.get("itc_claimed_cgst", 0))
        claimed_sgst = float(gstr3b.raw_data.get("itc_claimed_sgst", 0))

        # Check each tax type for mismatch
        mismatches_data = [
            ("IGST ITC", available_igst, claimed_igst),
            ("CGST ITC", available_cgst, claimed_cgst),
            ("SGST ITC", available_sgst, claimed_sgst),
        ]

        client = get_ai_client()

        for tax_type, available, claimed in mismatches_data:
            diff = claimed - available
            if abs(diff) < 100:  # ignore trivial differences
                continue

            mismatch_type = "excess_claimed" if diff > 0 else "short_claimed"
            risk = "critical" if abs(diff) > 100000 else \
                   "high" if abs(diff) > 10000 else \
                   "medium" if abs(diff) > 1000 else "low"

            # Get AI explanation
            explanation = _get_mismatch_explanation(
                client, tax_type, available, claimed, diff, mismatch_type
            )

            mismatch = ITCMismatch(
                org_id=org_id,
                engagement_id=engagement_id,
                supplier_gstin="SUMMARY",
                supplier_name=f"{tax_type} Summary Reconciliation",
                filing_period=gstr3b.filing_period,
                itc_in_2b=available,
                itc_in_3b=claimed,
                difference=diff,
                mismatch_type=mismatch_type,
                risk_level=risk,
                ai_explanation=explanation
            )
            db.add(mismatch)

        db.commit()
        print(f"[GST Recon] Completed for engagement {engagement_id}")

    except Exception as e:
        print(f"[GST Recon Error] {e}")
        db.rollback()
    finally:
        db.close()


def _get_mismatch_explanation(client, tax_type, available, claimed, diff, mismatch_type):
    prompt = f"""You are a GST audit expert. Explain this ITC mismatch to a CA in 2-3 sentences.

Tax Type: {tax_type}
ITC Available (GSTR-2B): ₹{available:,.2f}
ITC Claimed (GSTR-3B): ₹{claimed:,.2f}
Difference: ₹{abs(diff):,.2f} {'excess claimed' if diff > 0 else 'under claimed'}

What could cause this and what should the CA investigate?"""

    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="openai/gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                time.sleep(20 * (attempt + 1))
    return f"{tax_type}: ITC claimed (₹{claimed:,.2f}) differs from ITC available in GSTR-2B (₹{available:,.2f}) by ₹{abs(diff):,.2f}."


@router.get("/tax/engagements/{engagement_id}/itc-mismatches")
def get_itc_mismatches(
    engagement_id: str,
    current_user=Depends(require_module("tax_audit")),
    db: Session = Depends(get_db)
):
    mismatches = db.query(ITCMismatch).filter(
        ITCMismatch.engagement_id == engagement_id,
        ITCMismatch.org_id == current_user.org_id
    ).all()

    return [
        {
            "id": str(m.id),
            "supplier_name": m.supplier_name,
            "filing_period": m.filing_period,
            "itc_in_2b": float(m.itc_in_2b or 0),
            "itc_in_3b": float(m.itc_in_3b or 0),
            "difference": float(m.difference or 0),
            "mismatch_type": m.mismatch_type,
            "risk_level": m.risk_level,
            "ai_explanation": m.ai_explanation,
            "status": m.status
        }
        for m in mismatches
    ]


# ── TDS / 26AS Upload ─────────────────────────────────────────

@router.post("/tax/engagements/{engagement_id}/tds/upload-26as")
async def upload_26as(
    engagement_id: str,
    file: UploadFile = File(...),
    current_user=Depends(require_module("tax_audit")),
    db: Session = Depends(get_db)
):
    content = await file.read()
    try:
        records = parse_26as_csv(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Delete existing 26AS records for this engagement
    db.query(TDSRecord).filter(
        TDSRecord.engagement_id == engagement_id,
        TDSRecord.source == "26AS"
    ).delete()

    for record in records:
        tds = TDSRecord(
            org_id=current_user.org_id,
            engagement_id=engagement_id,
            deductor_name=record.get("deductor_name"),
            deductor_tan=record.get("deductor_tan"),
            section=record.get("section"),
            tds_amount=record.get("tds_amount", 0),
            payment_amount=record.get("payment_amount", 0),
            source="26AS"
        )
        db.add(tds)

    db.commit()
    return {"total_tds_records": len(records), "source": "26AS"}


@router.get("/tax/engagements/{engagement_id}/tds/summary")
def get_tds_summary(
    engagement_id: str,
    current_user=Depends(require_module("tax_audit")),
    db: Session = Depends(get_db)
):
    records = db.query(TDSRecord).filter(
        TDSRecord.engagement_id == engagement_id,
        TDSRecord.org_id == current_user.org_id
    ).all()

    total_tds = sum(float(r.tds_amount or 0) for r in records)
    total_payment = sum(float(r.payment_amount or 0) for r in records)
    by_section = {}
    for r in records:
        section = r.section or "Unknown"
        by_section[section] = by_section.get(section, 0) + float(r.tds_amount or 0)

    return {
        "total_records": len(records),
        "total_tds_amount": total_tds,
        "total_payment_amount": total_payment,
        "by_section": by_section,
        "records": [
            {
                "id": str(r.id),
                "deductor_name": r.deductor_name,
                "deductor_tan": r.deductor_tan,
                "section": r.section,
                "tds_amount": float(r.tds_amount or 0),
                "payment_amount": float(r.payment_amount or 0)
            }
            for r in records[:100]  # paginated
        ]
    }


# ── Form 3CD ─────────────────────────────────────────────────

@router.get("/tax/engagements/{engagement_id}/form-3cd")
def get_form_3cd(
    engagement_id: str,
    current_user=Depends(require_module("tax_audit")),
    db: Session = Depends(get_db)
):
    """
    Returns all Form 3CD clauses with any existing responses.
    If no responses exist yet, returns the clause list with empty responses.
    """
    existing = {
        r.clause_number: r
        for r in db.query(Form3CDResponse).filter(
            Form3CDResponse.engagement_id == engagement_id
        ).all()
    }

    result = []
    for clause in FORM_3CD_CLAUSES:
        existing_response = existing.get(clause["number"])
        result.append({
            "clause_number": clause["number"],
            "clause_text": clause["text"],
            "category": clause["category"],
            "response": existing_response.response if existing_response else "",
            "ai_suggested_response": existing_response.ai_suggested_response if existing_response else None,
            "is_completed": existing_response.is_completed if existing_response else False,
            "is_applicable": existing_response.is_applicable if existing_response else True,
        })

    return {
        "engagement_id": engagement_id,
        "total_clauses": len(FORM_3CD_CLAUSES),
        "completed": sum(1 for r in result if r["is_completed"]),
        "clauses": result
    }


class Form3CDUpdate(BaseModel):
    clause_number: str
    response: str
    is_applicable: bool = True

@router.patch("/tax/engagements/{engagement_id}/form-3cd/response")
def update_form_3cd_response(
    engagement_id: str,
    body: Form3CDUpdate,
    current_user=Depends(require_module("tax_audit")),
    db: Session = Depends(get_db)
):
    existing = db.query(Form3CDResponse).filter(
        Form3CDResponse.engagement_id == engagement_id,
        Form3CDResponse.clause_number == body.clause_number
    ).first()

    if existing:
        existing.response = body.response
        existing.is_applicable = body.is_applicable
        existing.is_completed = bool(body.response.strip()) or not body.is_applicable
    else:
        clause_text = next(
            (c["text"] for c in FORM_3CD_CLAUSES if c["number"] == body.clause_number),
            ""
        )
        new_response = Form3CDResponse(
            org_id=current_user.org_id,
            engagement_id=engagement_id,
            clause_number=body.clause_number,
            clause_text=clause_text,
            response=body.response,
            is_applicable=body.is_applicable,
            is_completed=bool(body.response.strip()) or not body.is_applicable
        )
        db.add(new_response)

    db.commit()
    return {"clause_number": body.clause_number, "saved": True}


@router.post("/tax/engagements/{engagement_id}/form-3cd/ai-suggest/{clause_number}")
def ai_suggest_clause_response(
    engagement_id: str,
    clause_number: str,
    current_user=Depends(require_module("tax_audit")),
    db: Session = Depends(get_db)
):
    """
    Uses AI to suggest a response for a Form 3CD clause based on
    the engagement's transaction and GST return data.
    """
    clause = next(
        (c for c in FORM_3CD_CLAUSES if c["number"] == clause_number),
        None
    )
    if not clause:
        raise HTTPException(status_code=404, detail="Clause not found")

    # Get context
    gst_returns = db.query(GSTReturn).filter(
        GSTReturn.engagement_id == engagement_id
    ).all()
    gst_summary = ", ".join(
        [f"{r.return_type} (Period: {r.filing_period}, Tax: ₹{float(r.total_tax or 0):,.0f})"
         for r in gst_returns]
    ) if gst_returns else "No GST returns uploaded"

    itc_mismatches = db.query(ITCMismatch).filter(
        ITCMismatch.engagement_id == engagement_id
    ).count()

    prompt = f"""You are a Chartered Accountant filling Form 3CD (Tax Audit Report under Section 44AB of Indian Income Tax Act).

CLAUSE {clause_number}: {clause['text']}

AVAILABLE DATA:
- GST Returns: {gst_summary}
- ITC Mismatches detected: {itc_mismatches}

Suggest a concise, professional response to this clause (2-4 sentences max).
If the data is insufficient to answer definitively, state what information is needed.
Write as if you are the CA filling the report."""

    client = get_ai_client()
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="openai/gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300
            )
            suggestion = response.choices[0].message.content.strip()
            break
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                time.sleep(20 * (attempt + 1))
            else:
                raise HTTPException(status_code=500, detail="AI suggestion failed")

    # Save suggestion to DB
    existing = db.query(Form3CDResponse).filter(
        Form3CDResponse.engagement_id == engagement_id,
        Form3CDResponse.clause_number == clause_number
    ).first()

    if existing:
        existing.ai_suggested_response = suggestion
    else:
        db.add(Form3CDResponse(
            org_id=current_user.org_id,
            engagement_id=engagement_id,
            clause_number=clause_number,
            clause_text=clause["text"],
            ai_suggested_response=suggestion
        ))
    db.commit()

    return {"clause_number": clause_number, "suggestion": suggestion}


# ── Form 3CD Clause Definitions ───────────────────────────────
# Key clauses most relevant to financial auditors
# Full Form 3CD has 44 clauses — include the most critical ones

FORM_3CD_CLAUSES = [
    {"number": "4", "category": "General",
     "text": "Whether the assessee is liable to pay indirect tax like excise duty, service tax, sales tax, customs duty, GST, etc.? If yes, furnish a description of the goods manufactured/services rendered/goods traded."},
    {"number": "9", "category": "General",
     "text": "Details of turnover, gross profit, etc., for the previous year and preceding previous year."},
    {"number": "11", "category": "Accounting",
     "text": "Change in accounting method with respect to stocks. If yes, the effect thereof on the profit or loss should be stated."},
    {"number": "12", "category": "Income",
     "text": "Profit and Loss account includes any profits and gains assessable as business income (Section 28 to 44DB)."},
    {"number": "13", "category": "Deductions",
     "text": "Particulars of depreciation allowable as per the Income-tax Act, 1961."},
    {"number": "17", "category": "Payments",
     "text": "Amounts inadmissible under section 40(a) — payments to non-residents without TDS deduction."},
    {"number": "21", "category": "Compliance",
     "text": "Amount of tax deducted at source from payments made/credited during the year — reconciliation with books."},
    {"number": "26", "category": "GST",
     "text": "Details of amounts admissible under sections 36(1)(iii) — borrowed capital interest."},
    {"number": "34", "category": "GST",
     "text": "Whether the assessee is required to furnish statement in Form No. 61 or Form No. 61A or Form No. 61B? If yes, furnish details."},
    {"number": "40a", "category": "Related Party",
     "text": "Particulars of transactions with persons referred to in section 40A(2)(b) — related party transactions."},
    {"number": "44", "category": "GST",
     "text": "Break-up of total expenditure of entities registered or not registered under GST."},
]
