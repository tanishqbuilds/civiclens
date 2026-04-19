from flask import Flask, request, jsonify
from transformers import pipeline
from PIL import Image
import io

app = Flask(__name__)

# Load the model once when the server starts
print("Loading AI Model...")
classifier = pipeline("zero-shot-image-classification", model="openai/clip-vit-base-patch32")

LABEL_MAPPING = {
    "a severe pothole, broken tarmac, or heavily damaged road surface": "pothole",
    "an overflowing garbage bin, litter, or pile of trash dumped on the street": "garbage_dump",
    "a flooded street, stagnant water, or severe road waterlogging": "waterlogging",
    "dangerous hanging electrical wires, tangled cables, or fallen poles": "electrical_hazard",
    "overflowing sewage, dirty water, or an open, blocked drainage system": "blocked_drain",
    "a clean, normal, and well-maintained street with no visible issues": "clean_street"
}
ai_descriptions = list(LABEL_MAPPING.keys())

# Category-specific severity prompts — gives CLIP concrete visual cues per category
CATEGORY_SEVERITY_PROMPTS = {
    "pothole": [
        "a small shallow crack on the road",
        "a noticeable pothole on the road",
        "a large deep pothole damaging the road",
        "a massive dangerous road crater",
        "a completely destroyed road with huge craters"
    ],
    "garbage_dump": [
        "a few pieces of small litter on the ground",
        "a small pile of garbage on the sidewalk",
        "a large pile of garbage overflowing from bins",
        "a massive garbage dump blocking the street",
        "an enormous hazardous waste dump covering the area"
    ],
    "waterlogging": [
        "a small puddle on the street",
        "ankle-deep water flooding part of a road",
        "knee-deep water flooding the entire road",
        "waist-deep flood water submerging vehicles",
        "a completely flooded area with dangerous water levels"
    ],
    "electrical_hazard": [
        "slightly sagging overhead electrical cables",
        "a broken street light pole",
        "dangerously hanging electrical wires near the ground",
        "sparking exposed electrical wires on the street",
        "a fallen electric utility pole with live wires on the road"
    ],
    "blocked_drain": [
        "a slightly clogged storm drain with some debris",
        "a blocked drain with dirty water pooling around it",
        "an overflowing drain with sewage seeping out",
        "a severely blocked drain causing street-level sewage flooding",
        "a burst sewage pipe with raw sewage flooding the street"
    ],
    "clean_street": [
        "a well-maintained clean street",
        "a clean street with minor litter",
        "a street with some visible issues",
        "a street with multiple maintenance issues",
        "a neglected street in poor condition"
    ]
}

# Fallback for unclassified categories
DEFAULT_SEVERITY_PROMPTS = [
    "a tiny, barely visible, or negligible issue",
    "a minor civic issue with small local impact",
    "a significant and clearly visible civic problem",
    "a severe, dangerous, or high-risk infrastructure failure",
    "a catastrophic, life-threatening metropolitan emergency"
]

SEVERITY_SCORES = [2, 4, 6, 8, 10]


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "service": "civiclens-ai",
        "modelLoaded": classifier is not None
    })

@app.route('/classify', methods=['POST'])
def classify_image():
    if 'image' not in request.files:
        return jsonify({"success": False, "error": "No image uploaded"}), 400
    
    file = request.files['image']
    img = Image.open(io.BytesIO(file.read()))

    # 1. Identify Category
    cat_preds = classifier(img, candidate_labels=ai_descriptions)
    top_cat = cat_preds[0]
    final_category = LABEL_MAPPING[top_cat['label']]
    confidence = top_cat['score']

    # 2. Identify Severity using category-specific prompts
    severity_prompts = CATEGORY_SEVERITY_PROMPTS.get(final_category, DEFAULT_SEVERITY_PROMPTS)
    sev_preds = classifier(img, candidate_labels=severity_prompts)
    
    # Build a confidence-weighted severity score across all levels
    # instead of just picking the top one (gives better granularity)
    score_map = {prompt: score for prompt, score in zip(severity_prompts, SEVERITY_SCORES)}
    weighted_score = 0.0
    total_weight = 0.0
    for pred in sev_preds:
        s = score_map[pred['label']]
        w = pred['score']
        weighted_score += s * w
        total_weight += w
    
    severity_score = round(weighted_score / total_weight) if total_weight > 0 else 5
    # Clamp to valid range
    severity_score = max(1, min(10, severity_score))

    return jsonify({
        "success": True,
        "category": final_category,
        "confidence": round(float(confidence), 2),
        "severity": severity_score
    })


