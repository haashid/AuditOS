"""
Audit Report PDF Generator — creates a professional PDF audit report using ReportLab.
"""
import os
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from core.database import get_db
from core.security import get_current_user
from core.permissions import require_role
from core.config import settings
from models.engagement import Engagement, Transaction
from models.finding import Finding
from models.workpaper import Workpaper
from models.fraud_alert import FraudAlert

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/engagements/{engagement_id}/reports/generate")
def generate_audit_report(
    engagement_id: str,
    current_user=Depends(require_role("senior_auditor")),
    db: Session = Depends(get_db)
):
    engagement = db.query(Engagement).filter(
        Engagement.id == engagement_id,
        Engagement.org_id == current_user.org_id
    ).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    findings = db.query(Finding).filter(Finding.engagement_id == engagement_id).all()
    workpapers = db.query(Workpaper).filter(Workpaper.engagement_id == engagement_id).all()
    transactions = db.query(Transaction).filter(Transaction.engagement_id == engagement_id).all()
    fraud_alerts = db.query(FraudAlert).filter(FraudAlert.engagement_id == engagement_id).all()

    # Stats
    total_txns = len(transactions)
    flagged_txns = len([t for t in transactions if t.is_flagged])
    critical_findings = len([f for f in findings if f.severity == "critical"])
    high_findings = len([f for f in findings if f.severity == "high"])
    open_findings = len([f for f in findings if f.status == "open"])

    # Build PDF
    output_dir = f"{settings.UPLOAD_DIR}/{engagement_id}/reports"
    os.makedirs(output_dir, exist_ok=True)
    report_path = f"{output_dir}/audit_report_{uuid.uuid4().hex[:8]}.pdf"

    doc = SimpleDocTemplate(
        report_path,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()
    story = []

    # Styles
    title_style = ParagraphStyle("CustomTitle", parent=styles["Title"], fontSize=20, spaceAfter=6, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=11, spaceAfter=4, alignment=TA_CENTER, textColor=colors.grey)
    heading1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=14, spaceAfter=6, textColor=colors.HexColor("#1e3a5f"))
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=9)

    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("INDEPENDENT AUDIT REPORT", title_style))
    story.append(Paragraph(f"Engagement: {engagement.name}", subtitle_style))
    story.append(Paragraph(f"Client: {engagement.client_name or 'N/A'}", subtitle_style))
    story.append(Paragraph(f"Fiscal Year: {engagement.fiscal_year_start} to {engagement.fiscal_year_end}", subtitle_style))
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1e3a5f")))
    story.append(Spacer(1, 0.5*cm))

    # Executive Summary
    story.append(Paragraph("1. Executive Summary", heading1))
    story.append(Paragraph(
        f"This report presents the findings of the audit conducted for {engagement.client_name or 'the client'} "
        f"for the fiscal year ended {engagement.fiscal_year_end}. The audit was performed using AuditOS AI, "
        f"an AI-powered audit platform. A total of {total_txns:,} transactions were analyzed.",
        normal
    ))
    story.append(Spacer(1, 0.3*cm))

    # Key Statistics Table
    story.append(Paragraph("2. Key Statistics", heading1))
    stats_data = [
        ["Metric", "Value"],
        ["Total Transactions Analyzed", f"{total_txns:,}"],
        ["Flagged Transactions", f"{flagged_txns:,} ({flagged_txns/max(total_txns,1)*100:.1f}%)"],
        ["Total Findings", str(len(findings))],
        ["Critical Findings", str(critical_findings)],
        ["High Severity Findings", str(high_findings)],
        ["Open Findings (Unresolved)", str(open_findings)],
        ["Fraud Patterns Detected", str(len(fraud_alerts))],
        ["Workpapers Prepared", str(len(workpapers))],
    ]
    stats_table = Table(stats_data, colWidths=[10*cm, 6*cm])
    stats_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4f8")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 0.5*cm))

    # Findings Summary
    story.append(Paragraph("3. Findings Summary", heading1))
    if findings:
        findings_data = [["#", "Title", "Severity", "Status"]]
        for i, f in enumerate(findings[:20], 1):  # Max 20 in summary
            findings_data.append([str(i), f.title[:60], (f.severity or "").upper(), (f.status or "").replace("_", " ").title()])
        findings_table = Table(findings_data, colWidths=[1*cm, 10*cm, 3*cm, 3*cm])
        findings_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4f8")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(findings_table)
    else:
        story.append(Paragraph("No findings were raised during this engagement.", normal))
    story.append(Spacer(1, 0.5*cm))

    # Fraud Intelligence Section
    if fraud_alerts:
        story.append(Paragraph("4. Fraud Intelligence", heading1))
        story.append(Paragraph(
            f"{len(fraud_alerts)} fraud pattern(s) were detected during automated analysis:",
            normal
        ))
        for alert in fraud_alerts[:10]:
            story.append(Spacer(1, 0.2*cm))
            story.append(Paragraph(f"<b>{alert.title}</b> [{(alert.severity or '').upper()}]", normal))
            story.append(Paragraph(alert.ai_explanation or alert.description or "", small))

    # Conclusion
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("5. Conclusion", heading1))
    if critical_findings > 0:
        opinion = "ADVERSE — Critical issues identified requiring immediate management attention."
    elif high_findings > 2:
        opinion = "QUALIFIED — Significant issues identified. Material weaknesses noted."
    elif open_findings > 0:
        opinion = "UNQUALIFIED WITH EMPHASIS — Minor issues noted. Management should address open findings."
    else:
        opinion = "UNQUALIFIED — No material issues identified. Controls appear adequate."

    story.append(Paragraph(f"<b>Audit Opinion: {opinion}</b>", normal))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "This report was generated by AuditOS AI. All findings should be reviewed and validated by a qualified auditor before issuance.",
        small
    ))

    doc.build(story)

    return FileResponse(
        report_path,
        media_type="application/pdf",
        filename=f"AuditReport_{engagement.name.replace(' ', '_')}.pdf"
    )


