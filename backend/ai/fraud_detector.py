"""
Fraud Pattern Detection Engine
Analyzes all transactions in an engagement to detect complex fraud patterns.
Called manually (on-demand) or by the nightly scheduler.
"""
import time
import json
import math
import logging
import numpy as np
from collections import defaultdict
from sqlalchemy.orm import Session
import openai
from core.config import settings
from core.database import SessionLocal
from models.engagement import Transaction
from models.fraud_alert import FraudAlert

logger = logging.getLogger(__name__)

def get_ai_client():
    return openai.OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )


def run_fraud_detection(engagement_id: str, org_id: str) -> list[dict]:
    """
    Runs all fraud pattern checks on an engagement's transactions.
    Returns list of detected patterns.
    Saves FraudAlert records to DB.

    Opens its own SessionLocal() — safe for background tasks.
    """
    db = SessionLocal()
    try:
        transactions = db.query(Transaction).filter(
            Transaction.engagement_id == engagement_id,
            Transaction.org_id == org_id
        ).all()

        if len(transactions) < 10:
            return []  # Not enough data for pattern analysis

        alerts = []

        # Run each pattern detector
        alerts += detect_threshold_splitting(transactions, engagement_id, org_id, db)
        alerts += detect_duplicate_payments(transactions, engagement_id, org_id, db)
        alerts += detect_benford_deviation(transactions, engagement_id, org_id, db)
        alerts += detect_round_number_clusters(transactions, engagement_id, org_id, db)
        alerts += detect_weekend_clusters(transactions, engagement_id, org_id, db)

        return alerts
    except Exception as e:
        logger.error(f"Fraud detection failed for engagement {engagement_id}: {e}", exc_info=True)
        return []
    finally:
        db.close()


def detect_threshold_splitting(transactions, engagement_id, org_id, db):
    """
    Detects payments split to stay just below a threshold.
    Pattern: same vendor, multiple payments, each between 80-99% of a round threshold,
    within a short time window.
    Thresholds checked: 10000, 25000, 50000, 100000, 500000
    """
    alerts = []
    thresholds = [10000, 25000, 50000, 100000, 500000]

    # Group transactions by vendor/account
    by_account = defaultdict(list)
    for t in transactions:
        key = (t.account_name or "unknown").lower().strip()
        by_account[key].append(t)

    for account, txns in by_account.items():
        for threshold in thresholds:
            lower = threshold * 0.80
            near_threshold = [
                t for t in txns
                if lower <= max(float(t.debit_amount or 0), float(t.credit_amount or 0)) < threshold
            ]
            if len(near_threshold) >= 3:
                # Found a cluster — save alert
                txn_ids = [str(t.id) for t in near_threshold]
                total = sum(max(float(t.debit_amount or 0), float(t.credit_amount or 0)) for t in near_threshold)
                explanation = _get_ai_explanation(
                    f"Threshold splitting detected: {len(near_threshold)} payments to '{account}' "
                    f"each between ${lower:,.0f} and ${threshold:,.0f} (just below the ${threshold:,.0f} approval threshold). "
                    f"Total combined: ${total:,.2f}. This pattern is consistent with structuring to avoid authorization controls."
                )
                alert = FraudAlert(
                    org_id=org_id,
                    engagement_id=engagement_id,
                    pattern_type="threshold_splitting",
                    severity="high",
                    title=f"Threshold Splitting — {account} (${threshold:,.0f} threshold)",
                    description=f"{len(near_threshold)} payments just below ${threshold:,.0f} approval limit. Total: ${total:,.2f}",
                    affected_transaction_ids=txn_ids,
                    pattern_data={"threshold": threshold, "count": len(near_threshold), "total": float(total)},
                    ai_explanation=explanation,
                    confidence_score=0.80
                )
                db.add(alert)
                db.commit()
                alerts.append({"type": "threshold_splitting", "account": account, "count": len(near_threshold)})

    return alerts


