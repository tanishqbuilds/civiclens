from flask import Flask, request, jsonify
from transformers import pipeline
from PIL import Image
import io

app = Flask(__name__)

# Load the model once when the server starts
print("Loading AI Model...")
classifier = pipeline("zero-shot-image-classification", model="openai/clip-vit-base-patch32")

LABEL_MAPPING = {
    "a severe pothole, broken tarmac, or heavily damaged road surface": "Pothole",
    "an overflowing garbage bin, litter, or pile of trash dumped on the street": "Garbage Dump",
    "a flooded street, stagnant water, or severe road waterlogging": "Waterlogging",
    "dangerous hanging electrical wires, tangled cables, or fallen poles": "Electrical Hazard",
    "overflowing sewage, dirty water, or an open, blocked drainage system": "Open/Blocked Drain",
    "a clean, normal, and well-maintained street with no visible issues": "Clean Street"
}
ai_descriptions = list(LABEL_MAPPING.keys())

# Define severity levels for the AI to choose from
SEVERITY_PROMPTS = [
    "minor or small issue, low impact",        # Score: 1-3
    "moderate damage or noticeable issue",    # Score: 4-6
    "severe, dangerous, or high-risk issue",  # Score: 7-9
    "extreme emergency or life-threatening"    # Score: 10
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
        SEVERITY_PROMPTS[0]: 3,  # Minor
        SEVERITY_PROMPTS[1]: 6,  # Moderate
        SEVERITY_PROMPTS[2]: 8,  # Severe
        SEVERITY_PROMPTS[3]: 10  # Extreme
    }
    severity_score = severity_map[top_sev_label]

    return jsonify({
        "success": True,
        "category": final_category,
        "confidence": round(float(confidence), 2),
        "severity": severity_score
    })

if __name__ == '__main__':
    # Using 0.0.0.0 makes the server accessible on your local network
    # Change port to 5005 to avoid common conflicts with Windows AirPlay/Services
    app.run(host='0.0.0.0', port=5000, debug=False)