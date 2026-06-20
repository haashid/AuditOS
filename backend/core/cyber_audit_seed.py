from sqlalchemy.orm import Session
from models.cyber_audit import CyberControl

def seed_nist_controls(engagement_id: str, org_id: str, db: Session):
    existing = db.query(CyberControl).filter(
        CyberControl.engagement_id == engagement_id,
        CyberControl.framework == 'NIST_CSF'
    ).first()
    if existing:
        return

    controls = [
        {"function": "Identify", "category": "Asset Management", "control_code": "ID.AM-1", "control_name": "Physical devices and systems are inventoried"},
        {"function": "Identify", "category": "Asset Management", "control_code": "ID.AM-2", "control_name": "Software platforms and applications are inventoried"},
        {"function": "Identify", "category": "Risk Assessment", "control_code": "ID.RA-1", "control_name": "Vulnerabilities are identified and documented"},
        {"function": "Protect", "category": "Identity Management", "control_code": "PR.AC-1", "control_name": "Identities and credentials are managed (MFA)"},
        {"function": "Protect", "category": "Identity Management", "control_code": "PR.AC-4", "control_name": "Access permissions are managed (Least Privilege)"},
        {"function": "Protect", "category": "Data Security", "control_code": "PR.DS-1", "control_name": "Data-at-rest is protected (Encryption)"},
        {"function": "Protect", "category": "Data Security", "control_code": "PR.DS-2", "control_name": "Data-in-transit is protected (TLS)"},
        {"function": "Protect", "category": "Information Protection Processes", "control_code": "PR.IP-1", "control_name": "A baseline configuration of IT systems is created"},
        {"function": "Protect", "category": "Protective Technology", "control_code": "PR.PT-1", "control_name": "Audit logs are implemented and reviewed"},
        {"function": "Detect", "category": "Anomalies and Events", "control_code": "DE.AE-1", "control_name": "A baseline of network operations and expected data flows is established"},
        {"function": "Detect", "category": "Security Continuous Monitoring", "control_code": "DE.CM-1", "control_name": "Network is monitored to detect potential cybersecurity events"},
        {"function": "Detect", "category": "Security Continuous Monitoring", "control_code": "DE.CM-8", "control_name": "Vulnerability scans are performed"},
        {"function": "Respond", "category": "Response Planning", "control_code": "RS.RP-1", "control_name": "Response plan is executed during or after an incident"},
        {"function": "Respond", "category": "Communications", "control_code": "RS.CO-2", "control_name": "Incidents are reported to stakeholders"},
        {"function": "Recover", "category": "Recovery Planning", "control_code": "RC.RP-1", "control_name": "Recovery plan is executed during or after an incident"},
        {"function": "Recover", "category": "Improvements", "control_code": "RC.IM-1", "control_name": "Recovery plans incorporate lessons learned"}
    ]

    for c in controls:
        db.add(CyberControl(
            org_id=org_id,
            engagement_id=engagement_id,
            framework="NIST_CSF",
            function=c["function"],
            control_id=c["control_code"],
            control_name=c["control_name"],
            maturity_level=0
        ))
    db.commit()
