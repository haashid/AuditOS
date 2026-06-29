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


@router.delete("/{engagement_id}", status_code=204)
def delete_engagement(
    engagement_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("senior_auditor")),
):
    engagement = (
        db.query(Engagement)
        .filter(Engagement.id == engagement_id, Engagement.org_id == current_user.org_id)
        .first()
    )
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")
        
    from sqlalchemy import text
    
    # Dynamically find all child tables referencing engagements to manually cascade delete
    # (Since PostgreSQL constraints were not created with ON DELETE CASCADE)
    res = db.execute(text('''
        SELECT tc.table_name, kcu.column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu 
          ON tc.constraint_name = kcu.constraint_name 
        JOIN information_schema.constraint_column_usage AS ccu 
          ON ccu.constraint_name = tc.constraint_name 
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name='engagements';
    '''))
    
    for row in res:
        tbl, col = row[0], row[1]
        db.execute(text(f"DELETE FROM {tbl} WHERE {col} = :eid"), {"eid": engagement_id})

    db.delete(engagement)
    db.commit()

    from core.activity_logger import log_activity
    log_activity(db, current_user, "engagement_deleted",
                  f"Deleted engagement '{engagement.name}'",
                  engagement_id=None,  # engagement is gone!
                  resource_type="engagement", resource_id=str(engagement_id))

    return None


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


# ─── ISA 530 Audit Sampling ───────────────────────────────────────────────────

from pydantic import BaseModel as PydanticBaseModel

class SamplingRequest(PydanticBaseModel):
    audit_area: str
    confidence_level: int = 95      # 90, 95, or 99
    tolerable_error_pct: float = 5.0   # as percentage of population value
    expected_error_pct: float = 1.0
    materiality_threshold: float = 100000.0


@router.post("/{engagement_id}/sampling/generate")
def generate_audit_sample(
    engagement_id: UUID,
    body: SamplingRequest,
    current_user: User = Depends(require_role("junior_auditor")),
    db: Session = Depends(get_db)
):
    """
    ISA 530 Monetary Unit Sampling — generates a statistically
    defensible sample of transactions for the given engagement.
    """
    from ai.audit_sampler import calculate_sample_size, select_sample

    engagement = db.query(Engagement).filter(
        Engagement.id == engagement_id,
        Engagement.org_id == current_user.org_id
    ).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    all_txns = db.query(Transaction).filter(
        Transaction.engagement_id == engagement_id,
        Transaction.org_id == current_user.org_id
    ).all()

    if not all_txns:
        raise HTTPException(
            status_code=400,
            detail="No transactions found for this engagement. Upload a ledger first."
        )

    txn_dicts = []
    for t in all_txns:
        amount = max(float(t.debit_amount or 0), float(t.credit_amount or 0))
        txn_dicts.append({
            "id": str(t.id),
            "date": str(t.transaction_date),
            "account_name": t.account_name,
            "amount": amount,
            "description": t.description,
            "document_number": t.document_number,
            "posted_by": t.posted_by,
            "risk_score": t.risk_score,
            "is_flagged": t.is_flagged,
        })

    population_value = sum(t["amount"] for t in txn_dicts)
    tolerable_error = population_value * (body.tolerable_error_pct / 100)
    expected_error = population_value * (body.expected_error_pct / 100)

    sample_size = calculate_sample_size(
        population_value,
        tolerable_error,
        expected_error,
        body.confidence_level
    )

    sample = select_sample(txn_dicts, sample_size, body.materiality_threshold)

    return {
        "audit_area": body.audit_area,
        "population_count": len(txn_dicts),
        "population_value": round(population_value, 2),
        "confidence_level": body.confidence_level,
        "tolerable_error": round(tolerable_error, 2),
        "expected_error": round(expected_error, 2),
        "calculated_sample_size": sample_size,
        "actual_sample_size": len(sample),
        "individually_significant": len(
            [s for s in sample if "Individually Significant" in s["selection_reason"]]
        ),
        "mus_selected": len(
            [s for s in sample if "MUS" in s["selection_reason"]]
        ),
        "materiality_threshold": body.materiality_threshold,
        "sample": sample,
    }


# ─── Prior Year Upload & Variance Analysis ────────────────────────────────────

@router.post("/{engagement_id}/upload/prior-year")
async def upload_prior_year(
    engagement_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("junior_auditor")),
    db: Session = Depends(get_db)
):
    """
    Upload a prior year trial balance CSV/Excel.
    Stored as transactions tagged source_system='Prior Year' for variance analysis.
    """
    engagement = db.query(Engagement).filter(
        Engagement.id == engagement_id,
        Engagement.org_id == current_user.org_id
    ).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    filename = file.filename or ""
    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    upload_dir = os.path.join(settings.UPLOAD_DIR, str(engagement_id), "prior_year")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    try:
        if filename.endswith(".csv"):
            try:
                df = pd.read_csv(file_path)
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding='cp1252')
        else:
            df = pd.read_excel(file_path)

        if df.empty:
            raise ValueError("File contains no data rows")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {str(e)}")

    df = normalize_columns(df)

    # Remove existing prior year data for this engagement
    db.query(Transaction).filter(
        Transaction.engagement_id == engagement_id,
        Transaction.org_id == current_user.org_id,
        Transaction.source_system == "Prior Year"
    ).delete()
    db.flush()

    inserted = 0
    for _, row in df.iterrows():
        row_dict = row.to_dict()

        def safe_decimal(val):
            try:
                v = float(val)
                return v if v > 0 else 0
            except (TypeError, ValueError):
                return 0

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
            account_name=str(row_dict.get("account_name", ""))[:255] if pd.notna(row_dict.get("account_name")) else None,
            debit_amount=safe_decimal(row_dict.get("debit_amount")),
            credit_amount=safe_decimal(row_dict.get("credit_amount")),
            currency=str(row_dict.get("currency", "INR"))[:3] if pd.notna(row_dict.get("currency")) else "INR",
            description=str(row_dict.get("description", "")) if pd.notna(row_dict.get("description")) else None,
            is_flagged=False,
            source_system="Prior Year",
        )
        db.add(txn)
        inserted += 1

    db.commit()
    return {
        "total_rows": inserted,
        "source": "Prior Year",
        "engagement_id": str(engagement_id)
    }


