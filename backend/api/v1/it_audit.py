from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import io
import time
import openai
import os
import uuid as uuid_module

from core.database import get_db
from core.security import get_current_user
from core.permissions import require_module
from core.config import settings
from core.it_audit_seed import seed_itgc_controls
from models.it_audit import ITGCControl, UserAccessRecord, ChangeLogEntry

router = APIRouter()


def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )


# ── ITGC Controls ─────────────────────────────────────────────

@router.post("/it/engagements/{engagement_id}/itgc/initialize")
def initialize_itgc(
    engagement_id: str,
    current_user=Depends(require_module("it_audit")),
    db: Session = Depends(get_db)
):
    """Seed standard ITGC controls for this engagement."""
    seed_itgc_controls(engagement_id, str(current_user.org_id), db)
    count = db.query(ITGCControl).filter(
        ITGCControl.engagement_id == engagement_id
    ).count()
    return {"message": f"Initialized {count} ITGC controls", "total_controls": count}


@router.get("/it/engagements/{engagement_id}/itgc/controls")
def list_itgc_controls(
    engagement_id: str,
    category: Optional[str] = None,
    current_user=Depends(require_module("it_audit")),
    db: Session = Depends(get_db)
):
    query = db.query(ITGCControl).filter(
        ITGCControl.engagement_id == engagement_id,
        ITGCControl.org_id == current_user.org_id
    )
    if category:
        query = query.filter(ITGCControl.category == category)

    controls = query.order_by(ITGCControl.control_id).all()

    total = len(controls)
    effective = len([c for c in controls if c.effectiveness == "effective"])
    not_tested = len([c for c in controls if c.effectiveness == "not_tested"])
    deficiencies = len([c for c in controls if c.deficiency_type is not None])

    return {
        "summary": {
            "total": total,
            "effective": effective,
            "not_tested": not_tested,
            "deficiencies": deficiencies,
            "completion_pct": round((total - not_tested) / max(total, 1) * 100)
        },
        "controls": [
            {
                "id": str(c.id),
                "category": c.category,
                "control_id": c.control_id,
                "control_name": c.control_name,
                "control_description": c.control_description,
                "test_procedure": c.test_procedure,
                "effectiveness": c.effectiveness,
                "evidence_description": c.evidence_description,
                "auditor_notes": c.auditor_notes,
                "ai_assessment": c.ai_assessment,
                "is_key_control": c.is_key_control,
                "deficiency_type": c.deficiency_type
            }
            for c in controls
        ]
    }


class ITGCUpdate(BaseModel):
    effectiveness: str  # 'effective', 'partially_effective', 'ineffective', 'not_tested'
    evidence_description: Optional[str] = None
    auditor_notes: Optional[str] = None
    deficiency_type: Optional[str] = None  # null, 'deficiency', 'significant_deficiency', 'material_weakness'


@router.patch("/it/engagements/{engagement_id}/itgc/controls/{control_id}")
def update_itgc_control(
    engagement_id: str,
    control_id: str,
    body: ITGCUpdate,
    current_user=Depends(require_module("it_audit")),
    db: Session = Depends(get_db)
):
    control = db.query(ITGCControl).filter(
        ITGCControl.id == control_id,
        ITGCControl.engagement_id == engagement_id,
        ITGCControl.org_id == current_user.org_id
    ).first()
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")

    valid_effectiveness = ["effective", "partially_effective", "ineffective", "not_tested"]
    if body.effectiveness not in valid_effectiveness:
        raise HTTPException(status_code=400, detail=f"effectiveness must be one of: {valid_effectiveness}")

    control.effectiveness = body.effectiveness
    if body.evidence_description is not None:
        control.evidence_description = body.evidence_description
    if body.auditor_notes is not None:
        control.auditor_notes = body.auditor_notes
    if body.deficiency_type is not None:
        control.deficiency_type = body.deficiency_type

    db.commit()
    return {"id": str(control.id), "effectiveness": control.effectiveness}


