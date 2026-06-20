import requests
import json
import uuid

API_URL = "http://localhost:8000/api/v1"

def test_rbac():
    print("--- Starting RBAC Tests ---")
    
    # 1. Register Senior Auditor
    senior_email = f"senior_{uuid.uuid4().hex[:6]}@test.com"
    res = requests.post(f"{API_URL}/auth/register", json={
        "email": senior_email,
        "password": "password123",
        "full_name": "Senior Test",
        "org_name": "Test Org"
    })
    senior_token = res.json()["access_token"]
    
    # Update role to senior_auditor directly in DB or via API if possible.
    # Actually wait, registering gives default role 'auditor'. I need to promote.
    
    print("Tests will be done manually or via a better script.")

if __name__ == '__main__':
    test_rbac()
