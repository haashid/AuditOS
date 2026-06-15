from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from core.database import Base


class Regulation(Base):
    __tablename__ = "regulations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(100), unique=True, nullable=False)   # 'SOX_302', 'GDPR_ART_17', 'IFRS_15'
    framework = Column(String(100))    # 'SOX', 'GDPR', 'IFRS', 'GAAP', 'GST', 'HIPAA'
    jurisdiction = Column(String(100)) # 'US', 'EU', 'IN', 'GLOBAL'
    title = Column(String(500))
    description = Column(Text)
    required_controls = Column(JSONB)  # list of control descriptions required by this regulation
    effective_date = Column(Date)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ComplianceGap(Base):
    __tablename__ = "compliance_gaps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    regulation_id = Column(UUID(as_uuid=True), ForeignKey("regulations.id"), nullable=False)

    control_description = Column(Text)   # the required control
    gap_status = Column(String(50))      # 'present', 'partial', 'missing'
    evidence = Column(Text)              # what was found (or not found) in the data
    remediation_suggestion = Column(Text)
    ai_generated = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
