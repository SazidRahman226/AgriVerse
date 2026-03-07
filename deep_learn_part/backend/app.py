import os
import uuid
import numpy as np
from PIL import Image

from flask import Flask, request, jsonify
from flask_cors import CORS

import tensorflow as tf
import joblib
import cv2

from leaf_filter import detect_and_crop_leaf


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

PKL_PATH = os.path.join(MODELS_DIR, "plant_disease_classifier.pkl")
EXTRACTOR_PATH = os.path.join(MODELS_DIR, "mobilenetv2_feature_extractor.keras")

os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__)
CORS(app)

# disease model
bundle = joblib.load(PKL_PATH)
clf = bundle["classifier"]
class_names = bundle["class_names"]
IMG_SIZE = int(bundle.get("img_size", 224))

# feature extractor
extractor = tf.keras.models.load_model(EXTRACTOR_PATH)


def preprocess_image(pil_img: Image.Image) -> np.ndarray:
    pil_img = pil_img.convert("RGB")
    pil_img = pil_img.resize((IMG_SIZE, IMG_SIZE))
    x = np.array(pil_img, dtype=np.float32)
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x = np.expand_dims(x, axis=0)
    return x


@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "classes": len(class_names),
        "img_size": IMG_SIZE
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
        img_bgr = cv2.imread(save_path)
        if img_bgr is None:
            return jsonify({"error": "Failed to read image."}), 400

        # strong leaf check + crop
        ok, crop_bgr, info = detect_and_crop_leaf(
            img_bgr,
            min_green_ratio=0.04,
            min_area_ratio=0.015,
            min_fill_ratio=0.25,
            max_components=12,
            pad=0.10,
        )

        if not ok:
            return jsonify({
                "is_leaf": False,
                "reason": info.get("reason", "Not a leaf."),
                "leaf_debug": info,
                "saved_as": save_name
            }), 200

        # disease prediction
        crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(crop_rgb)

        x = preprocess_image(pil_img)
        feat = extractor(x, training=False).numpy()

        pred_idx = int(clf.predict(feat)[0])
        pred_name = class_names[pred_idx]

        confidence = None
        top5 = None

        if hasattr(clf, "predict_proba"):
            proba = clf.predict_proba(feat)[0]
            confidence = float(np.max(proba))

            k = min(5, len(class_names))
            top_idx = np.argsort(proba)[::-1][:k]
            top5 = [
                {"label": class_names[i], "prob": float(proba[i])}
                for i in top_idx
            ]

        return jsonify({
            "is_leaf": True,
            "leaf_probability": info.get("crop_leaf_prob", info.get("whole_leaf_prob")),
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