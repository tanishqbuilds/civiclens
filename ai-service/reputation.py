"""
reputation.py — Neuro-Fuzzy User Reputation Scoring Module
============================================================

A lightweight ANFIS-inspired (Adaptive Neuro-Fuzzy Inference System) reputation
scorer for CivicLens citizens. Uses triangular/trapezoidal membership functions
with weighted-average defuzzification.

This module is OPTIONAL. If it fails, the rest of the system continues normally.

Dependencies: numpy (already present via torch/transformers).
No new dependencies required.

Usage:
    from reputation import compute_reputation

    metrics = {
        "resolution_rate": 0.8,
        "false_rate":      0.05,
        "avg_confidence":  0.72,
        "consistency":     0.85,
    }
    score = compute_reputation(metrics)  # → float in [0, 100]
"""

import numpy as np


# ─────────────────────────────────────────────
# 1. Membership Functions (Triangular / Trapezoidal)
# ─────────────────────────────────────────────

def _trimf(x: float, a: float, b: float, c: float) -> float:
    """Triangular membership: rises from a→b, falls from b→c."""
    x = float(x)
    if x <= a or x >= c:
        return 0.0
    if x <= b:
        return (x - a) / (b - a) if b != a else 1.0
    return (c - x) / (c - b) if c != b else 1.0


def _trapmf(x: float, a: float, b: float, c: float, d: float) -> float:
    """Trapezoidal membership: rises a→b, plateau b→c, falls c→d."""
    x = float(x)
    if x <= a or x >= d:
        return 0.0
    if x <= b:
        return (x - a) / (b - a) if b != a else 1.0
    if x <= c:
        return 1.0
    return (d - x) / (d - c) if d != c else 1.0


# ─────────────────────────────────────────────
# 2. Fuzzy Variable Definitions
# ─────────────────────────────────────────────

def _resolution_rate_mf(x: float) -> dict:
    """Membership degrees for resolution_rate ∈ [0, 1]."""
    return {
        "low":    _trapmf(x, -0.1, 0.0, 0.2, 0.4),
        "medium": _trimf(x, 0.3, 0.5, 0.7),
        "high":   _trapmf(x, 0.6, 0.8, 1.0, 1.1),
    }


def _false_rate_mf(x: float) -> dict:
    """Membership degrees for false_rate ∈ [0, 1]."""
    return {
        "low":    _trapmf(x, -0.1, 0.0, 0.1, 0.2),
        "medium": _trimf(x, 0.1, 0.3, 0.5),
        "high":   _trapmf(x, 0.4, 0.6, 1.0, 1.1),
    }


def _avg_confidence_mf(x: float) -> dict:
    """Membership degrees for avg_confidence ∈ [0, 1]."""
    return {
        "low":    _trapmf(x, -0.1, 0.0, 0.3, 0.5),
        "medium": _trimf(x, 0.4, 0.575, 0.75),
        "high":   _trapmf(x, 0.7, 0.85, 1.0, 1.1),
    }


# ─────────────────────────────────────────────
# 3. Fuzzy Rule Base (ANFIS Layer 3)
#    Each rule → (firing_strength, consequent_score)
# ─────────────────────────────────────────────

_RULES = [
    # Rule 1: high resolution AND low false AND high confidence → 90
    {
        "antecedent": lambda rr, fr, ac: min(rr["high"], fr["low"], ac["high"]),
        "consequent": 90.0,
    },
    # Rule 2: high resolution AND medium confidence → 75
    {
        "antecedent": lambda rr, fr, ac: min(rr["high"], ac["medium"]),
        "consequent": 75.0,
    },
    # Rule 3: medium resolution AND low false → 65
    {
        "antecedent": lambda rr, fr, ac: min(rr["medium"], fr["low"]),
        "consequent": 65.0,
    },
    # Rule 4: low resolution OR high false → 30
    {
        "antecedent": lambda rr, fr, ac: max(rr["low"], fr["high"]),
        "consequent": 30.0,
    },
    # Rule 5: medium resolution AND medium confidence → 55 (fill gap)
    {
        "antecedent": lambda rr, fr, ac: min(rr["medium"], ac["medium"]),
        "consequent": 55.0,
    },
    # Rule 6: high resolution AND low confidence → 50 (many reports but weak AI match)
    {
        "antecedent": lambda rr, fr, ac: min(rr["high"], ac["low"]),
        "consequent": 50.0,
    },
]


# ─────────────────────────────────────────────
# 4. Neuro-Fuzzy Inference Engine
# ─────────────────────────────────────────────

def compute_reputation(user_metrics: dict) -> float:
    """
    Compute a user reputation score using neuro-fuzzy inference.

    Parameters
    ----------
    user_metrics : dict
        Required keys:
            resolution_rate : float [0–1]  — resolved_reports / total_reports
            false_rate      : float [0–1]  — false_reports / total_reports
            avg_confidence  : float [0–1]  — mean AI confidence across tickets
            consistency     : float [0–1]  — 1 - std_dev(confidences)

    Returns
    -------
    float
        Reputation score clamped to [0, 100].
    """
    # ── Extract & clamp inputs to [0, 1] ──
    rr_val = float(np.clip(user_metrics.get("resolution_rate", 0.0), 0.0, 1.0))
    fr_val = float(np.clip(user_metrics.get("false_rate", 0.0), 0.0, 1.0))
    ac_val = float(np.clip(user_metrics.get("avg_confidence", 0.0), 0.0, 1.0))
    cn_val = float(np.clip(user_metrics.get("consistency", 0.0), 0.0, 1.0))

    # ── Fuzzification (ANFIS Layer 1) ──
    rr_mem = _resolution_rate_mf(rr_val)
    fr_mem = _false_rate_mf(fr_val)
    ac_mem = _avg_confidence_mf(ac_val)

    # ── Rule evaluation (ANFIS Layers 2–3) ──
    #    Weighted-average defuzzification:
    #    reputation = Σ(rule_weight × output) / Σ(rule_weight)
    numerator = 0.0
    denominator = 0.0

    for rule in _RULES:
        firing_strength = rule["antecedent"](rr_mem, fr_mem, ac_mem)
        if firing_strength > 0.0:
            numerator += firing_strength * rule["consequent"]
            denominator += firing_strength

    # Avoid division by zero — default to neutral 50 if no rules fire
    if denominator < 1e-9:
        base_score = 50.0
    else:
        base_score = numerator / denominator

    # ── Consistency bonus (ANFIS Layer 4 — neural adaptation) ──
    # High consistency (≥ 0.8) earns up to +5 points
    consistency_bonus = 0.0
    if cn_val >= 0.8:
        # Linear scale: 0.8 → +0,  1.0 → +5
        consistency_bonus = ((cn_val - 0.8) / 0.2) * 5.0

    # ── Final output (ANFIS Layer 5 — defuzzified output) ──
    reputation = float(np.clip(base_score + consistency_bonus, 0.0, 100.0))

    return round(reputation, 2)
