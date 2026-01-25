"""
Hyperparameter tuning for the pyannote diarization pipeline using Optuna.
This is the most impactful step — tunes clustering thresholds and
post-processing settings to minimize DER on training data.

Optimized for speed:
- Phase 1: Uses 3 representative files (not all 10) for fast exploration
- Per-file pruning: bad trials killed after 1 file (~2 min) not 3 (~8 min)
- Phase 2: Validates best params on ALL 10 files
- 4-hour timeout with GPU enforcement
"""

import os
import json
import time
import torch
import optuna
import warnings
from pathlib import Path
from pyannote.audio import Pipeline
from pyannote.core import Annotation

from .data_utils import (
    get_train_ids, get_audio_path, get_audio_duration,
    load_reference_annotation,
)
from .evaluate import quick_eval, evaluate_all, compute_der
from .postprocess import postprocess

warnings.filterwarnings("ignore")

BEST_PARAMS_PATH = Path(__file__).resolve().parent.parent / "best_params.json"
STUDY_DB_PATH = Path(__file__).resolve().parent.parent / "optuna_study.db"

# ──────────────────────────────────────────────────────────────────────
# Representative files for fast tuning (picked for speed + diversity)
# ──────────────────────────────────────────────────────────────────────
# train_002: 2437s audio, 132s proc, 21 speakers, 73.5% speech (medium density)
# train_009: 2579s audio, 165s proc, 22 speakers, 58.0% speech (sparse, many spk)
# train_001: 3371s audio, 198s proc, 11 speakers, 58.4% speech (fewer spk, sparse)
# Total: ~495s per trial (~8 min), with pruning ~5 min average
FAST_FILES = ["train_002", "train_009", "train_001"]


def load_pipeline_for_tuning(hf_token: str = None, device: str = None) -> Pipeline:
    """Load pyannote pipeline for hyperparameter tuning. Always uses GPU."""
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    if device != "cuda" and torch.cuda.is_available():
        device = "cuda"
        print("Forcing GPU for tuning.")

    token = hf_token or os.environ.get("HF_TOKEN")
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=token,
    )
    pipeline.to(torch.device(device))
    print(f"Pipeline loaded on {device}")
    return pipeline


def apply_params_to_pipeline(pipeline: Pipeline, params: dict) -> Pipeline:
    """
    Apply hyperparameters to the pyannote pipeline.

    pyannote 3.1 exposes:
    - clustering.threshold: agglomerative clustering distance threshold
    - clustering.method: linkage method
    - clustering.min_cluster_size: minimum segments per speaker cluster
    - segmentation.min_duration_off: min silence gap to split segments
    """
    pipeline_params = {}

    if "clustering_threshold" in params:
        pipeline_params.setdefault("clustering", {})
        pipeline_params["clustering"]["threshold"] = params["clustering_threshold"]

    if "clustering_method" in params:
        pipeline_params.setdefault("clustering", {})
        pipeline_params["clustering"]["method"] = params["clustering_method"]

    if "clustering_min_cluster_size" in params:
        pipeline_params.setdefault("clustering", {})
        pipeline_params["clustering"]["min_cluster_size"] = params["clustering_min_cluster_size"]

    if "min_duration_off" in params:
        pipeline_params.setdefault("segmentation", {})
        pipeline_params["segmentation"]["min_duration_off"] = params["min_duration_off"]

    if pipeline_params:
        pipeline.instantiate(pipeline_params)

    return pipeline


def _get_pp_params(params: dict) -> dict:
    """Extract post-processing params from a params dict."""
    return {
        "min_segment_duration": params.get("pp_min_segment_duration", 0.3),
        "max_merge_gap": params.get("pp_max_merge_gap", 0.5),
        "max_interruption": params.get("pp_max_interruption", 0.5),
    }


