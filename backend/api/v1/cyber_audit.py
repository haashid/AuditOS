from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import time
import openai

from core.database import get_db
from core.security import get_current_user
from core.permissions import require_module
from core.config import settings
from core.cyber_audit_seed import seed_nist_controls
from models.cyber_audit import Vulnerability, CyberControl

router = APIRouter()


def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )


# ── Vulnerability Import ──────────────────────────────────────

@router.post("/cyber/engagements/{engagement_id}/vulnerabilities/upload-csv")
async def upload_vulnerabilities_csv(
    engagement_id: str,
    file: UploadFile = File(...),
    current_user=Depends(require_module("cyber_audit")),
    db: Session = Depends(get_db)
):
    """
    Upload vulnerability scan results as CSV.
    Compatible with Nessus CSV export format.
    Expected columns: Plugin ID, CVE, CVSS, Risk, Host, Port, Name, Description, Solution
    """
    import pandas as pd
    import io

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse CSV file")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    db.query(Vulnerability).filter(
        Vulnerability.engagement_id == engagement_id
    ).delete()

    added = 0
    for _, row in df.iterrows():
        risk = str(row.get("risk", "info")).lower()
        severity_map = {
            "critical": "critical", "high": "high",
            "medium": "medium", "low": "low", "none": "info", "info": "info"
        }
        severity = severity_map.get(risk, "info")

        try:
            cvss = float(str(row.get("cvss", 0)).replace(",", ""))
        except (ValueError, TypeError):
            cvss = 0.0

        db.add(Vulnerability(
            org_id=current_user.org_id,
            engagement_id=engagement_id,
            plugin_id=str(row.get("plugin_id", "")),
            vuln_name=str(row.get("name", "")),
            description=str(row.get("description", "")),
            host=str(row.get("host", "")),
            port=int(row.get("port", 0)) if str(row.get("port", "")).isdigit() else None,
            protocol=str(row.get("protocol", "tcp")),
            cvss_score=cvss,
            severity=severity,
            cve_ids=[str(row.get("cve", ""))] if row.get("cve") else [],
            solution=str(row.get("solution", "")),
            source="nessus"
        ))
        added += 1

    db.commit()

    critical = db.query(Vulnerability).filter(
        Vulnerability.engagement_id == engagement_id,
        Vulnerability.severity == "critical"
    ).count()

    return {
        "total_vulnerabilities": added,
        "critical": critical,
        "source": "CSV Import"
    }


@router.get("/cyber/engagements/{engagement_id}/vulnerabilities/summary")
def get_vulnerability_summary(
    engagement_id: str,
    current_user=Depends(require_module("cyber_audit")),
    db: Session = Depends(get_db)
):
    vulns = db.query(Vulnerability).filter(
        Vulnerability.engagement_id == engagement_id,
        Vulnerability.org_id == current_user.org_id
    ).all()

    by_severity = {}
    for v in vulns:
        sev = v.severity or "info"
        by_severity[sev] = by_severity.get(sev, 0) + 1

    return {
        "total": len(vulns),
        "by_severity": by_severity,
        "open": len([v for v in vulns if v.status == "open"]),
        "top_10": [
            {
                "id": str(v.id),
                "vuln_name": v.vuln_name,
                "host": v.host,
                "cvss_score": float(v.cvss_score or 0),
                "severity": v.severity,
                "status": v.status,
                "solution": v.solution
            }
            for v in sorted(vulns, key=lambda x: float(x.cvss_score or 0), reverse=True)[:10]
        ]
    }


# ── NIST CSF Assessment ───────────────────────────────────────

