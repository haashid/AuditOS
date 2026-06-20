from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
from typing import List
from uuid import UUID

from core.database import get_db
from core.security import get_current_user
from core.permissions import require_module
from models.user import User
from models.internal_audit import InternalControl, ControlTest
from schemas.internal_audit import InternalControlCreate, InternalControlOut, ControlTestCreate, ControlTestOut

router = APIRouter()

@router.get("/internal-controls", response_model=List[InternalControlOut])
def get_internal_controls(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _=Depends(require_module("internal_audit"))
):
    """Get all internal controls for the organization."""
    controls = db.query(InternalControl)\
        .filter(InternalControl.org_id == current_user.org_id)\
        .options(joinedload(InternalControl.tests))\
        .order_by(InternalControl.created_at.desc())\
        .all()
    
    # We could attach tester names if needed, but for simplicity, we let the frontend fetch users or just show the ID for now.
    return controls

@router.post("/internal-controls", response_model=InternalControlOut)
def create_internal_control(
    payload: InternalControlCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _=Depends(require_module("internal_audit"))
):
    """Create a new internal control in the RCM."""
    control = InternalControl(
        org_id=current_user.org_id,
        process_name=payload.process_name,
        risk_description=payload.risk_description,
        control_activity=payload.control_activity,
        frequency=payload.frequency,
        owner_id=payload.owner_id,
        status=payload.status
    )
    db.add(control)
    db.commit()
    db.refresh(control)
    return control

@router.post("/internal-controls/{control_id}/tests", response_model=ControlTestOut)
def submit_control_test(
    control_id: UUID,
    payload: ControlTestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _=Depends(require_module("internal_audit"))
):
    """Submit a test result for a specific control."""
    control = db.query(InternalControl).filter(
        InternalControl.id == control_id,
        InternalControl.org_id == current_user.org_id
    ).first()
    
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")

    test = ControlTest(
        control_id=control.id,
        tester_id=current_user.id,
        effectiveness=payload.effectiveness,
        evidence_url=payload.evidence_url,
        notes=payload.notes
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    
    # For response formatting
    test_out = ControlTestOut.model_validate(test)
    test_out.tester_name = current_user.full_name
    
    return test_out

@router.delete("/internal-controls/{control_id}")
def delete_internal_control(
    control_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _=Depends(require_module("internal_audit"))
):
    """Delete a control."""
    control = db.query(InternalControl).filter(
        InternalControl.id == control_id,
        InternalControl.org_id == current_user.org_id
    ).first()
    
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")

    db.delete(control)
    db.commit()
    return {"message": "Deleted successfully"}
