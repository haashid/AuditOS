"""
Jira Finding Sync Connector
One-way push: AuditOS Finding → Jira Issue.
Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/

IMPORTANT NOTES:
- Jira connects at the ORG level, not per-engagement.
  One Jira connection serves all engagements for the firm.
- The cloud ID (site identifier) is stored in ConnectorToken.realm_id.
- Jira REST API v3 requires ADF (Atlassian Document Format) for
  description fields — plain strings are rejected.
- If jira_issue_key is already set on a Finding, the sync endpoint
  returns HTTP 400 to prevent duplicate issues.
"""
import httpx
from datetime import datetime, timedelta
from core.config import settings

JIRA_AUTH_URL = "https://auth.atlassian.com/authorize"
JIRA_TOKEN_URL = "https://auth.atlassian.com/oauth/token"


def get_authorization_url(state: str) -> str:
    """Build the Atlassian OAuth 2.0 authorization URL."""
    from urllib.parse import urlencode
    params = {
        "audience": "api.atlassian.com",
        "client_id": settings.JIRA_CLIENT_ID,
        "scope": "write:jira-work read:jira-work offline_access",
        "redirect_uri": settings.JIRA_REDIRECT_URI,
        "state": state,
        "response_type": "code",
        "prompt": "consent"
    }
    return f"{JIRA_AUTH_URL}?{urlencode(params)}"


def exchange_code_for_token(code: str) -> dict:
    """Exchange an authorization code for access + refresh tokens."""
    response = httpx.post(
        JIRA_TOKEN_URL,
        json={
            "grant_type": "authorization_code",
            "client_id": settings.JIRA_CLIENT_ID,
            "client_secret": settings.JIRA_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.JIRA_REDIRECT_URI
        },
        timeout=30.0
    )
    response.raise_for_status()
    return response.json()


def refresh_access_token(refresh_token: str) -> dict:
    """Refresh the Jira access token using the stored refresh token."""
    response = httpx.post(
        JIRA_TOKEN_URL,
        json={
            "grant_type": "refresh_token",
            "client_id": settings.JIRA_CLIENT_ID,
            "client_secret": settings.JIRA_CLIENT_SECRET,
            "refresh_token": refresh_token
        },
        timeout=30.0
    )
    response.raise_for_status()
    return response.json()


def get_accessible_sites(access_token: str) -> list:
    """
    Returns all Jira Cloud sites accessible to this token.
    Each site has: id (cloudId), url, name, scopes.
    The first site is used by default when multiple exist.
    """
    response = httpx.get(
        "https://api.atlassian.com/oauth/token/accessible-resources",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30.0
    )
    response.raise_for_status()
    return response.json()


def get_projects(access_token: str, cloud_id: str) -> list:
    """
    List all Jira projects for the given site.
    Returns a list of {key, name, id} dicts so the auditor
    can pick a target project for syncing findings.
    """
    response = httpx.get(
        f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/project/search",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json"
        },
        timeout=30.0
    )
    response.raise_for_status()
    return response.json().get("values", [])


def create_jira_issue(access_token: str, cloud_id: str,
                      project_key: str, finding: dict) -> dict:
    """
    Creates a Jira issue from an AuditOS Finding.

    finding dict must contain:
        id            — AuditOS finding UUID (str)
        title         — Finding title (str)
        description   — Finding description (str, may be None)
        severity      — 'critical', 'high', 'medium', 'low', or None
        recommendation — Recommendation text (str, may be None)

    Returns Jira API response: {"id": "...", "key": "PROJ-123", "self": "..."}

    IMPORTANT: Jira REST API v3 requires Atlassian Document Format (ADF)
    for description fields. Plain strings are rejected with HTTP 400.
    """
    severity_to_priority = {
        "critical": "Highest",
        "high": "High",
        "medium": "Medium",
        "low": "Low"
    }
    priority_name = severity_to_priority.get(
        (finding.get("severity") or "").lower(), "Medium"
    )

    description_text = (
        f"{finding.get('description') or 'No description provided.'}\n\n"
        f"Recommendation: {finding.get('recommendation') or 'N/A'}\n\n"
        f"Synced from AuditOS — finding ID: {finding.get('id')}"
    )

    # Jira REST API v3 requires ADF — plain strings are rejected.
    payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": f"[AuditOS] {finding['title']}",
            "description": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": description_text
                            }
                        ]
                    }
                ]
            },
            "issuetype": {"name": "Task"},
            "priority": {"name": priority_name}
        }
    }

    response = httpx.post(
        f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/issue",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        json=payload,
        timeout=30.0
    )
    response.raise_for_status()
    return response.json()
