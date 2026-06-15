from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from core.database import Base


class Workpaper(Base):
    __tablename__ = "workpapers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    audit_area = Column(String(255))         # 'Revenue', 'Payroll', 'Procurement', 'Cash', 'Expenses'
    objective = Column(Text)
    procedure = Column(Text)
    population_description = Column(Text)
    population_count = Column(Integer)
    sample_count = Column(Integer)
    exceptions_found = Column(Text)
    conclusion = Column(Text)
    full_content = Column(Text)              # Full AI-generated workpaper text

    status = Column(String(50), default="draft")   # 'draft', 'reviewed', 'approved'
    ai_generated = Column(Boolean, default=True)

    # Phase 2: approval workflow
    approval_status = Column(String(50), default="draft")  # draft, submitted, approved, rejected
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    review_comment = Column(Text, nullable=True)

    prepared_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
