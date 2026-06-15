"""
Role-based permission checks. Use as FastAPI dependencies.
"""
from fastapi import Depends, HTTPException
from core.security import get_current_user
from sqlalchemy.orm import Session
from core.database import get_db
from core.modules import is_valid_module
from models.user import Organization

ROLE_HIERARCHY = {
    "partner": 4,
    "senior_auditor": 3,
    "junior_auditor": 2,
    "reviewer": 1,
    # Legacy role mappings
    "admin": 4,
    "auditor": 3,
}


def require_role(minimum_role: str):
    """
    Returns a dependency that checks the current user's role
    meets or exceeds the minimum required role.

    Usage:
        @router.post("/engagements")
        def create_engagement(
            current_user=Depends(require_role("senior_auditor")),
            ...
        ):
    """
    def dependency(current_user=Depends(get_current_user)):
        user_level = ROLE_HIERARCHY.get(current_user.role, 0)
        required_level = ROLE_HIERARCHY.get(minimum_role, 999)
        if user_level < required_level:
            raise HTTPException(
                status_code=403,
                detail=f"This action requires '{minimum_role}' role or higher. "
                       f"Your role: '{current_user.role}'"
            )
        return current_user
    return dependency


def require_any_role(*roles: str):
    """
    Returns a dependency that checks the current user's role
    is one of the specified roles (not hierarchical).

    Usage:
        @router.patch("/workpapers/{id}/review")
        def approve_workpaper(
            current_user=Depends(require_any_role("partner", "senior_auditor", "reviewer")),
            ...
        ):
    """
    def dependency(current_user=Depends(get_current_user)):
        # Normalize legacy roles for comparison
        user_role = current_user.role
        if user_role == "admin":
            user_role = "partner"
        elif user_role == "auditor":
            user_role = "senior_auditor"

        if user_role not in roles and current_user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"This action requires one of: {roles}. Your role: '{current_user.role}'"
            )
        return current_user
    return dependency


def require_module(module_key: str):
    """
    FastAPI dependency that checks whether the current user's
    organization has the specified module activated.
    """
    if not is_valid_module(module_key):
        raise ValueError(f"Unknown module: {module_key}")

    def dependency(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        org = db.query(Organization).filter(
            Organization.id == current_user.org_id
        ).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")

        active_modules = org.modules or ["financial_audit"]
        if module_key not in active_modules:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "module_not_activated",
                    "message": f"The '{module_key}' module is not activated for your organization.",
                    "module": module_key,
                    "contact": "Contact your administrator to activate this module."
                }
            )
        return current_user
    return dependency


def require_superadmin(current_user=Depends(get_current_user)):
    """
    FastAPI dependency that checks whether the current user's
    is_superadmin flag is set to True.
    """
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(
            status_code=403,
            detail="Superadmin access required."
        )
    return current_user
