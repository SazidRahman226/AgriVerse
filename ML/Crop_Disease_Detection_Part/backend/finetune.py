"""
Fine-tuning the pyannote segmentation model on Bengali training data.
Adapts the VAD/segmentation model to Bangla speech patterns.

Step 7: Fine-tune pyannote/segmentation-3.0 on the 10 training files.

With RTX 3050 6GB:
- Batch size 2-4, gradient accumulation 4-8
- 5-10 epochs with early stopping
- Leave-one-out CV for validation
"""

import os
import json
import math
import time
import torch
import warnings
import numpy as np
from pathlib import Path
from typing import Optional

warnings.filterwarnings("ignore")

from pyannote.audio import Model, Pipeline
from pyannote.audio.tasks import Segmentation
from pyannote.database import FileFinder, registry
from pyannote.core import Annotation, Segment
import pytorch_lightning as pl
from pytorch_lightning.callbacks import (
    EarlyStopping,
    ModelCheckpoint,
    LearningRateMonitor,
)

from .data_utils import (
    get_train_ids, get_audio_path, get_audio_duration,
    load_annotation_df, TRAIN_AUDIO_DIR, TRAIN_ANNOT_DIR, BASE_DIR,
)
from .evaluate import evaluate_all
from .postprocess import postprocess

FINETUNE_DIR = BASE_DIR / "finetuned_models"
FINETUNE_DIR.mkdir(exist_ok=True)

RTTM_DIR = BASE_DIR / "rttm_files"
RTTM_DIR.mkdir(exist_ok=True)

DATABASE_YML_PATH = BASE_DIR / "database.yml"


def annotation_df_to_rttm(file_id: str, output_dir: Path = RTTM_DIR) -> Path:
    """
    Convert annotation CSV to RTTM format (required by pyannote for training).

    RTTM format:
    SPEAKER <file_id> 1 <start> <duration> <NA> <NA> <speaker_id> <NA> <NA>
    """
    df = load_annotation_df(file_id)
    output_path = output_dir / f"{file_id}.rttm"

    with open(output_path, "w") as f:
        for _, row in df.iterrows():
            start = row["start_time"]
            duration = row["end_time"] - row["start_time"]
            speaker = f"SPEAKER_{row['speaker_id']}"
            f.write(f"SPEAKER {file_id} 1 {start:.3f} {duration:.3f} "
                    f"<NA> <NA> {speaker} <NA> <NA>\n")

    return output_path


def create_all_rttm_files():
    """Generate RTTM files for all training annotations."""
    train_ids = get_train_ids()
    print(f"Creating RTTM files for {len(train_ids)} training files...")
    for fid in train_ids:
        annotation_df_to_rttm(fid)
    print(f"RTTM files saved to {RTTM_DIR}")


def create_database_yml(
    train_ids: list = None,
    val_ids: list = None,
):
    """
    Create a pyannote database.yml for training.

    This YAML file tells pyannote where to find audio and annotations.
    """
    if train_ids is None:
        all_ids = get_train_ids()
        # Default: use all for training (validation via leave-one-out externally)
        train_ids = all_ids
        val_ids = all_ids  # reuse for simplicity; real CV done in cross_validate.py

    # Create file lists
    train_list_path = BASE_DIR / "train_list.txt"
    val_list_path = BASE_DIR / "val_list.txt"

    with open(train_list_path, "w") as f:
        for fid in train_ids:
            f.write(f"{fid}\n")

    with open(val_list_path, "w") as f:
        for fid in val_ids:
            f.write(f"{fid}\n")

    # Create database.yml
    yml_content = f"""Databases:
  BanglaDialization:
    - {str(TRAIN_AUDIO_DIR).replace(chr(92), '/')}/{{uri}}.wav

Protocols:
  BanglaDialization:
    SpeakerDiarization:
      Train:
        train:
          uri: {str(train_list_path).replace(chr(92), '/')}
          annotation: {str(RTTM_DIR).replace(chr(92), '/')}/{{uri}}.rttm
        development:
          uri: {str(val_list_path).replace(chr(92), '/')}
          annotation: {str(RTTM_DIR).replace(chr(92), '/')}/{{uri}}.rttm
"""
    with open(DATABASE_YML_PATH, "w") as f:
        f.write(yml_content)

    print(f"database.yml saved to {DATABASE_YML_PATH}")
    return DATABASE_YML_PATH


