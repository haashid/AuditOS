from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from core.database import Base

class ConnectorToken(Base):
    __tablename__ = "connector_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=True)
    connector_type = Column(String(50), nullable=False)  # 'quickbooks', 'xero'
    access_token = Column(Text)
    refresh_token = Column(Text)
    realm_id = Column(String(255))     # QuickBooks company ID
    tenant_id = Column(String(255))    # Xero tenant ID
    token_expiry = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
