"""
AuditOS Module Registry
All available audit modules and their metadata.
Add new modules here as they are built.
"""

AVAILABLE_MODULES = {
    "financial_audit": {
        "name": "Financial Audit",
        "description": "Transaction analysis, fraud detection, workpaper generation, audit reports",
        "icon": "dollar-sign",
        "color": "#3b82f6",
        "is_core": True,    # Cannot be deactivated — everyone gets this
        "phase_available": 1
    },
    "internal_audit": {
        "name": "Internal Audit",
        "description": "Team collaboration, findings tracking, control testing, evidence management",
        "icon": "building",
        "color": "#8b5cf6",
        "is_core": False,
        "phase_available": 2
    },
    "tax_audit": {
        "name": "Tax Audit",
        "description": "GST reconciliation, TDS compliance, ITC mismatch detection, Form 3CD",
        "icon": "receipt",
        "color": "#f59e0b",
        "is_core": False,
        "phase_available": 3
    },
    "it_audit": {
        "name": "IT Audit",
        "description": "ITGC testing, user access review, change management, IT compliance",
        "icon": "monitor",
        "color": "#06b6d4",
        "is_core": False,
        "phase_available": 4,
        "coming_soon": True
    },
    "cyber_audit": {
        "name": "Cybersecurity Audit",
        "description": "Cloud infrastructure review, vulnerability analysis, NIST/ISO 27001 mapping",
        "icon": "shield",
        "color": "#ef4444",
        "is_core": False,
        "phase_available": 4,
        "coming_soon": True
    },
    "esg_audit": {
        "name": "ESG Audit",
        "description": "Carbon emissions, energy/water/waste, BRSR, GRI, TCFD reporting",
        "icon": "leaf",
        "color": "#10b981",
        "is_core": False,
        "phase_available": 4,
        "coming_soon": True
    },
    "operational_audit": {
        "name": "Operational Audit",
        "description": "Process mapping, KPI tracking, efficiency benchmarking, root cause analysis",
        "icon": "settings",
        "color": "#f97316",
        "is_core": False,
        "phase_available": 4,
        "coming_soon": True
    },
    "supply_chain_audit": {
        "name": "Supply Chain Audit",
        "description": "Vendor risk scoring, contract compliance, supplier ESG, third-party audit",
        "icon": "truck",
        "color": "#6366f1",
        "is_core": False,
        "phase_available": 5,
        "coming_soon": True
    }
}

# Modules that every new organization gets by default
DEFAULT_MODULES = ["financial_audit"]

def get_module_info(module_key: str) -> dict:
    return AVAILABLE_MODULES.get(module_key, {})

def is_valid_module(module_key: str) -> bool:
    return module_key in AVAILABLE_MODULES

def get_available_modules() -> list:
    return [
        {"key": k, **v}
        for k, v in AVAILABLE_MODULES.items()
    ]
