from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_user
from core.modules import AVAILABLE_MODULES, get_available_modules
from models.user import Organization

router = APIRouter()

@router.get("/modules/status")
def get_module_status(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all modules with their activation status for the
    current user's organization. Used by the frontend to build
    the sidebar and settings page.
    """
    org = db.query(Organization).filter(
        Organization.id == current_user.org_id
    ).first()

    active_modules = org.modules or ["financial_audit"]

    return {
        "active_modules": active_modules,
        "all_modules": [
            {
                "key": k,
                "name": v["name"],
                "description": v["description"],
                "icon": v["icon"],
                "color": v["color"],
                "is_core": v.get("is_core", False),
                "is_active": k in active_modules,
                "coming_soon": v.get("coming_soon", False)
            }
            for k, v in AVAILABLE_MODULES.items()
        ]
    }
