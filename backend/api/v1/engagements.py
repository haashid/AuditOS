from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from uuid import UUID
import os
import pandas as pd
import uuid as uuid_module

from core.database import get_db
from core.security import get_current_user
from core.permissions import require_role
from models.user import User
from models.portal_user import PortalUser
from models.engagement import Engagement, Transaction
from schemas.engagement import (
    EngagementCreate,
    EngagementOut,
    TransactionOut,
    TransactionListResponse,
    UploadResponse,
)
from services.flag_engine import flag_transaction, normalize_columns
from core.config import settings

router = APIRouter(prefix="/engagements", tags=["engagements"])


# ─── Engagement CRUD ─────────────────────────────────────────────────────────

@router.post("", response_model=EngagementOut, status_code=201)
def create_engagement(
    payload: EngagementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("senior_auditor")),
):
    engagement = Engagement(
        org_id=current_user.org_id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(engagement)
    db.commit()
    db.refresh(engagement)

    from core.activity_logger import log_activity
    log_activity(db, current_user, "engagement_created",
                  f"Created engagement '{engagement.name}'",
                  engagement_id=str(engagement.id),
                  resource_type="engagement", resource_id=str(engagement.id))

    return engagement


@router.get("", response_model=list[EngagementOut])
def list_engagements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Engagement)
        .filter(Engagement.org_id == current_user.org_id)
        .order_by(Engagement.created_at.desc())
        .all()
    )


@router.get("/{engagement_id}", response_model=EngagementOut)
def get_engagement(
    engagement_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engagement = (
        db.query(Engagement)
        .filter(Engagement.id == engagement_id, Engagement.org_id == current_user.org_id)
        .first()
    )
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
    return engagement


# ─── File Upload ──────────────────────────────────────────────────────────────

@router.post("/{engagement_id}/upload", response_model=UploadResponse)
def upload_transactions(
    engagement_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify engagement belongs to this org
    engagement = (
        db.query(Engagement)
        .filter(Engagement.id == engagement_id, Engagement.org_id == current_user.org_id)
        .first()
    )
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    # Validate file type
    filename = file.filename or ""
    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    # Save file to disk
    upload_dir = os.path.join(settings.UPLOAD_DIR, str(engagement_id))
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    # Parse with pandas
    try:
        if filename.endswith(".csv"):
            try:
                df = pd.read_csv(file_path)
            except UnicodeDecodeError:
                # Fallback for Excel-saved CSVs on Windows
                df = pd.read_csv(file_path, encoding='cp1252')
            except pd.errors.EmptyDataError:
                raise ValueError("File is empty or contains no data")
        else:
            df = pd.read_excel(file_path)
            
        if df.empty:
            raise ValueError("File contains no data rows")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {str(e)}")

    # Normalize column names
    df = normalize_columns(df)

    # Remove any existing transactions for this upload (allows re-upload)
    db.query(Transaction).filter(Transaction.engagement_id == engagement_id).delete()
    db.flush()

    # Process each row
    flagged_count = 0
    transactions_to_insert = []

    for _, row in df.iterrows():
        row_dict = row.to_dict()
        is_flagged, flag_reasons, risk_score = flag_transaction(row_dict)

        if is_flagged:
            flagged_count += 1

        def safe_decimal(val):
            try:
                v = float(val)
                return v if v > 0 else 0
            except (TypeError, ValueError):
                return 0

        # Handle dates robustly
        raw_date = row_dict.get("transaction_date")
        parsed_date = None
        if pd.notna(raw_date) and str(raw_date).strip() not in ("", "nan", "None"):
            dt = pd.to_datetime(raw_date, errors="coerce")
            if pd.notna(dt):
                parsed_date = dt.date()

        txn = Transaction(
            id=uuid_module.uuid4(),
            org_id=current_user.org_id,
            engagement_id=engagement_id,
            transaction_date=parsed_date,
            document_number=str(row_dict.get("document_number", ""))[:100] if pd.notna(row_dict.get("document_number")) else None,
            account_code=str(row_dict.get("account_code", ""))[:50] if pd.notna(row_dict.get("account_code")) else None,
            account_name=str(row_dict.get("account_name", ""))[:255] if pd.notna(row_dict.get("account_name")) else None,
            debit_amount=safe_decimal(row_dict.get("debit_amount")),
            credit_amount=safe_decimal(row_dict.get("credit_amount")),
            currency=str(row_dict.get("currency", "USD"))[:3] if pd.notna(row_dict.get("currency")) else "USD",
            description=str(row_dict.get("description", "")) if pd.notna(row_dict.get("description")) else None,
            posted_by=str(row_dict.get("posted_by", "")) if pd.notna(row_dict.get("posted_by")) else None,
            is_flagged=is_flagged,
            flag_reasons=flag_reasons,
            risk_score=risk_score,
        )
        transactions_to_insert.append(txn)

    # Bulk insert
    db.bulk_save_objects(transactions_to_insert)
    db.commit()

    return UploadResponse(
        total_rows=len(transactions_to_insert),
        flagged_rows=flagged_count,
        engagement_id=engagement_id,
    )


# ─── Transaction List ─────────────────────────────────────────────────────────

@router.get("/{engagement_id}/transactions", response_model=TransactionListResponse)
def list_transactions(
    engagement_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    is_flagged: Optional[bool] = Query(None),
    account_code: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify engagement belongs to this org
    engagement = (
        db.query(Engagement)
        .filter(Engagement.id == engagement_id, Engagement.org_id == current_user.org_id)
        .first()
    )
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    query = db.query(Transaction).filter(
        Transaction.engagement_id == engagement_id,
        Transaction.org_id == current_user.org_id,
    )

    # Apply filters
    if is_flagged is not None:
        query = query.filter(Transaction.is_flagged == is_flagged)
    if account_code:
        query = query.filter(Transaction.account_code.ilike(f"%{account_code}%"))
    if date_from:
        query = query.filter(Transaction.transaction_date >= date_from)
    if date_to:
        query = query.filter(Transaction.transaction_date <= date_to)

    total = query.count()
    transactions = (
        query.order_by(Transaction.transaction_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return TransactionListResponse(
        total=total,
        page=page,
        page_size=page_size,
        data=transactions,
    )

# ─── Portal Users ─────────────────────────────────────────────────────────────

@router.get("/{engagement_id}/portal-users")
def list_portal_users(
    engagement_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify engagement belongs to this org
    engagement = (
        db.query(Engagement)
        .filter(Engagement.id == engagement_id, Engagement.org_id == current_user.org_id)
        .first()
    )
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    users = db.query(PortalUser).filter(PortalUser.engagement_id == engagement_id).all()
    return [{"id": str(u.id), "email": u.email, "full_name": u.full_name, "company_name": u.company_name} for u in users]


@router.delete("/{engagement_id}/portal-users/{user_id}")
def revoke_portal_user(
    engagement_id: UUID,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("senior_auditor")),
):
    # Verify engagement belongs to this org
    engagement = (
        db.query(Engagement)
        .filter(Engagement.id == engagement_id, Engagement.org_id == current_user.org_id)
        .first()
    )
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    user = db.query(PortalUser).filter(PortalUser.engagement_id == engagement_id, PortalUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Portal user not found")
        
    db.delete(user)
    db.commit()
    return {"message": "Portal access revoked"}
