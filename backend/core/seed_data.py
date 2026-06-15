"""
Run this once to populate regulations and risk library.
Call seed_if_empty() from main.py on startup.
"""
from sqlalchemy.orm import Session
from models.regulation import Regulation
from models.risk_library import RiskLibraryItem

REGULATIONS = [
    {
        "code": "SOX_302",
        "framework": "SOX",
        "jurisdiction": "US",
        "title": "SOX Section 302 — Corporate Responsibility for Financial Reports",
        "description": "CEO and CFO must certify accuracy of financial statements. Requires disclosure controls and procedures.",
        "required_controls": [
            "CEO/CFO sign-off on financial statements",
            "Disclosure controls and procedures documented",
            "Material weaknesses reported to audit committee",
            "No significant changes in internal controls during quarter"
        ]
    },
    {
        "code": "SOX_404",
        "framework": "SOX",
        "jurisdiction": "US",
        "title": "SOX Section 404 — Management Assessment of Internal Controls",
        "description": "Management must assess and report on the effectiveness of internal controls over financial reporting.",
        "required_controls": [
            "Internal control framework documented (COSO/COBIT)",
            "Segregation of duties enforced in financial processes",
            "All journal entries reviewed and approved",
            "Reconciliations performed monthly",
            "IT general controls documented and tested"
        ]
    },
    {
        "code": "GDPR_ART_17",
        "framework": "GDPR",
        "jurisdiction": "EU",
        "title": "GDPR Article 17 — Right to Erasure",
        "description": "Individuals have the right to request deletion of personal data. Organizations must have processes to comply.",
        "required_controls": [
            "Data retention policy documented",
            "Process for handling erasure requests within 30 days",
            "Data inventory maintained",
            "Data processor agreements in place"
        ]
    },
    {
        "code": "IFRS_15",
        "framework": "IFRS",
        "jurisdiction": "GLOBAL",
        "title": "IFRS 15 — Revenue from Contracts with Customers",
        "description": "Specifies how and when revenue is recognized. Five-step model: identify contract, performance obligations, transaction price, allocate, recognize.",
        "required_controls": [
            "Revenue recognition policy documented per IFRS 15 five-step model",
            "Contract review process before revenue recognition",
            "Performance obligations identified for each contract type",
            "Variable consideration estimated and constrained appropriately",
            "Revenue cut-off controls at period end"
        ]
    },
    {
        "code": "GAAP_ASC_606",
        "framework": "GAAP",
        "jurisdiction": "US",
        "title": "ASC 606 — Revenue from Contracts with Customers",
        "description": "US GAAP equivalent of IFRS 15. Five-step revenue recognition model.",
        "required_controls": [
            "Revenue recognition policy aligned with ASC 606",
            "Contract modifications assessed and documented",
            "Principal vs agent determination documented",
            "Disaggregation of revenue disclosures prepared"
        ]
    },
    {
        "code": "HIPAA_SECURITY",
        "framework": "HIPAA",
        "jurisdiction": "US",
        "title": "HIPAA Security Rule",
        "description": "Requires administrative, physical, and technical safeguards to protect electronic protected health information (ePHI).",
        "required_controls": [
            "Risk analysis performed and documented",
            "Access controls to ePHI systems",
            "Audit controls and logging enabled",
            "Transmission security (encryption) for ePHI",
            "Workforce training on HIPAA policies"
        ]
    },
    {
        "code": "GST_IN",
        "framework": "GST",
        "jurisdiction": "IN",
        "title": "Indian GST Compliance",
        "description": "Goods and Services Tax compliance requirements for Indian businesses.",
        "required_controls": [
            "GST registration maintained for all applicable entities",
            "Monthly GSTR-1 and GSTR-3B filed on time",
            "Input tax credit reconciliation performed",
            "E-invoicing compliance for applicable turnover",
            "Annual GST audit (GSTR-9C) for eligible entities"
        ]
    }
]

