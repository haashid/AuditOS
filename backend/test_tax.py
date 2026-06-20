import json
import uuid
import sys
import os

# Add the backend directory to sys.path so we can import from it
sys.path.insert(0, os.path.abspath('backend'))

from main import app
from fastapi.testclient import TestClient
from core.database import SessionLocal
from models.user import User, Organization
from models.engagement import Engagement
from models.tax import GSTReturn, ITCMismatch
from core.security import create_access_token
from api.v1.tax import _run_itc_reconciliation

client = TestClient(app)
db = SessionLocal()

# 1. Create a user and org WITHOUT tax_audit module
org1 = Organization(id=uuid.uuid4(), name="Test Org 1 (No Tax)", slug=f"test1-{uuid.uuid4()}", modules=["financial_audit"])
db.add(org1)
user1 = User(id=uuid.uuid4(), email=f"user1_{uuid.uuid4()}@test.com", full_name="User 1", hashed_password="pw", org_id=org1.id)
db.add(user1)
db.commit()

token1 = create_access_token({"sub": str(user1.id)})
headers1 = {"Authorization": f"Bearer {token1}"}

print("=== TEST MG2 (Module Gating) ===")
res1 = client.get(f"/api/v1/tax/engagements/{uuid.uuid4()}/form-3cd", headers=headers1)
print("Raw 403 JSON:")
print(json.dumps(res1.json(), indent=2))
print("========================================")

# 2. Create a user and org WITH tax_audit module
org2 = Organization(id=uuid.uuid4(), name="Test Org 2 (With Tax)", slug=f"test2-{uuid.uuid4()}", modules=["financial_audit", "tax_audit"])
db.add(org2)
user2 = User(id=uuid.uuid4(), email=f"user2_{uuid.uuid4()}@test.com", full_name="User 2", hashed_password="pw", org_id=org2.id)
db.add(user2)
db.commit()

eng2 = Engagement(id=uuid.uuid4(), org_id=org2.id, name="Test Eng", client_name="Test Client", status="planning", fiscal_year_start="2023-01-01", fiscal_year_end="2023-12-31")
db.add(eng2)
db.commit()

# Add dummy GSTR-2B and GSTR-3B data
gstr2b = GSTReturn(
    org_id=org2.id, engagement_id=eng2.id, return_type="GSTR-2B", filing_period="2023-01", gstin="123", raw_data={},
    total_igst=1000, total_cgst=500, total_sgst=500, file_name="gstr2b.json", uploaded_by=user2.id
)
gstr3b = GSTReturn(
    org_id=org2.id, engagement_id=eng2.id, return_type="GSTR-3B", filing_period="2023-01", gstin="123", 
    raw_data={"itc_claimed_igst": 1500, "itc_claimed_cgst": 500, "itc_claimed_sgst": 500},
    file_name="gstr3b.json", uploaded_by=user2.id
)
db.add_all([gstr2b, gstr3b])
db.commit()

# Run reconciliation directly
print("Running AI reconciliation... please wait.")
_run_itc_reconciliation(str(eng2.id), str(org2.id), str(user2.id))

token2 = create_access_token({"sub": str(user2.id)})
headers2 = {"Authorization": f"Bearer {token2}"}

print("=== TEST GST4 (Tax Audit - ITC Mismatch AI) ===")
res2 = client.get(f"/api/v1/tax/engagements/{eng2.id}/itc-mismatches", headers=headers2)
print("Raw ITC Mismatch Array:")
print(json.dumps(res2.json(), indent=2))
print("========================================")
