"""
Nightly Transaction Rescoring Scheduler
Runs at 2am every night. Re-scores all transactions added in the last 24 hours.
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from core.database import SessionLocal
from models.engagement import Transaction
from services.flag_engine import flag_transaction
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def rescore_recent_transactions():
    """
    Runs every night at 2am.
    Re-scores all transactions added in the last 24 hours.
    Also re-scores any previously unflagged transactions (score == 0).
    """
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(hours=24)
        recent = db.query(Transaction).filter(
            Transaction.created_at >= cutoff
        ).all()

        for txn in recent:
            row = {
                "transaction_date": txn.transaction_date,
                "debit_amount": float(txn.debit_amount or 0),
                "credit_amount": float(txn.credit_amount or 0),
                "description": txn.description,
                "posted_by": txn.posted_by
            }
            is_flagged, flag_reasons, risk_score = flag_transaction(row)
            txn.is_flagged = is_flagged
            txn.flag_reasons = flag_reasons
            txn.risk_score = risk_score

        db.commit()
        logger.info(f"[Scheduler] Rescored {len(recent)} transactions at {datetime.utcnow()}")
    except Exception as e:
        logger.error(f"[Scheduler] Error: {e}", exc_info=True)
    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(
        rescore_recent_transactions,
        CronTrigger(hour=2, minute=0),  # 2am every night
        id="nightly_rescore",
        replace_existing=True
    )
    scheduler.start()
    logger.info("[Scheduler] Nightly transaction rescoring scheduled for 2:00 AM.")
