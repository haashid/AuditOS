"""
Zoho Books Connector (India data center)
Docs: https://www.zoho.com/books/api/v3/
"""
import httpx
from sqlalchemy.orm import Session
from models.connector import ConnectorToken
from core.config import settings


def get_authorization_url(state: str) -> str:
    from urllib.parse import urlencode
    params = {
        "response_type": "code",
        "client_id": settings.ZOHO_CLIENT_ID,
        "redirect_uri": settings.ZOHO_REDIRECT_URI,
        "scope": "ZohoBooks.fullaccess.all",
        "access_type": "offline",
        "state": state
    }
    return f"{settings.ZOHO_ACCOUNTS_URL}/oauth/v2/auth?{urlencode(params)}"


def exchange_code_for_token(code: str) -> dict:
    """
    Zoho Books uses OAuth 2.0 — exchange authorization code for
    access_token (1 hour expiry) and refresh_token (permanent).
    """
    response = httpx.post(
        f"{settings.ZOHO_ACCOUNTS_URL}/oauth/v2/token",
        data={
            "grant_type": "authorization_code",
            "client_id": settings.ZOHO_CLIENT_ID,
            "client_secret": settings.ZOHO_CLIENT_SECRET,
            "redirect_uri": settings.ZOHO_REDIRECT_URI,
            "code": code
        }
    )
    response.raise_for_status()
    return response.json()


def refresh_access_token(refresh_token: str) -> dict:
    """Refresh expired access token using the permanent refresh token."""
    response = httpx.post(
        f"{settings.ZOHO_ACCOUNTS_URL}/oauth/v2/token",
        data={
            "grant_type": "refresh_token",
            "client_id": settings.ZOHO_CLIENT_ID,
            "client_secret": settings.ZOHO_CLIENT_SECRET,
            "refresh_token": refresh_token
        }
    )
    response.raise_for_status()
    return response.json()


def get_organizations(access_token: str) -> list:
    """List Zoho Books organizations the user has access to."""
    response = httpx.get(
        f"{settings.ZOHO_API_BASE}/organizations",
        headers={"Authorization": f"Zoho-oauthtoken {access_token}"}
    )
    response.raise_for_status()
    return response.json().get("organizations", [])


def pull_transactions(token: ConnectorToken, engagement_id: str, db: Session) -> list:
    """
    Pull journal entries from Zoho Books and normalize to AuditOS schema.
    Zoho Books rate limit: 100 requests/minute per organization.
    """
    headers = {
        "Authorization": f"Zoho-oauthtoken {token.access_token}",
    }
    params = {"organization_id": token.realm_id}  # reuse realm_id field for org_id

    response = httpx.get(
        f"{settings.ZOHO_API_BASE}/journals",
        headers=headers,
        params=params
    )
    response.raise_for_status()
    data = response.json()

    transactions = []
    for journal in data.get("journals", []):
        journal_id = journal.get("journal_id")

        # Fetch full journal detail for line items
        detail_response = httpx.get(
            f"{settings.ZOHO_API_BASE}/journals/{journal_id}",
            headers=headers,
            params=params
        )
        detail_response.raise_for_status()
        journal_detail = detail_response.json().get("journal", {})

        for line in journal_detail.get("line_items", []):
            transactions.append({
                "engagement_id": engagement_id,
                "source_system": "Zoho Books",
                "transaction_date": journal_detail.get("journal_date"),
                "document_number": journal_detail.get("journal_number") or str(journal_id),
                "account_code": line.get("account_id"),
                "account_name": line.get("account_name"),
                "debit_amount": float(line.get("debit", 0)),
                "credit_amount": float(line.get("credit", 0)),
                "currency": journal_detail.get("currency_code", "INR"),
                "description": line.get("description") or journal_detail.get("notes") or "",
                "posted_by": journal_detail.get("created_by_email", ""),
            })

    return transactions
