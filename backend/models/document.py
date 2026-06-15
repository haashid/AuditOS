from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    # File metadata
    file_name = Column(String(500), nullable=False)
    file_type = Column(String(50))           # 'invoice', 'bank_statement', 'contract', 'other'
    storage_path = Column(Text, nullable=False)
    file_hash = Column(String(64))           # SHA-256 of file contents

    # Extraction results
    raw_text = Column(Text)                  # Full OCR text output
    extracted_data = Column(JSONB)           # Structured extracted fields
    extraction_confidence = Column(Float)    # 0.0 to 1.0
    extraction_status = Column(String(50), default="pending")  # pending, processing, done, failed

    # Matching result
    matched_transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=True)
    match_confidence = Column(Float)

    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
