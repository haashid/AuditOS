from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Numeric, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from core.database import Base

class FreelancerProfile(Base):
    __tablename__ = "freelancer_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    specialties = Column(JSONB) # ["IT Audit", "Tax", "Cyber"]
    hourly_rate = Column(Numeric(10, 2))
    rating = Column(Numeric(3, 2), default=5.0)
    is_verified = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MarketplaceJob(Base):
    __tablename__ = "marketplace_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    
    title = Column(String(255))
    description = Column(Text)
    budget_type = Column(String(50)) # 'Fixed', 'Hourly'
    budget_amount = Column(Numeric(15, 2))
    status = Column(String(50), default="Open") # Open, Assigned, Completed

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class JobBid(Base):
    __tablename__ = "job_bids"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("marketplace_jobs.id"), nullable=False)
    freelancer_id = Column(UUID(as_uuid=True), ForeignKey("freelancer_profiles.id"), nullable=False)
    
    bid_amount = Column(Numeric(15, 2))
    cover_letter = Column(Text)
    status = Column(String(50), default="Pending") # Pending, Accepted, Rejected

    created_at = Column(DateTime(timezone=True), server_default=func.now())
