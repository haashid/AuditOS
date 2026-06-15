import sys
import os

from core.database import SessionLocal
from models.user import User

db = SessionLocal()
users = db.query(User).all()
for u in users:
    print(f"Elevating {u.full_name} ({u.email}) to superadmin.")
    u.is_superadmin = True
    u.role = "admin"
db.commit()
print("Successfully elevated all users to superadmin for testing purposes.")
db.close()
