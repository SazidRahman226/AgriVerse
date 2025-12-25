import os
import uuid
import json
from typing import Tuple, Optional

import numpy as np
from PIL import Image

from flask import Flask, request, jsonify
from flask_cors import CORS

import tensorflow as tf
import joblib
import cv2

from leaf_filter import detect_and_crop_leaf  # make sure leaf_filter.py is in same folder


# -------------------------
# Paths
# -------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

PKL_PATH = os.path.join(MODELS_DIR, "plant_disease_classifier.pkl")
EXTRACTOR_PATH = os.path.join(MODELS_DIR, "mobilenetv2_feature_extractor.keras")
LEAF_GATE_PATH = os.path.join(MODELS_DIR, "leaf_gate.pkl")  # optional

os.makedirs(UPLOAD_DIR, exist_ok=True)

# -------------------------
# Flask
# -------------------------
app = Flask(__name__)
CORS(app)

# -------------------------
# Load disease models once
# -------------------------
bundle = joblib.load(PKL_PATH)
clf = bundle["classifier"]
class_names = bundle["class_names"]
IMG_SIZE = int(bundle.get("img_size", 224))

extractor = tf.keras.models.load_model(EXTRACTOR_PATH)

# -------------------------
# Load leaf gate (optional)
# -------------------------
leaf_gate = None
if os.path.isfile(LEAF_GATE_PATH):
    try:
        leaf_gate = joblib.load(LEAF_GATE_PATH)
        print("✅ Loaded leaf_gate.pkl")
    except Exception as e:
        print("⚠️ Failed to load leaf_gate.pkl:", e)
        leaf_gate = None


# -------------------------
# Helpers
# -------------------------
def preprocess_image(pil_img: Image.Image) -> np.ndarray:
    """Preprocess for MobileNetV2 feature extractor."""
    pil_img = pil_img.convert("RGB")
    pil_img = pil_img.resize((IMG_SIZE, IMG_SIZE))
    x = np.array(pil_img, dtype=np.float32)
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x = np.expand_dims(x, axis=0)  # (1, H, W, 3)
    return x


def is_leaf_by_gate(crop_bgr: np.ndarray) -> Tuple[bool, Optional[float]]:
    """
    Optional ML gate using leaf_gate.pkl if you have one.
    Returns: (is_leaf, leaf_prob_or_None)

    If your leaf_gate.pkl was trained on different features, this may not work.
    In that case, it will safely fallback to True.
    """
    if leaf_gate is None:
        return True, None

    # Simple gate features (mean HSV + green ratio)
    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    mean_hsv = hsv.reshape(-1, 3).mean(axis=0)  # [H,S,V]

    lower = np.array([25, 30, 30], dtype=np.uint8)
    upper = np.array([95, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower, upper)
    green_ratio = float(mask.mean() / 255.0)

    feat = np.array([[mean_hsv[0], mean_hsv[1], mean_hsv[2], green_ratio]], dtype=np.float32)

    try:
        if hasattr(leaf_gate, "predict_proba"):
            proba = leaf_gate.predict_proba(feat)[0]
            leaf_prob = float(np.max(proba))
            pred = int(np.argmax(proba))
            return (pred == 1), leaf_prob
        else:
            pred = int(leaf_gate.predict(feat)[0])
            return (pred == 1), None
    except Exception:
        # If gate feature shape mismatches, fallback to leaf_filter only
        return True, None


# -------------------------
# Routes
# -------------------------
@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "classes": len(class_names),
        "img_size": IMG_SIZE,
        "leaf_gate_loaded": bool(leaf_gate is not None)
    })


@app.post("/predict")
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No file field named 'image' found."}), 400

    f = request.files["image"]
    if not f or f.filename.strip() == "":
        return jsonify({"error": "Empty filename / no image uploaded."}), 400

    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]:
        return jsonify({"error": "Unsupported image type. Use jpg/png/webp/bmp."}), 400

    save_name = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, save_name)
    f.save(save_path)

    try:
        # -------------------------
        # 1) LEAF CHECK + CROP
        # -------------------------
        img_bgr = cv2.imread(save_path)
        if img_bgr is None:
            return jsonify({"error": "Failed to read image."}), 400

        ok, crop_bgr, info = detect_and_crop_leaf(
            img_bgr,
            min_green_ratio=0.08,
            min_area_ratio=0.03,
            pad=0.08
        )

        if not ok:
            return jsonify({
                "is_leaf": False,
                "reason": info.get("reason", "Not a leaf."),
                "leaf_debug": info,
                "saved_as": save_name
            }), 200

        # Optional second gate check
        ok2, leaf_prob = is_leaf_by_gate(crop_bgr)
        if not ok2:
            return jsonify({
                "is_leaf": False,
                "reason": "Leaf gate model rejected this image.",
                "leaf_probability": leaf_prob,
                "leaf_debug": info,
                "saved_as": save_name
            }), 200

        # -------------------------
        # 2) DISEASE PREDICTION
        # -------------------------
        crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(crop_rgb)

        x = preprocess_image(pil_img)
        feat = extractor(x, training=False).numpy()  # (1, 1280)

        pred_idx = int(clf.predict(feat)[0])
        pred_name = class_names[pred_idx]

        confidence = None
        top5 = None
        if hasattr(clf, "predict_proba"):
            proba = clf.predict_proba(feat)[0]
            confidence = float(np.max(proba))

            k = min(5, len(class_names))
            top_idx = np.argsort(proba)[::-1][:k]
            top5 = [{"label": class_names[i], "prob": float(proba[i])} for i in top_idx]

        return jsonify({
            "is_leaf": True,
            "leaf_probability": leaf_prob,
            "leaf_debug": info,
            "prediction_index": pred_idx,
            "prediction": pred_name,
            "confidence": confidence,
            "top5": top5,
            "saved_as": save_name
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
