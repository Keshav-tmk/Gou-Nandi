"""Hardware-Compatible Cow Activity Anomaly Detection Pipeline.

Trains an unsupervised Isolation Forest anomaly detector on baseline normal grazing
activity using the exact same 72 hardware-compatible features as the behaviour classifier.

Flags unusual physical movement patterns that deviate significantly from reference grazing.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import sys
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.ai.feature_extraction import (
    FEATURE_NAMES,
    FEATURE_COUNT,
    PHYSICAL_CHANNELS,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("train_anomaly")

PROCESSED_DATA_PATH = ROOT / "data" / "processed" / "hardware_behaviour_features.csv"
MODELS_DIR = ROOT / "models" / "hardware_compatible"
OUTPUTS_DIR = ROOT / "outputs" / "hardware_compatible"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)


def train_hardware_anomaly_model() -> Dict[str, Any]:
    """Train and evaluate the hardware-compatible Isolation Forest anomaly detector."""
    if not PROCESSED_DATA_PATH.exists():
        raise FileNotFoundError(
            f"Feature dataset missing: {PROCESSED_DATA_PATH}. Run train_behaviour.py first."
        )

    df = pd.read_csv(PROCESSED_DATA_PATH)
    logger.info("Loaded dataset with %d observations and %d columns.", len(df), df.shape[1])

    # Select grazing observations as the reference baseline of regular daily activity
    grazing_mask = df["label"].astype(str).str.strip().str.lower() == "grazing"
    grazing_df = df[grazing_mask].copy()

    logger.info("Reference baseline (grazing) observations: %d", len(grazing_df))
    logger.info("Other activity observations (for anomaly evaluation): %d", len(df) - len(grazing_df))

    X_ref = grazing_df[FEATURE_NAMES].replace([np.inf, -np.inf], np.nan)
    X_all = df[FEATURE_NAMES].replace([np.inf, -np.inf], np.nan)

    # Build Pipeline: Imputation -> Scaling -> Isolation Forest
    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("detector", IsolationForest(
            n_estimators=200,
            contamination=0.05,  # 5% nominal expected outliers in reference data
            random_state=42,
            n_jobs=-1,
        )),
    ])

    logger.info("Fitting Isolation Forest on %d baseline observations (72 features)...", len(X_ref))
    pipeline.fit(X_ref)

    # Score reference and full datasets
    ref_preds = pipeline.predict(X_ref)  # +1 inlier, -1 outlier
    ref_scores = pipeline.decision_function(X_ref)

    all_preds = pipeline.predict(X_all)
    all_scores = pipeline.decision_function(X_all)

    # Outlier statistics
    ref_anomaly_rate = float(np.mean(ref_preds == -1))
    all_anomaly_rate = float(np.mean(all_preds == -1))

    logger.info("Reference baseline anomaly rate: %.2f%%", ref_anomaly_rate * 100)
    logger.info("Full dataset anomaly rate:        %.2f%%", all_anomaly_rate * 100)

    # Breakdown by behaviour label
    df_eval = df[["label", "source_file"]].copy()
    df_eval["anomaly_detected"] = all_preds == -1
    df_eval["anomaly_score"] = all_scores

    breakdown = {}
    for label, group in df_eval.groupby("label"):
        flagged = int(group["anomaly_detected"].sum())
        total = int(len(group))
        rate = round(flagged / max(total, 1), 4)
        breakdown[str(label)] = {
            "total_samples": total,
            "anomalies_flagged": flagged,
            "anomaly_rate": rate,
            "mean_score": round(float(group["anomaly_score"].mean()), 4),
        }
        logger.info("  Class '%s': %d/%d flagged (%.1f%%)", label, flagged, total, rate * 100)

    summary = {
        "model_id": "cow_activity_hardware_iforest",
        "version": "1.0.0",
        "model_type": "IsolationForest",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_feature_count": FEATURE_COUNT,
        "feature_names": FEATURE_NAMES,
        "reference_baseline_class": "grazing",
        "reference_observations": len(X_ref),
        "total_evaluated_observations": len(X_all),
        "reference_anomaly_rate": round(ref_anomaly_rate, 4),
        "total_anomaly_rate": round(all_anomaly_rate, 4),
        "class_breakdown": breakdown,
        "score_interpretation": "Negative scores indicate unusual sensor dynamics relative to the grazing baseline. Anomaly flags indicate deviations from routine motion, not a veterinary disease diagnosis.",
    }

    # Save summary and candidate table
    summary_path = OUTPUTS_DIR / "anomaly_evaluation_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    df_eval.to_csv(OUTPUTS_DIR / "anomaly_predictions.csv", index=False)
    logger.info("Saved anomaly evaluation summary to %s", summary_path)

    # Save complete bundle
    bundle = {
        "pipeline": pipeline,
        "feature_columns": FEATURE_NAMES,
        "reference_label": "grazing",
        "metadata": summary,
    }
    model_save_path = MODELS_DIR / "cow_activity_hardware_iforest.joblib"
    joblib.dump(bundle, model_save_path)
    logger.info("Serialized anomaly model bundle to %s", model_save_path)

    return summary


if __name__ == "__main__":
    train_hardware_anomaly_model()