def run_with_params(pipeline: Pipeline, params: dict, file_ids: list = None) -> dict:
    """
    Run diarization with given parameters on specified files.
    Returns {file_id: Annotation} predictions dict.
    """
    if file_ids is None:
        file_ids = get_train_ids()

    # Apply pipeline params
    pipeline_params = {k: v for k, v in params.items()
                       if k in ("clustering_threshold",
                                "clustering_method", "clustering_min_cluster_size",
                                "min_duration_off")}
    apply_params_to_pipeline(pipeline, pipeline_params)

    pp_params = _get_pp_params(params)

    predictions = {}
    for fid in file_ids:
        audio_path = get_audio_path(fid)
        with torch.no_grad():
            annotation = pipeline(str(audio_path))
        annotation.uri = fid
        annotation = postprocess(annotation, **pp_params)
        predictions[fid] = annotation

    return predictions


def create_objective(pipeline: Pipeline, file_ids: list = None):
    """
    Create an Optuna objective with per-file pruning.

    Reports intermediate DER after each file so Optuna can kill bad trials
    early (after ~2 min instead of wasting ~8 min on all 3 files).
    """
    if file_ids is None:
        file_ids = FAST_FILES

    # Pre-load references (avoid re-reading CSV every trial)
    references = {}
    for fid in file_ids:
        references[fid] = load_reference_annotation(fid)

    def objective(trial: optuna.Trial) -> float:
        t0 = time.time()

        # ── Suggest hyperparameters ──────────────────────────────────
        params = {
            "clustering_threshold": trial.suggest_float(
                "clustering_threshold", 0.30, 0.85
            ),
            "clustering_method": trial.suggest_categorical(
                "clustering_method", ["centroid", "average", "complete"]
            ),
            "clustering_min_cluster_size": trial.suggest_int(
                "clustering_min_cluster_size", 1, 20
            ),
            "min_duration_off": trial.suggest_float(
                "min_duration_off", 0.0, 1.5
            ),
            # Post-processing
            "pp_min_segment_duration": trial.suggest_float(
                "pp_min_segment_duration", 0.0, 1.0
            ),
            "pp_max_merge_gap": trial.suggest_float(
                "pp_max_merge_gap", 0.0, 2.0
            ),
            "pp_max_interruption": trial.suggest_float(
                "pp_max_interruption", 0.0, 1.5
            ),
        }

        # Apply pipeline params
        try:
            pipeline_params = {k: v for k, v in params.items()
                               if k in ("clustering_threshold", "clustering_method",
                                        "clustering_min_cluster_size", "min_duration_off")}
            apply_params_to_pipeline(pipeline, pipeline_params)
        except Exception as e:
            print(f"  Trial {trial.number}: param error: {e}")
            return 1.0

        pp_params = _get_pp_params(params)

        # ── Run per-file with intermediate pruning ───────────────────
        cum_fa = 0.0
        cum_miss = 0.0
        cum_conf = 0.0
        cum_total = 0.0

        for step, fid in enumerate(file_ids):
            try:
                audio_path = get_audio_path(fid)
                with torch.no_grad():
                    annotation = pipeline(str(audio_path))
                annotation.uri = fid
                annotation = postprocess(annotation, **pp_params)

                # Compute DER components for this file
                ref = references[fid]
                result = compute_der(ref, annotation)

                cum_fa += result["false_alarm"]
                cum_miss += result["missed"]
                cum_conf += result["confusion"]
                cum_total += result["total"]

                # Intermediate pooled DER so far
                intermediate_der = (
                    (cum_fa + cum_miss + cum_conf) / cum_total
                    if cum_total > 0 else 1.0
                )

                # Report to Optuna for pruning
                trial.report(intermediate_der, step)

                # Check if trial should be pruned
                if trial.should_prune():
                    elapsed = time.time() - t0
                    print(f"  Trial {trial.number}: PRUNED at file {step+1}/{len(file_ids)} "
                          f"(DER={intermediate_der:.4f}, {elapsed:.0f}s)")
                    raise optuna.TrialPruned()

            except optuna.TrialPruned:
                raise
            except Exception as e:
                print(f"  Trial {trial.number}: file {fid} failed: {e}")
                return 1.0

        # Final DER across all files
        final_der = (cum_fa + cum_miss + cum_conf) / cum_total if cum_total > 0 else 1.0
        elapsed = time.time() - t0

        print(f"  Trial {trial.number}: DER={final_der:.4f} "
              f"(FA={cum_fa:.0f}s Miss={cum_miss:.0f}s Conf={cum_conf:.0f}s) "
              f"[{elapsed:.0f}s]")

        return final_der

    return objective


