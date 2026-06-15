import sys
import os

from core.database import SessionLocal
from models.user import Organization

db = SessionLocal()
org = db.query(Organization).first()
if org:
    print(f"Current modules: {org.modules}")
    org.modules = ["financial_audit", "internal_audit", "tax_audit"]
    db.commit()
    print("Successfully activated all modules: financial_audit, internal_audit, tax_audit")
else:
    print("No organization found.")
db.close()
