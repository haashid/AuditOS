"""
Document OCR + Extraction Engine using Google Gemini.
Called as a FastAPI BackgroundTask after document upload.
"""
import json
import os
import logging
import time
import threading

import pdfplumber
import openai

def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )
from sqlalchemy.orm import Session
from models.document import Document
from core.config import settings

logger = logging.getLogger(__name__)


# EasyOCR reader — lazy-initialized to avoid slow startup for every request
_easyocr_reader = None


def _get_ocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        _easyocr_reader = easyocr.Reader(["en"], gpu=False)
    return _easyocr_reader


def extract_document(doc_id: str, file_path: str, file_ext: str, db: Session):
    """
    Background task: read document → OCR → Gemini extraction → update DB record.
    """
    # Mark as processing
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        return
    doc.extraction_status = "processing"
    db.commit()

    try:
        raw_text = _extract_raw_text(file_path, file_ext)
        extracted_data, confidence = _extract_structured_fields(raw_text, doc_id)

        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.raw_text = raw_text
            doc.extracted_data = extracted_data
            doc.extraction_confidence = confidence
            doc.extraction_status = "done"
            db.commit()

            # TASK 2: Trigger evidence matching agent (non-blocking)
            try:
                from ai.evidence_matcher import run_evidence_matching
                run_evidence_matching(str(doc.id), db)
            except Exception as em_err:
                print(f"[EvidenceMatcher] Failed for doc {doc_id}: {em_err}")

    except Exception as e:
        logger.error(f"Extraction failed for doc {doc_id}: {e}", exc_info=True)
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.extraction_status = "failed"
            db.commit()


def _extract_raw_text(file_path: str, file_ext: str) -> str:
    """Extract raw text from PDF or image."""
    raw_text = ""

    if file_ext == "pdf":
        # Try pdfplumber first (works for text-based PDFs)
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        raw_text += text + "\n"
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}")

        # Fallback to EasyOCR on rendered images (for scanned PDFs)
        if len(raw_text.strip()) < 50:
            try:
                reader = _get_ocr_reader()
                doc = fitz.open(file_path)
                for page_num in range(min(3, len(doc))):
                    page = doc.load_page(page_num)
                    pix = page.get_pixmap(dpi=200)
                    img_path = f"{file_path}_page{page_num}.png"
                    pix.save(img_path)
                    result = reader.readtext(img_path, detail=0)
                    raw_text += " ".join(result) + "\n"
                    # Clean up temp image
                    try:
                        os.remove(img_path)
                    except Exception:
                        pass
            except Exception as e:
                logger.warning(f"EasyOCR PDF fallback failed: {e}")

    elif file_ext in ("png", "jpg", "jpeg"):
        try:
            reader = _get_ocr_reader()
            result = reader.readtext(file_path, detail=0)
            raw_text = " ".join(result)
        except Exception as e:
            logger.warning(f"EasyOCR image read failed: {e}")

    return raw_text


def _extract_structured_fields(raw_text: str, doc_id: str):
    """Use Gemini to parse structured fields from raw OCR text."""
    extraction_prompt = f"""You are a document data extraction AI for an audit platform.
Extract structured information from the following document text.

Document text:
{raw_text[:4000]}

Return ONLY a valid JSON object with these fields (use null if not found):
{{
  "vendor_name": "...",
  "invoice_number": "...",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "total_amount": 0.00,
  "currency": "USD",
  "line_items": [
    {{"description": "...", "quantity": 1, "unit_price": 0.00, "amount": 0.00}}
  ],
  "tax_amount": 0.00,
  "payment_terms": "...",
  "document_type": "invoice or bank_statement or contract or other"
}}

Return ONLY the JSON. No explanation. No markdown code blocks."""

    try:
        response = None
        max_retries = 3
        client = get_ai_client()
        for attempt in range(max_retries):
            try:
                api_response = client.chat.completions.create(
                    model="openai/gpt-4o-mini",
                    messages=[{"role": "user", "content": extraction_prompt}],
                    max_tokens=2000
                )
                response_text = api_response.choices[0].message.content
                break
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    sleep_time = 15 * (attempt + 1)
                    logger.warning(f"OpenAI API rate limit hit. Retrying in {sleep_time}s...")
                    time.sleep(sleep_time)
                else:
                    raise e
        extracted_text = response_text.strip()

        # Strip markdown code fences if Gemini wraps output
        if extracted_text.startswith("```"):
            lines = extracted_text.split("\n")
            extracted_text = "\n".join(lines[1:-1])

        extracted_data = json.loads(extracted_text)
        confidence = 0.85
    except json.JSONDecodeError:
        logger.warning(f"JSON parse failed for doc {doc_id}, storing raw text")
        extracted_data = {"raw_extraction": extracted_text if "extracted_text" in dir() else ""}
        confidence = 0.3
    except Exception as e:
        logger.error(f"Gemini extraction failed for doc {doc_id}: {e}")
        extracted_data = {"error": "Rate limit or API error: " + str(e)}
        confidence = 0.0

    return extracted_data, confidence