@router.post("/it/engagements/{engagement_id}/itgc/controls/{control_id}/ai-assess")
def ai_assess_control(
    engagement_id: str,
    control_id: str,
    current_user=Depends(require_module("it_audit")),
    db: Session = Depends(get_db)
):
    """AI assesses a control based on auditor-provided evidence."""
    control = db.query(ITGCControl).filter(
        ITGCControl.id == control_id,
        ITGCControl.engagement_id == engagement_id,
        ITGCControl.org_id == current_user.org_id
    ).first()
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")

    if not control.evidence_description:
        raise HTTPException(
            status_code=400,
            detail="Add evidence description before requesting AI assessment"
        )

    prompt = f"""You are an IT audit expert reviewing an ITGC control.

CONTROL: {control.control_name}
DESCRIPTION: {control.control_description}
TEST PROCEDURE: {control.test_procedure}
AUDITOR'S EVIDENCE: {control.evidence_description}
AUDITOR'S NOTES: {control.auditor_notes or 'None'}

Based on the evidence provided:
1. Assess whether this control is: Effective / Partially Effective / Ineffective
2. Explain your reasoning in 2-3 sentences
3. If deficient, classify as: Deficiency / Significant Deficiency / Material Weakness
4. Suggest one specific follow-up procedure

Keep the response professional and concise."""

    client = get_ai_client()
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="openai/gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=400
            )
            assessment = response.choices[0].message.content.strip()
            control.ai_assessment = assessment
            db.commit()
            return {"control_id": str(control.id), "ai_assessment": assessment}
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                time.sleep(20 * (attempt + 1))
            else:
                raise HTTPException(status_code=500, detail="AI assessment failed")


# ── User Access Review ────────────────────────────────────────

@router.post("/it/engagements/{engagement_id}/user-access/upload")
async def upload_user_access(
    engagement_id: str,
    file: UploadFile = File(...),
    current_user=Depends(require_module("it_audit")),
    db: Session = Depends(get_db)
):
    """
    Upload user access data as CSV.
    Expected columns: username, full_name, email, department,
    job_title, system_name, access_level, access_granted_date,
    last_login_date, is_active, has_mfa
    """
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse CSV file")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Delete existing records for this engagement
    db.query(UserAccessRecord).filter(
        UserAccessRecord.engagement_id == engagement_id
    ).delete()

    import datetime
    records_added = 0
    flagged_count = 0

    for _, row in df.iterrows():
        last_login_str = str(row.get("last_login_date", ""))
        last_login = None
        is_dormant = False

        try:
            last_login = pd.to_datetime(last_login_str).date()
            days_since_login = (datetime.date.today() - last_login).days
            is_dormant = days_since_login > 90
        except Exception:
            is_dormant = True  # No login date = treat as dormant

        access_level = str(row.get("access_level", "")).lower()
        has_excessive = access_level in ["admin", "superuser"]
        has_mfa = str(row.get("has_mfa", "false")).lower() in ["true", "yes", "1"]
        is_active = str(row.get("is_active", "true")).lower() in ["true", "yes", "1"]

        flags = []
        if is_dormant and is_active:
            flags.append("dormant")
        if has_excessive:
            flags.append("excessive_rights")
        if not has_mfa and has_excessive:
            flags.append("no_mfa")

        is_flagged = len(flags) > 0
        if is_flagged:
            flagged_count += 1

        record = UserAccessRecord(
            org_id=current_user.org_id,
            engagement_id=engagement_id,
            username=str(row.get("username", "")),
            full_name=str(row.get("full_name", "")),
            email=str(row.get("email", "")),
            department=str(row.get("department", "")),
            job_title=str(row.get("job_title", "")),
            system_name=str(row.get("system_name", "")),
            access_level=str(row.get("access_level", "")),
            last_login_date=last_login,
            is_active=is_active,
            has_mfa=has_mfa,
            is_dormant=is_dormant and is_active,
            has_excessive_rights=has_excessive,
            risk_flag=",".join(flags) if flags else None
        )
        db.add(record)
        records_added += 1

    db.commit()
    return {
        "total_users": records_added,
        "flagged_users": flagged_count,
        "source": "User Access CSV"
    }


