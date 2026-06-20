from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Numeric, Integer, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from core.database import Base

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    vendor_code = Column(String(50))
    vendor_name = Column(String(255))
    category = Column(String(100))        # IT, Logistics, Raw Materials, Services
    criticality = Column(String(50))      # High, Medium, Low
    annual_spend = Column(Numeric(15, 2))
    status = Column(String(50), default="active")
    
    # Computed Risk Scores (0-100)
    financial_risk_score = Column(Integer)
    cyber_risk_score = Column(Integer)
    esg_risk_score = Column(Integer)
    overall_risk_score = Column(Integer)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VendorRiskAssessment(Base):
    __tablename__ = "vendor_risk_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    assessment_date = Column(Date)
    assessor_name = Column(String(255))
    
    # Context given to AI
    financial_notes = Column(Text)
    cyber_notes = Column(Text)
    esg_notes = Column(Text)
    
    # AI Generated Outputs
    ai_financial_risk_explanation = Column(Text)
    ai_cyber_risk_explanation = Column(Text)
    ai_esg_risk_explanation = Column(Text)
    ai_overall_summary = Column(Text)
    ai_recommended_actions = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
