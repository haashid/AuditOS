import sys
import os
from sqlalchemy import text

# Add backend to path so we can import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import SessionLocal

def fix_db():
    db = SessionLocal()
    try:
        print("Adding missing columns to workpapers table...")
        db.execute(text("ALTER TABLE workpapers ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'draft'"))
        db.execute(text("ALTER TABLE workpapers ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id)"))
        db.execute(text("ALTER TABLE workpapers ADD COLUMN IF NOT EXISTS review_comment TEXT"))
        db.commit()
        print("Database schema successfully updated!")
    except Exception as e:
        print(f"Error updating schema: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_db()
