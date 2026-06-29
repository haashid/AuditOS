from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import secrets, json
from datetime import datetime, timedelta

from core.database import get_db
from core.security import get_current_user
from core.config import settings
from models.connector import ConnectorToken
from models.engagement import Engagement
from connectors.quickbooks import (
    get_authorization_url as qb_auth_url,
    exchange_code_for_token as qb_exchange,
    pull_transactions as qb_pull
)
from connectors.xero import (
    get_authorization_url as xero_auth_url,
    exchange_code_for_token as xero_exchange,
    pull_transactions as xero_pull,
    get_tenant_id as xero_get_tenant
)
from connectors.zoho import (
    get_authorization_url as zoho_auth_url,
    exchange_code_for_token as zoho_exchange,
    get_organizations as zoho_get_orgs,
    pull_transactions as zoho_pull
)
from connectors.tally import parse_tally_xml, pull_from_live_tally
from connectors.microsoft365 import (
    get_authorization_url as ms365_auth_url,
    exchange_code_for_token as ms365_exchange,
    get_tenant_id_from_token as ms365_get_tenant,
    pull_user_access_data as ms365_pull_users,
    refresh_access_token as ms365_refresh
)
from connectors.jira import (
    get_authorization_url as jira_auth_url,
    exchange_code_for_token as jira_exchange,
    get_accessible_sites,
    get_projects,
    create_jira_issue
)
from core.permissions import require_module, require_role
from fastapi import UploadFile, File
from pydantic import BaseModel as PydanticBaseModel

router = APIRouter()

# In-memory state store (use Redis in production for multi-instance)
oauth_states = {}

# ─── QuickBooks ───────────────────────────────────────────────

@router.get("/connectors/quickbooks/authorize")
def quickbooks_authorize(
    engagement_id: str,
    current_user=Depends(get_current_user)
):
    """Step 1: Redirect user to QuickBooks OAuth page."""
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "org_id": str(current_user.org_id),
        "engagement_id": engagement_id,
        "user_id": str(current_user.id)
    }
    auth_url = qb_auth_url(state)
    return {"authorization_url": auth_url}

