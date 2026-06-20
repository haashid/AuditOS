from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Numeric, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from core.database import Base


class ProcessRisk(Base):
    """
    Business process risk identification and assessment.
    The auditor documents each key process and its risks.
    """
    __tablename__ = "process_risks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    process_name = Column(String(255))     # e.g. 'Procure-to-Pay', 'Order-to-Cash'
    risk_name = Column(String(500))
    risk_description = Column(Text)
    risk_category = Column(String(100))    # 'financial', 'operational', 'compliance', 'strategic'

    inherent_likelihood = Column(Integer)  # 1-5
    inherent_impact = Column(Integer)      # 1-5
    inherent_risk_score = Column(Integer)  # likelihood * impact (1-25)

    control_description = Column(Text)
    control_effectiveness = Column(String(50))  # 'effective', 'partially_effective', 'ineffective'

    residual_likelihood = Column(Integer)  # 1-5
    residual_impact = Column(Integer)      # 1-5
    residual_risk_score = Column(Integer)  # 1-25

    risk_rating = Column(String(20))       # 'critical', 'high', 'medium', 'low'
    ai_recommendation = Column(Text)
    owner = Column(String(255))

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KPIRecord(Base):
    """
    Key Performance Indicator tracking for operational audit.
    Compares actual vs target vs prior period.
    """
    __tablename__ = "kpi_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    department = Column(String(255))
    kpi_name = Column(String(255))
    kpi_category = Column(String(100))    # 'financial', 'customer', 'process', 'people'
    unit = Column(String(50))

    actual_value = Column(Numeric(20, 4))
    target_value = Column(Numeric(20, 4))
    prior_period_value = Column(Numeric(20, 4))
    period = Column(String(20))

    variance_vs_target = Column(Numeric(10, 2))  # percentage
    variance_vs_prior = Column(Numeric(10, 2))   # percentage
    is_adverse = Column(Boolean, default=False)   # True if variance exceeds threshold
    threshold_pct = Column(Numeric(5, 2), default=10.0)  # Alert if variance > this %
    ai_explanation = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
