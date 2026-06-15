from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from core.database import get_db
from core.permissions import require_superadmin
from core.modules import is_valid_module, AVAILABLE_MODULES
from models.user import Organization, User

router = APIRouter()

@router.get("/admin/organizations")
def list_all_organizations(
    current_user=Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """List all organizations on the platform with their module status."""
    orgs = db.query(Organization).all()
    result = []
    for org in orgs:
        member_count = db.query(User).filter(User.org_id == org.id).count()
        result.append({
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "active_modules": org.modules or ["financial_audit"],
            "member_count": member_count,
            "created_at": org.created_at.isoformat() if org.created_at else None
        })
    return result


class ModuleUpdateRequest(BaseModel):
    modules: List[str]

@router.patch("/admin/organizations/{org_id}/modules")
def update_org_modules(
    org_id: str,
    body: ModuleUpdateRequest,
    current_user=Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """
    Set the active modules for an organization.
    Always includes 'financial_audit' (core, cannot be removed).
    """
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Validate all module keys
    for module_key in body.modules:
        if not is_valid_module(module_key):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid module key: '{module_key}'. "
                f"Valid modules: {list(AVAILABLE_MODULES.keys())}"
            )

    # Always include financial_audit
    final_modules = list(set(["financial_audit"] + body.modules))
    org.modules = final_modules
    db.commit()

    return {
        "org_id": str(org.id),
        "org_name": org.name,
        "active_modules": final_modules
    }


@router.post("/admin/organizations/{org_id}/modules/{module_key}/activate")
def activate_module(
    org_id: str,
    module_key: str,
    current_user=Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Activate a single module for an organization."""
    if not is_valid_module(module_key):
        raise HTTPException(status_code=400, detail=f"Invalid module: {module_key}")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    current = org.modules or ["financial_audit"]
    if module_key not in current:
        org.modules = current + [module_key]
        db.commit()

    return {"org_id": str(org.id), "activated_module": module_key,
            "active_modules": org.modules}


@router.post("/admin/organizations/{org_id}/modules/{module_key}/deactivate")
def deactivate_module(
    org_id: str,
    module_key: str,
    current_user=Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Deactivate a module. Cannot deactivate financial_audit (core)."""
    if module_key == "financial_audit":
        raise HTTPException(
            status_code=400,
            detail="Cannot deactivate 'financial_audit' — it is a core module"
        )

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    current = org.modules or ["financial_audit"]
    org.modules = [m for m in current if m != module_key]
    db.commit()

    return {"org_id": str(org.id), "deactivated_module": module_key,
            "active_modules": org.modules}
