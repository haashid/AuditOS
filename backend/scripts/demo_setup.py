import os
import sys
import uuid
import datetime
from sqlalchemy.orm import Session

# Add backend to path so we can import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal, engine, Base
from core.security import hash_password
from models.user import User, Organization
from models.engagement import Engagement

def setup_demo_data():
    print("Setting up demo data...")
    db: Session = SessionLocal()

    # 1. Create a demo organization if none exists
    org = db.query(Organization).filter_by(slug="demo-org").first()
    if not org:
        org = Organization(
            id=uuid.uuid4(),
            name="Demo Audit Partners",
            slug="demo-org"
        )
        db.add(org)
        db.commit()
        db.refresh(org)
        print(f"Created Organization: {org.name}")
    else:
        print(f"Organization already exists: {org.name}")

    # 2. Create users with different roles
    demo_users = [
        {"email": "partner@demo.com", "name": "Sarah (Partner/Admin)", "role": "admin"},
        {"email": "reviewer@demo.com", "name": "John (Reviewer)", "role": "reviewer"},
        {"email": "auditor@demo.com", "name": "Emily (Auditor)", "role": "auditor"},
    ]

    for u in demo_users:
        user = db.query(User).filter_by(email=u["email"]).first()
        if not user:
            user = User(
                id=uuid.uuid4(),
                org_id=org.id,
                email=u["email"],
                full_name=u["name"],
                hashed_password=hash_password("password123"), # Universal demo password
                role=u["role"],
                is_active=True,
                onboarding_completed=True
            )
            db.add(user)
            print(f"Created {u['role'].capitalize()}: {u['email']} (pw: password123)")
        else:
            # Update role just in case
            user.role = u["role"]
            user.hashed_password = hash_password("password123")
            print(f"Updated {u['role'].capitalize()}: {u['email']}")

    # 3. Create a Demo Client / Engagement
    eng = db.query(Engagement).filter_by(client_name="Acme Corp Demo").first()
    if not eng:
        eng = Engagement(
            id=uuid.uuid4(),
            org_id=org.id,
            name="FY25 Financial Audit",
            client_name="Acme Corp Demo",
            audit_type="financial",
            fiscal_year_start=datetime.date(2024, 1, 1),
            fiscal_year_end=datetime.date(2024, 12, 31),
            status="active"
        )
        db.add(eng)
        print("Created Demo Engagement: FY25 Financial Audit for Acme Corp")
    
    db.commit()
    db.close()
    print("Demo data setup complete!")

if __name__ == "__main__":
    setup_demo_data()