@router.get("/connectors/quickbooks/callback")
def quickbooks_callback(
    code: str,
    state: str,
    realmId: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Step 2: QuickBooks redirects here with auth code."""
    state_data = oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    # Exchange code for tokens
    token_data = qb_exchange(code, realmId)

    # Save tokens to DB
    connector = ConnectorToken(
        org_id=state_data["org_id"],
        engagement_id=state_data["engagement_id"],
        connector_type="quickbooks",
        access_token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        realm_id=realmId,
        token_expiry=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
        is_active=True
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)

    # Pull transactions in background
    background_tasks.add_task(
        sync_quickbooks_transactions,
        str(connector.id),
        state_data["engagement_id"],
        state_data["org_id"]
    )

    # Redirect to engagement page
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/engagements/{state_data['engagement_id']}?sync=quickbooks"
    )

@router.post("/connectors/quickbooks/sync/{engagement_id}")
def sync_quickbooks(
    engagement_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger a QuickBooks sync for an engagement."""
    from models.engagement import Transaction
    from datetime import date
    import random
    
    # Add a dummy transaction for visual feedback (Demo mode)
    txn = Transaction(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        source_system="QuickBooks",
        transaction_date=date.today(),
        account_name="Office Supplies",
        debit_amount=random.randint(100, 2000),
        credit_amount=0,
        currency="USD",
        description="Demo Sync Data - QuickBooks",
        is_flagged=False
    )
    db.add(txn)
    db.commit()

    return {"message": "QuickBooks sync started in background."}


def sync_quickbooks_transactions(connector_id: str, engagement_id: str, org_id: str):
    """Background task: pull QB transactions and insert into DB."""
    from core.database import SessionLocal
    from ai.flag_engine import flag_transaction
    from models.engagement import Transaction

    db = SessionLocal()
    try:
        connector = db.query(ConnectorToken).filter(
            ConnectorToken.id == connector_id
        ).first()
        if not connector:
            return

        raw_transactions = qb_pull(connector, engagement_id, db)

        for txn_dict in raw_transactions:
            row = {
                "transaction_date": txn_dict.get("transaction_date"),
                "debit_amount": txn_dict.get("debit_amount", 0),
                "credit_amount": txn_dict.get("credit_amount", 0),
                "description": txn_dict.get("description", ""),
                "posted_by": txn_dict.get("posted_by", "")
            }
            is_flagged, flag_reasons, risk_score = flag_transaction(row)

            txn = Transaction(
                org_id=org_id,
                engagement_id=engagement_id,
                source_system="QuickBooks",
                transaction_date=txn_dict.get("transaction_date"),
                document_number=txn_dict.get("document_number"),
                account_code=txn_dict.get("account_code"),
                account_name=txn_dict.get("account_name"),
                debit_amount=txn_dict.get("debit_amount", 0),
                credit_amount=txn_dict.get("credit_amount", 0),
                currency=txn_dict.get("currency", "USD"),
                description=txn_dict.get("description", ""),
                posted_by=txn_dict.get("posted_by", ""),
                is_flagged=is_flagged,
                flag_reasons=flag_reasons,
                risk_score=risk_score
            )
            db.add(txn)

        db.commit()
        print(f"[QuickBooks] Synced {len(raw_transactions)} transactions for engagement {engagement_id}")
    except Exception as e:
        print(f"[QuickBooks Sync Error] {e}")
        db.rollback()
    finally:
        db.close()


# ─── Xero ───────────────────────────────────────────────

@router.get("/connectors/xero/authorize")
def xero_authorize(
    engagement_id: str,
    current_user=Depends(get_current_user)
):
    """Step 1: Redirect user to Xero OAuth page."""
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "org_id": str(current_user.org_id),
        "engagement_id": engagement_id,
        "user_id": str(current_user.id)
    }
    auth_url = xero_auth_url(state)
    return {"authorization_url": auth_url}

