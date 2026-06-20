"""
Standard ITGC controls — seeded for each new IT Audit engagement.
Based on COSO/COBIT framework aligned with Big 4 audit practice.
"""

STANDARD_ITGC_CONTROLS = [
    # ── Access Controls ──────────────────────────────────────
    {
        "category": "access_control",
        "control_id": "AC-01",
        "control_name": "User Access Provisioning",
        "control_description": "New user access is formally requested, approved by management, and provisioned by IT within defined timelines.",
        "test_procedure": "1. Select sample of new users added during the period.\n2. Obtain access request forms for sample.\n3. Verify management approval obtained before access granted.\n4. Confirm access granted matches what was approved.",
        "is_key_control": True
    },
    {
        "category": "access_control",
        "control_id": "AC-02",
        "control_name": "User Access Termination",
        "control_description": "Access is revoked within 24 hours of employee termination or role change.",
        "test_procedure": "1. Obtain list of terminated employees during the period.\n2. Compare to active user list — check for accounts not disabled.\n3. Verify HR notification process to IT is documented.",
        "is_key_control": True
    },
    {
        "category": "access_control",
        "control_id": "AC-03",
        "control_name": "Privileged Access Review",
        "control_description": "Administrator and privileged accounts are reviewed quarterly. Unnecessary privileges are revoked.",
        "test_procedure": "1. Obtain list of all admin/privileged accounts.\n2. Verify periodic review was performed (obtain sign-off evidence).\n3. Check that ex-employees or contractors do not retain admin access.",
        "is_key_control": True
    },
    {
        "category": "access_control",
        "control_id": "AC-04",
        "control_name": "Password Policy Enforcement",
        "control_description": "Password policy enforces minimum length, complexity, and rotation. MFA required for privileged access.",
        "test_procedure": "1. Obtain system-generated password policy configuration screenshot.\n2. Verify policy meets minimum standards (8+ chars, complexity, 90-day rotation).\n3. Confirm MFA is enforced for admin accounts.",
        "is_key_control": False
    },
    {
        "category": "access_control",
        "control_id": "AC-05",
        "control_name": "Segregation of Duties",
        "control_description": "No single user has conflicting access rights that would allow them to initiate and approve transactions.",
        "test_procedure": "1. Map critical business processes to system roles.\n2. Identify roles that should be segregated.\n3. Run SoD conflict report from system.\n4. Verify conflicts are mitigated by compensating controls.",
        "is_key_control": True
    },
    # ── Change Management ─────────────────────────────────────
    {
        "category": "change_management",
        "control_id": "CM-01",
        "control_name": "Change Request Process",
        "control_description": "All system changes follow a formal request, review, and approval process before implementation.",
        "test_procedure": "1. Obtain change log for the period.\n2. Select sample of changes.\n3. Verify each change has: documented request, technical review, business approval.\n4. Check that emergency changes have retrospective approval.",
        "is_key_control": True
    },
    {
        "category": "change_management",
        "control_id": "CM-02",
        "control_name": "Testing Before Deployment",
        "control_description": "Changes are tested in a non-production environment before deployment to production.",
        "test_procedure": "1. From change sample in CM-01, verify test evidence exists.\n2. Confirm test sign-off obtained before production deployment.\n3. Verify separate test/staging environment exists.",
        "is_key_control": True
    },
    {
        "category": "change_management",
        "control_id": "CM-03",
        "control_name": "Rollback Procedures",
        "control_description": "All production changes include a documented rollback plan in case of failure.",
        "test_procedure": "1. For change sample, verify rollback plan documented.\n2. Confirm rollback was tested where applicable.\n3. Check emergency change rollback procedures.",
        "is_key_control": False
    },
    # ── Computer Operations ───────────────────────────────────
    {
        "category": "computer_operations",
        "control_id": "CO-01",
        "control_name": "Backup and Recovery",
        "control_description": "Critical data is backed up daily. Recovery is tested at least annually.",
        "test_procedure": "1. Obtain backup policy and schedule.\n2. Verify backup logs show successful execution.\n3. Obtain evidence of last recovery test.\n4. Confirm offsite or cloud backup exists.",
        "is_key_control": True
    },
    {
        "category": "computer_operations",
        "control_id": "CO-02",
        "control_name": "Job Scheduling and Monitoring",
        "control_description": "Automated jobs/batch processes are monitored. Failures are detected and resolved.",
        "test_procedure": "1. Obtain list of critical batch jobs.\n2. Verify monitoring alerts are configured.\n3. Review job failure log — confirm failures were investigated.",
        "is_key_control": False
    },
    {
        "category": "computer_operations",
        "control_id": "CO-03",
        "control_name": "Incident Management",
        "control_description": "Security and operational incidents are logged, classified, and resolved within defined SLAs.",
        "test_procedure": "1. Obtain incident log for the period.\n2. Select sample of critical incidents.\n3. Verify classification, assignment, and resolution timelines.\n4. Confirm post-incident review for major incidents.",
        "is_key_control": False
    },
    # ── Program Development ───────────────────────────────────
    {
        "category": "program_development",
        "control_id": "PD-01",
        "control_name": "System Development Lifecycle (SDLC)",
        "control_description": "A formal SDLC methodology governs all new system development with defined phases.",
        "test_procedure": "1. Obtain SDLC policy document.\n2. Select sample development project.\n3. Verify all SDLC phases documented (requirements, design, test, UAT, deployment).\n4. Confirm user acceptance sign-off obtained.",
        "is_key_control": True
    },
    {
        "category": "program_development",
        "control_id": "PD-02",
        "control_name": "Code Review Process",
        "control_description": "All code changes undergo peer review before deployment to production.",
        "test_procedure": "1. Obtain code repository access logs or pull request history.\n2. Verify code reviews documented for sample of changes.\n3. Confirm reviewer is different from code author.",
        "is_key_control": False
    },
]


def seed_itgc_controls(engagement_id: str, org_id: str, db):
    """Seed standard ITGC controls for a new IT audit engagement."""
    from models.it_audit import ITGCControl

    # Check if already seeded
    existing = db.query(ITGCControl).filter(
        ITGCControl.engagement_id == engagement_id
    ).count()
    if existing > 0:
        return

    for control in STANDARD_ITGC_CONTROLS:
        db.add(ITGCControl(
            org_id=org_id,
            engagement_id=engagement_id,
            **control,
            effectiveness="not_tested"
        ))
    db.commit()
    print(f"[ITGC] Seeded {len(STANDARD_ITGC_CONTROLS)} controls for engagement {engagement_id}")
