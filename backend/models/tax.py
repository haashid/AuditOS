from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Numeric, Integer, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from core.database import Base


class GSTReturn(Base):
    """Stores an uploaded GST return file (GSTR-1, GSTR-3B, GSTR-2B)."""
    __tablename__ = "gst_returns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    return_type = Column(String(20), nullable=False)  # 'GSTR-1', 'GSTR-3B', 'GSTR-2B'
    filing_period = Column(String(10))   # 'MM-YYYY' e.g. '01-2024'
    gstin = Column(String(15))           # GST Identification Number

    raw_data = Column(JSONB)             # Full parsed JSON from the return
    total_taxable_value = Column(Numeric(20, 2))
    total_igst = Column(Numeric(20, 2))
    total_cgst = Column(Numeric(20, 2))
    total_sgst = Column(Numeric(20, 2))
    total_tax = Column(Numeric(20, 2))

    file_name = Column(String(500))
    upload_status = Column(String(50), default="processed")
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ITCMismatch(Base):
    """Stores detected mismatches between ITC claimed and ITC available."""
    __tablename__ = "itc_mismatches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    supplier_gstin = Column(String(15))
    supplier_name = Column(String(255))
    filing_period = Column(String(10))

    itc_in_2b = Column(Numeric(20, 2))    # ITC available per GSTR-2B
    itc_in_3b = Column(Numeric(20, 2))    # ITC claimed in GSTR-3B
    difference = Column(Numeric(20, 2))   # itc_in_3b - itc_in_2b
    mismatch_type = Column(String(50))    # 'excess_claimed', 'short_claimed', 'not_in_2b'
    risk_level = Column(String(20))       # 'low', 'medium', 'high', 'critical'
    ai_explanation = Column(Text)

    status = Column(String(50), default="open")  # 'open', 'explained', 'reversed'
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TDSRecord(Base):
    """Stores TDS data from 26AS or manual upload."""
    __tablename__ = "tds_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    deductor_name = Column(String(255))
    deductor_tan = Column(String(15))
    section = Column(String(20))          # '194A', '194C', '194J', etc.
    payment_date = Column(Date)
    tds_amount = Column(Numeric(20, 2))
    payment_amount = Column(Numeric(20, 2))
    tds_rate = Column(Numeric(5, 2))
    source = Column(String(50))           # '26AS', 'books', 'manual'

    # Reconciliation
    matched_in_books = Column(Boolean, default=False)
    book_amount = Column(Numeric(20, 2))
    variance = Column(Numeric(20, 2))

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Form3CDResponse(Base):
    """Stores responses to Form 3CD clauses for an engagement."""
    __tablename__ = "form_3cd_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    clause_number = Column(String(10))    # '12', '13', '14a', '40a', etc.
    clause_text = Column(Text)            # The actual clause question
    response = Column(Text)               # Auditor's answer
    ai_suggested_response = Column(Text)  # AI-generated suggestion
    ai_confidence = Column(Numeric(3, 2)) # 0.00 to 1.00
    is_applicable = Column(Boolean, default=True)
    is_completed = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
