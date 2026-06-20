from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from core.database import Base

class InternalControl(Base):
    __tablename__ = "internal_controls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    process_name = Column(String(255), nullable=False)
    risk_description = Column(Text, nullable=False)
    control_activity = Column(Text, nullable=False)
    frequency = Column(String(50), default="Annual") # Annual, Quarterly, Monthly, Daily
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default="Active") # Active, Draft

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tests = relationship("ControlTest", back_populates="control", cascade="all, delete-orphan")


class ControlTest(Base):
    __tablename__ = "control_tests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    control_id = Column(UUID(as_uuid=True), ForeignKey("internal_controls.id"), nullable=False)
    tester_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    test_date = Column(DateTime(timezone=True), server_default=func.now())
    effectiveness = Column(String(50), default="Not Tested") # Effective, Ineffective, Not Tested
    evidence_url = Column(String(1024), nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    control = relationship("InternalControl", back_populates="tests")
