"""
Copilot endpoint — streaming AI answers over engagement transaction data.
Uses Google Gemini 2.0 Flash with 1M context window.
"""
import json
import logging

import openai
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db
from core.security import get_current_user
from models.engagement import Engagement, Transaction

logger = logging.getLogger(__name__)

router = APIRouter()

def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )

SYSTEM_INSTRUCTION = """You are AuditOS Copilot, an expert AI assistant for financial auditors.
You have been given real transaction data from an audit engagement.
Answer the auditor's question based ONLY on the data provided.
Be precise, professional, and concise.
If you cannot find the answer in the provided data, say so clearly — do not make up numbers.
Format numbers with commas and currency symbols.
When listing transactions, use a clean markdown table format."""


class CopilotRequest(BaseModel):
    question: str
    engagement_id: str


@router.post("/copilot/query")
async def copilot_query(
    request: CopilotRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream a Gemini answer grounded in the engagement's transaction data."""
    # 1. Verify engagement belongs to this org
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

    # 2. Fetch transactions for context (Gemini 1M window — we can be generous)
    all_txns = (
        db.query(Transaction)
        .filter(
            Transaction.engagement_id == request.engagement_id,
            Transaction.org_id == current_user.org_id,
        )
        .all()
    )

    total_count = len(all_txns)
    flagged_txns = [t for t in all_txns if t.is_flagged]
    high_risk_txns = [t for t in all_txns if t.risk_score >= 70]

    # Include up to 200 flagged + up to 50 clean for richer context
    sample = flagged_txns[:200] + [t for t in all_txns if not t.is_flagged][:50]
    txn_context = [
        {
            "date": str(t.transaction_date),
            "doc_number": t.document_number,
            "account": t.account_name,
            "debit": float(t.debit_amount or 0),
            "credit": float(t.credit_amount or 0),
            "description": t.description,
            "posted_by": t.posted_by,
            "risk_score": t.risk_score,
            "flags": t.flag_reasons,
        }
        for t in sample
    ]

    data_context = f"""ENGAGEMENT: {engagement.name}
CLIENT: {engagement.client_name}
FISCAL YEAR: {engagement.fiscal_year_start} to {engagement.fiscal_year_end}

TRANSACTION SUMMARY:
- Total transactions: {total_count}
- Flagged transactions: {len(flagged_txns)}
- High risk (score >= 70): {len(high_risk_txns)}

TRANSACTION DATA (up to 250 records):
{json.dumps(txn_context, indent=2)}
"""

    prompt = f"DATA:\n{data_context}\n\nQUESTION: {request.question}"

    # 3. Stream response
    def generate():
        import time
        max_retries = 3
        for attempt in range(max_retries):
            try:
                client = get_ai_client()
                response = client.chat.completions.create(
                    model="openai/gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": SYSTEM_INSTRUCTION},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=1500,
                    stream=True
                )
                for chunk in response:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
                return  # Success, exit generator
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    sleep_time = 20 * (attempt + 1)
                    logger.warning(f"Copilot API rate limit hit. Retrying in {sleep_time}s...")
                    yield f"\n\n[OpenRouter rate limit reached. Auto-retrying in {sleep_time} seconds...]\n\n"
                    time.sleep(sleep_time)
                else:
                    logger.error(f"OpenRouter copilot error: {e}", exc_info=True)
                    yield f"\n\n[Error generating response: {str(e)}]"
                    return

    return StreamingResponse(generate(), media_type="text/plain")
