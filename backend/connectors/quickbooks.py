"""
QuickBooks Online Connector
Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/journalentry
"""
import httpx
import base64
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models.connector import ConnectorToken
from core.config import settings

QBO_SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com/v3/company"
QBO_PROD_BASE = "https://quickbooks.api.intuit.com/v3/company"
QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2"
QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"

def get_base_url():
    if settings.QUICKBOOKS_ENVIRONMENT == "sandbox":
        return QBO_SANDBOX_BASE
    return QBO_PROD_BASE

def get_authorization_url(state: str) -> str:
    """Generate OAuth2 authorization URL for QuickBooks."""
    params = {
        "client_id": settings.QUICKBOOKS_CLIENT_ID,
        "response_type": "code",
        "scope": "com.intuit.quickbooks.accounting",
        "redirect_uri": settings.QUICKBOOKS_REDIRECT_URI,
        "state": state
    }
    from urllib.parse import urlencode
    return f"{QBO_AUTH_URL}?{urlencode(params)}"

def exchange_code_for_token(code: str, realm_id: str) -> dict:
    """Exchange authorization code for access + refresh tokens."""
    credentials = base64.b64encode(
        f"{settings.QUICKBOOKS_CLIENT_ID}:{settings.QUICKBOOKS_CLIENT_SECRET}".encode()
    ).decode()

    response = httpx.post(
        QBO_TOKEN_URL,
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.QUICKBOOKS_REDIRECT_URI
        }
    )
    response.raise_for_status()
    token_data = response.json()
    token_data["realm_id"] = realm_id
    return token_data

def refresh_access_token(refresh_token: str) -> dict:
    """Refresh expired access token."""
    credentials = base64.b64encode(
        f"{settings.QUICKBOOKS_CLIENT_ID}:{settings.QUICKBOOKS_CLIENT_SECRET}".encode()
    ).decode()

    response = httpx.post(
        QBO_TOKEN_URL,
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
    )
    response.raise_for_status()
    return response.json()

def pull_transactions(token: ConnectorToken, engagement_id: str, db: Session) -> list[dict]:
    """
    Pull journal entries from QuickBooks and normalize to AuditOS transaction schema.
    Returns list of dicts ready for bulk insert into transactions table.
    """
    base_url = get_base_url()
    headers = {
        "Authorization": f"Bearer {token.access_token}",
        "Accept": "application/json"
    }

    # Query all journal entries
    query = "SELECT * FROM JournalEntry MAXRESULTS 1000"
    response = httpx.get(
        f"{base_url}/{token.realm_id}/query",
        headers=headers,
        params={"query": query}
    )
    response.raise_for_status()
    data = response.json()

    transactions = []
    journal_entries = data.get("QueryResponse", {}).get("JournalEntry", [])

    for je in journal_entries:
        for line in je.get("Line", []):
            detail = line.get("JournalEntryLineDetail", {})
            account_ref = detail.get("AccountRef", {})
            amount = float(line.get("Amount", 0))
            posting_type = detail.get("PostingType", "Debit")

            transactions.append({
                "engagement_id": engagement_id,
                "source_system": "QuickBooks",
                "transaction_date": je.get("TxnDate"),
                "document_number": je.get("DocNumber") or je.get("Id"),
                "account_code": account_ref.get("value"),
                "account_name": account_ref.get("name"),
                "debit_amount": amount if posting_type == "Debit" else 0,
                "credit_amount": amount if posting_type == "Credit" else 0,
                "currency": je.get("CurrencyRef", {}).get("value", "USD"),
                "description": je.get("PrivateNote") or line.get("Description") or "",
                "posted_by": je.get("MetaData", {}).get("LastUpdatedBy", ""),
            })

    return transactions
