from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Date, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from core.database import Base


class Finding(Base):
    __tablename__ = "findings"
    __table_args__ = (
        Index('idx_findings_engagement', 'engagement_id'),
        Index('idx_findings_status', 'status'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    title = Column(String(500), nullable=False)
    description = Column(Text)
    finding_type = Column(String(100))       # 'control_deficiency', 'anomaly', 'compliance_gap', 'fraud_indicator'
    severity = Column(String(20))            # 'low', 'medium', 'high', 'critical'
    status = Column(String(50), default="open")  # 'open', 'in_progress', 'resolved', 'risk_accepted'

    recommendation = Column(Text)
    management_response = Column(Text)

    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    due_date = Column(Date, nullable=True)

    ai_generated = Column(Boolean, default=False)

    # Jira Finding Sync — populated after "Push to Jira" action
    jira_issue_key = Column(String(50), nullable=True)   # e.g. "AUDIT-123"
    jira_issue_url = Column(String(500), nullable=True)  # e.g. "https://firm.atlassian.net/browse/AUDIT-123"

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
