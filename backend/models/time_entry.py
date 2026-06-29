from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from core.database import Base


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    audit_area = Column(String(100))        # Revenue, Payroll, ITGC, etc.
    description = Column(Text)              # What was done
    minutes = Column(Integer, nullable=False)   # Duration in minutes
    billable = Column(String(10), default="yes")   # yes / no
    created_at = Column(DateTime(timezone=True), server_default=func.now())