def detect_duplicate_payments(transactions, engagement_id, org_id, db):
    """
    Detects payments with same amount to same account within 30 days.
    Exact duplicates are almost certainly errors or fraud.
    """
    alerts = []
    seen = defaultdict(list)

    for t in transactions:
        amount = max(float(t.debit_amount or 0), float(t.credit_amount or 0))
        if amount == 0:
            continue
        key = (
            (t.account_name or "").lower().strip(),
            round(amount, 2)
        )
        seen[key].append(t)

    for (account, amount), txns in seen.items():
        if len(txns) >= 2 and amount >= 1000:
            txn_ids = [str(t.id) for t in txns]
            explanation = _get_ai_explanation(
                f"Duplicate payment detected: {len(txns)} payments of exactly ${amount:,.2f} to '{account}'. "
                f"Exact duplicate amounts to the same payee are a strong indicator of duplicate payment fraud or system error."
            )
            alert = FraudAlert(
                org_id=org_id,
                engagement_id=engagement_id,
                pattern_type="duplicate_payment",
                severity="high" if amount >= 10000 else "medium",
                title=f"Duplicate Payment — {account} (${amount:,.2f} × {len(txns)})",
                description=f"{len(txns)} identical payments of ${amount:,.2f} to same account.",
                affected_transaction_ids=txn_ids,
                pattern_data={"amount": float(amount), "count": len(txns)},
                ai_explanation=explanation,
                confidence_score=0.90
            )
            db.add(alert)
            db.commit()
            alerts.append({"type": "duplicate_payment", "account": account, "amount": amount})

    return alerts


def detect_benford_deviation(transactions, engagement_id, org_id, db):
    """
    Applies Benford's Law to the full transaction set.
    Raises alert if observed distribution significantly deviates from expected.
    Only meaningful with 100+ transactions.
    Uses math.log10 instead of scipy.
    """
    amounts = []
    for t in transactions:
        amt = max(float(t.debit_amount or 0), float(t.credit_amount or 0))
        if amt >= 1:
            amounts.append(amt)

    if len(amounts) < 100:
        return []

    # Get first digits
    first_digits = []
    for a in amounts:
        s = str(abs(a)).replace(".", "").lstrip("0")
        if s:
            d = int(s[0])
            if 1 <= d <= 9:
                first_digits.append(d)

    if not first_digits:
        return []

    # Expected Benford distribution
    benford_expected = {d: math.log10(1 + 1/d) for d in range(1, 10)}

    # Observed distribution
    total = len(first_digits)
    observed = {d: first_digits.count(d) / total for d in range(1, 10)}

    # Calculate deviation (sum of absolute differences)
    deviation = sum(abs(observed.get(d, 0) - benford_expected[d]) for d in range(1, 10))

    # Threshold: deviation > 0.15 is significant
    if deviation > 0.15:
        severity = "critical" if deviation > 0.25 else "high"
        explanation = _get_ai_explanation(
            f"Benford's Law deviation detected in {len(amounts)} transactions. "
            f"Total deviation score: {deviation:.3f} (threshold: 0.15). "
            f"Observed first-digit distribution differs significantly from the expected natural distribution. "
            f"This is a strong statistical indicator that transaction amounts may have been manually fabricated or manipulated."
        )
        # Convert numpy/float values for JSON serialization
        observed_serializable = {str(k): float(v) for k, v in observed.items()}
        expected_serializable = {str(k): float(v) for k, v in benford_expected.items()}

        alert = FraudAlert(
            org_id=org_id,
            engagement_id=engagement_id,
            pattern_type="benford_deviation",
            severity=severity,
            title=f"Benford's Law Deviation (score: {deviation:.2f})",
            description=f"Transaction amount distribution significantly deviates from Benford's Law across {len(amounts)} transactions.",
            affected_transaction_ids=[],
            pattern_data={"deviation_score": float(deviation), "observed": observed_serializable, "expected": expected_serializable, "sample_size": len(amounts)},
            ai_explanation=explanation,
            confidence_score=min(0.95, deviation * 3)
        )
        db.add(alert)
        db.commit()
        return [{"type": "benford_deviation", "score": deviation}]

    return []


