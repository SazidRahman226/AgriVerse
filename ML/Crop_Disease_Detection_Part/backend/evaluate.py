"""
Local evaluation utilities for Bengali Speaker Diarization.
Uses pyannote.metrics to compute DER on training data.
"""

import numpy as np
from pyannote.core import Annotation
from pyannote.metrics.diarization import DiarizationErrorRate

from .data_utils import load_reference_annotation, get_train_ids


def compute_der(
    reference: Annotation,
    hypothesis: Annotation,
    collar: float = 0.0,
    skip_overlap: bool = True,
) -> dict:
    """
    Compute DER between reference and hypothesis annotations.

    Args:
        reference: ground truth Annotation
        hypothesis: predicted Annotation
        collar: tolerance collar in seconds (default 0.0 per competition)
        skip_overlap: skip overlapping speech regions

    Returns:
        dict with 'der', 'false_alarm', 'missed', 'confusion', 'total'
    """
    metric = DiarizationErrorRate(collar=collar, skip_overlap=skip_overlap)
    detail = metric.compute_components(reference, hypothesis)
    der_val = metric.compute_metric(detail)

    return {
        "der": der_val,
        "false_alarm": detail["false alarm"],
        "missed": detail["missed detection"],
        "confusion": detail["confusion"],
        "total": detail["total"],
    }


def evaluate_all(
    predictions: dict,
    collar: float = 0.0,
    skip_overlap: bool = True,
    verbose: bool = True,
) -> dict:
    """
    Evaluate predictions on all training files.

    Args:
        predictions: {file_id: Annotation} dict
        collar: tolerance collar in seconds
        skip_overlap: skip overlapping regions
        verbose: print per-file results

    Returns:
        dict with per-file and aggregate metrics
    """
    results = {}
    all_fa = 0.0
    all_miss = 0.0
    all_conf = 0.0
    all_total = 0.0

    for file_id in sorted(predictions.keys()):
        ref = load_reference_annotation(file_id)
        hyp = predictions[file_id]

        result = compute_der(ref, hyp, collar=collar, skip_overlap=skip_overlap)
        fa = result["false_alarm"]
        miss = result["missed"]
        conf = result["confusion"]
        total = result["total"]

        all_fa += fa
        all_miss += miss
        all_conf += conf
        all_total += total

        results[file_id] = result

        if verbose:
            print(f"  {file_id}: DER={result['der']:.4f} "
                  f"(FA={fa:.1f}s, Miss={miss:.1f}s, Conf={conf:.1f}s, Total={total:.1f}s)")

    # Aggregate (pool all durations)
    agg_der = (all_fa + all_miss + all_conf) / all_total if all_total > 0 else 0

    results["__aggregate__"] = {
        "der": agg_der,
        "false_alarm": all_fa,
        "missed": all_miss,
        "confusion": all_conf,
        "total": all_total,
    }

    # Competition score = 100 * (1 - DER), clipped to [0, 100]
    score = max(0, min(100, 100 * (1 - agg_der)))

    if verbose:
        print(f"\n  AGGREGATE DER: {agg_der:.4f}")
        print(f"  Competition Score: {score:.2f}")
        print(f"  FA: {all_fa:.1f}s | Miss: {all_miss:.1f}s | "
              f"Conf: {all_conf:.1f}s | Total: {all_total:.1f}s")

    results["__score__"] = score
    return results


def quick_eval(predictions: dict, collar: float = 0.0) -> float:
    """Quick evaluation returning just the aggregate DER."""
    results = evaluate_all(predictions, collar=collar, verbose=False)
    return results["__aggregate__"]["der"]
