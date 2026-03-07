import os
import cv2
import numpy as np
import tensorflow as tf

LEAF_MODEL_PATH = os.environ.get("LEAF_MODEL_PATH", "models/leaf_detector.keras")
LEAF_THRESHOLD = float(os.environ.get("LEAF_THRESHOLD", 0.70))
IMG_SIZE = 224

_leaf_model = None


def load_leaf_model(model_path=LEAF_MODEL_PATH):
    global _leaf_model
    if _leaf_model is None:
        if not os.path.isfile(model_path):
            return None
        _leaf_model = tf.keras.models.load_model(model_path)
    return _leaf_model


def _resize_for_model(img_rgb: np.ndarray) -> np.ndarray:
    x = cv2.resize(img_rgb, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
    x = x.astype(np.float32)
    x = np.expand_dims(x, axis=0)
    return x


def _score_leaf_classifier(img_bgr: np.ndarray):
    model = load_leaf_model()
    if model is None:
        return None

    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    x = _resize_for_model(img_rgb)

    prob_raw = float(model.predict(x, verbose=0)[0][0])

    # Keras usually loads classes alphabetically:
    # ['leaf', 'non_leaf']
    # label 0 = leaf, label 1 = non_leaf
    # sigmoid output = probability of class 1 = non_leaf
    prob_leaf = 1.0 - prob_raw
    return prob_leaf


def _green_mask_hsv(img_bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

    lower = np.array([20, 20, 20], dtype=np.uint8)
    upper = np.array([100, 255, 255], dtype=np.uint8)

    mask = cv2.inRange(hsv, lower, upper)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    return mask


def detect_and_crop_leaf(
    img_bgr: np.ndarray,
    min_green_ratio: float = 0.04,
    min_area_ratio: float = 0.015,
    min_fill_ratio: float = 0.20,
    max_components: int = 18,
    pad: float = 0.10,
    threshold: float = LEAF_THRESHOLD,
):
    h, w = img_bgr.shape[:2]
    if h < 40 or w < 40:
        return False, None, {"reason": "Image too small."}

    # 1) whole image check
    whole_prob = _score_leaf_classifier(img_bgr)
    if whole_prob is not None and whole_prob < threshold:
        return False, None, {
            "reason": "Whole image rejected by leaf classifier.",
            "whole_leaf_prob": whole_prob,
        }

    # 2) green mask
    mask = _green_mask_hsv(img_bgr)
    green_ratio = float(mask.mean() / 255.0)

    if green_ratio < min_green_ratio:
        return False, None, {
            "reason": "Not enough green/leaf pixels.",
            "green_ratio": green_ratio,
            "whole_leaf_prob": whole_prob,
        }

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

    component_areas = []
    for i in range(1, num_labels):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area > 30:
            component_areas.append(area)

    component_areas.sort(reverse=True)
    component_count = len(component_areas)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return False, None, {
            "reason": "No leaf-like region found.",
            "whole_leaf_prob": whole_prob,
        }

    cnt = max(contours, key=cv2.contourArea)
    area = float(cv2.contourArea(cnt))
    img_area = float(h * w)
    area_ratio = area / (img_area + 1e-9)

    if area_ratio < min_area_ratio:
        return False, None, {
            "reason": "Largest green region too small.",
            "area_ratio": area_ratio,
            "whole_leaf_prob": whole_prob,
        }

    hull = cv2.convexHull(cnt)
    hull_area = float(cv2.contourArea(hull)) + 1e-9
    solidity = area / hull_area

    x, y, bw, bh = cv2.boundingRect(cnt)
    box_area = float(bw * bh) + 1e-9
    fill_ratio = area / box_area
    prominence = area / (sum(component_areas) + 1e-9) if component_areas else 0.0
    aspect_ratio = bw / max(bh, 1)

    # reject very fragmented tree/background scenes
    if component_count > max_components and prominence < 0.45:
        return False, None, {
            "reason": "Too many green components; scene looks like tree/background.",
            "component_count": component_count,
            "prominence": prominence,
            "whole_leaf_prob": whole_prob,
        }

    if fill_ratio < min_fill_ratio:
        return False, None, {
            "reason": "Object is too fragmented; not a clear leaf close-up.",
            "fill_ratio": fill_ratio,
            "whole_leaf_prob": whole_prob,
        }

    if solidity < 0.15:
        return False, None, {
            "reason": "Shape is too irregular for a single leaf.",
            "solidity": solidity,
            "whole_leaf_prob": whole_prob,
        }

    # 3) crop
    px = int(bw * pad)
    py = int(bh * pad)

    x0 = max(0, x - px)
    y0 = max(0, y - py)
    x1 = min(w, x + bw + px)
    y1 = min(h, y + bh + py)

    crop = img_bgr[y0:y1, x0:x1].copy()

    # 4) crop re-check
    crop_prob = _score_leaf_classifier(crop)
    if crop_prob is not None and crop_prob < threshold:
        return False, None, {
            "reason": "Crop rejected by leaf classifier.",
            "whole_leaf_prob": whole_prob,
            "crop_leaf_prob": crop_prob,
            "bbox": [int(x0), int(y0), int(x1), int(y1)],
        }

    return True, crop, {
        "whole_leaf_prob": whole_prob,
        "crop_leaf_prob": crop_prob,
        "green_ratio": green_ratio,
        "area_ratio": area_ratio,
        "solidity": solidity,
        "fill_ratio": fill_ratio,
        "component_count": component_count,
        "prominence": prominence,
        "aspect_ratio": aspect_ratio,
        "bbox": [int(x0), int(y0), int(x1), int(y1)],
    }