@router.get("/it/engagements/{engagement_id}/user-access/summary")
def get_user_access_summary(
    engagement_id: str,
    current_user=Depends(require_module("it_audit")),
    db: Session = Depends(get_db)
):
    records = db.query(UserAccessRecord).filter(
        UserAccessRecord.engagement_id == engagement_id,
        UserAccessRecord.org_id == current_user.org_id
    ).all()

    return {
        "total_users": len(records),
        "dormant_accounts": len([r for r in records if r.is_dormant]),
        "admin_accounts": len([r for r in records if r.has_excessive_rights]),
        "no_mfa_admins": len([r for r in records if r.has_excessive_rights and not r.has_mfa]),
        "flagged_users": [
            {
                "username": r.username,
                "full_name": r.full_name,
                "department": r.department,
                "access_level": r.access_level,
                "system_name": r.system_name,
                "risk_flag": r.risk_flag,
                "last_login_date": str(r.last_login_date) if r.last_login_date else None
            }
            for r in records if r.risk_flag
        ][:50]  # paginated
    }


# ── ITSM Change Log ───────────────────────────────────────────

@router.post("/it/engagements/{engagement_id}/change-log/upload")
async def upload_change_log(
    engagement_id: str,
    file: UploadFile = File(...),
    current_user=Depends(require_module("it_audit")),
    db: Session = Depends(get_db)
):
    """
    Upload change management log as CSV.
    Compatible with Jira, ServiceNow, or any ITSM tool export.
    Expected columns: change_id, change_type, description,
    requested_by, approved_by, implemented_by, change_date,
    environment, has_rollback_plan, was_tested
    """
    import pandas as pd
    import io

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse CSV file")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Delete existing change log for this engagement
    db.query(ChangeLogEntry).filter(
        ChangeLogEntry.engagement_id == engagement_id
    ).delete()

    added = 0
    unauthorized_count = 0
    emergency_count = 0

    for _, row in df.iterrows():
        approved_by = str(row.get("approved_by", "")).strip()
        change_type = str(row.get("change_type", "normal")).lower()
        environment = str(row.get("environment", "")).lower()
        has_rollback = str(row.get("has_rollback_plan", "false")).lower() in ["true", "yes", "1"]
        was_tested = str(row.get("was_tested", "false")).lower() in ["true", "yes", "1"]

        is_unauthorized = not approved_by or approved_by in ["", "none", "nan"]
        is_emergency = change_type == "emergency"
        production_direct = environment == "production" and not was_tested

        if is_unauthorized:
            unauthorized_count += 1
        if is_emergency:
            emergency_count += 1

        try:
            change_date = pd.to_datetime(str(row.get("change_date", ""))).date()
        except Exception:
            change_date = None

        db.add(ChangeLogEntry(
            org_id=current_user.org_id,
            engagement_id=engagement_id,
            change_id=str(row.get("change_id", "")),
            change_type=change_type,
            description=str(row.get("description", "")),
            requested_by=str(row.get("requested_by", "")),
            approved_by=approved_by,
            implemented_by=str(row.get("implemented_by", "")),
            change_date=change_date,
            environment=environment,
            has_rollback_plan=has_rollback,
            was_tested=was_tested,
            is_unauthorized=is_unauthorized,
            is_emergency=is_emergency,
            production_direct=production_direct
        ))
        added += 1

    db.commit()

    return {
        "total_changes": added,
        "unauthorized_changes": unauthorized_count,
        "emergency_changes": emergency_count,
        "source": "ITSM CSV Import"
    }


@router.get("/it/engagements/{engagement_id}/change-log/summary")
def get_change_log_summary(
    engagement_id: str,
    current_user=Depends(require_module("it_audit")),
    db: Session = Depends(get_db)
):
    entries = db.query(ChangeLogEntry).filter(
        ChangeLogEntry.engagement_id == engagement_id,
        ChangeLogEntry.org_id == current_user.org_id
    ).all()

    return {
        "total_changes": len(entries),
        "unauthorized": len([e for e in entries if e.is_unauthorized]),
        "emergency": len([e for e in entries if e.is_emergency]),
        "production_direct": len([e for e in entries if e.production_direct]),
        "changes": [
            {
                "change_id": e.change_id,
                "change_type": e.change_type,
                "description": e.description[:100] if e.description else "",
                "approved_by": e.approved_by,
                "change_date": str(e.change_date) if e.change_date else None,
                "environment": e.environment,
                "is_unauthorized": e.is_unauthorized,
                "is_emergency": e.is_emergency,
                "production_direct": e.production_direct
            }
            for e in entries[:50]
        ]
    }


