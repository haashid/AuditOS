from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from core.database import Base


class Vulnerability(Base):
    """
    Vulnerability records — imported from Nessus/OpenVAS XML export
    or manually entered.
    """
    __tablename__ = "vulnerabilities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    plugin_id = Column(String(50))          # Nessus plugin ID
    vuln_name = Column(String(500))
    description = Column(Text)
    host = Column(String(255))              # IP address or hostname
    port = Column(Integer)
    protocol = Column(String(10))           # tcp, udp
    cvss_score = Column(Numeric(4, 1))      # 0.0 to 10.0
    severity = Column(String(20))           # 'critical', 'high', 'medium', 'low', 'info'
    cve_ids = Column(JSONB)                 # list of CVE references
    solution = Column(Text)
    source = Column(String(50))             # 'nessus', 'openvas', 'manual'

    status = Column(String(50), default="open")  # 'open', 'remediated', 'accepted_risk', 'false_positive'
    ai_recommendation = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CyberControl(Base):
    """
    Cybersecurity control assessment mapped to NIST CSF and ISO 27001.
    """
    __tablename__ = "cyber_controls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    engagement_id = Column(UUID(as_uuid=True), ForeignKey("engagements.id"), nullable=False)

    framework = Column(String(50))          # 'NIST_CSF', 'ISO_27001'
    function = Column(String(50))           # NIST: 'Identify','Protect','Detect','Respond','Recover'
    control_id = Column(String(20))         # e.g. 'PR.AC-1', 'A.9.1.1'
    control_name = Column(String(500))
    control_description = Column(Text)

    maturity_level = Column(Integer)        # 0=Not Implemented, 1=Partial, 2=Risk Informed,
                                             # 3=Repeatable, 4=Adaptive (NIST tiers)
    evidence = Column(Text)
    gap_description = Column(Text)
    ai_recommendation = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
