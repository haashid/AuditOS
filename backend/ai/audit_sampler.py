"""
ISA 530 Audit Sampling Engine
Calculates statistically defensible sample sizes and
selects samples using Monetary Unit Sampling.
"""
import math
import random

# Confidence factor table (ISA 530 standard values)
CONFIDENCE_FACTORS = {
    90: 2.31,
    95: 3.00,
    99: 4.61
}


def calculate_sample_size(
    population_value: float,
    tolerable_error: float,
    expected_error: float,
    confidence_level: int = 95
) -> int:
    """
    ISA 530 monetary unit sample size formula.
    population_value: total value of the population in currency
    tolerable_error: maximum error auditor can accept (currency)
    expected_error:  error auditor expects to find (currency)
    confidence_level: 90, 95, or 99
    Returns: required sample size (integer)
    """
    if tolerable_error <= 0:
        return 500

    rf = CONFIDENCE_FACTORS.get(confidence_level, 3.00)
    if expected_error == 0:
        sample_size = math.ceil(
            (population_value * rf) / tolerable_error
        )
    else:
        expansion = 1 + (expected_error / tolerable_error)
        sample_size = math.ceil(
            (population_value * rf * expansion) / tolerable_error
        )
    return min(sample_size, 500)  # cap at 500 for practicality


def select_sample(
    transactions: list,
    sample_size: int,
    materiality_threshold: float,
    amount_field: str = "amount"
) -> list:
    """
    Selects audit sample using MUS + individually significant items.
    Returns list of dicts with 'selection_reason' added.
    """
    # Step 1: Isolate individually significant items (must test 100%)
    significant = [
        {**t, "selection_reason": "Individually Significant (above materiality)"}
        for t in transactions
        if float(t.get(amount_field, 0)) >= materiality_threshold
    ]
    significant_ids = {t["id"] for t in significant}

    # Step 2: Remaining population for MUS
    remaining = [t for t in transactions if t["id"] not in significant_ids]

    # Step 3: Calculate remaining sample needed
    remaining_needed = max(0, sample_size - len(significant))

    # Step 4: MUS selection on remaining population
    mus_sample = []
    if remaining_needed > 0 and remaining:
        total_remaining_value = sum(
            float(t.get(amount_field, 0)) for t in remaining
        )
        if total_remaining_value > 0:
            interval = total_remaining_value / remaining_needed
            random_start = random.uniform(0, interval)
            cumulative = 0
            next_pick = random_start
            for t in sorted(
                remaining,
                key=lambda x: float(x.get(amount_field, 0)),
                reverse=True
            ):
                cumulative += float(t.get(amount_field, 0))
                if cumulative >= next_pick:
                    mus_sample.append({
                        **t,
                        "selection_reason": "Monetary Unit Sampling (MUS)"
                    })
                    next_pick += interval
                    if len(mus_sample) >= remaining_needed:
                        break

    return significant + mus_sample
