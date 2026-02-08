"""Quick test: run pyannote on ONE training file, evaluate DER."""
import os
import sys
import time
import torch
import warnings

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings("ignore")

from pyannote.audio import Pipeline
from src.data_utils import get_audio_path, get_audio_duration, load_reference_annotation
from src.evaluate import compute_der, evaluate_all
from src.postprocess import postprocess

# Load pipeline
token = os.environ.get("HF_TOKEN")
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device: {device}")

print("Loading pipeline...")
pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token=token,
)
pipeline.to(torch.device(device))
print("Pipeline loaded.\n")

# Run on train_001 (smallest speech ratio, good test case)
file_id = "train_001"
audio_path = get_audio_path(file_id)
duration = get_audio_duration(file_id)
print(f"Processing {file_id} ({duration:.1f}s = {duration/60:.1f}min)...")

t0 = time.time()
annotation = pipeline(str(audio_path))
annotation.uri = file_id
elapsed = time.time() - t0
rtf = elapsed / duration

n_spk = len(set(annotation.labels()))
print(f"Done in {elapsed:.1f}s (RTF={rtf:.3f}), detected {n_spk} speakers")

# Evaluate raw
ref = load_reference_annotation(file_id)
result_raw = compute_der(ref, annotation)
print(f"\nRaw DER: {result_raw['der']:.4f}")
print(f"  FA={result_raw['false_alarm']:.1f}s, Miss={result_raw['missed']:.1f}s, "
      f"Conf={result_raw['confusion']:.1f}s")

# Apply post-processing
annotation_pp = postprocess(annotation)
annotation_pp.uri = file_id
n_spk_pp = len(set(annotation_pp.labels()))
print(f"\nAfter post-processing: {n_spk_pp} speakers")

result_pp = compute_der(ref, annotation_pp)
print(f"Post-processed DER: {result_pp['der']:.4f}")
print(f"  FA={result_pp['false_alarm']:.1f}s, Miss={result_pp['missed']:.1f}s, "
      f"Conf={result_pp['confusion']:.1f}s")

score = max(0, min(100, 100 * (1 - result_pp['der'])))
print(f"\nCompetition Score (this file): {score:.2f}")