def get_segmentation_task(database_yml: Path = None):
    """
    Create a pyannote Segmentation task from our database.

    Returns:
        Segmentation task configured for our data
    """
    if database_yml is None:
        database_yml = DATABASE_YML_PATH

    # Register the database
    registry.load_database(str(database_yml))

    # Create Segmentation task
    task = Segmentation(
        protocol="BanglaDialization.SpeakerDiarization.Train",
        duration=5.0,        # 5-second chunks (default)
        max_num_speakers=10, # Up to 10 speakers per recording
        batch_size=4,        # Small batch for 6GB VRAM
        num_workers=2,
    )

    return task


def finetune_segmentation(
    hf_token: str = None,
    device: str = None,
    max_epochs: int = 10,
    batch_size: int = 4,
    accumulate_grad_batches: int = 4,
    learning_rate: float = 1e-4,
    patience: int = 3,
    output_name: str = "segmentation_finetuned",
    val_ids: list = None,
    train_ids: list = None,
):
    """
    Fine-tune the pyannote segmentation model on Bengali training data.

    Args:
        hf_token: HuggingFace token
        device: 'cuda' or 'cpu'
        max_epochs: maximum training epochs
        batch_size: batch size (keep small for 6GB VRAM)
        accumulate_grad_batches: gradient accumulation steps
        learning_rate: learning rate
        patience: early stopping patience
        output_name: name for saved model
        val_ids: validation file IDs (for leave-one-out)
        train_ids: training file IDs
    """
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    token = hf_token or os.environ.get("HF_TOKEN")

    print("=" * 70)
    print("FINE-TUNING SEGMENTATION MODEL")
    print("=" * 70)
    print(f"  Device: {device}")
    print(f"  Batch size: {batch_size}")
    print(f"  Gradient accumulation: {accumulate_grad_batches}")
    print(f"  Effective batch size: {batch_size * accumulate_grad_batches}")
    print(f"  Max epochs: {max_epochs}")
    print(f"  Learning rate: {learning_rate}")
    print(f"  Early stopping patience: {patience}")

    # Step 1: Generate RTTM files
    create_all_rttm_files()

    # Step 2: Create database.yml with train/val split
    if train_ids is None:
        train_ids = get_train_ids()
    if val_ids is None:
        val_ids = train_ids  # Simple: validate on all

    create_database_yml(train_ids=train_ids, val_ids=val_ids)

    # Step 3: Load pre-trained segmentation model
    print("\nLoading pyannote/segmentation-3.0...")
    model = Model.from_pretrained(
        "pyannote/segmentation-3.0",
        use_auth_token=token,
    )

    # Step 4: Create task and attach to model
    task = get_segmentation_task()
    model.task = task
    model.setup(stage="fit")

    # Step 5: Configure optimizer
    model.learning_rate = learning_rate

    # Step 6: Set up callbacks
    checkpoint_dir = FINETUNE_DIR / output_name
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    callbacks = [
        ModelCheckpoint(
            dirpath=str(checkpoint_dir),
            filename="best-{epoch:02d}-{val_loss:.4f}",
            monitor="val_loss",
            mode="min",
            save_top_k=1,
            verbose=True,
        ),
        EarlyStopping(
            monitor="val_loss",
            patience=patience,
            mode="min",
            verbose=True,
        ),
        LearningRateMonitor(logging_interval="step"),
    ]

    # Step 7: Train
    accelerator = "gpu" if device == "cuda" else "cpu"
    precision = "16-mixed" if device == "cuda" else 32

    trainer = pl.Trainer(
        max_epochs=max_epochs,
        accelerator=accelerator,
        devices=1,
        precision=precision,
        accumulate_grad_batches=accumulate_grad_batches,
        callbacks=callbacks,
        default_root_dir=str(checkpoint_dir),
        enable_progress_bar=True,
        gradient_clip_val=1.0,
    )

    print("\nStarting fine-tuning...")
    t0 = time.time()
    trainer.fit(model)
    elapsed = time.time() - t0
    print(f"\nFine-tuning completed in {elapsed:.1f}s ({elapsed/60:.1f} min)")

    # Step 8: Save the best model
    best_model_path = checkpoint_dir / "best_model.pt"
    best_ckpt = callbacks[0].best_model_path
    if best_ckpt:
        print(f"Best checkpoint: {best_ckpt}")
        # Load best checkpoint and save as a standalone model
        best_model = Model.from_pretrained(best_ckpt)
        torch.save(best_model.state_dict(), best_model_path)
        print(f"Best model saved to {best_model_path}")
    else:
        # Save current model
        torch.save(model.state_dict(), best_model_path)
        print(f"Model saved to {best_model_path}")

    return model, str(best_model_path)