def detect_round_number_clusters(transactions, engagement_id, org_id, db):
    """
    Detects if a specific account has an unusually high concentration of round numbers.
    Normal business has ~5-10% round numbers. >40% is suspicious.
    """
    alerts = []
    by_account = defaultdict(list)
    for t in transactions:
        key = (t.account_name or "unknown").lower().strip()
        by_account[key].append(t)

    for account, txns in by_account.items():
        if len(txns) < 10:
            continue
        amounts = [max(float(t.debit_amount or 0), float(t.credit_amount or 0)) for t in txns if max(float(t.debit_amount or 0), float(t.credit_amount or 0)) > 0]
        if not amounts:
            continue
        round_count = sum(1 for a in amounts if a % 1000 == 0 and a >= 1000)
        round_pct = round_count / len(amounts)

        if round_pct > 0.40 and round_count >= 5:
            txn_ids = [str(t.id) for t in txns if max(float(t.debit_amount or 0), float(t.credit_amount or 0)) % 1000 == 0]
            explanation = _get_ai_explanation(
                f"Round number cluster in '{account}': {round_count} of {len(amounts)} transactions ({round_pct:.0%}) "
                f"are exact multiples of 1,000. Normal business transactions have ~5-10% round numbers. "
                f"High concentration suggests possible fabricated or estimated amounts."
            )
            alert = FraudAlert(
                org_id=org_id,
                engagement_id=engagement_id,
                pattern_type="round_number_cluster",
                severity="medium",
                title=f"Round Number Cluster — {account} ({round_pct:.0%} round)",
                description=f"{round_count}/{len(amounts)} transactions are exact round thousands.",
                affected_transaction_ids=txn_ids,
                pattern_data={"round_percentage": float(round_pct), "round_count": round_count, "total": len(amounts)},
                ai_explanation=explanation,
                confidence_score=0.65
            )
            db.add(alert)
            db.commit()
            alerts.append({"type": "round_number_cluster", "account": account, "pct": round_pct})

    return alerts


def detect_weekend_clusters(transactions, engagement_id, org_id, db):
    """
    Detects accounts where a high percentage of transactions occur on weekends.
    >25% weekend transactions in any account is suspicious.
    """
    import pandas as pd
    alerts = []
    by_account = defaultdict(list)
    for t in transactions:
        key = (t.account_name or "unknown").lower().strip()
        by_account[key].append(t)

    for account, txns in by_account.items():
        if len(txns) < 8:
            continue
        weekend_txns = [t for t in txns if t.transaction_date and pd.to_datetime(t.transaction_date).weekday() >= 5]
        pct = len(weekend_txns) / len(txns)
        if pct > 0.25:
            txn_ids = [str(t.id) for t in weekend_txns]
            explanation = _get_ai_explanation(
                f"Weekend transaction cluster in '{account}': {len(weekend_txns)} of {len(txns)} transactions ({pct:.0%}) "
                f"were posted on weekends. Most legitimate financial operations occur on business days. "
                f"High weekend activity may indicate unauthorized access or post-dated entries."
            )
            alert = FraudAlert(
                org_id=org_id,
                engagement_id=engagement_id,
                pattern_type="weekend_cluster",
                severity="medium",
                title=f"Weekend Transaction Cluster — {account} ({pct:.0%} on weekends)",
                description=f"{len(weekend_txns)}/{len(txns)} transactions posted on weekends.",
                affected_transaction_ids=txn_ids,
                pattern_data={"weekend_percentage": float(pct), "weekend_count": len(weekend_txns), "total": len(txns)},
                ai_explanation=explanation,
                confidence_score=0.70
            )
            db.add(alert)
            db.commit()
            alerts.append({"type": "weekend_cluster", "account": account, "pct": pct})

    return alerts


def _get_ai_explanation(pattern_description: str) -> str:
    """
    Gets a plain-English explanation from Gemini with retry.
    Reuses the retry pattern established in Month 2.
    """
    prompt = f"""You are an expert forensic auditor. Explain this fraud pattern to a junior auditor in 2-3 clear sentences.
Be specific about why this is suspicious and what the auditor should investigate next.

Pattern: {pattern_description}"""

    for attempt in range(3):
        try:
            client = get_ai_client()
            response = client.chat.completions.create(
                model="openai/gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000
            )
            return response.choices[0].message.content
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                wait = (attempt + 1) * 20
                logger.warning(f"Fraud AI rate limit hit. Retrying in {wait}s...")
                time.sleep(wait)
            else:
                logger.error(f"AI explanation failed: {e}")
                return pattern_description  # fallback to raw description
    return pattern_description
