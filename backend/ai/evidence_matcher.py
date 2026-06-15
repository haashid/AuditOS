"""
Evidence Matching Agent
Cross-references uploaded documents (invoices, etc.) against transaction data.
Uses GPT-4o-mini via OpenRouter for AI-powered matching decision.
"""
import time
import json
from datetime import datetime, timedelta
from rapidfuzz import fuzz
from sqlalchemy.orm import Session
import openai
from core.config import settings
from models.document import Document
from models.engagement import Transaction
from models.finding import Finding


def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )


def run_evidence_matching(document_id: str, db: Session):
    """
    Called after document extraction completes.
    Finds candidate transactions and uses AI to confirm the match.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or not doc.extracted_data:
        return

    extracted = doc.extracted_data
    vendor_name = extracted.get("vendor_name")
    total_amount = extracted.get("total_amount")
    invoice_date_str = extracted.get("invoice_date")

    if not vendor_name or not total_amount:
        return  # Not enough data to match

    try:
        total_amount_float = float(total_amount)
    except (ValueError, TypeError):
        return

    # Step 1: Find candidate transactions
    all_txns = db.query(Transaction).filter(
        Transaction.engagement_id == doc.engagement_id,
        Transaction.org_id == doc.org_id
    ).all()

    candidates = []
    for txn in all_txns:
        amount = max(float(txn.debit_amount or 0), float(txn.credit_amount or 0))
        if amount == 0:
            continue

        # Amount within 1%
        amount_match = abs(amount - total_amount_float) / max(total_amount_float, 1) < 0.01

        # Vendor name fuzzy match (account_name vs vendor_name)
        name_similarity = fuzz.partial_ratio(
            (vendor_name or "").lower(),
            (txn.account_name or "").lower()
        )

        # Date proximity (within 7 days) if invoice date available
        date_match = True
        if invoice_date_str and txn.transaction_date:
            try:
                invoice_date = datetime.strptime(invoice_date_str, "%Y-%m-%d").date()
                date_diff = abs((txn.transaction_date - invoice_date).days)
                date_match = date_diff <= 7
            except (ValueError, TypeError):
                date_match = True  # don't penalize if date parsing fails

        if amount_match and name_similarity > 40 and date_match:
            candidates.append({
                "transaction_id": str(txn.id),
                "date": str(txn.transaction_date),
                "account_name": txn.account_name,
                "amount": amount,
                "description": txn.description,
                "name_similarity": name_similarity
            })

    # Sort by similarity, take top 5
    candidates = sorted(candidates, key=lambda c: c["name_similarity"], reverse=True)[:5]

    if not candidates:
        # No candidates found at all — create finding if amount significant
        if total_amount_float >= 1000:
            _create_unmatched_finding(doc, db)
        doc.match_confidence = 0.0
        db.commit()
        return

    # Step 2: Ask AI to confirm the best match
    prompt = f"""You are an audit evidence matching assistant.

INVOICE DATA EXTRACTED FROM DOCUMENT:
- Vendor: {vendor_name}
- Amount: {total_amount}
- Invoice Date: {invoice_date_str}
- Invoice Number: {extracted.get('invoice_number')}

CANDIDATE TRANSACTIONS FROM THE LEDGER:
{json.dumps(candidates, indent=2)}

Does this invoice match any of the candidate transactions? Respond with ONLY 
valid JSON in this exact format, no other text:
{{
  "matched": true or false,
  "transaction_id": "the matching transaction_id, or null",
  "confidence": 0.0 to 1.0,
  "explanation": "brief 1-2 sentence explanation"
}}"""

    result = None
    client = get_ai_client()
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="openai/gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300
            )
            result_text = response.choices[0].message.content.strip()
            # Strip markdown code fences if present
            result_text = result_text.replace("```json", "").replace("```", "").strip()
            result = json.loads(result_text)
            break
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                time.sleep(20 * (attempt + 1))
            else:
                print(f"[EvidenceMatcher] AI error: {e}")
                return

    if not result:
        return

    # Step 3: Save result
    if result.get("matched") and result.get("transaction_id"):
        doc.matched_transaction_id = result["transaction_id"]
        doc.match_confidence = result.get("confidence", 0.5)
    else:
        doc.match_confidence = result.get("confidence", 0.0)
        if total_amount_float >= 1000:
            _create_unmatched_finding(doc, db, ai_explanation=result.get("explanation"))

    db.commit()


def _create_unmatched_finding(doc: Document, db: Session, ai_explanation: str = None):
    """Creates a Finding when a significant invoice has no matching transaction."""
    extracted = doc.extracted_data or {}
    vendor = extracted.get("vendor_name", "Unknown vendor")
    amount = extracted.get("total_amount", 0)
    try:
        amount_float = float(amount)
    except (ValueError, TypeError):
        amount_float = 0

    finding = Finding(
        org_id=doc.org_id,
        engagement_id=doc.engagement_id,
        title=f"Unmatched invoice from {vendor} (${amount_float:,.2f})",
        description=(
            f"An invoice from '{vendor}' for ${amount_float:,.2f} (document: {doc.file_name}) "
            f"was uploaded but no matching transaction was found in the ledger. "
            + (ai_explanation or "")
        ),
        finding_type="anomaly",
        severity="high" if amount_float >= 10000 else "medium",
        recommendation=(
            "Verify whether this invoice has been recorded in the general ledger. "
            "If not recorded, this may represent an unrecorded liability or expense."
        ),
        ai_generated=True,
        status="open",
    )
    db.add(finding)
    db.commit()
