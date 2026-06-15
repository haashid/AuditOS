from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from core.database import Base


class RiskLibraryItem(Base):
    __tablename__ = "risk_library"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    industry = Column(String(100))      # 'banking', 'healthcare', 'manufacturing',
                                         # 'retail', 'government', 'education'
    risk_area = Column(String(255))     # e.g. 'Revenue Recognition', 'Payroll'
    risk_title = Column(String(500))
    risk_description = Column(Text)
    likelihood = Column(String(20))     # 'low', 'medium', 'high'
    impact = Column(String(20))         # 'low', 'medium', 'high'
    audit_procedures = Column(JSONB)    # list of recommended audit steps
    red_flags = Column(JSONB)           # list of warning signs to look for