# ─── AI Management Letter Generator ──────────────────────────────────────────

@router.post("/engagements/{engagement_id}/management-letter")
def generate_management_letter(
    engagement_id: str,
    current_user=Depends(require_role("senior_auditor")),
    db: Session = Depends(get_db)
):
    """
    Streams a professional management letter (letter of recommendations)
    drafted by AI, based on all findings and fraud alerts for this engagement.
    Addressed to the Board and Audit Committee. Senior Auditor+ only.
    """
    import openai
    import time
    from fastapi.responses import StreamingResponse

    engagement = db.query(Engagement).filter(
        Engagement.id == engagement_id,
        Engagement.org_id == current_user.org_id
    ).first()
    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    findings = db.query(Finding).filter(
        Finding.engagement_id == engagement_id
    ).all()

    fraud_alerts = db.query(FraudAlert).filter(
        FraudAlert.engagement_id == engagement_id
    ).all()

    critical = [f for f in findings if f.severity == "critical"]
    high = [f for f in findings if f.severity == "high"]
    medium = [f for f in findings if f.severity == "medium"]
    open_count = len([f for f in findings if f.status == "open"])

    findings_text = "\n".join([
        f"[{(f.severity or 'medium').upper()}] {f.title}: "
        f"{f.description or ''} | Recommendation: {f.recommendation or 'N/A'}"
        for f in findings
    ]) or "No findings raised during this engagement."

    fraud_text = "\n".join([
        f"[{a.pattern_type or 'PATTERN'}] {a.title}: {a.ai_explanation or ''}"
        for a in fraud_alerts
    ]) or "No fraud patterns detected."

    prompt = f"""You are a Senior Chartered Accountant writing a formal
Management Letter (Letter of Recommendations) to the Board of Directors
and Audit Committee.

ENGAGEMENT DETAILS:
Client: {engagement.client_name}
Engagement: {engagement.name}
Fiscal Year: {engagement.fiscal_year_start} to {engagement.fiscal_year_end}

FINDINGS SUMMARY:
Critical: {len(critical)} | High: {len(high)} | Medium: {len(medium)}
Open (unresolved): {open_count}

DETAILED FINDINGS:
{findings_text}

FRAUD INTELLIGENCE:
{fraud_text}

Write a complete, professional Management Letter with these sections:
1. ADDRESSEE & DATE — To the Board of Directors and Audit Committee of {engagement.client_name}
2. SCOPE — Brief description of what was audited and the period
3. EXECUTIVE SUMMARY — Overall audit conclusion in 2-3 sentences
4. SIGNIFICANT OBSERVATIONS — Each critical and high finding as a numbered item with: Observation, Risk/Implication, Recommendation
5. OTHER OBSERVATIONS — Medium findings, briefly
6. FRAUD INDICATORS — If any fraud patterns detected, note them formally. If none, omit this section.
7. MANAGEMENT RESPONSIBILITIES — Standard paragraph on management's responsibility for internal controls
8. CLOSING — Professional close with auditor signature block placeholder

Use formal CA/audit language. Be specific — reference actual finding titles. Do not invent details not in the findings provided."""

    client = openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )

    def generate():
        for attempt in range(3):
            try:
                response = client.chat.completions.create(
                    model="openai/gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=3000,
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
                    yield f"\n[Rate limit hit — retrying in {wait}s...]\n"
                    time.sleep(wait)
                else:
                    yield f"\n[Error generating letter: {str(e)}]"
                    return

    return StreamingResponse(generate(), media_type="text/plain")
