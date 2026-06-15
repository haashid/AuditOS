"""
Xero Connector
Docs: https://developer.xero.com/documentation/api/accounting/journals
"""
import httpx
import base64
from sqlalchemy.orm import Session
from models.connector import ConnectorToken
from core.config import settings

XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize"
XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
XERO_API_BASE = "https://api.xero.com/api.xro/2.0"

def get_authorization_url(state: str) -> str:
    from urllib.parse import urlencode
    params = {
        "response_type": "code",
        "client_id": settings.XERO_CLIENT_ID,
        "redirect_uri": settings.XERO_REDIRECT_URI,
        "scope": "offline_access accounting.transactions.read accounting.settings.read",
        "state": state
    }
    return f"{XERO_AUTH_URL}?{urlencode(params)}"

def exchange_code_for_token(code: str) -> dict:
    credentials = base64.b64encode(
        f"{settings.XERO_CLIENT_ID}:{settings.XERO_CLIENT_SECRET}".encode()
    ).decode()

    response = httpx.post(
        XERO_TOKEN_URL,
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.XERO_REDIRECT_URI
        }
    )
    response.raise_for_status()
    return response.json()

def get_tenant_id(access_token: str) -> str:
    """Get the Xero tenant (organisation) ID."""
    response = httpx.get(
        "https://api.xero.com/connections",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    response.raise_for_status()
    connections = response.json()
    if not connections:
        raise Exception("No Xero organisations connected")
    return connections[0]["tenantId"]

def pull_transactions(token: ConnectorToken, engagement_id: str, db: Session) -> list[dict]:
    """Pull journals from Xero and normalize to AuditOS schema."""
    headers = {
        "Authorization": f"Bearer {token.access_token}",
        "Xero-tenant-id": token.tenant_id,
        "Accept": "application/json"
    }

    response = httpx.get(f"{XERO_API_BASE}/Journals", headers=headers)
    response.raise_for_status()
    data = response.json()

    transactions = []
    for journal in data.get("Journals", []):
        for line in journal.get("JournalLines", []):
            net_amount = float(line.get("NetAmount", 0))
            transactions.append({
                "engagement_id": engagement_id,
                "source_system": "Xero",
                "transaction_date": journal.get("JournalDate", "").split("T")[0],
                "document_number": str(journal.get("JournalNumber", "")),
                "account_code": line.get("AccountCode"),
                "account_name": line.get("AccountName"),
                "debit_amount": net_amount if net_amount > 0 else 0,
                "credit_amount": abs(net_amount) if net_amount < 0 else 0,
                "currency": "USD",
                "description": line.get("Description") or "",
                "posted_by": journal.get("CreatedBy") or "",
            })

    return transactions