RISK_LIBRARY = [
    # Banking
    {
        "industry": "banking",
        "risk_area": "Credit Risk",
        "risk_title": "Inadequate Loan Loss Provisioning",
        "risk_description": "Loans classified as performing that should be non-performing, resulting in understated credit loss provisions.",
        "likelihood": "high",
        "impact": "high",
        "audit_procedures": ["Review loan classification criteria", "Test sample of loans for correct classification", "Recalculate expected credit loss (ECL) for sample", "Compare provisions to regulatory minimums"],
        "red_flags": ["Provision-to-loan ratio declining while NPL ratio rises", "Large number of loan restructures", "Provisions below peer average"]
    },
    {
        "industry": "banking",
        "risk_area": "AML/KYC",
        "risk_title": "Incomplete Customer Due Diligence",
        "risk_description": "Customer onboarding without adequate KYC documentation, exposing the bank to money laundering risk.",
        "likelihood": "medium",
        "impact": "high",
        "audit_procedures": ["Sample customer files for KYC completeness", "Check high-risk customers for enhanced due diligence", "Review suspicious transaction reports filed"],
        "red_flags": ["Customers with incomplete ID documentation", "High-value cash transactions with no business rationale", "Transactions with high-risk jurisdictions"]
    },
    # Healthcare
    {
        "industry": "healthcare",
        "risk_area": "Billing & Revenue",
        "risk_title": "Upcoding and Phantom Billing",
        "risk_description": "Billing for higher-cost procedures than performed, or billing for services not rendered.",
        "likelihood": "medium",
        "impact": "high",
        "audit_procedures": ["Match billing codes to patient records sample", "Verify service dates against provider schedules", "Compare procedure mix to clinical benchmarks"],
        "red_flags": ["Unusual spike in high-cost procedure codes", "Billing on days provider was absent", "High rate of claim rejections and resubmissions"]
    },
    # Manufacturing
    {
        "industry": "manufacturing",
        "risk_area": "Inventory",
        "risk_title": "Inventory Overstatement",
        "risk_description": "Inventory recorded at cost but actual net realizable value is lower due to obsolescence or damage.",
        "likelihood": "medium",
        "impact": "high",
        "audit_procedures": ["Physical inventory count attendance", "Test NRV for slow-moving items", "Review write-off history", "Check FIFO/LIFO application consistency"],
        "red_flags": ["Inventory turnover ratio declining", "High proportion of inventory older than 180 days", "Large year-end inventory adjustments"]
    },
    # Retail
    {
        "industry": "retail",
        "risk_area": "Revenue",
        "risk_title": "Returns Fraud and Revenue Overstatement",
        "risk_description": "Manipulating return rates to inflate net revenue, or recording fictitious sales near period end.",
        "likelihood": "high",
        "impact": "medium",
        "audit_procedures": ["Cutoff testing of sales near period end", "Verify large returns with supporting documentation", "Reconcile POS data to general ledger"],
        "red_flags": ["Spike in sales in last week of reporting period", "High return rate post period-end", "Credit notes without matching return receipts"]
    },
    # Government
    {
        "industry": "government",
        "risk_area": "Procurement",
        "risk_title": "Procurement Fraud and Bid Rigging",
        "risk_description": "Awarding contracts to related parties, splitting contracts below tender thresholds, or accepting kickbacks.",
        "likelihood": "high",
        "impact": "high",
        "audit_procedures": ["Test all contracts above threshold for proper tender", "Check vendor registration against employee records (related party)", "Analyze contract splitting patterns"],
        "red_flags": ["Multiple contracts to same vendor just below tender threshold", "Single-bid contracts for specialized work", "Vendors registered at employee addresses"]
    }
]


def seed_if_empty(db: Session):
    """Call on startup. Only seeds if tables are empty."""
    if db.query(Regulation).count() == 0:
        for reg in REGULATIONS:
            db.add(Regulation(**reg))
        db.commit()
        print("[Seed] Seeded regulations table.")

    if db.query(RiskLibraryItem).count() == 0:
        for item in RISK_LIBRARY:
            db.add(RiskLibraryItem(**item))
        db.commit()
        print("[Seed] Seeded risk library table.")