def run_tuning(
    hf_token: str = None,
    n_trials: int = 100,
    timeout: int = 14400,  # 4 hours default
    study_name: str = "bangla_diarization",
    device: str = None,
    fast_files: list = None,
    validate_all: bool = True,
):
    """
    Run Optuna hyperparameter tuning with speed optimizations.

    Phase 1: Fast exploration on 3 representative files with pruning
    Phase 2: Validate best params on all 10 training files

    Args:
        hf_token: HuggingFace token
        n_trials: max number of trials (default: 100)
        timeout: timeout in seconds (default: 14400 = 4 hours)
        study_name: Optuna study name
        device: 'cuda' or 'cpu' (GPU enforced if available)
        fast_files: override which files to use for tuning
        validate_all: run final validation on all 10 files (adds ~35 min)
    """
    if fast_files is None:
        fast_files = FAST_FILES

    print("=" * 70)
    print(f"HYPERPARAMETER TUNING")
    print(f"  Trials: up to {n_trials}")
    print(f"  Timeout: {timeout}s ({timeout/3600:.1f}h)")
    print(f"  Fast files: {fast_files}")
    print(f"  Estimated time per trial: ~{len(fast_files) * 150}s "
          f"(~{len(fast_files) * 2.5:.0f} min)")
    print("=" * 70)

    # Load pipeline once (GPU)
    pipeline = load_pipeline_for_tuning(hf_token=hf_token, device=device)

    # Create persistent Optuna study (SQLite so we can resume)
    storage = f"sqlite:///{STUDY_DB_PATH}"
    study = optuna.create_study(
        study_name=study_name,
        direction="minimize",
        sampler=optuna.samplers.TPESampler(seed=42, n_startup_trials=10),
        pruner=optuna.pruners.MedianPruner(
            n_startup_trials=5,       # Allow 5 full trials before pruning
            n_warmup_steps=0,         # Can prune after step 0 (1st file)
            interval_steps=1,         # Check every file
        ),
        storage=storage,
        load_if_exists=True,  # Resume if study exists
    )

    # Check if resuming
    n_existing = len([t for t in study.trials
                      if t.state in (optuna.trial.TrialState.COMPLETE,
                                     optuna.trial.TrialState.PRUNED)])
    if n_existing > 0:
        try:
            best_val = study.best_value
            print(f"\nResuming study with {n_existing} existing trials "
                  f"(best so far: DER={best_val:.4f})")
        except ValueError:
            print(f"\nResuming study with {n_existing} existing trials "
                  f"(no completed trials yet)")
        remaining = max(0, n_trials - n_existing)
        if remaining == 0:
            print("All trials already completed. Skipping to validation.")
        else:
            n_trials = remaining
            print(f"Running {remaining} more trials...")

    # Create objective
    objective = create_objective(pipeline, file_ids=fast_files)

    # ── Phase 1: Fast exploration ────────────────────────────────────
    if n_trials > 0:
        print(f"\n{'─'*70}")
        print(f"PHASE 1: Fast exploration ({n_trials} trials on {len(fast_files)} files)")
        print(f"{'─'*70}")

        t0 = time.time()
        study.optimize(
            objective,
            n_trials=n_trials,
            timeout=timeout,
            show_progress_bar=True,
            gc_after_trial=True,
        )
        elapsed = time.time() - t0

        completed = len([t for t in study.trials
                         if t.state == optuna.trial.TrialState.COMPLETE])
        pruned = len([t for t in study.trials
                      if t.state == optuna.trial.TrialState.PRUNED])

        print(f"\nPhase 1 complete in {elapsed:.0f}s ({elapsed/60:.1f} min)")
        print(f"  Completed: {completed} | Pruned: {pruned} | "
              f"Total: {len(study.trials)}")
        print(f"  Best DER (fast files): {study.best_value:.4f}")
        print(f"  Best Score (fast files): "
              f"{max(0, min(100, 100*(1-study.best_value))):.2f}")

    # Print best params
    print(f"\nBest parameters:")
    for k, v in study.best_params.items():
        if isinstance(v, float):
            print(f"  {k}: {v:.4f}")
        else:
            print(f"  {k}: {v}")

    # ── Phase 2: Validate on ALL 10 files ────────────────────────────
    if validate_all:
        print(f"\n{'─'*70}")
        print("PHASE 2: Validating best params on ALL 10 training files")
        print(f"{'─'*70}")

        t0 = time.time()
        predictions = run_with_params(pipeline, study.best_params)
        results = evaluate_all(predictions, verbose=True)
        elapsed = time.time() - t0

        full_der = results["__aggregate__"]["der"]
        full_score = results["__score__"]

        print(f"\nFull validation in {elapsed:.0f}s ({elapsed/60:.1f} min)")
        print(f"  Full DER (all 10 files): {full_der:.4f}")
        print(f"  Full Score: {full_score:.2f}")

        # Save with full DER
        save_best_params(study.best_params, full_der)
    else:
        save_best_params(study.best_params, study.best_value)

    # ── Summary ──────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("TUNING COMPLETE")
    print("=" * 70)
    print(f"Best trial: #{study.best_trial.number}")
    if validate_all:
        print(f"DER on 3 fast files: {study.best_value:.4f}")
        print(f"DER on all 10 files: {full_der:.4f}")
        print(f"Competition Score:   {full_score:.2f}")
    else:
        print(f"Best DER: {study.best_value:.4f}")
    print(f"Params saved to {BEST_PARAMS_PATH}")

    return study, pipeline


