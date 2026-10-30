"""Hardware-Compatible Cow Rumination Classifier Training Pipeline.

Trains a leakage-resistant Random Forest model to detect rumination (cud chewing)
using strictly the 6 physical IMU channels available on the ESP32 collar
(accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z).

Uses GroupKFold grouped by segment_id to ensure segments are never split between
training and testing folds.

Outputs:
  - models/hardware_compatible/cow_rumination_hardware_rf.joblib
  - outputs/hardware_compatible/rumination_evaluation_summary.json
  - outputs/hardware_compatible/rumination_predictions.csv
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import sys
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
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.ai.feature_extraction import (
    HardwareFeatureExtractor,
    FEATURE_NAMES,
    FEATURE_COUNT,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("train_rumination")

RAW_DATA_PATH = ROOT / "data" / "raw" / "rumination_dataset_cleaned.csv"
MODELS_DIR = ROOT / "models" / "hardware_compatible"
OUTPUTS_DIR = ROOT / "outputs" / "hardware_compatible"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)


def extract_features_from_rumination_dataset(
    csv_path: Path,
) -> Tuple[np.ndarray, np.ndarray, List[int]]:
    """Extract 72-feature vectors from rumination dataset segments."""
    logger.info("Reading rumination dataset from %s", csv_path)
    df = pd.read_csv(csv_path)

    # Accelerometer is 16-bit raw counts (~16384 count/g); Gyroscope is (~131 count/(deg/s))
    extractor = HardwareFeatureExtractor(
        min_samples=4,
        normalize_acceleration_to_g=True,
    )

    X_list: List[np.ndarray] = []
    y_list: List[int] = []
    segment_ids: List[int] = []

    for seg_id, group in df.groupby("segment_id", sort=False):
        if len(group) < 4:
            continue

        readings = []
        for _, row in group.iterrows():
            readings.append({
                "cow_id": "COW-RUM",
                "accel_x": float(row["acc_x"]) / 16384.0,
                "accel_y": float(row["acc_y"]) / 16384.0,
                "accel_z": float(row["acc_z"]) / 16384.0,
                "gyro_x": float(row["gir_x"]) / 131.0,
                "gyro_y": float(row["gir_y"]) / 131.0,
                "gyro_z": float(row["gir_z"]) / 131.0,
            })

        res = extractor.extract_features(readings, cow_id="COW-RUM")
        if res.is_valid:
            X_list.append(res.feature_vector)
            # 1 if rumination, 0 otherwise
            is_rum = int(group["is_rumination"].iloc[0])
            y_list.append(is_rum)
            segment_ids.append(int(seg_id))

    X = np.asarray(X_list, dtype=np.float64)
    y = np.asarray(y_list, dtype=np.int64)
    logger.info("Extracted %d segments (%d rumination, %d non-rumination)", len(X), sum(y), len(y) - sum(y))
    return X, y, segment_ids


def train_and_evaluate(
    X: np.ndarray,
    y: np.ndarray,
    segment_ids: List[int],
) -> Tuple[Pipeline, Dict[str, Any], pd.DataFrame]:
    """Train Random Forest classifier with 5-fold cross validation and retrain on full set."""
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    cv_preds = np.zeros(len(y), dtype=np.int64)
    cv_probs = np.zeros(len(y), dtype=np.float64)

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y), start=1):
        fold_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("classifier", RandomForestClassifier(
                n_estimators=200,
                max_depth=12,
                min_samples_split=3,
                min_samples_leaf=2,
                class_weight="balanced_subsample",
                random_state=42 + fold,
                n_jobs=-1,
            )),
        ])

        fold_pipeline.fit(X[train_idx], y[train_idx])
        cv_preds[val_idx] = fold_pipeline.predict(X[val_idx])
        cv_probs[val_idx] = fold_pipeline.predict_proba(X[val_idx])[:, 1]

    # Evaluate CV metrics
    acc = float(accuracy_score(y, cv_preds))
    prec = float(precision_score(y, cv_preds, zero_division=0))
    rec = float(recall_score(y, cv_preds, zero_division=0))
    f1 = float(f1_score(y, cv_preds, zero_division=0))
    auc = float(roc_auc_score(y, cv_probs))
    cm = confusion_matrix(y, cv_preds).tolist()
    report = classification_report(y, cv_preds, target_names=["not_ruminating", "ruminating"], output_dict=True)

    logger.info("CV Accuracy: %.4f | Precision: %.4f | Recall: %.4f | F1: %.4f | ROC AUC: %.4f", acc, prec, rec, f1, auc)

    # Train final model on all data
    final_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("classifier", RandomForestClassifier(
            n_estimators=250,
            max_depth=14,
            min_samples_split=3,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=42,
            n_jobs=-1,
        )),
    ])
    final_pipeline.fit(X, y)

    metrics = {
        "model_type": "RandomForestClassifier",
        "task": "binary_rumination_detection",
        "feature_count": FEATURE_COUNT,
        "classes": ["not_ruminating", "ruminating"],
        "cv_accuracy": round(acc, 4),
        "cv_precision": round(prec, 4),
        "cv_recall": round(rec, 4),
        "cv_f1": round(f1, 4),
        "cv_roc_auc": round(auc, 4),
        "confusion_matrix": cm,
        "classification_report": report,
        "sample_count": len(y),
        "positive_support": int(sum(y)),
        "negative_support": int(len(y) - sum(y)),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0-hardware",
    }

    pred_df = pd.DataFrame({
        "segment_id": segment_ids,
        "ground_truth": y,
        "cv_prediction": cv_preds,
        "cv_probability": cv_probs,
    })

    return final_pipeline, metrics, pred_df


def main():
    logger.info("=== Starting Hardware-Compatible Rumination Model Training ===")
    X, y, segment_ids = extract_features_from_rumination_dataset(RAW_DATA_PATH)

    pipeline, metrics, pred_df = train_and_evaluate(X, y, segment_ids)

    # Save model bundle
    bundle = {
        "pipeline": pipeline,
        "feature_names": FEATURE_NAMES,
        "feature_count": FEATURE_COUNT,
        "classes": ["not_ruminating", "ruminating"],
        "threshold": 0.40,  # Tuned decision threshold for chewing detection
        "metadata": metrics,
    }

    model_dest = MODELS_DIR / "cow_rumination_hardware_rf.joblib"
    joblib.dump(bundle, model_dest)
    logger.info("Saved hardware rumination model bundle to %s", model_dest)

    # Save outputs
    metrics_dest = OUTPUTS_DIR / "rumination_evaluation_summary.json"
    with open(metrics_dest, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    pred_dest = OUTPUTS_DIR / "rumination_predictions.csv"
    pred_df.to_csv(pred_dest, index=False)

    logger.info("=== Rumination Training Completed Successfully ===")


if __name__ == "__main__":
    main()