@router.post("/cyber/engagements/{engagement_id}/nist-assessment/run")
def run_nist_assessment(
    engagement_id: str,
    current_user=Depends(require_module("cyber_audit")),
    db: Session = Depends(get_db)
):
    """
    Streams an AI-powered NIST CSF assessment based on
    the vulnerability data and any context provided.
    """
    vulns = db.query(Vulnerability).filter(
        Vulnerability.engagement_id == engagement_id,
        Vulnerability.org_id == current_user.org_id
    ).all()

    total = len(vulns)
    by_severity = {}
    for v in vulns:
        by_severity[v.severity] = by_severity.get(v.severity, 0) + 1

    prompt = f"""You are a cybersecurity auditor performing a NIST Cybersecurity Framework assessment.

VULNERABILITY SCAN SUMMARY:
- Total vulnerabilities: {total}
- By severity: {by_severity}

Assess the organization against each NIST CSF function and provide:
1. IDENTIFY — Asset management, governance, risk assessment maturity
2. PROTECT — Access control, data security, protective technology
3. DETECT — Anomalies, continuous monitoring capabilities
4. RESPOND — Response planning, communications, analysis
5. RECOVER — Recovery planning, improvements, communications

For each function:
- Current Maturity Level (0-4): 0=None, 1=Partial, 2=Risk Informed, 3=Repeatable, 4=Adaptive
- Key gaps identified
- Top 2 recommendations

Base your assessment on the vulnerability data. Be specific and professional."""

    client = get_ai_client()

    def generate():
        for attempt in range(3):
            try:
                response = client.chat.completions.create(
                    model="openai/gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=2000,
                    stream=True
                )
                for chunk in response:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
                return
            except Exception as e:
                if "429" in str(e) and attempt < 2:
                    wait = 20 * (attempt + 1)
                    yield f"\n[Rate limit hit. Retrying in {wait}s...]\n"
                    time.sleep(wait)
                else:
                    yield f"\n[Error: {str(e)}]"
                    return

    return StreamingResponse(generate(), media_type="text/plain")


# ── NIST Manual Assessment ────────────────────────────────────

@router.post("/cyber/engagements/{engagement_id}/nist/initialize")
def initialize_nist_controls(
    engagement_id: str,
    current_user=Depends(require_module("cyber_audit")),
    db: Session = Depends(get_db)
):
    """Seed standard NIST CSF controls for this engagement."""
    seed_nist_controls(engagement_id, str(current_user.org_id), db)
    count = db.query(CyberControl).filter(
        CyberControl.engagement_id == engagement_id,
        CyberControl.framework == 'NIST_CSF'
    ).count()
    return {"message": f"Initialized {count} NIST CSF controls", "total_controls": count}


@router.get("/cyber/engagements/{engagement_id}/nist/controls")
def list_nist_controls(
    engagement_id: str,
    function: Optional[str] = None,
    current_user=Depends(require_module("cyber_audit")),
    db: Session = Depends(get_db)
):
    query = db.query(CyberControl).filter(
        CyberControl.engagement_id == engagement_id,
        CyberControl.org_id == current_user.org_id,
        CyberControl.framework == 'NIST_CSF'
    )
    if function:
        query = query.filter(CyberControl.function == function)

    controls = query.order_by(CyberControl.control_id).all()

    return {
        "controls": [
            {
                "id": str(c.id),
                "function": c.function,
                "control_code": c.control_id,
                "control_name": c.control_name,
                "maturity_level": c.maturity_level,
                "gap_description": c.gap_description,
                "ai_recommendation": c.ai_recommendation
            }
            for c in controls
        ]
    }

class NISTControlUpdate(BaseModel):
    maturity_level: int
    gap_description: Optional[str] = None


@router.patch("/cyber/engagements/{engagement_id}/nist/controls/{control_id}")
def update_nist_control(
    engagement_id: str,
    control_id: str,
    body: NISTControlUpdate,
    current_user=Depends(require_module("cyber_audit")),
    db: Session = Depends(get_db)
):
    control = db.query(CyberControl).filter(
        CyberControl.id == control_id,
        CyberControl.engagement_id == engagement_id,
        CyberControl.org_id == current_user.org_id,
        CyberControl.framework == 'NIST_CSF'
    ).first()
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")

    control.maturity_level = body.maturity_level
    if body.gap_description is not None:
        control.gap_description = body.gap_description

    # AI Recommendation if maturity <= 1
    if control.maturity_level <= 1 and control.gap_description:
        client = get_ai_client()
        prompt = f"""You are a NIST CSF auditor.
Control: {control.control_id} - {control.control_name}
Current Maturity: {control.maturity_level}/4
Identified Gap: {control.gap_description}

Provide a concise, specific recommendation to improve this control's maturity.
Keep it under 3 sentences."""
        try:
            res = client.chat.completions.create(
                model="openai/gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150
            )
            control.ai_recommendation = res.choices[0].message.content.strip()
        except Exception:
            pass

    db.commit()
    return {
        "id": str(control.id),
        "maturity_level": control.maturity_level,
        "ai_recommendation": control.ai_recommendation
    }