def save_best_params(params: dict, best_der: float):
    """Save best parameters to JSON file."""
    data = {
        "params": params,
        "best_der": best_der,
        "best_score": max(0, min(100, 100 * (1 - best_der))),
    }
    with open(BEST_PARAMS_PATH, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\nBest params saved to {BEST_PARAMS_PATH}")


def load_best_params() -> dict:
    """Load best parameters from JSON file."""
    if not BEST_PARAMS_PATH.exists():
        raise FileNotFoundError(
            f"No best params found at {BEST_PARAMS_PATH}. Run tuning first."
        )
    with open(BEST_PARAMS_PATH) as f:
        data = json.load(f)
    print(f"Loaded best params (DER={data['best_der']:.4f}, Score={data['best_score']:.2f})")
    return data["params"]


def generate_submission_with_best_params(hf_token: str = None, device: str = None):
    """Load best params, run on test data, and create submission."""
    from .data_utils import create_submission

    params = load_best_params()
    pipeline = load_pipeline_for_tuning(hf_token=hf_token, device=device)

    # Apply pipeline params
    apply_params_to_pipeline(pipeline, params)

    # Post-processing params
    pp_params = {
        "min_segment_duration": params.get("pp_min_segment_duration", 0.3),
        "max_merge_gap": params.get("pp_max_merge_gap", 0.5),
        "max_interruption": params.get("pp_max_interruption", 0.5),
    }

    # Run on test files
    from .data_utils import get_test_ids
    test_ids = get_test_ids()
    predictions = {}

    print("Running on test files with best parameters...")
    for i, fid in enumerate(test_ids):
        audio_path = get_audio_path(fid)
        annotation = pipeline(str(audio_path))
        annotation.uri = fid
        annotation = postprocess(annotation, **pp_params)
        predictions[fid] = annotation
        n_spk = len(set(annotation.labels()))
        print(f"  [{i+1}/{len(test_ids)}] {fid}: {n_spk} speakers")

    # Also evaluate on train to verify
    print("\nVerification on train data:")
    train_preds = run_with_params(pipeline, params)
    evaluate_all(train_preds, verbose=True)

    # Save submission
    output_path = str(Path(__file__).resolve().parent.parent / "submission_tuned.csv")
    create_submission(predictions, output_path=output_path)

    return predictions


if __name__ == "__main__":
    run_tuning()
