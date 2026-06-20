"""
Documents API — upload evidence files, trigger OCR extraction in background.
"""
import hashlib
import logging
import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ai.document_extractor import extract_document
from core.config import settings
from core.database import get_db
from core.security import get_current_user
from models.document import Document
from models.engagement import Engagement

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg"}
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}


@router.post("/engagements/{engagement_id}/documents/upload")
async def upload_document(
    engagement_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload an evidence document (PDF/PNG/JPG). OCR extraction runs in background."""
    # Verify engagement belongs to this org
    engagement = (
        db.query(Engagement)
        .filter(
            Engagement.id == engagement_id,
            Engagement.org_id == current_user.org_id,
        )
        .first()
    )
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    # Validate file type
    file_ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename else ""
    content_type = file.content_type or ""

    if file_ext not in ALLOWED_EXTENSIONS and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only PDF, PNG, and JPG files are allowed.",
        )

    # Read file content + compute hash
    contents = await file.read()
    file_hash = hashlib.sha256(contents).hexdigest()

    # Save to disk
    save_dir = os.path.join(settings.UPLOAD_DIR, engagement_id, "documents")
    # WARNING: Railway uses an ephemeral file system by default. 
    # Unless a volume is attached, these files will be lost on the next deploy.
    logger.warning("Saving to local UPLOAD_DIR. Ensure persistent storage is configured for production on Railway.")
    os.makedirs(save_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    save_path = os.path.join(save_dir, f"{file_id}.{file_ext}")
    with open(save_path, "wb") as f:
        f.write(contents)

    # Detect document type from filename
    doc_type = "other"
    fname_lower = (file.filename or "").lower()
    if "invoice" in fname_lower or "inv" in fname_lower:
        doc_type = "invoice"
    elif "bank" in fname_lower or "statement" in fname_lower:
        doc_type = "bank_statement"
    elif "contract" in fname_lower or "agreement" in fname_lower:
        doc_type = "contract"

    # Save DB record
    doc = Document(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        file_name=file.filename or "untitled",
        file_type=doc_type,
        storage_path=save_path,
        file_hash=file_hash,
        extraction_status="pending",
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Queue background extraction
    background_tasks.add_task(extract_document, str(doc.id), save_path, file_ext, db)

    return {
        "id": str(doc.id),
        "file_name": doc.file_name,
        "file_type": doc_type,
        "extraction_status": "pending",
        "message": "Document uploaded. Extraction running in background.",
    }


@router.get("/engagements/{engagement_id}/documents")
def list_documents(
    engagement_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all uploaded documents for an engagement."""
    docs = (
        db.query(Document)
        .filter(
            Document.engagement_id == engagement_id,
            Document.org_id == current_user.org_id,
        )
        .order_by(Document.created_at.desc())
        .all()
    )

    return [
        {
            "id": str(d.id),
            "file_name": d.file_name,
            "file_type": d.file_type,
            "extraction_status": d.extraction_status,
            "extracted_data": d.extracted_data,
            "extraction_confidence": d.extraction_confidence,
            "matched_transaction_id": str(d.matched_transaction_id) if d.matched_transaction_id else None,
            "match_confidence": d.match_confidence,
            "uploaded_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]
