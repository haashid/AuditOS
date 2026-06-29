import sys
import os

# Add the current directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.config import settings
from models.user import User, Organization
from core.modules import AVAILABLE_MODULES

def main():
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    all_modules = list(AVAILABLE_MODULES.keys())

    try:
        # Update all organizations to have all modules enabled
        orgs = db.query(Organization).all()
        for org in orgs:
            org.modules = all_modules
            print(f"Enabled all modules for organization: {org.name}")

        # Update all users to be superadmin
        users = db.query(User).all()
        for user in users:
            user.is_superadmin = True
            print(f"Made user superadmin: {user.email}")

        db.commit()
        print("Successfully applied changes.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