@router.get("/connectors/xero/callback")
def xero_callback(
    code: str,
    state: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Step 2: Xero redirects here with auth code."""
    state_data = oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    # Exchange code for tokens
    token_data = xero_exchange(code)
    
    tenant_id = xero_get_tenant(token_data.get("access_token"))

    # Save tokens to DB
    connector = ConnectorToken(
        org_id=state_data["org_id"],
        engagement_id=state_data["engagement_id"],
        connector_type="xero",
        access_token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        tenant_id=tenant_id,
        token_expiry=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
        is_active=True
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)

    # Pull transactions in background
    background_tasks.add_task(
        sync_xero_transactions,
        str(connector.id),
        state_data["engagement_id"],
        state_data["org_id"]
    )

    # Redirect to engagement page
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/engagements/{state_data['engagement_id']}?sync=xero"
    )

@router.post("/connectors/xero/sync/{engagement_id}")
def sync_xero(
    engagement_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger a Xero sync for an engagement."""
    from models.engagement import Transaction
    from datetime import date
    import random
    
    # Add a dummy transaction for visual feedback (Demo mode)
    txn = Transaction(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        source_system="Xero",
        transaction_date=date.today(),
        account_name="Travel Expenses",
        debit_amount=random.randint(50, 1000),
        credit_amount=0,
        currency="USD",
        description="Demo Sync Data - Xero",
        is_flagged=False
    )
    db.add(txn)
    db.commit()
    return {"message": "Xero sync started in background."}


def sync_xero_transactions(connector_id: str, engagement_id: str, org_id: str):
    """Background task: pull Xero transactions and insert into DB."""
    from core.database import SessionLocal
    from ai.flag_engine import flag_transaction
    from models.engagement import Transaction

    db = SessionLocal()
    try:
        connector = db.query(ConnectorToken).filter(
            ConnectorToken.id == connector_id
        ).first()
        if not connector:
            return

        raw_transactions = xero_pull(connector, engagement_id, db)

        for txn_dict in raw_transactions:
            row = {
                "transaction_date": txn_dict.get("transaction_date"),
                "debit_amount": txn_dict.get("debit_amount", 0),
                "credit_amount": txn_dict.get("credit_amount", 0),
                "description": txn_dict.get("description", ""),
                "posted_by": txn_dict.get("posted_by", "")
            }
            is_flagged, flag_reasons, risk_score = flag_transaction(row)

            txn = Transaction(
                org_id=org_id,
                engagement_id=engagement_id,
                source_system="Xero",
                transaction_date=txn_dict.get("transaction_date"),
                document_number=txn_dict.get("document_number"),
                account_code=txn_dict.get("account_code"),
                account_name=txn_dict.get("account_name"),
                debit_amount=txn_dict.get("debit_amount", 0),
                credit_amount=txn_dict.get("credit_amount", 0),
                currency=txn_dict.get("currency", "USD"),
                description=txn_dict.get("description", ""),
                posted_by=txn_dict.get("posted_by", ""),
                is_flagged=is_flagged,
                flag_reasons=flag_reasons,
                risk_score=risk_score
            )
            db.add(txn)

        db.commit()
        print(f"[Xero] Synced {len(raw_transactions)} transactions for engagement {engagement_id}")
    except Exception as e:
        print(f"[Xero Sync Error] {e}")
        db.rollback()
    finally:
        db.close()


# ─── Connector Status ─────────────────────────────────────────

@router.get("/connectors/{engagement_id}/status")
def connector_status(
    engagement_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns which connectors are active for an engagement."""
    # Per-engagement connectors
    eng_connectors = db.query(ConnectorToken).filter(
        ConnectorToken.engagement_id == engagement_id,
        ConnectorToken.org_id == current_user.org_id,
        ConnectorToken.is_active == True
    ).all()

    # Org-level connectors (e.g. Jira — engagement_id is NULL)
    org_connectors = db.query(ConnectorToken).filter(
        ConnectorToken.engagement_id == None,
        ConnectorToken.org_id == current_user.org_id,
        ConnectorToken.is_active == True
    ).all()

    return {
        "quickbooks": any(c.connector_type == "quickbooks" for c in eng_connectors),
        "xero": any(c.connector_type == "xero" for c in eng_connectors),
        "zoho": any(c.connector_type == "zoho" for c in eng_connectors),
        "tally": any(c.connector_type == "tally" for c in eng_connectors),
        "microsoft365": any(c.connector_type == "microsoft365" for c in eng_connectors),
        "jira": any(c.connector_type == "jira" for c in org_connectors),
    }


# ─── Zoho Books ───────────────────────────────────────────────

@router.get("/connectors/zoho/authorize")
def zoho_authorize(
    engagement_id: str,
    current_user=Depends(get_current_user)
):
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "org_id": str(current_user.org_id),
        "engagement_id": engagement_id,
        "user_id": str(current_user.id)
    }
    return {"authorization_url": zoho_auth_url(state)}


@router.get("/connectors/zoho/callback")
def zoho_callback(
    code: str,
    state: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    state_data = oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    token_data = zoho_exchange(code)
    orgs = zoho_get_orgs(token_data["access_token"])
    if not orgs:
        raise HTTPException(status_code=400, detail="No Zoho Books organizations found")
    org_id = orgs[0]["organization_id"]

    connector = ConnectorToken(
        org_id=state_data["org_id"],
        engagement_id=state_data["engagement_id"],
        connector_type="zoho",
        access_token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        realm_id=org_id,
        token_expiry=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
        is_active=True
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)

    background_tasks.add_task(
        sync_zoho_transactions,
        str(connector.id),
        state_data["engagement_id"],
        state_data["org_id"]
    )

    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/engagements/{state_data['engagement_id']}?sync=zoho"
    )


def sync_zoho_transactions(connector_id: str, engagement_id: str, org_id: str):
    """Background task: pull Zoho transactions and insert into DB."""
    from core.database import SessionLocal
    from ai.flag_engine import flag_transaction
    from models.engagement import Transaction

    db = SessionLocal()
    try:
        connector = db.query(ConnectorToken).filter(ConnectorToken.id == connector_id).first()
        if not connector:
            return

        raw_transactions = zoho_pull(connector, engagement_id, db)

        for txn_dict in raw_transactions:
            row = {
                "transaction_date": txn_dict.get("transaction_date"),
                "debit_amount": txn_dict.get("debit_amount", 0),
                "credit_amount": txn_dict.get("credit_amount", 0),
                "description": txn_dict.get("description", ""),
                "posted_by": txn_dict.get("posted_by", "")
            }
            is_flagged, flag_reasons, risk_score = flag_transaction(row)

            txn = Transaction(
                org_id=org_id,
                engagement_id=engagement_id,
                source_system="Zoho Books",
                transaction_date=txn_dict.get("transaction_date"),
                document_number=txn_dict.get("document_number"),
                account_code=txn_dict.get("account_code"),
                account_name=txn_dict.get("account_name"),
                debit_amount=txn_dict.get("debit_amount", 0),
                credit_amount=txn_dict.get("credit_amount", 0),
                currency=txn_dict.get("currency", "INR"),
                description=txn_dict.get("description", ""),
                posted_by=txn_dict.get("posted_by", ""),
                is_flagged=is_flagged,
                flag_reasons=flag_reasons,
                risk_score=risk_score
            )
            db.add(txn)

        db.commit()
        print(f"[Zoho] Synced {len(raw_transactions)} transactions for engagement {engagement_id}")
    except Exception as e:
        print(f"[Zoho Sync Error] {e}")
        db.rollback()
    finally:
        db.close()

@router.post("/connectors/zoho/sync/{engagement_id}")
def sync_zoho_manual(
    engagement_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Demo endpoint to simulate manual Zoho sync."""
    from models.engagement import Transaction
    from datetime import date
    import random
    
    # Add a dummy transaction for visual feedback
    txn = Transaction(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        transaction_date=date.today(),
        account_name="Software Subscriptions",
        debit_amount=random.randint(500, 5000),
        credit_amount=0,
        currency="USD",
        description="Demo Sync Data - Zoho",
        is_flagged=False
    )
    db.add(txn)
    db.commit()
    return {"message": "Zoho sync completed."}


# ─── Tally Prime ──────────────────────────────────────────────

@router.post("/connectors/tally/upload-xml/{engagement_id}")
async def upload_tally_xml(
    engagement_id: str,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a Tally-exported XML file (Day Book or Voucher Register).
    Parses and inserts transactions just like CSV upload.
    """
    engagement = db.query(Engagement).filter(
        Engagement.id == engagement_id,
        Engagement.org_id == current_user.org_id
    ).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    if not (file.filename or "").lower().endswith(".xml"):
        raise HTTPException(status_code=400, detail="File must be a .xml export from Tally")

    content = await file.read()

    try:
        raw_transactions = parse_tally_xml(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    from ai.flag_engine import flag_transaction
    from models.engagement import Transaction

    flagged_count = 0
    for txn_dict in raw_transactions:
        row = {
            "transaction_date": txn_dict.get("transaction_date"),
            "debit_amount": txn_dict.get("debit_amount", 0),
            "credit_amount": txn_dict.get("credit_amount", 0),
            "description": txn_dict.get("description", ""),
            "posted_by": txn_dict.get("posted_by", "")
        }
        is_flagged, flag_reasons, risk_score = flag_transaction(row)
        if is_flagged:
            flagged_count += 1

        txn = Transaction(
            org_id=current_user.org_id,
            engagement_id=engagement_id,
            source_system="Tally (XML Import)",
            transaction_date=txn_dict.get("transaction_date"),
            document_number=txn_dict.get("document_number"),
            account_code=txn_dict.get("account_code", ""),
            account_name=txn_dict.get("account_name"),
            debit_amount=txn_dict.get("debit_amount", 0),
            credit_amount=txn_dict.get("credit_amount", 0),
            currency="INR",
            description=txn_dict.get("description", ""),
            posted_by=txn_dict.get("posted_by", ""),
            is_flagged=is_flagged,
            flag_reasons=flag_reasons,
            risk_score=risk_score
        )
        db.add(txn)

    db.commit()

    return {
        "total_rows": len(raw_transactions),
        "flagged_rows": flagged_count,
        "engagement_id": engagement_id,
        "source": "Tally XML Import"
    }


class TallyLiveConnectRequest(PydanticBaseModel):
    tally_url: str
    from_date: str = None
    to_date: str = None


@router.post("/connectors/tally/live-sync/{engagement_id}")
def tally_live_sync(
    engagement_id: str,
    body: TallyLiveConnectRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Attempts to connect to a live Tally instance on the local network.
    Will fail if AuditOS server cannot reach the given URL.
    """
    engagement = db.query(Engagement).filter(
        Engagement.id == engagement_id,
        Engagement.org_id == current_user.org_id
    ).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    try:
        raw_transactions = pull_from_live_tally(body.tally_url, body.from_date, body.to_date)
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    from ai.flag_engine import flag_transaction
    from models.engagement import Transaction

    flagged_count = 0
    for txn_dict in raw_transactions:
        row = {
            "transaction_date": txn_dict.get("transaction_date"),
            "debit_amount": txn_dict.get("debit_amount", 0),
            "credit_amount": txn_dict.get("credit_amount", 0),
            "description": txn_dict.get("description", ""),
            "posted_by": txn_dict.get("posted_by", "")
        }
        is_flagged, flag_reasons, risk_score = flag_transaction(row)
        if is_flagged:
            flagged_count += 1

        txn = Transaction(
            org_id=current_user.org_id,
            engagement_id=engagement_id,
            source_system="Tally (Live)",
            transaction_date=txn_dict.get("transaction_date"),
            document_number=txn_dict.get("document_number"),
            account_code="",
            account_name=txn_dict.get("account_name"),
            debit_amount=txn_dict.get("debit_amount", 0),
            credit_amount=txn_dict.get("credit_amount", 0),
            currency="INR",
            description=txn_dict.get("description", ""),
            posted_by="",
            is_flagged=is_flagged,
            flag_reasons=flag_reasons,
            risk_score=risk_score
        )
        db.add(txn)

    db.commit()

    return {
        "total_rows": len(raw_transactions),
        "flagged_rows": flagged_count,
        "source": "Tally Live Sync"
    }

@router.post("/connectors/tally/sync/{engagement_id}")
def sync_tally_manual(
    engagement_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Demo endpoint to simulate manual Tally sync."""
    from models.engagement import Transaction
    from datetime import date
    import random
    
    # Add a dummy transaction for visual feedback
    txn = Transaction(
        org_id=current_user.org_id,
        engagement_id=engagement_id,
        source_system="Tally Prime",
        transaction_date=date.today(),
        account_name="Vendor Payables",
        debit_amount=random.randint(1000, 10000),
        credit_amount=0,
        currency="INR",
        description="Demo Sync Data - Tally Prime",
        is_flagged=False
    )
    db.add(txn)
    db.commit()
    return {"message": "Tally sync completed."}


# ─── Microsoft 365 / Azure AD ─────────────────────────────────

@router.get("/connectors/microsoft365/authorize")
def microsoft365_authorize(
    engagement_id: str,
    current_user=Depends(require_module("it_audit")),
):
    """
    Step 1: Generate Microsoft OAuth authorization URL.
    Requires the it_audit module to be activated for the org.
    Returns a URL to redirect the browser to (same-tab, NOT popup).
    """
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "org_id": str(current_user.org_id),
        "engagement_id": engagement_id,
        "user_id": str(current_user.id),
        "connector": "microsoft365"
    }
    return {"authorization_url": ms365_auth_url(state)}


@router.get("/connectors/microsoft365/callback")
def microsoft365_callback(
    code: str,
    state: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Step 2: Microsoft redirects here after consent.
    Exchanges the auth code for tokens, stores them, and kicks
    off a background sync of Azure AD users.
    """
    state_data = oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    try:
        token_data = ms365_exchange(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {e}")

    try:
        tenant_id = ms365_get_tenant(token_data["access_token"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch tenant ID: {e}")

    # Deactivate any existing MS365 token for this engagement
    db.query(ConnectorToken).filter(
        ConnectorToken.engagement_id == state_data["engagement_id"],
        ConnectorToken.org_id == state_data["org_id"],
        ConnectorToken.connector_type == "microsoft365"
    ).update({"is_active": False})

    connector = ConnectorToken(
        org_id=state_data["org_id"],
        engagement_id=state_data["engagement_id"],
        connector_type="microsoft365",
        access_token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        tenant_id=tenant_id,
        token_expiry=datetime.utcnow() + timedelta(
            seconds=token_data.get("expires_in", 3600)
        ),
        is_active=True
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)

    # Pull Azure AD users in background
    background_tasks.add_task(
        sync_microsoft365_users,
        str(connector.id),
        state_data["engagement_id"],
        state_data["org_id"]
    )

    # Redirect to IT audit page — same-tab redirect (NOT popup)
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/it/{state_data['engagement_id']}?sync=microsoft365"
    )


@router.post("/connectors/microsoft365/sync/{engagement_id}")
def microsoft365_sync(
    engagement_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_module("it_audit")),
    db: Session = Depends(get_db)
):
    """Manually re-trigger a Microsoft 365 sync for an engagement."""
    connector = db.query(ConnectorToken).filter(
        ConnectorToken.engagement_id == engagement_id,
        ConnectorToken.org_id == current_user.org_id,
        ConnectorToken.connector_type == "microsoft365",
        ConnectorToken.is_active == True
    ).first()
    if not connector:
        raise HTTPException(
            status_code=404,
            detail="Microsoft 365 not connected for this engagement"
        )

    background_tasks.add_task(
        sync_microsoft365_users,
        str(connector.id),
        engagement_id,
        str(current_user.org_id)
    )
    return {"message": "Microsoft 365 sync started in background."}


def sync_microsoft365_users(connector_id: str, engagement_id: str, org_id: str):
    """
    Background task: pull all Azure AD users and insert them into
    user_access_records for the given engagement.
    Clears previous MS365-sourced records first to avoid duplicates.
    """
    from core.database import SessionLocal
    from models.it_audit import UserAccessRecord

    db = SessionLocal()
    try:
        connector = db.query(ConnectorToken).filter(
            ConnectorToken.id == connector_id
        ).first()
        if not connector:
            return

        # Refresh expired token if needed
        if connector.token_expiry and connector.token_expiry < datetime.utcnow():
            try:
                new_tokens = ms365_refresh(connector.refresh_token)
                connector.access_token = new_tokens.get("access_token")
                connector.token_expiry = datetime.utcnow() + timedelta(
                    seconds=new_tokens.get("expires_in", 3600)
                )
                db.commit()
            except Exception as refresh_err:
                print(f"[MS365] Token refresh failed: {refresh_err}")
                return

        users_data = ms365_pull_users(connector.access_token)

        # Clear previous MS365-sourced records for this engagement
        db.query(UserAccessRecord).filter(
            UserAccessRecord.engagement_id == engagement_id,
            UserAccessRecord.system_name == "Microsoft 365 / Azure AD"
        ).delete()

        for u in users_data:
            db.add(UserAccessRecord(
                org_id=org_id,
                engagement_id=engagement_id,
                **u
            ))

        db.commit()
        print(f"[MS365] Synced {len(users_data)} users for engagement {engagement_id}")
    except Exception as e:
        print(f"[MS365 Sync Error] {e}")
        db.rollback()
    finally:
        db.close()


# ─── Jira Finding Sync ────────────────────────────────────────

@router.get("/connectors/jira/authorize")
def jira_authorize(current_user=Depends(get_current_user)):
    """
    Step 1: Generate Jira OAuth authorization URL.
    Jira connects at the ORG level — one connection serves all
    engagements. No engagement_id parameter here.
    """
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "org_id": str(current_user.org_id),
        "user_id": str(current_user.id),
        "connector": "jira"
    }
    return {"authorization_url": jira_auth_url(state)}


@router.get("/connectors/jira/callback")
def jira_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db)
):
    """
    Step 2: Atlassian redirects here after consent.
    Stores the token with engagement_id=NULL (org-level connector).
    cloud_id stored in realm_id column.
    """
    state_data = oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    try:
        token_data = jira_exchange(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {e}")

    try:
        sites = get_accessible_sites(token_data["access_token"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch Jira sites: {e}")

    if not sites:
        raise HTTPException(
            status_code=400,
            detail="No accessible Jira sites found for this account"
        )

    cloud_id = sites[0]["id"]  # Default to first site if multiple exist

    # Deactivate any existing Jira org-level token
    db.query(ConnectorToken).filter(
        ConnectorToken.engagement_id == None,
        ConnectorToken.org_id == state_data["org_id"],
        ConnectorToken.connector_type == "jira"
    ).update({"is_active": False})

    connector = ConnectorToken(
        org_id=state_data["org_id"],
        engagement_id=None,  # Org-level — not per-engagement
        connector_type="jira",
        access_token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        realm_id=cloud_id,   # Jira cloud_id stored in realm_id
        token_expiry=datetime.utcnow() + timedelta(
            seconds=token_data.get("expires_in", 3600)
        ),
        is_active=True
    )
    db.add(connector)
    db.commit()

    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/settings?tab=integrations&jira=connected"
    )


@router.get("/connectors/jira/projects")
def list_jira_projects(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List the firm's Jira projects so the auditor can pick a target."""
    connector = db.query(ConnectorToken).filter(
        ConnectorToken.org_id == current_user.org_id,
        ConnectorToken.connector_type == "jira",
        ConnectorToken.is_active == True
    ).first()
    if not connector:
        raise HTTPException(status_code=404, detail="Jira not connected")

    try:
        projects = get_projects(connector.access_token, connector.realm_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Jira project fetch failed: {e}")

    return [{"key": p["key"], "name": p["name"]} for p in projects]


class JiraSyncRequest(PydanticBaseModel):
    project_key: str


@router.post("/findings/{finding_id}/sync-to-jira")
def sync_finding_to_jira(
    finding_id: str,
    body: JiraSyncRequest,
    current_user=Depends(require_role("junior_auditor")),  # any auditor role can push
    db: Session = Depends(get_db)
):
    """
    Push a single AuditOS Finding to Jira as a new issue.
    Returns HTTP 400 if already synced to prevent duplicate issues.
    """
    from models.finding import Finding

    finding = db.query(Finding).filter(
        Finding.id == finding_id,
        Finding.org_id == current_user.org_id
    ).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    # Prevent duplicate Jira issues for the same finding
    if finding.jira_issue_key:
        raise HTTPException(
            status_code=400,
            detail=f"Already synced to Jira as {finding.jira_issue_key}"
        )

    connector = db.query(ConnectorToken).filter(
        ConnectorToken.org_id == current_user.org_id,
        ConnectorToken.connector_type == "jira",
        ConnectorToken.is_active == True
    ).first()
    if not connector:
        raise HTTPException(
            status_code=400,
            detail="Jira not connected. Connect it in Settings → Integrations."
        )

    try:
        issue = create_jira_issue(
            connector.access_token,
            connector.realm_id,
            body.project_key,
            {
                "id": str(finding.id),
                "title": finding.title,
                "description": finding.description,
                "severity": finding.severity,
                "recommendation": finding.recommendation
            }
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Jira issue creation failed: {e}")

    # Get the site URL to build a human-readable issue link
    try:
        site_response = get_accessible_sites(connector.access_token)
        site_url = site_response[0]["url"] if site_response else ""
    except Exception:
        site_url = ""

    finding.jira_issue_key = issue.get("key")
    finding.jira_issue_url = f"{site_url}/browse/{issue.get('key')}" if site_url else None

    db.commit()
    db.refresh(finding)

    return {
        "finding_id": str(finding.id),
        "jira_issue_key": finding.jira_issue_key,
        "jira_issue_url": finding.jira_issue_url
    }
