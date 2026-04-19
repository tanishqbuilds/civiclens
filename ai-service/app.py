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

# Define severity levels for the AI to choose from
SEVERITY_PROMPTS = [
    "a tiny, barely visible, or negligible issue",
    "a minor civic issue with small local impact",
    "a significant and clearly visible civic problem",
    "a severe, dangerous, or high-risk infrastructure failure",
    "a catastrophic, life-threatening metropolitan emergency"
]


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

    # 2. Identify Severity (Zero-shot against severity prompts)
    sev_preds = classifier(img, candidate_labels=SEVERITY_PROMPTS)
    top_sev_label = sev_preds[0]['label']
    
    # Map the text label to a numeric score out of 10
    severity_map = {
        SEVERITY_PROMPTS[0]: 2,
        SEVERITY_PROMPTS[1]: 4,
        SEVERITY_PROMPTS[2]: 6,
        SEVERITY_PROMPTS[3]: 8,
        SEVERITY_PROMPTS[4]: 10
    }
    severity_score = severity_map[top_sev_label]

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