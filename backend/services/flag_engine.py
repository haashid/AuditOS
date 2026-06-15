"""
Flag Rules Engine — Month 1
Simple rule-based anomaly detection for financial transactions.
No ML. Just deterministic rules.
"""
from typing import Tuple, List
import pandas as pd


def flag_transaction(row: dict) -> Tuple[bool, List[str], int]:
    """
    Evaluate a single transaction row against all flag rules.

    Returns:
        (is_flagged, flag_reasons, risk_score)
        risk_score: 0-100, additive per rule triggered
    """
    flags = []
    score = 0

    amount = max(
        float(row.get("debit_amount") or 0),
        float(row.get("credit_amount") or 0),
    )

    # Rule 1: Round number above threshold
    # Suspiciously round numbers like $10,000, $50,000, $100,000
    if amount > 0 and amount % 1000 == 0 and amount >= 10000:
        flags.append("Round number above threshold")
        score += 20

    # Rule 2: Weekend transaction
    # Transactions posted on Saturday or Sunday
    txn_date = row.get("transaction_date")
    if txn_date:
        try:
            day = pd.to_datetime(txn_date).weekday()
            if day >= 5:  # Saturday=5, Sunday=6
                flags.append("Transaction on weekend")
                score += 25
        except Exception:
            pass  # unparseable date — skip this rule

    # Rule 3: Very high amount (above 100,000 in any currency)
    if amount >= 100000:
        flags.append("High value transaction")
        score += 15

    # Rule 4: Missing description
    desc = row.get("description")
    if not desc or str(desc).strip() in ("", "nan", "None"):
        flags.append("Missing description")
        score += 20

    # Rule 5: Missing posted_by
    posted_by = row.get("posted_by")
    if not posted_by or str(posted_by).strip() in ("", "nan", "None"):
        flags.append("No user recorded")
        score += 20

    is_flagged = len(flags) > 0
    return is_flagged, flags, min(score, 100)


# Column name mapping — try to detect any of these variations from uploaded files
COLUMN_MAP = {
    "transaction_date": ["date", "txn_date", "transaction_date", "posting_date", "trans_date"],
    "document_number": ["doc_no", "document_number", "voucher", "ref_no", "invoice_no"],
    "account_code": ["account_code", "gl_code", "account_no", "ledger_code"],
    "account_name": ["account_name", "account", "ledger_name", "gl_name"],
    "debit_amount": ["debit", "debit_amount", "dr", "dr_amount"],
    "credit_amount": ["credit", "credit_amount", "cr", "cr_amount"],
    "description": ["description", "narration", "remarks", "memo", "particulars"],
    "posted_by": ["posted_by", "user", "entered_by", "created_by"],
}


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Auto-detect and rename columns from an uploaded CSV/XLSX to our canonical names.
    Column matching is case-insensitive and strips whitespace.
    """
    # Build a lookup: lowercase_source_col -> canonical_name
    col_lookup = {}
    for canonical, variants in COLUMN_MAP.items():
        for variant in variants:
            col_lookup[variant.lower().strip()] = canonical

    rename_map = {}
    for col in df.columns:
        normalized_col = col.lower().strip().replace(" ", "_")
        if normalized_col in col_lookup:
            rename_map[col] = col_lookup[normalized_col]

    return df.rename(columns=rename_map)
