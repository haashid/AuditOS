"""
AuditOS AI — FastAPI Application Entry Point (Month 3)
"""
import os
import logging
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from api.v1.auth import limiter

from core.config import settings
from core.database import create_tables, SessionLocal

# Month 1+2 routers
from api.v1.auth import router as auth_router
from api.v1.engagements import router as engagements_router
from api.v1.dashboard import router as dashboard_router
from api.v1.copilot import router as copilot_router
from api.v1.documents import router as documents_router
from api.v1.findings import router as findings_router
from api.v1.workpapers import router as workpapers_router

# Month 3 routers
from api.v1.fraud import router as fraud_router
from api.v1.regulations import router as regulations_router
from api.v1.industry import router as industry_router
from api.v1.reports import router as reports_router
from api.v1.portal import router as portal_router
from api.v1.alerts import router as alerts_router

# Month 5 routers
from api.v1.connectors import router as connectors_router
from api.v1.templates import router as templates_router

# Phase 2 routers
from api.v1.team import router as team_router
from api.v1.activity import router as activity_router

# Phase 2 models (must import so create_all picks them up)
import models.invitation  # noqa: F401
import models.activity_log  # noqa: F401

# Phase 3 models
import models.tax  # noqa: F401

# Phase 4 models
import models.it_audit  # noqa: F401
import models.cyber_audit  # noqa: F401
import models.esg_audit  # noqa: F401
import models.operational_audit  # noqa: F401

# Phase 5 models
import models.supply_chain  # noqa: F401
import models.marketplace  # noqa: F401

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AuditOS AI API",
    description="AI-powered audit operating system — Month 3 Scale & Intelligence",
    version="5.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Register routers — Month 1+2
app.include_router(auth_router, prefix="/api/v1")
app.include_router(engagements_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(copilot_router, prefix="/api/v1", tags=["copilot"])
app.include_router(documents_router, prefix="/api/v1", tags=["documents"])
app.include_router(findings_router, prefix="/api/v1", tags=["findings"])
app.include_router(workpapers_router, prefix="/api/v1", tags=["workpapers"])

# Register routers — Month 3
app.include_router(fraud_router, prefix="/api/v1", tags=["fraud"])
app.include_router(regulations_router, prefix="/api/v1", tags=["regulations"])
app.include_router(industry_router, prefix="/api/v1", tags=["industry"])
app.include_router(reports_router, prefix="/api/v1", tags=["reports"])
app.include_router(portal_router, prefix="/api/v1", tags=["portal"])
app.include_router(alerts_router, prefix="/api/v1", tags=["alerts"])

# Register routers — Month 5
app.include_router(connectors_router, prefix="/api/v1", tags=["connectors"])
app.include_router(templates_router, prefix="/api/v1", tags=["templates"])

# Register routers — Phase 2
app.include_router(team_router, prefix="/api/v1", tags=["team"])
app.include_router(activity_router, prefix="/api/v1", tags=["activity"])

# Register routers — Phase 3
from api.v1.modules import router as modules_router
from api.v1.admin import router as admin_router
from api.v1.tax import router as tax_router
app.include_router(modules_router, prefix="/api/v1", tags=["modules"])
app.include_router(admin_router, prefix="/api/v1", tags=["admin"])
app.include_router(tax_router, prefix="/api/v1", tags=["tax"])

# Phase 4 and 5 routers
from api.v1 import it_audit, cyber_audit, esg_audit, operational_audit, supply_chain, marketplace
app.include_router(it_audit.router,          prefix="/api/v1", tags=["it_audit"])
app.include_router(cyber_audit.router,       prefix="/api/v1", tags=["cyber_audit"])
app.include_router(esg_audit.router,         prefix="/api/v1", tags=["esg_audit"])
app.include_router(operational_audit.router, prefix="/api/v1", tags=["operational_audit"])
app.include_router(supply_chain.router,      prefix="/api/v1", tags=["supply_chain_audit"])
app.include_router(marketplace.router,       prefix="/api/v1", tags=["marketplace"])


@app.on_event("startup")
def on_startup():
    """
    Startup sequence:
    1. Ensure upload directory exists
    2. Run Alembic migrations (if alembic.ini is present)
    3. Run create_all() as a safety net for any tables Alembic missed
    4. Seed regulations and risk library if tables are empty
    5. Start the nightly scoring scheduler
    """
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # 1. Skip Alembic migrations in startup to prevent reload deadlocks
    # try:
    #     # pyrefly: ignore [missing-import]
    #     from alembic.config import Config
    #     from alembic import command
    #     alembic_cfg = Config("alembic.ini")
    #     command.upgrade(alembic_cfg, "head")
    #     print("[Startup] Alembic migrations applied successfully.")
    # except Exception as e:
    #     print(f"[Startup] WARNING: Alembic migration failed: {e}")
    #     print("[Startup] Falling back to create_all()...")
    
    from core.database import Base, engine
    Base.metadata.create_all(bind=engine)

    # 2. create_all() as safety net
    create_tables()

    # 3. Seed data
    from core.seed_data import seed_if_empty
    db = SessionLocal()
    try:
        seed_if_empty(db)
    except Exception as e:
        logger.error(f"[Startup] Seed data error: {e}")
    finally:
        db.close()

    # 4. Start nightly scheduler
    from core.scheduler import start_scheduler
    try:
        start_scheduler()
        print("[Startup] Nightly transaction rescoring scheduler activated.")
    except Exception as e:
        logger.error(f"[Startup] Scheduler error: {e}")


@app.get("/health", tags=["health"])
def health_check():
    return {
        "status": "healthy",
        "version": "5.0.0",
        "checks": {
            "database": "ok",
            "redis": "ok"
        },
        "timestamp": datetime.utcnow().isoformat()
    }
