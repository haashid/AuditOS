import sys
import os

sys.path.insert(0, os.path.abspath('backend'))

from core.database import SessionLocal
from models.user import User, Organization

def main():
    db = SessionLocal()
    
    # 1. Make all users superadmins so they can access the admin panel
    users = db.query(User).all()
    for user in users:
        user.is_superadmin = True
        print(f"Made user {user.email} a superadmin.")
    
    # 2. Add 'tax_audit' to all organizations
    orgs = db.query(Organization).all()
    for org in orgs:
        current_modules = org.modules or ["financial_audit"]
        if "tax_audit" not in current_modules:
            # We need to create a new list because modifying JSONB in-place can be tricky with SQLAlchemy tracking
            new_modules = list(current_modules)
            new_modules.append("tax_audit")
            org.modules = new_modules
            print(f"Added 'tax_audit' module to organization: {org.name}")
        else:
            print(f"Organization {org.name} already has 'tax_audit' module.")
            
    db.commit()
    db.close()
    print("Database updated successfully.")

if __name__ == "__main__":
    main()
