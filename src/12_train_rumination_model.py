"""
Train rumination and broad-behaviour Random Forest models from the cleaned
public cattle sensor dataset.

Expected input:
  data/raw/rumination_dataset_cleaned.csv

Outputs:
  models/rumination_classifier_bundle.joblib
  outputs/rumination_binary_evaluation_report.csv
  outputs/rumination_multiclass_evaluation_report.csv
  outputs/rumination_training_summary.json
  outputs/rumination_multiclass_feature_importance.csv
  outputs/rumination_segment_features.csv
"""
import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split

SENSOR_COLUMNS = [
    "acc_x", "acc_y", "acc_z",
    "mag_x", "mag_y", "mag_z",
    "gir_x", "gir_y", "gir_z",
    "displacement_speed", "any_saturated",
]
STATISTICS = ["mean", "std", "min", "max", "median", "range", "abs_diff_mean", "diff_std"]


def aggregate_segment(group):
    result = {}
    for col in SENSOR_COLUMNS:
        values = pd.to_numeric(group[col], errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
        if values.empty:
            values = pd.Series([0.0])
        arr = values.to_numpy(dtype=float)
        diff = np.diff(arr)
        result[f"{col}__mean"] = float(np.mean(arr))
        result[f"{col}__std"] = float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0
        result[f"{col}__min"] = float(np.min(arr))
        result[f"{col}__max"] = float(np.max(arr))
        result[f"{col}__median"] = float(np.median(arr))
        result[f"{col}__range"] = float(np.max(arr) - np.min(arr))
        result[f"{col}__abs_diff_mean"] = float(np.mean(np.abs(diff))) if len(diff) else 0.0
        result[f"{col}__diff_std"] = float(np.std(diff, ddof=1)) if len(diff) > 1 else 0.0
    return pd.Series(result)


def build_segment_table(raw):
    required = set(SENSOR_COLUMNS + ["segment_id", "is_rumination", "behaviour_group"])
    missing = sorted(required - set(raw.columns))
    if missing:
        raise ValueError("Dataset is missing required columns: " + ", ".join(missing))

    data = raw.copy()
    for col in SENSOR_COLUMNS:
        data[col] = pd.to_numeric(data[col], errors="coerce")
    data[SENSOR_COLUMNS] = data[SENSOR_COLUMNS].replace([np.inf, -np.inf], np.nan)
    data[SENSOR_COLUMNS] = data[SENSOR_COLUMNS].fillna(data[SENSOR_COLUMNS].median()).fillna(0)

    # Segment-level labels should be consistent. Drop segments with conflicting labels.
    rows = []
    for segment_id, group in data.groupby("segment_id", sort=False):
        binary_labels = pd.to_numeric(group["is_rumination"], errors="coerce").dropna().unique()
        multiclass_labels = group["behaviour_group"].dropna().astype(str).str.lower().unique()
        if len(binary_labels) != 1 or len(multiclass_labels) != 1:
            continue
        if multiclass_labels[0] not in {"grazing", "resting", "ruminating", "walking"}:
            continue
        features = aggregate_segment(group).to_dict()
        features["segment_id"] = str(segment_id)
        features["is_rumination"] = int(binary_labels[0])
        features["behaviour_group"] = str(multiclass_labels[0])
        rows.append(features)

    result = pd.DataFrame(rows)
    if result.empty:
        raise ValueError("No valid segments found after checking labels.")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/raw/rumination_dataset_cleaned.csv")
    parser.add_argument("--test-size", type=float, default=0.25)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()

    root = Path.cwd()
    input_path = (root / args.input).resolve()
    models_dir = root / "models"
    outputs_dir = root / "outputs"
    models_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        raise FileNotFoundError(
            f"Dataset not found: {input_path}\n"
            "Place rumination_dataset_cleaned.csv in data/raw or pass --input with its path."
        )

    raw = pd.read_csv(input_path)
    segments = build_segment_table(raw)
    feature_columns = [c for c in segments.columns if c not in {"segment_id", "is_rumination", "behaviour_group"}]
    X = segments[feature_columns]
    y_binary = segments["is_rumination"].astype(int)
    y_multi = segments["behaviour_group"].astype(str)

    # One split shared by both targets; each segment occurs in only one side.
    stratify_key = y_multi
    counts = stratify_key.value_counts()
    if counts.min() < 2:
        stratify_key = y_binary if y_binary.value_counts().min() >= 2 else None

    train_idx, test_idx = train_test_split(
        np.arange(len(segments)),
        test_size=args.test_size,
        random_state=args.random_state,
        stratify=stratify_key,
    )
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    yb_train, yb_test = y_binary.iloc[train_idx], y_binary.iloc[test_idx]
    ym_train, ym_test = y_multi.iloc[train_idx], y_multi.iloc[test_idx]

    binary_model = RandomForestClassifier(
        n_estimators=400, class_weight="balanced_subsample",
        random_state=args.random_state, n_jobs=-1, min_samples_leaf=1
    )
    multiclass_model = RandomForestClassifier(
        n_estimators=400, class_weight="balanced_subsample",
        random_state=args.random_state, n_jobs=-1, min_samples_leaf=1
    )
    binary_model.fit(X_train, yb_train)
    multiclass_model.fit(X_train, ym_train)

    binary_pred = binary_model.predict(X_test)
    multi_pred = multiclass_model.predict(X_test)

    binary_report = classification_report(
        yb_test, binary_pred, labels=[0, 1],
        target_names=["not_rumination", "rumination"], output_dict=True, zero_division=0
    )
    multi_labels = ["grazing", "resting", "ruminating", "walking"]
    multi_report = classification_report(
        ym_test, multi_pred, labels=multi_labels,
        output_dict=True, zero_division=0
    )
    pd.DataFrame(binary_report).transpose().to_csv(outputs_dir / "rumination_binary_evaluation_report.csv")
    pd.DataFrame(multi_report).transpose().to_csv(outputs_dir / "rumination_multiclass_evaluation_report.csv")

    binary_cm = confusion_matrix(yb_test, binary_pred, labels=[0, 1]).tolist()
    multi_cm = confusion_matrix(ym_test, multi_pred, labels=multi_labels).tolist()

    # Refit models on all available segments for use by the API.
    binary_model.fit(X, y_binary)
    multiclass_model.fit(X, y_multi)

    bundle = {
        "binary_model": binary_model,
        "multiclass_model": multiclass_model,
        "feature_columns": feature_columns,
        "sensor_columns": SENSOR_COLUMNS,
        "aggregation_statistics": STATISTICS,
        "binary_classes": {0: "not_rumination", 1: "rumination"},
        "multiclass_classes": list(multiclass_model.classes_),
        "training_rows": int(len(raw)),
        "training_segments": int(len(segments)),
        "source_dataset": str(input_path),
        "notes": (
            "Research prototype trained on a public dataset. Evaluation uses a random "
            "segment-level holdout, not animal-held-out or real-farm validation. "
            "A rumination prediction is not a veterinary diagnosis."
        ),
    }
    joblib.dump(bundle, models_dir / "rumination_classifier_bundle.joblib")

    importance = pd.DataFrame({
        "feature": feature_columns,
        "importance": multiclass_model.feature_importances_,
    }).sort_values("importance", ascending=False)
    importance.to_csv(outputs_dir / "rumination_multiclass_feature_importance.csv", index=False)
    segments.to_csv(outputs_dir / "rumination_segment_features.csv", index=False)

    summary = {
        "input_file": str(input_path),
        "raw_rows": int(len(raw)),
        "valid_segments": int(len(segments)),
        "feature_count": len(feature_columns),
        "train_segments": int(len(train_idx)),
        "test_segments": int(len(test_idx)),
        "binary_accuracy": float(accuracy_score(yb_test, binary_pred)),
        "binary_macro_f1": float(f1_score(yb_test, binary_pred, average="macro", zero_division=0)),
        "binary_classification_report": binary_report,
        "binary_confusion_matrix_labels_0_1": binary_cm,
        "multiclass_accuracy": float(accuracy_score(ym_test, multi_pred)),
        "multiclass_macro_f1": float(f1_score(ym_test, multi_pred, average="macro", zero_division=0)),
        "multiclass_classification_report": multi_report,
        "multiclass_confusion_matrix_labels_grazing_resting_ruminating_walking": multi_cm,
        "warning": "Public dataset segment-level evaluation only; not real-farm validation.",
    }
    (outputs_dir / "rumination_training_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )

    print("\nRumination model training completed.")
    print(f"Raw rows: {len(raw)}")
    print(f"Valid segments: {len(segments)}")
    print(f"Features: {len(feature_columns)}")
    print(f"Binary rumination accuracy: {summary['binary_accuracy']:.2%}")
    print(f"Binary rumination macro F1: {summary['binary_macro_f1']:.2%}")
    print(f"Multiclass behaviour accuracy: {summary['multiclass_accuracy']:.2%}")
    print(f"Multiclass behaviour macro F1: {summary['multiclass_macro_f1']:.2%}")
    print(f"Model: {models_dir / 'rumination_classifier_bundle.joblib'}")
    print(f"Reports: {outputs_dir}")


if __name__ == "__main__":
    main()
