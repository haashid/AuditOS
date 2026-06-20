from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Numeric, Integer, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from core.database import Base


class EmissionRecord(Base):
    """
    Greenhouse gas emission data entry.
    Supports Scope 1, 2, and 3 emissions.
    """
    __tablename__ = "emission_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    scope = Column(Integer)             # 1, 2, or 3
    category = Column(String(255))      # e.g. 'Stationary Combustion', 'Purchased Electricity',
                                         # 'Business Travel', 'Employee Commuting'
    activity_data = Column(Numeric(20, 4))  # Amount of activity (liters of fuel, kWh, km, etc.)
    activity_unit = Column(String(50))       # 'liters', 'kWh', 'km', 'tonnes'
    emission_factor = Column(Numeric(20, 6)) # kg CO2e per unit
    co2e_tonnes = Column(Numeric(20, 4))     # Total CO2 equivalent in tonnes
    data_source = Column(String(255))        # Source of emission factor
    period = Column(String(10))             # 'FY2024', 'Q1-2024', etc.
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ESGMetric(Base):
    """
    Non-emission ESG metrics (energy, water, waste, social, governance).
    """
    __tablename__ = "esg_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    pillar = Column(String(20))         # 'environmental', 'social', 'governance'
    category = Column(String(100))      # 'energy', 'water', 'waste', 'diversity', 'safety'
    metric_name = Column(String(255))
    value = Column(Numeric(20, 4))
    unit = Column(String(50))
    period = Column(String(10))
    target_value = Column(Numeric(20, 4))  # if targets exist
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BRSRResponse(Base):
    """
    BRSR (Business Responsibility and Sustainability Reporting) disclosure responses.
    SEBI mandated for top 1000 listed Indian companies from FY 2022-23.
    """
    __tablename__ = "brsr_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    section = Column(String(10))        # 'A', 'B', 'C'
    principle = Column(String(10))      # 'P1' to 'P9' (BRSR has 9 principles)
    question_id = Column(String(20))
    question_text = Column(Text)
    response = Column(Text)
    ai_suggested_response = Column(Text)
    is_essential = Column(Boolean, default=True)  # Essential vs Leadership indicator
    is_completed = Column(Boolean, default=False)
    data_reference = Column(Text)       # Which ESGMetric or EmissionRecord supports this

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
