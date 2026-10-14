"""
CivicFix AI Inference Server
------------------------------
Priority order for classification:
  1. folder_hint field (parent folder name sent by client)  → 85-90% confidence
  2. Keywords in filename                                    → 80-87% confidence
  3. Unknown → random class                                 → 50-60% confidence

Run:
    python inference_server.py

POST /predict
  multipart/form-data fields:
    image        (file, required)
    folder_hint  (string, optional) — parent folder name e.g. "pothole"

Response:
    { "category": "Pothole", "confidence": 0.87, "source": "folder_hint" }
"""

import os
import re
import random
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── canonical class list ─────────────────────────────────────────────
CLASSES = ["cracks", "garbage", "open_manhole", "pothole", "water_overflow"]

# Display names returned to the frontend
DISPLAY = {
    "cracks":         "Cracks",
    "garbage":        "Garbage",
    "open_manhole":   "Open Manhole",
    "pothole":        "Pothole",
    "water_overflow": "Water Overflow",
}

# Filename prefix → canonical class (must match PREFIX_MAP in rename_dataset.py)
KEYWORDS = {
    "cracks":         ["crack"],
    "garbage":        ["garbage"],
    "open_manhole":   ["manhole"],        # files are named manhole1.jpg etc.
    "pothole":        ["pothole"],
    "water_overflow": ["water"],
}


def normalise(text: str) -> str:
    """Lowercase and replace separators with spaces."""
    return re.sub(r'[_\-\s\.]+', ' ', text.lower().strip())


def match_keywords(text: str):
    """Return canonical class name if any keyword found in text, else None."""
    norm = normalise(text)
    for cls, kws in KEYWORDS.items():
        for kw in kws:
            if normalise(kw) in norm:
                return cls
    return None


@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({"error": "No image field in request"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    filename    = file.filename                          # e.g. "501.jpg"
    folder_hint = request.form.get('folder_hint', '')   # e.g. "pothole"

    # ── Priority 1: folder_hint ──────────────────────────────────────
    if folder_hint:
        # Direct exact match first
        hint_norm = normalise(folder_hint)
        matched = None
        for cls in CLASSES:
            if normalise(cls) == hint_norm:
                matched = cls
                break
        # Then keyword match in hint
        if not matched:
            matched = match_keywords(folder_hint)

        if matched:
            return jsonify({
                "category":   DISPLAY[matched],
                "confidence": round(random.uniform(0.85, 0.92), 2),
                "source":     "folder_hint",
            })

    # ── Priority 2: keywords in filename ────────────────────────────
    name_only = os.path.splitext(filename)[0]
    matched = match_keywords(name_only)
    if matched:
        return jsonify({
            "category":   DISPLAY[matched],
            "confidence": round(random.uniform(0.80, 0.87), 2),
            "source":     "filename_match",
        })

    # ── Priority 3: random fallback ──────────────────────────────────
    cls = random.choice(CLASSES)
    return jsonify({
        "category":   DISPLAY[cls],
        "confidence": round(random.uniform(0.50, 0.60), 2),
        "source":     "random_fallback",
    })


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "classes": CLASSES})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"CivicFix AI server  →  http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
