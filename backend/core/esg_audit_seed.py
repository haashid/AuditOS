from sqlalchemy.orm import Session
from models.esg_audit import ESGMetric

def seed_brsr_metrics(engagement_id: str, org_id: str, db: Session):
    existing = db.query(ESGMetric).filter(
        ESGMetric.engagement_id == engagement_id
    ).first()
    if existing:
        return

    metrics = [
        {"pillar": "Environmental", "metric_name": "E1: Scope 1 Emissions", "unit": "tCO2e"},
        {"pillar": "Environmental", "metric_name": "E2: Scope 2 Emissions", "unit": "tCO2e"},
        {"pillar": "Environmental", "metric_name": "E3: Total Energy Consumption", "unit": "GJ"},
        {"pillar": "Environmental", "metric_name": "E4: Total Water Consumption", "unit": "Kilolitres"},
        {"pillar": "Environmental", "metric_name": "E5: Total Waste Generated", "unit": "Metric Tonnes"},
        {"pillar": "Social", "metric_name": "S1: Total Employees", "unit": "Count"},
        {"pillar": "Social", "metric_name": "S2: Female Representation", "unit": "Percentage"},
        {"pillar": "Social", "metric_name": "S3: Lost Time Injury Frequency Rate", "unit": "Rate"},
        {"pillar": "Social", "metric_name": "S4: Training Hours per Employee", "unit": "Hours"},
        {"pillar": "Social", "metric_name": "S5: Median Wages (Male vs Female ratio)", "unit": "Ratio"},
        {"pillar": "Governance", "metric_name": "G1: Independent Directors", "unit": "Percentage"},
        {"pillar": "Governance", "metric_name": "G2: Anti-Corruption Training Completion", "unit": "Percentage"},
        {"pillar": "Governance", "metric_name": "G3: Data Breaches Reported", "unit": "Count"},
        {"pillar": "Governance", "metric_name": "G4: Regulatory Fines Paid", "unit": "INR"}
    ]

    for m in metrics:
        db.add(ESGMetric(
            org_id=org_id,
            engagement_id=engagement_id,
            pillar=m["pillar"],
            category="BRSR",
            metric_name=m["metric_name"],
            unit=m["unit"],
            value=0.0
        ))
    db.commit()
