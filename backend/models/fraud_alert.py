from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from core.database import Base

class FraudAlert(Base):
    __tablename__ = "fraud_alerts"
    __table_args__ = (
        Index('idx_fraud_alerts_engagement', 'engagement_id'),
        Index('idx_fraud_alerts_status', 'status'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    pattern_type = Column(String(100))   # 'threshold_splitting', 'duplicate_payment',
                                          # 'benford_deviation', 'ghost_payment',
                                          # 'round_number_cluster', 'weekend_cluster'
    severity = Column(String(20))         # 'low', 'medium', 'high', 'critical'
    title = Column(String(500))
    description = Column(Text)
    affected_transaction_ids = Column(JSONB)   # list of transaction UUIDs
    pattern_data = Column(JSONB)               # raw pattern stats
    ai_explanation = Column(Text)              # Gemini-generated plain English explanation
    confidence_score = Column(Float)           # 0.0 to 1.0

    status = Column(String(50), default="open")   # 'open', 'investigated', 'dismissed', 'escalated'
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
