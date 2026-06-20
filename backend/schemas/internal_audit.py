from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class ControlTestCreate(BaseModel):
    effectiveness: str
    evidence_url: Optional[str] = None
    notes: Optional[str] = None

class ControlTestOut(BaseModel):
    id: UUID
    control_id: UUID
    tester_id: UUID
    test_date: datetime
    effectiveness: str
    evidence_url: Optional[str]
    notes: Optional[str]
    created_at: datetime
    tester_name: Optional[str] = None

    model_config = {"from_attributes": True}


class InternalControlCreate(BaseModel):
    process_name: str
    risk_description: str
    control_activity: str
    frequency: str
    owner_id: Optional[UUID] = None
    status: Optional[str] = "Active"

class InternalControlOut(BaseModel):
    id: UUID
    org_id: UUID
    process_name: str
    risk_description: str
    control_activity: str
    frequency: str
    owner_id: Optional[UUID]
    status: str
    created_at: datetime
    updated_at: Optional[datetime]
    tests: List[ControlTestOut] = []

    model_config = {"from_attributes": True}
