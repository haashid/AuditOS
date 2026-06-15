from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Integer, Numeric, Boolean, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from core.database import Base


class Engagement(Base):
    __tablename__ = "engagements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    client_name = Column(String(255))
    audit_type = Column(String(100), default="financial")
    fiscal_year_start = Column(Date)
    fiscal_year_end = Column(Date)
    status = Column(String(50), default="planning")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index('idx_transactions_engagement', 'engagement_id'),
        Index('idx_transactions_flagged', 'is_flagged'),
        Index('idx_transactions_risk_score', 'risk_score'),
        Index('idx_transactions_date', 'transaction_date'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    transaction_date = Column(Date)
    document_number = Column(String(100))
    account_code = Column(String(50))
    account_name = Column(String(255))
    debit_amount = Column(Numeric(20, 4), default=0)
    credit_amount = Column(Numeric(20, 4), default=0)
    currency = Column(String(3), default="USD")
    description = Column(Text)
    posted_by = Column(String(255))
    # Flags — computed on upload, stored here
    is_flagged = Column(Boolean, default=False)
    flag_reasons = Column(JSONB, default=list)
    risk_score = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