# ── ITGC Report Generation ────────────────────────────────────

@router.post("/it/engagements/{engagement_id}/itgc/generate-report")
def generate_itgc_report(
    engagement_id: str,
    current_user=Depends(require_module("it_audit")),
    db: Session = Depends(get_db)
):
    """Generates ITGC report PDF using existing ReportLab infrastructure."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    controls = db.query(ITGCControl).filter(
        ITGCControl.engagement_id == engagement_id,
        ITGCControl.org_id == current_user.org_id
    ).order_by(ITGCControl.control_id).all()

    user_records = db.query(UserAccessRecord).filter(
        UserAccessRecord.engagement_id == engagement_id,
        UserAccessRecord.org_id == current_user.org_id
    ).all()

    from models.engagement import Engagement
    engagement = db.query(Engagement).filter(
        Engagement.id == engagement_id
    ).first()

    output_dir = f"{settings.UPLOAD_DIR}/{engagement_id}/reports"
    os.makedirs(output_dir, exist_ok=True)
    report_path = f"{output_dir}/ITGC_Report_{uuid_module.uuid4().hex[:8]}.pdf"

    doc = SimpleDocTemplate(report_path, pagesize=A4,
                            rightMargin=2*cm, leftMargin=2*cm,
                            topMargin=2.5*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    DARK = colors.HexColor("#1e3a5f")
    story = []

    # Title
    story.append(Paragraph("IT GENERAL CONTROLS (ITGC) AUDIT REPORT",
                            ParagraphStyle("T", parent=styles["Title"],
                                           fontSize=18, alignment=1, textColor=DARK)))
    story.append(Paragraph(f"Engagement: {engagement.name if engagement else 'N/A'}",
                            ParagraphStyle("S", parent=styles["Normal"],
                                           fontSize=11, alignment=1, textColor=colors.grey)))
    story.append(Spacer(1, 0.5*cm))

    # Summary
    total = len(controls)
    effective = len([c for c in controls if c.effectiveness == "effective"])
    deficiencies = [c for c in controls if c.deficiency_type]

    story.append(Paragraph("Executive Summary",
                            ParagraphStyle("H", parent=styles["Heading1"],
                                           fontSize=13, textColor=DARK)))
    summary_data = [
        ["Metric", "Count"],
        ["Total ITGC Controls", str(total)],
        ["Effective", str(effective)],
        ["Partially Effective", str(len([c for c in controls if c.effectiveness == "partially_effective"]))],
        ["Ineffective", str(len([c for c in controls if c.effectiveness == "ineffective"]))],
        ["Not Tested", str(len([c for c in controls if c.effectiveness == "not_tested"]))],
        ["Deficiencies Noted", str(len(deficiencies))],
        ["Total Users Reviewed", str(len(user_records))],
        ["Dormant Accounts", str(len([r for r in user_records if r.is_dormant]))],
        ["Admin without MFA", str(len([r for r in user_records if r.has_excessive_rights and not r.has_mfa]))],
    ]
    t = Table(summary_data, colWidths=[10*cm, 6*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4f8")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5*cm))

    # Deficiencies section
    if deficiencies:
        story.append(Paragraph("Control Deficiencies",
                                ParagraphStyle("H", parent=styles["Heading1"],
                                               fontSize=13, textColor=DARK)))
        for c in deficiencies:
            story.append(Paragraph(
                f"<b>{c.control_id}: {c.control_name}</b> [{c.deficiency_type.replace('_', ' ').title()}]",
                styles["Normal"]
            ))
            if c.evidence_description:
                story.append(Paragraph(f"Evidence: {c.evidence_description}",
                                        ParagraphStyle("S", parent=styles["Normal"], fontSize=9)))
            if c.ai_assessment:
                story.append(Paragraph(f"AI Assessment: {c.ai_assessment}",
                                        ParagraphStyle("S", parent=styles["Normal"],
                                                       fontSize=9, textColor=colors.grey)))
            story.append(Spacer(1, 0.2*cm))

    doc.build(story)
    return FileResponse(report_path, media_type="application/pdf",
                        filename="ITGC_Audit_Report.pdf")
