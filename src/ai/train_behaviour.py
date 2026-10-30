"""Hardware-Compatible Cow Behaviour Model Training Pipeline.

Trains a leakage-resistant Random Forest behaviour classifier using strictly the
6 physical sensor channels available on the ESP32 collar hardware (accel_x, accel_y,
accel_z, gyro_x, gyro_y, gyro_z).

Uses GroupShuffleSplit grouped by recording source file so that test windows come
from entirely separate recordings, preventing cross-window temporal data leakage.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import re
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.ai.feature_extraction import (
    HardwareFeatureExtractor,
    FEATURE_NAMES,
    FEATURE_COUNT,
    PHYSICAL_CHANNELS,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("train_behaviour")

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "external" / "db-cow-mounts"
PROCESSED_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models" / "hardware_compatible"
OUTPUTS_DIR = ROOT / "outputs" / "hardware_compatible"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

WINDOW_SAMPLES = 70  # 7 seconds at 10 Hz
MIN_SAMPLES = 20     # Minimum viable window size

BEHAVIOUR_MAP: Dict[str, str] = {
    "active mount": "active_mount",
    "active_mount": "active_mount",
    "grazing": "grazing",
    "head nodding": "head_nodding",
    "head_nodding": "head_nodding",
    "resting": "resting",
    "walking": "walking",
}


def label_from_file_path(path: Path) -> str:
    """Infer ground truth behaviour from directory naming structure."""
    for part in reversed(path.parts):
        norm = part.lower().replace("_", " ").strip()
        if norm in BEHAVIOUR_MAP:
            return BEHAVIOUR_MAP[norm]
    return "unknown"


def extract_windows_from_csv(
    file_path: Path,
    extractor: HardwareFeatureExtractor,
) -> Tuple[List[Dict[str, Any]], str]:
    """Read a raw CSV file and extract feature rows for each non-overlapping window."""
    label = label_from_file_path(file_path)
    if label == "unknown":
        return [], "unknown_label"

    try:
        df = pd.read_csv(file_path, low_memory=False)
    except Exception as exc:
        return [], f"read_error: {exc}"

    if len(df) < MIN_SAMPLES:
        return [], "too_few_rows"

    # Identify accelerometer and gyroscope columns
    # Prefer body-frame MPU9250 (direct match for MPU-6050 6-DOF IMU)
    col_mapping = {}
    lower_cols = {str(c).lower(): c for c in df.columns}

    # Accel X, Y, Z
    for axis in ("x", "y", "z"):
        candidates = [
            f"mpu9250_a{axis}_body",
            f"mpu9250_a{axis}",
            f"bno055_a{axis}_body",
            f"bno055_a{axis}",
            f"accel_{axis}",
            f"acc_{axis}",
        ]
        found = None
        for cand in candidates:
            if cand in lower_cols:
                found = lower_cols[cand]
                break
        if found:
            col_mapping[f"accel_{axis}"] = found

    # Gyro X, Y, Z
    for axis in ("x", "y", "z"):
        candidates = [
            f"mpu9250_g{axis}",
            f"bno055_g{axis}",
            f"gyro_{axis}",
            f"gir_{axis}",
        ]
        found = None
        for cand in candidates:
            if cand in lower_cols:
                found = lower_cols[cand]
                break
        if found:
            col_mapping[f"gyro_{axis}"] = found

    required_keys = ("accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z")
    if any(k not in col_mapping for k in required_keys):
        return [], "missing_required_channels"

    # Standardize column names for the segment
    sensor_df = pd.DataFrame()
    for standard_name, raw_name in col_mapping.items():
        sensor_df[standard_name] = pd.to_numeric(df[raw_name], errors="coerce")

    # Time column if available
    time_col = None
    for cand in ("time", "timestamp", "date"):
        if cand in lower_cols:
            time_col = lower_cols[cand]
            break
    if time_col is not None:
        sensor_df["timestamp"] = df[time_col].astype(str)

    sensor_df = sensor_df.dropna(subset=list(required_keys))
    if len(sensor_df) < MIN_SAMPLES:
        return [], "too_few_finite_rows"

    rows: List[Dict[str, Any]] = []
    rel_path = str(file_path.relative_to(ROOT))

    # Slice into sequential non-overlapping windows
    window_idx = 0
    for start in range(0, len(sensor_df), WINDOW_SAMPLES):
        segment = sensor_df.iloc[start : start + WINDOW_SAMPLES]
        if len(segment) < MIN_SAMPLES:
            continue

        readings_list = segment.to_dict(orient="records")
        res = extractor.extract_features(readings_list)
        if not res.is_valid:
            continue

        item = dict(res.features)
        item["label"] = label
        item["source_file"] = rel_path
        item["window_idx"] = window_idx
        item["window_samples"] = len(segment)
        rows.append(item)
        window_idx += 1

    return rows, "success"


def build_hardware_dataset() -> pd.DataFrame:
    """Build or load the hardware-compatible feature dataset from raw CSV files."""
    cache_file = PROCESSED_DIR / "hardware_behaviour_features.csv"
    if cache_file.exists():
        logger.info("Loading cached hardware feature dataset: %s", cache_file)
        df = pd.read_csv(cache_file)
        if len(df) > 100 and all(f in df.columns for f in FEATURE_NAMES):
            return df
        logger.info("Cached dataset incomplete or outdated; rebuilding...")

    logger.info("Extracting features from raw recordings in %s...", DATA_DIR)
    extractor = HardwareFeatureExtractor(min_samples=MIN_SAMPLES, normalize_acceleration_to_g=True)

    csv_files = sorted(DATA_DIR.rglob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV recordings found in {DATA_DIR}")

    all_rows: List[Dict[str, Any]] = []
    skipped: List[Tuple[str, str]] = []

    for file_path in csv_files:
        rows, reason = extract_windows_from_csv(file_path, extractor)
        if rows:
            all_rows.extend(rows)
        else:
            skipped.append((str(file_path.name), reason))

    logger.info("Extracted %d windows across %d recordings (skipped %d).",
                len(all_rows), len(csv_files) - len(skipped), len(skipped))

    df = pd.DataFrame(all_rows)
    df.to_csv(cache_file, index=False)
    logger.info("Saved hardware feature dataset to %s", cache_file)
    return df


def train_hardware_behaviour_model() -> Dict[str, Any]:
    """Train, validate, and serialize the hardware-compatible behaviour classifier."""
    df = build_hardware_dataset()
    logger.info("Dataset shape: %s", df.shape)

    # Filter valid labelled rows
    df = df[df["label"].notna() & df["source_file"].notna()].copy()
    label_counts = df["label"].value_counts().to_dict()
    logger.info("Class distribution in full dataset:\n%s", pd.Series(label_counts).to_string())

    classes = sorted(label_counts.keys())
    if len(classes) < 2:
        raise ValueError(f"Need at least 2 behaviour classes, found {len(classes)}.")

    X = df[FEATURE_NAMES].replace([np.inf, -np.inf], np.nan)
    y = df["label"].astype(str)
    groups = df["source_file"].astype(str)

    # GroupShuffleSplit: 25% test, grouped strictly by source recording file
    gss = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups=groups))

    X_train, y_train = X.iloc[train_idx], y.iloc[train_idx]
    X_test, y_test = X.iloc[test_idx], y.iloc[test_idx]
    train_groups = set(groups.iloc[train_idx])
    test_groups = set(groups.iloc[test_idx])

    # Assert ZERO leakage between train and test recordings
    assert not (train_groups & test_groups), "CRITICAL: Source file overlap between train and test sets!"

    logger.info("Train rows: %d (%d source files) | Test rows: %d (%d source files)",
                len(X_train), len(train_groups), len(X_test), len(test_groups))

    # Construct robust pipeline with median imputer and balanced Random Forest
    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("classifier", RandomForestClassifier(
            n_estimators=300,
            max_depth=20,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=42,
            n_jobs=-1,
        )),
    ])

    logger.info("Fitting Random Forest pipeline on 72 hardware features...")
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_pred_proba = pipeline.predict_proba(X_test)

    # Evaluation metrics
    acc = float(accuracy_score(y_test, y_pred))
    macro_f1 = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
    report_dict = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_test, y_pred, labels=classes).tolist()

    logger.info("=" * 60)
    logger.info("TEST SET EVALUATION RESULTS (Held-Out Source Files)")
    logger.info("=" * 60)
    logger.info("Accuracy:    %.4f (%.2f%%)", acc, acc * 100)
    logger.info("Macro F1:    %.4f", macro_f1)
    logger.info("Weighted F1: %.4f", weighted_f1)
    logger.info("\nClassification Report:\n%s",
                classification_report(y_test, y_pred, zero_division=0))

    metrics_summary = {
        "model_id": "cow_behaviour_hardware_rf",
        "version": "1.0.0",
        "model_type": "RandomForestClassifier",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_feature_count": FEATURE_COUNT,
        "feature_names": FEATURE_NAMES,
        "classes": classes,
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "train_source_files": len(train_groups),
        "test_source_files": len(test_groups),
        "test_accuracy": acc,
        "test_macro_f1": macro_f1,
        "test_weighted_f1": weighted_f1,
        "per_class_metrics": report_dict,
        "confusion_matrix": cm,
        "confusion_matrix_labels": classes,
        "leakage_controls": "GroupShuffleSplit grouped by source recording file (test recordings completely unseen during training)",
        "sensor_channels": list(PHYSICAL_CHANNELS),
        "sampling_rate_hz": 10.0,
        "window_duration_seconds": 7.0,
    }

    # Save summary report and predictions
    summary_path = OUTPUTS_DIR / "behaviour_evaluation_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)
    logger.info("Saved evaluation summary to %s", summary_path)

    test_preds_df = pd.DataFrame({
        "source_file": groups.iloc[test_idx].values,
        "actual_label": y_test.values,
        "predicted_label": y_pred,
    })
    for i, cls in enumerate(pipeline.named_steps["classifier"].classes_):
        test_preds_df[f"prob_{cls}"] = y_pred_proba[:, i]
    test_preds_df.to_csv(OUTPUTS_DIR / "behaviour_test_predictions.csv", index=False)

    # Save complete model bundle
    bundle = {
        "pipeline": pipeline,
        "feature_columns": FEATURE_NAMES,
        "classes": classes,
        "metadata": metrics_summary,
    }
    model_save_path = MODELS_DIR / "cow_behaviour_hardware_rf.joblib"
    joblib.dump(bundle, model_save_path)
    logger.info("Serialized trained model bundle to %s", model_save_path)

    return metrics_summary


if __name__ == "__main__":
    train_hardware_behaviour_model()
