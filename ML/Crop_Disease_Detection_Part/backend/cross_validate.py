"""
Cross-validation for Bengali Speaker Diarization.
Implements leave-one-out CV on the 10 training files to get robust DER
estimates and detect overfitting during hyperparameter tuning.

Step 10: Cross-validation and robustness checking.
"""

import os
import json
import time
import torch
import warnings
import numpy as np
from pathlib import Path
from pyannote.audio import Pipeline
from pyannote.core import Annotation

from .data_utils import get_train_ids, get_audio_path, get_audio_duration
from .evaluate import compute_der, evaluate_all
from .postprocess import postprocess
from .tune import (
    load_pipeline_for_tuning, apply_params_to_pipeline,
    load_best_params, run_with_params
)

warnings.filterwarnings("ignore")

CV_RESULTS_PATH = Path(__file__).resolve().parent.parent / "cv_results.json"


def leave_one_out_cv(
    hf_token: str = None,
    device: str = None,
    params: dict = None,
    verbose: bool = True,
) -> dict:
    """
    Leave-one-out cross-validation on training files.

    For each fold, one file is held out as "test" and the remaining 9
    files are used to evaluate the current parameter set. Since we don't
    retune per fold (too expensive), this measures how well the globally
    tuned params generalize.

    For a proper CV (retune per fold), use leave_one_out_cv_with_tuning().

    Args:
        hf_token: HuggingFace token
        device: 'cuda' or 'cpu'
        params: hyperparameters dict. None = load from best_params.json
        verbose: print progress

    Returns:
        dict with per-fold and aggregate results
    """
    if params is None:
        try:
            params = load_best_params()
        except FileNotFoundError:
            print("No best params found. Using defaults (empty params).")
            params = {}

    train_ids = get_train_ids()
    n_files = len(train_ids)

    print("=" * 70)
    print(f"LEAVE-ONE-OUT CROSS-VALIDATION ({n_files} folds)")
    print("=" * 70)

    # Load pipeline once
    pipeline = load_pipeline_for_tuning(hf_token=hf_token, device=device)

    fold_results = {}
    all_ders = []

    for fold_idx, held_out_id in enumerate(train_ids):
        if verbose:
            print(f"\n--- Fold {fold_idx + 1}/{n_files}: held out = {held_out_id} ---")

        # Run on held-out file with current params
        apply_params_to_pipeline(pipeline, params)

        # Post-processing params
        pp_params = {
            "min_segment_duration": params.get("pp_min_segment_duration", 0.3),
            "max_merge_gap": params.get("pp_max_merge_gap", 0.5),
            "max_interruption": params.get("pp_max_interruption", 0.5),
        }

        audio_path = get_audio_path(held_out_id)
        duration = get_audio_duration(held_out_id)

        t0 = time.time()
        prediction = pipeline(str(audio_path))
        prediction.uri = held_out_id
        prediction = postprocess(prediction, **pp_params)
        elapsed = time.time() - t0

        # Evaluate
        from .data_utils import load_reference_annotation
        result = compute_der(
            reference=load_reference_annotation(held_out_id),
            hypothesis=prediction,
        )

        n_spk = len(set(prediction.labels()))
        fold_results[held_out_id] = {
            "der": result["der"],
            "false_alarm": result["false_alarm"],
            "missed": result["missed"],
            "confusion": result["confusion"],
            "total": result["total"],
            "n_speakers_detected": n_spk,
            "duration": duration,
            "processing_time": elapsed,
            "rtf": elapsed / duration,
        }
        all_ders.append(result["der"])

        if verbose:
            print(f"  {held_out_id}: DER={result['der']:.4f} "
                  f"({n_spk} speakers, {elapsed:.1f}s, RTF={elapsed/duration:.3f})")

    # Aggregate statistics
    mean_der = np.mean(all_ders)
    std_der = np.std(all_ders)
    min_der = np.min(all_ders)
    max_der = np.max(all_ders)
    median_der = np.median(all_ders)

    # Pool-based aggregate (weight by total reference duration)
    total_fa = sum(r["false_alarm"] for r in fold_results.values())
    total_miss = sum(r["missed"] for r in fold_results.values())
    total_conf = sum(r["confusion"] for r in fold_results.values())
    total_ref = sum(r["total"] for r in fold_results.values())
    pooled_der = (total_fa + total_miss + total_conf) / total_ref if total_ref > 0 else 0

    aggregate = {
        "mean_der": mean_der,
        "std_der": std_der,
        "min_der": min_der,
        "max_der": max_der,
        "median_der": median_der,
        "pooled_der": pooled_der,
        "score_from_pooled": max(0, min(100, 100 * (1 - pooled_der))),
        "score_from_mean": max(0, min(100, 100 * (1 - mean_der))),
    }

    if verbose:
        print("\n" + "=" * 70)
        print("CROSS-VALIDATION RESULTS")
        print("=" * 70)
        print(f"  Mean DER:   {mean_der:.4f} ± {std_der:.4f}")
        print(f"  Median DER: {median_der:.4f}")
        print(f"  Min DER:    {min_der:.4f}")
        print(f"  Max DER:    {max_der:.4f}")
        print(f"  Pooled DER: {pooled_der:.4f}")
        print(f"  Score (pooled): {aggregate['score_from_pooled']:.2f}")
        print(f"  Score (mean):   {aggregate['score_from_mean']:.2f}")

        # Per-file breakdown sorted by DER
        print(f"\n  Per-file breakdown (sorted by DER):")
        for fid, r in sorted(fold_results.items(), key=lambda x: x[1]["der"]):
            print(f"    {fid}: DER={r['der']:.4f} "
                  f"(FA={r['false_alarm']:.1f}s, Miss={r['missed']:.1f}s, "
                  f"Conf={r['confusion']:.1f}s)")

    # Save results
    results = {
        "aggregate": aggregate,
        "per_fold": {k: {kk: float(vv) if isinstance(vv, (np.floating, float)) else vv
                         for kk, vv in v.items()}
                     for k, v in fold_results.items()},
        "params_used": params,
    }

    with open(CV_RESULTS_PATH, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nCV results saved to {CV_RESULTS_PATH}")

    return results


def check_overfitting(
    hf_token: str = None,
    device: str = None,
    params: dict = None,
) -> dict:
    """
    Compare in-sample DER (all train files) vs CV DER
    to detect overfitting in hyperparameter tuning.
    """
    if params is None:
        try:
            params = load_best_params()
        except FileNotFoundError:
            print("No best params found.")
            return {}

    print("=" * 70)
    print("OVERFITTING CHECK")
    print("=" * 70)

    # In-sample: run with params on all train files (same data used for tuning)
    pipeline = load_pipeline_for_tuning(hf_token=hf_token, device=device)
    print("\n--- In-sample evaluation ---")
    predictions = run_with_params(pipeline, params)
    in_sample_results = evaluate_all(predictions, verbose=True)
    in_sample_der = in_sample_results["__aggregate__"]["der"]

    # CV evaluation
    print("\n--- Leave-one-out CV ---")
    cv_results = leave_one_out_cv(
        hf_token=hf_token,
        device=device,
        params=params,
        verbose=True,
    )
    cv_der = cv_results["aggregate"]["pooled_der"]

    # Gap analysis
    gap = cv_der - in_sample_der
    relative_gap = gap / in_sample_der if in_sample_der > 0 else 0

    print("\n" + "=" * 70)
    print("OVERFITTING ANALYSIS")
    print("=" * 70)
    print(f"  In-sample DER:  {in_sample_der:.4f}")
    print(f"  CV DER:         {cv_der:.4f}")
    print(f"  Gap:            {gap:.4f} ({relative_gap*100:.1f}% increase)")

    if relative_gap < 0.05:
        print("  Verdict: LOW overfitting risk ✓")
    elif relative_gap < 0.15:
        print("  Verdict: MODERATE overfitting — consider regularization")
    else:
        print("  Verdict: HIGH overfitting — params too specialized to train data")

    return {
        "in_sample_der": in_sample_der,
        "cv_der": cv_der,
        "gap": gap,
        "relative_gap": relative_gap,
    }


if __name__ == "__main__":
    leave_one_out_cv()
