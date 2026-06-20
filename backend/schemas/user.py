from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    org_name: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    role: str
    org_id: UUID
    is_active: bool
    is_superadmin: bool = False
    onboarding_completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Optional[str] = None
    full_name: Optional[str] = None