def load_finetuned_pipeline(
    segmentation_model_path: str = None,
    hf_token: str = None,
    device: str = None,
    best_params: dict = None,
) -> Pipeline:
    """
    Load the diarization pipeline with a fine-tuned segmentation model.

    Args:
        segmentation_model_path: path to fine-tuned segmentation .pt file
        hf_token: HuggingFace token
        device: 'cuda' or 'cpu'
        best_params: tuned hyperparameters

    Returns:
        pyannote Pipeline with fine-tuned segmentation
    """
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    token = hf_token or os.environ.get("HF_TOKEN")

    # Load base pipeline
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=token,
    )

    # Swap segmentation model if path provided
    if segmentation_model_path is None:
        # Try default path
        default_path = FINETUNE_DIR / "segmentation_finetuned" / "best_model.pt"
        if default_path.exists():
            segmentation_model_path = str(default_path)
        else:
            print("No fine-tuned segmentation model found. Using default.")

    if segmentation_model_path:
        print(f"Loading fine-tuned segmentation from: {segmentation_model_path}")

        # Load the segmentation model
        seg_model = Model.from_pretrained(
            "pyannote/segmentation-3.0",
            use_auth_token=token,
        )
        state_dict = torch.load(segmentation_model_path, map_location=device)
        seg_model.load_state_dict(state_dict)
        seg_model.to(torch.device(device))
        seg_model.eval()

        # Replace in pipeline
        pipeline._segmentation.model_ = seg_model

    pipeline.to(torch.device(device))

    # Apply hyperparameters
    if best_params:
        from .tune import apply_params_to_pipeline
        apply_params_to_pipeline(pipeline, best_params)

    return pipeline


def evaluate_finetuned(
    segmentation_model_path: str = None,
    hf_token: str = None,
    device: str = None,
):
    """Evaluate the fine-tuned model on all training data."""
    from .tune import load_best_params

    try:
        best_params = load_best_params()
    except FileNotFoundError:
        best_params = {}

    pipeline = load_finetuned_pipeline(
        segmentation_model_path=segmentation_model_path,
        hf_token=hf_token,
        device=device,
        best_params=best_params,
    )

    # Run on all training files
    train_ids = get_train_ids()
    predictions = {}

    pp_params = {
        "min_segment_duration": best_params.get("pp_min_segment_duration", 0.3),
        "max_merge_gap": best_params.get("pp_max_merge_gap", 0.5),
        "max_interruption": best_params.get("pp_max_interruption", 0.5),
    }

    print("\n--- Evaluating fine-tuned model ---")
    for i, fid in enumerate(train_ids):
        audio_path = get_audio_path(fid)
        t0 = time.time()
        annotation = pipeline(str(audio_path))
        annotation.uri = fid
        annotation = postprocess(annotation, **pp_params)
        elapsed = time.time() - t0
        n_spk = len(set(annotation.labels()))
        print(f"  [{i+1}/{len(train_ids)}] {fid}: {n_spk} speakers, {elapsed:.1f}s")
        predictions[fid] = annotation

    results = evaluate_all(predictions, verbose=True)
    return results


if __name__ == "__main__":
    finetune_segmentation()
