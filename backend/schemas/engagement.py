from pydantic import BaseModel
from typing import Optional, List, Any
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal


class EngagementCreate(BaseModel):
    name: str
    client_name: Optional[str] = None
    audit_type: Optional[str] = "financial"
    fiscal_year_start: Optional[date] = None
    fiscal_year_end: Optional[date] = None


class EngagementOut(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    client_name: Optional[str]
    audit_type: Optional[str]
    fiscal_year_start: Optional[date]
    fiscal_year_end: Optional[date]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionOut(BaseModel):
    id: UUID
    engagement_id: UUID
    transaction_date: Optional[date]
    document_number: Optional[str]
    account_code: Optional[str]
    account_name: Optional[str]
    debit_amount: Optional[Decimal]
    credit_amount: Optional[Decimal]
    currency: Optional[str]
    description: Optional[str]
    posted_by: Optional[str]
    is_flagged: bool
    flag_reasons: Optional[Any]
    risk_score: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    data: List[TransactionOut]


class UploadResponse(BaseModel):
    total_rows: int
    flagged_rows: int
    engagement_id: UUID


class DashboardStats(BaseModel):
    total_engagements: int
    total_transactions: int
    total_flagged: int
    avg_risk_score: float
    engagements_breakdown: List[dict]
    flag_reasons_breakdown: dict