# ═════════════════════════════════════════════════════════════
# Neuro-Fuzzy Reputation Scoring — Optional Post-Processing
# ═════════════════════════════════════════════════════════════
# This module is OPTIONAL. If it fails, the rest of the system
# continues normally. It is NOT called by any existing endpoint.
# ═════════════════════════════════════════════════════════════

@app.route('/reputation', methods=['POST'])
def get_reputation():
    """
    POST /reputation  { "userId": "<mongo_object_id>" }
    Returns the neuro-fuzzy reputation score for the given user.
    """
    try:
        data = request.get_json(silent=True) or {}
        user_id = data.get("userId")
        if not user_id:
            return jsonify({"success": False, "error": "userId is required"}), 400

        result = update_user_reputation(user_id)
        status = 200 if result.get("success") else 500
        return jsonify(result), status
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

def update_user_reputation(user_id: str, mongo_uri: str = None) -> dict:
    """
    Compute the neuro-fuzzy reputation score for a given userId.

    This is a **utility function only** — it is NOT wired into any
    existing endpoint. Call it explicitly when a ticket status
    becomes "resolved".

    Parameters
    ----------
    user_id  : str   — MongoDB ObjectId (string) of the user.
    mongo_uri: str   — MongoDB connection string. Falls back to
                        MONGO_URI env var if not provided.

    Returns
    -------
    dict with keys:
        success          : bool
        user_id          : str
        reputation_score : float (0–100)
        metrics          : dict of computed input metrics
        error            : str (only on failure)
    """
    try:
        import os
        import numpy as np
        from pymongo import MongoClient
        from bson import ObjectId
        from reputation import compute_reputation

        # Load .env if python-dotenv is available (non-critical)
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass

        uri = mongo_uri or os.environ.get("MONGO_URI", "")
        if not uri:
            return {"success": False, "user_id": user_id,
                    "error": "MONGO_URI not configured"}

        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        db = client.get_default_database()
        tickets_col = db["tickets"]

        # Fetch all tickets reported by this user
        # The Ticket model stores reportedBy as a String, so query both formats
        user_oid = ObjectId(user_id)
        cursor = tickets_col.find({
            "$or": [
                {"reportedBy": str(user_id)},
                {"reportedBy": user_oid},
            ]
        })
        tickets = list(cursor)
        client.close()

        total = len(tickets)
        if total == 0:
            return {
                "success": True,
                "user_id": user_id,
                "reputation_score": 50.0,   # neutral default
                "metrics": {
                    "total_reports": 0,
                    "resolution_rate": 0.0,
                    "false_rate": 0.0,
                    "avg_confidence": 0.0,
                    "consistency": 1.0,
                },
            }

        # ── Compute metrics from ticket data ──
        resolved = sum(1 for t in tickets if t.get("status") == "resolved")
        resolution_rate = resolved / total

        # "False" reports: tickets classified as 'unclassified' or 'other'
        # with very low AI confidence (< 0.3) — likely noise / spam
        false_reports = sum(
            1 for t in tickets
            if t.get("aiCategory") in ("unclassified", "other")
            and t.get("aiConfidence", 0) < 0.3
        )
        false_rate = false_reports / total

        # AI confidence statistics
        confidences = np.array(
            [t.get("aiConfidence", 0.0) for t in tickets], dtype=np.float64
        )
        avg_confidence = float(np.mean(confidences))
        consistency = float(1.0 - np.std(confidences))

        metrics = {
            "resolution_rate": round(resolution_rate, 4),
            "false_rate": round(false_rate, 4),
            "avg_confidence": round(avg_confidence, 4),
            "consistency": round(max(0.0, consistency), 4),
        }

        # ── Neuro-Fuzzy Inference ──
        score = compute_reputation(metrics)

        return {
            "success": True,
            "user_id": user_id,
            "reputation_score": score,
            "metrics": {
                "total_reports": total,
                **metrics,
            },
        }

    except Exception as exc:
        # Module is optional — never crash the main service
        return {
            "success": False,
            "user_id": user_id,
            "error": str(exc),
        }


if __name__ == '__main__':
    # Using 0.0.0.0 makes the server accessible on your local network
    # Change port to 5005 to avoid common conflicts with Windows AirPlay/Services
    app.run(host='0.0.0.0', port=5000, debug=False)