@router.get("/{engagement_id}/variance-analysis")
def get_variance_analysis(
    engagement_id: UUID,
    variance_threshold_pct: float = 10.0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compares current year vs prior year balances by account.
    Returns accounts with variance above threshold_pct.
    """
    engagement = db.query(Engagement).filter(
        Engagement.id == engagement_id,
        Engagement.org_id == current_user.org_id
    ).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    all_txns = db.query(Transaction).filter(
        Transaction.engagement_id == engagement_id,
        Transaction.org_id == current_user.org_id
    ).all()

    current_year = [t for t in all_txns if (t.source_system or "") != "Prior Year"]
    prior_year = [t for t in all_txns if (t.source_system or "") == "Prior Year"]

    if not prior_year:
        raise HTTPException(
            status_code=400,
            detail="No prior year data uploaded. Use POST /upload/prior-year first."
        )

    def aggregate_by_account(txns):
        accounts = {}
        for t in txns:
            key = t.account_name or "Unknown"
            net = float(t.debit_amount or 0) - float(t.credit_amount or 0)
            accounts[key] = accounts.get(key, 0) + net
        return accounts

    cy_accounts = aggregate_by_account(current_year)
    py_accounts = aggregate_by_account(prior_year)
    all_accounts = set(cy_accounts.keys()) | set(py_accounts.keys())

    variances = []
    for account in all_accounts:
        cy_val = cy_accounts.get(account, 0)
        py_val = py_accounts.get(account, 0)
        absolute_change = cy_val - py_val
        pct_change = (
            (absolute_change / abs(py_val) * 100) if py_val != 0
            else (100.0 if cy_val != 0 else 0.0)
        )
        is_significant = abs(pct_change) >= variance_threshold_pct

        variances.append({
            "account_name": account,
            "current_year": round(cy_val, 2),
            "prior_year": round(py_val, 2),
            "absolute_change": round(absolute_change, 2),
            "percentage_change": round(pct_change, 2),
            "is_significant": is_significant,
            "direction": "increase" if absolute_change > 0 else "decrease"
        })

    variances.sort(key=lambda x: abs(x["percentage_change"]), reverse=True)
    significant = [v for v in variances if v["is_significant"]]

    return {
        "total_accounts": len(variances),
        "significant_variances": len(significant),
        "threshold_pct": variance_threshold_pct,
        "variances": variances,
    }


# ─── Risk Heat Map ────────────────────────────────────────────────────────────

@router.get("/{engagement_id}/risk-heatmap")
def get_risk_heatmap(
    engagement_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns data for a 5x5 likelihood vs impact risk heat map.
    Aggregates findings and fraud alerts.
    """
    from models.finding import Finding

    findings = db.query(Finding).filter(
        Finding.engagement_id == engagement_id,
        Finding.org_id == current_user.org_id
    ).all()

    # Try fraud alerts (may not exist in all deployments)
    fraud_alerts = []
    try:
        from models.fraud_alert import FraudAlert
        fraud_alerts = db.query(FraudAlert).filter(
            FraudAlert.engagement_id == engagement_id,
            FraudAlert.org_id == current_user.org_id
        ).all()
    except Exception:
        pass

    severity_coords = {
        "critical": (5, 5),
        "high":     (4, 4),
        "medium":   (3, 3),
        "low":      (2, 2)
    }

    items = []
    for f in findings:
        likelihood, impact = severity_coords.get(f.severity or "low", (2, 2))
        items.append({
            "id": str(f.id),
            "title": f.title,
            "type": "finding",
            "severity": f.severity,
            "likelihood": likelihood,
            "impact": impact,
            "risk_score": likelihood * impact,
            "status": f.status
        })

    for a in fraud_alerts:
        fraud_coords = {
            "critical": (5, 5), "high": (4, 5),
            "medium": (3, 3), "low": (2, 2)
        }
        likelihood, impact = fraud_coords.get(
            getattr(a, "severity", "medium") or "medium", (3, 3)
        )
        items.append({
            "id": str(a.id),
            "title": getattr(a, "title", "Fraud Alert"),
            "type": "fraud_alert",
            "severity": getattr(a, "severity", "medium"),
            "likelihood": likelihood,
            "impact": impact,
            "risk_score": likelihood * impact,
            "status": getattr(a, "status", "open")
        })

    # Build 5x5 grid
    grid = []
    for likelihood in range(1, 6):
        for impact in range(1, 6):
            score = likelihood * impact
            cell_items = [
                i for i in items
                if i["likelihood"] == likelihood and i["impact"] == impact
            ]
            color = (
                "red"    if score >= 20 else
                "orange" if score >= 12 else
                "amber"  if score >= 6  else
                "green"
            )
            grid.append({
                "likelihood": likelihood,
                "impact": impact,
                "risk_score": score,
                "color": color,
                "items": cell_items,
                "count": len(cell_items)
            })

    return {
        "total_items": len(items),
        "critical_count": len([i for i in items if i["severity"] == "critical"]),
        "high_count": len([i for i in items if i["severity"] == "high"]),
        "grid": grid,
        "all_items": sorted(items, key=lambda x: x["risk_score"], reverse=True),
    }
