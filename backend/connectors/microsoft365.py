"""
Microsoft 365 / Azure AD Connector
Pulls user accounts, sign-in activity, and admin role membership
from a client's Azure AD tenant via Microsoft Graph API.

Docs: https://learn.microsoft.com/en-us/graph/api/user-list

IMPORTANT NOTES:
- MFA status (has_mfa) is set to None for all users — a separate
  per-user Graph call is required and is not included in this build.
  The UI renders None as a gray "Verify Manually" badge.
- signInActivity requires AuditLog.Read.All permission AND an
  Azure AD P1/P2 or Microsoft 365 Business Premium license.
  If signInActivity is null, is_dormant is set to None and the
  UI shows "Sign-in data unavailable".
- Uses /common endpoint for multi-tenant authorization, allowing
  any client's Azure AD tenant to connect.
"""
import httpx
from datetime import datetime, timedelta
from core.config import settings

GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
MS_AUTH_BASE = settings.MS365_AUTHORITY  # https://login.microsoftonline.com/common


def get_authorization_url(state: str) -> str:
    from urllib.parse import urlencode
    params = {
        "client_id": settings.MS365_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.MS365_REDIRECT_URI,
        "scope": "offline_access User.Read.All AuditLog.Read.All Directory.Read.All",
        "state": state,
        "response_mode": "query"
    }
    return f"{MS_AUTH_BASE}/oauth2/v2.0/authorize?{urlencode(params)}"


def exchange_code_for_token(code: str) -> dict:
    """Exchange authorization code for access + refresh tokens."""
    response = httpx.post(
        f"{MS_AUTH_BASE}/oauth2/v2.0/token",
        data={
            "client_id": settings.MS365_CLIENT_ID,
            "client_secret": settings.MS365_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.MS365_REDIRECT_URI,
            "grant_type": "authorization_code",
            "scope": "offline_access User.Read.All AuditLog.Read.All Directory.Read.All"
        }
    )
    response.raise_for_status()
    return response.json()


def refresh_access_token(refresh_token: str) -> dict:
    response = httpx.post(
        f"{MS_AUTH_BASE}/oauth2/v2.0/token",
        data={
            "client_id": settings.MS365_CLIENT_ID,
            "client_secret": settings.MS365_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": "offline_access User.Read.All AuditLog.Read.All Directory.Read.All"
        }
    )
    response.raise_for_status()
    return response.json()


def get_tenant_id_from_token(access_token: str) -> str:
    """Get the connected organization's Azure AD tenant ID."""
    response = httpx.get(
        f"{GRAPH_API_BASE}/organization",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    response.raise_for_status()
    data = response.json()
    orgs = data.get("value", [])
    if not orgs:
        raise Exception("No organization found for this Microsoft 365 account")
    return orgs[0]["id"]


def get_admin_role_member_ids(access_token: str) -> set:
    """
    Returns a set of user IDs who hold privileged directory roles
    (Global Administrator, User Administrator, etc.)
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    admin_ids = set()

    try:
        roles_resp = httpx.get(
            f"{GRAPH_API_BASE}/directoryRoles",
            headers=headers
        )
        roles_resp.raise_for_status()
        roles = roles_resp.json().get("value", [])

        privileged_role_names = [
            "Global Administrator", "User Administrator",
            "Privileged Role Administrator", "Security Administrator"
        ]

        for role in roles:
            if role.get("displayName") in privileged_role_names:
                members_resp = httpx.get(
                    f"{GRAPH_API_BASE}/directoryRoles/{role['id']}/members",
                    headers=headers
                )
                if members_resp.status_code == 200:
                    members = members_resp.json().get("value", [])
                    for m in members:
                        admin_ids.add(m.get("id"))
    except Exception as e:
        print(f"[MS365] Could not fetch admin roles: {e}")

    return admin_ids


def pull_user_access_data(access_token: str) -> list:
    """
    Pulls all users with sign-in activity from Azure AD.
    Returns data normalized to AuditOS's UserAccessRecord schema.

    NOTE: signInActivity requires AuditLog.Read.All permission and
    an Azure AD P1/P2 or Microsoft 365 Business Premium license.
    If unavailable, is_dormant will be None (shown as
    "Sign-in data unavailable" in the UI — not marked as dormant).

    NOTE: has_mfa is always None — MFA status requires a separate
    per-user Graph call not included in this build. The UI renders
    None as a gray "Verify Manually" badge (not red "No MFA").
    """
    headers = {"Authorization": f"Bearer {access_token}"}

    admin_ids = get_admin_role_member_ids(access_token)

    # Pull users with sign-in activity — requires AuditLog.Read.All
    select_fields = (
        "id,displayName,userPrincipalName,mail,department,jobTitle,"
        "accountEnabled,signInActivity,createdDateTime"
    )
    response = httpx.get(
        f"{GRAPH_API_BASE}/users?$select={select_fields}&$top=999",
        headers=headers
    )
    response.raise_for_status()
    users = response.json().get("value", [])

    records = []
    today = datetime.utcnow().date()

    for user in users:
        sign_in = user.get("signInActivity") or {}
        last_signin_raw = sign_in.get("lastSignInDateTime")

        # None means sign-in data unavailable (no P1/P2 license)
        # This is different from known-dormant
        last_login_date = None
        is_dormant = None  # None = "sign-in data unavailable"

        if last_signin_raw:
            try:
                last_login_date = datetime.fromisoformat(
                    last_signin_raw.replace("Z", "+00:00")
                ).date()
                days_since = (today - last_login_date).days
                is_dormant = days_since > 90
            except (ValueError, TypeError):
                is_dormant = None  # Could not parse date, treat as unavailable

        is_admin = user.get("id") in admin_ids
        is_active = user.get("accountEnabled", True)

        # MFA status requires a separate Graph call per-user (expensive).
        # Always None — UI renders as "Verify Manually" gray badge.
        has_mfa = None

        flags = []
        if is_dormant is True and is_active:
            flags.append("dormant")
        if is_admin:
            flags.append("excessive_rights")

        records.append({
            "username": user.get("userPrincipalName", ""),
            "full_name": user.get("displayName", ""),
            "email": user.get("mail") or user.get("userPrincipalName", ""),
            "department": user.get("department") or "",
            "job_title": user.get("jobTitle") or "",
            "system_name": "Microsoft 365 / Azure AD",
            "access_level": "admin" if is_admin else "standard",
            "last_login_date": last_login_date,
            "is_active": is_active,
            "has_mfa": has_mfa,          # None = "needs manual verification"
            "is_dormant": is_dormant,    # None = "sign-in data unavailable"
            "has_excessive_rights": is_admin,
            "risk_flag": ",".join(flags) if flags else None
        })

    return records
