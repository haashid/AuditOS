from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Integer, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from core.database import Base


class ITGCControl(Base):
    """
    ITGC control checklist item.
    Each engagement has a set of ITGC controls to test.
    Pre-seeded with standard controls on first use.
    """
    __tablename__ = "itgc_controls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    category = Column(String(100))  # 'access_control', 'change_management',
                                     # 'computer_operations', 'program_development'
    control_id = Column(String(20))  # 'AC-01', 'CM-01', etc.
    control_name = Column(String(500))
    control_description = Column(Text)
    test_procedure = Column(Text)

    # Assessment
    effectiveness = Column(String(50))   # 'effective', 'partially_effective',
                                          # 'ineffective', 'not_tested'
    evidence_description = Column(Text)  # What the auditor found
    auditor_notes = Column(Text)
    ai_assessment = Column(Text)         # AI-generated assessment

    is_key_control = Column(Boolean, default=False)
    deficiency_type = Column(String(50))  # null, 'deficiency', 'significant_deficiency',
                                           # 'material_weakness'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class UserAccessRecord(Base):
    """
    User access data — uploaded from Active Directory, Okta, or manual CSV.
    Used to detect excessive privileges, dormant accounts, SoD violations.
    """
    __tablename__ = "user_access_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    username = Column(String(255))
    full_name = Column(String(255))
    email = Column(String(255))
    department = Column(String(255))
    job_title = Column(String(255))
    system_name = Column(String(255))  # Which system (ERP, email, core banking, etc.)
    access_level = Column(String(100)) # 'admin', 'read_write', 'read_only', 'superuser'
    access_granted_date = Column(Date)
    last_login_date = Column(Date)
    is_active = Column(Boolean, default=True)
    has_mfa = Column(Boolean, default=False)

    # Risk flags (computed on upload)
    is_dormant = Column(Boolean, default=False)        # No login in 90+ days
    has_excessive_rights = Column(Boolean, default=False)
    sod_conflict = Column(Boolean, default=False)       # Has conflicting roles
    risk_flag = Column(String(50))   # 'dormant', 'excessive_rights', 'sod_conflict', 'no_mfa'
    risk_notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ChangeLogEntry(Base):
    """
    IT change management log — uploaded from ITSM tool (Jira, ServiceNow, etc.)
    Used to test change management controls.
    """
    __tablename__ = "change_log_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    change_id = Column(String(100))        # e.g. CHG-0001
    change_type = Column(String(50))       # 'standard', 'emergency', 'normal'
    description = Column(Text)
    requested_by = Column(String(255))
    approved_by = Column(String(255))
    implemented_by = Column(String(255))
    change_date = Column(Date)
    environment = Column(String(50))       # 'production', 'staging', 'development'
    has_rollback_plan = Column(Boolean, default=False)
    was_tested = Column(Boolean, default=False)

    # Risk flags
    is_unauthorized = Column(Boolean, default=False)   # No approval recorded
    is_emergency = Column(Boolean, default=False)       # Emergency change
    production_direct = Column(Boolean, default=False)  # Direct prod change

    created_at = Column(DateTime(timezone=True), server_default=func.now())
