"""Quick smoke test for the reputation module."""
import sys
sys.path.insert(0, ".")

from reputation import compute_reputation

cases = [
    ("Excellent citizen", {"resolution_rate": 0.9, "false_rate": 0.02, "avg_confidence": 0.85, "consistency": 0.92}),
    ("Average citizen",   {"resolution_rate": 0.5, "false_rate": 0.1,  "avg_confidence": 0.6,  "consistency": 0.7}),
    ("Poor citizen",      {"resolution_rate": 0.1, "false_rate": 0.6,  "avg_confidence": 0.3,  "consistency": 0.4}),
    ("New user (empty)",  {"resolution_rate": 0.0, "false_rate": 0.0,  "avg_confidence": 0.0,  "consistency": 0.0}),
    ("Perfect citizen",   {"resolution_rate": 1.0, "false_rate": 0.0,  "avg_confidence": 1.0,  "consistency": 1.0}),
    ("Edge: all medium",  {"resolution_rate": 0.5, "false_rate": 0.3,  "avg_confidence": 0.55, "consistency": 0.9}),
]

print("=" * 60)
print("  Neuro-Fuzzy Reputation Scoring — Smoke Test")
print("=" * 60)

all_pass = True
for label, m in cases:
    score = compute_reputation(m)
    ok = 0.0 <= score <= 100.0
    if not ok:
        all_pass = False
    print(f"  {label:20s}  score={score:6.2f}  {'OK' if ok else 'FAIL'}")

print("-" * 60)
print(f"  Result: {'ALL PASSED' if all_pass else 'SOME FAILED'}")
print("=" * 60)
