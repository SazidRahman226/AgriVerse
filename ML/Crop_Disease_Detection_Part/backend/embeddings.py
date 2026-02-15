"""
Embedding model comparison for Bengali Speaker Diarization.
Tests alternative speaker embedding models by swapping them into the
pyannote pipeline and evaluating DER on training data.

Step 5: Try WeSpeaker/CAM++, ECAPA-TDNN, WavLM, etc.
"""

import os
import time
import json
import torch
import warnings
from pathlib import Path
from pyannote.audio import Pipeline, Model
from pyannote.core import Annotation

from .data_utils import get_train_ids, get_audio_path, get_audio_duration
from .evaluate import evaluate_all, quick_eval
from .postprocess import postprocess
from .tune import load_best_params, apply_params_to_pipeline

warnings.filterwarnings("ignore")

RESULTS_PATH = Path(__file__).resolve().parent.parent / "embedding_results.json"

# Embedding models to try
# Each entry: (name, HuggingFace model ID or path)
EMBEDDING_MODELS = {
    "default": None,  # Use pipeline's built-in wespeaker-voxceleb-resnet34-LM
    "wespeaker-cam++": "pyannote/wespeaker-voxceleb-CAM++",
    "ecapa-tdnn": "speechbrain/spkrec-ecapa-voxceleb",
    "resnet34": "pyannote/wespeaker-voxceleb-resnet34-LM",
    "resnet152": "pyannote/wespeaker-voxceleb-resnet152-LM",
    "resnet293": "pyannote/wespeaker-voxceleb-resnet293-LM",
}


def load_pipeline_with_embedding(
    embedding_model: str = None,
    hf_token: str = None,
    device: str = None,
    best_params: dict = None,
) -> Pipeline:
    """
    Load pyannote pipeline, optionally swapping the embedding model.

    Args:
        embedding_model: HuggingFace model ID for speaker embeddings.
                        None = use default.
        hf_token: HuggingFace token
        device: 'cuda' or 'cpu'
        best_params: dict of tuned hyperparameters to apply

    Returns:
        Configured pyannote Pipeline
    """
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    token = hf_token or os.environ.get("HF_TOKEN")

    # Load base pipeline
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=token,
    )

    # Swap embedding model if specified
    if embedding_model is not None:
        print(f"  Swapping embedding model to: {embedding_model}")
        try:
            # Try loading as a pyannote Model first
            emb_model = Model.from_pretrained(
                embedding_model,
                use_auth_token=token,
            )
            pipeline.embedding = emb_model
            pipeline.embedding.to(torch.device(device))
        except Exception:
            # For SpeechBrain models, we need a different approach
            # pyannote wraps them via its own inference wrapper
            try:
                from pyannote.audio import Inference
                pipeline._embedding = Inference(
                    embedding_model,
                    window="whole",
                    use_auth_token=token,
                )
                pipeline._embedding.to(torch.device(device))
            except Exception as e:
                print(f"  WARNING: Could not load embedding model {embedding_model}: {e}")
                print(f"  Falling back to default embedding model.")

    pipeline.to(torch.device(device))

    # Apply best hyperparameters if provided
    if best_params:
        apply_params_to_pipeline(pipeline, best_params)

    return pipeline


def evaluate_embedding(
    embedding_name: str,
    embedding_model_id: str = None,
    hf_token: str = None,
    device: str = None,
    apply_postprocessing: bool = True,
    best_params: dict = None,
    file_ids: list = None,
) -> dict:
    """
    Evaluate a specific embedding model on training data.

    Returns:
        dict with 'der', 'score', 'per_file', 'time'
    """
    if file_ids is None:
        file_ids = get_train_ids()

    print(f"\n--- Evaluating embedding: {embedding_name} ---")

    # Load pipeline with this embedding
    pipeline = load_pipeline_with_embedding(
        embedding_model=embedding_model_id,
        hf_token=hf_token,
        device=device,
        best_params=best_params,
    )

    # Get post-processing params
    pp_params = {}
    if best_params:
        pp_params = {
            "min_segment_duration": best_params.get("pp_min_segment_duration", 0.3),
            "max_merge_gap": best_params.get("pp_max_merge_gap", 0.5),
            "max_interruption": best_params.get("pp_max_interruption", 0.5),
        }

    # Run diarization on all training files
    predictions = {}
    total_time = 0

    for i, fid in enumerate(file_ids):
        audio_path = get_audio_path(fid)
        duration = get_audio_duration(fid)

        t0 = time.time()
        annotation = pipeline(str(audio_path))
        annotation.uri = fid
        elapsed = time.time() - t0
        total_time += elapsed

        if apply_postprocessing:
            annotation = postprocess(annotation, **pp_params)

        n_spk = len(set(annotation.labels()))
        rtf = elapsed / duration
        print(f"  [{i+1}/{len(file_ids)}] {fid}: {n_spk} speakers, "
              f"{elapsed:.1f}s (RTF={rtf:.3f})")

        predictions[fid] = annotation

    # Evaluate
    results = evaluate_all(predictions, verbose=True)
    der = results["__aggregate__"]["der"]
    score = results["__score__"]

    return {
        "embedding_name": embedding_name,
        "embedding_model": embedding_model_id,
        "der": der,
        "score": score,
        "total_time": total_time,
        "per_file": {k: v for k, v in results.items()
                     if not k.startswith("__")},
    }


def compare_embeddings(
    hf_token: str = None,
    device: str = None,
    models: dict = None,
):
    """
    Compare multiple embedding models and report results.

    Args:
        hf_token: HuggingFace token
        device: 'cuda' or 'cpu'
        models: dict of {name: model_id} to test. None = use EMBEDDING_MODELS
    """
    if models is None:
        models = EMBEDDING_MODELS

    # Try to load best params from tuning
    try:
        best_params = load_best_params()
        print("Using tuned hyperparameters.")
    except FileNotFoundError:
        best_params = None
        print("No tuned params found. Using defaults.")

    print("=" * 70)
    print("EMBEDDING MODEL COMPARISON")
    print("=" * 70)

    all_results = {}

    for name, model_id in models.items():
        try:
            result = evaluate_embedding(
                embedding_name=name,
                embedding_model_id=model_id,
                hf_token=hf_token,
                device=device,
                best_params=best_params,
            )
            all_results[name] = result
        except Exception as e:
            print(f"\n  ERROR with {name}: {e}")
            all_results[name] = {"error": str(e)}

    # Summary
    print("\n" + "=" * 70)
    print("EMBEDDING COMPARISON SUMMARY")
    print("=" * 70)
    print(f"{'Model':<25} {'DER':>8} {'Score':>8} {'Time':>8}")
    print("-" * 55)

    best_name = None
    best_der = float("inf")

    for name, result in sorted(all_results.items(),
                                key=lambda x: x[1].get("der", 999)):
        if "error" in result:
            print(f"{name:<25} {'ERROR':>8}")
        else:
            der = result["der"]
            score = result["score"]
            t = result["total_time"]
            marker = ""
            if der < best_der:
                best_der = der
                best_name = name
                marker = " <-- BEST"
            print(f"{name:<25} {der:>8.4f} {score:>8.2f} {t:>7.1f}s{marker}")

    # Save results
    with open(RESULTS_PATH, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\nResults saved to {RESULTS_PATH}")

    if best_name:
        print(f"\n>>> Best embedding: {best_name} (DER={best_der:.4f})")

    return all_results


if __name__ == "__main__":
    compare_embeddings()
