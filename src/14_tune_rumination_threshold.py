import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split

from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path.cwd()
DATA_PATH = ROOT / "data" / "raw" / "rumination_dataset_cleaned.csv"
OUTPUT_PATH = ROOT / "outputs" / "rumination_threshold_experiment.csv"

# Reuse the existing feature-building code.
spec = spec_from_file_location(
    "rumination_training",
    ROOT / "src" / "12_train_rumination_model.py",
)
training = module_from_spec(spec)
spec.loader.exec_module(training)

raw = pd.read_csv(DATA_PATH)
segments = training.build_segment_table(raw)

feature_columns = [
    col for col in segments.columns
    if col not in {"segment_id", "is_rumination", "behaviour_group"}
]

X = segments[feature_columns]
y = segments["is_rumination"].astype(int)
stratify = y if y.value_counts().min() >= 2 else None

train_idx, test_idx = train_test_split(
    np.arange(len(segments)),
    test_size=0.25,
    random_state=42,
    stratify=stratify,
)

# Split the training portion again to create a validation set.
fit_idx, val_idx = train_test_split(
    train_idx,
    test_size=0.25,
    random_state=123,
    stratify=y.iloc[train_idx],
)

model = RandomForestClassifier(
    n_estimators=400,
    class_weight="balanced_subsample",
    random_state=42,
    n_jobs=-1,
    min_samples_leaf=1,
)

model.fit(X.iloc[fit_idx], y.iloc[fit_idx])

# Choose a threshold using validation data, not the final test data.
positive_index = list(model.classes_).index(1)
val_prob = model.predict_proba(X.iloc[val_idx])[:, positive_index]
test_prob = model.predict_proba(X.iloc[test_idx])[:, positive_index]
y_val = y.iloc[val_idx].to_numpy()
y_test = y.iloc[test_idx].to_numpy()

thresholds = np.arange(0.20, 0.71, 0.05)
rows = []

for threshold in thresholds:
    val_pred = (val_prob >= threshold).astype(int)
    test_pred = (test_prob >= threshold).astype(int)

    rows.append({
        "threshold": round(float(threshold), 2),
        "validation_precision": precision_score(
            y_val, val_pred, zero_division=0
        ),
        "validation_recall": recall_score(
            y_val, val_pred, zero_division=0
        ),
        "validation_f1": f1_score(
            y_val, val_pred, zero_division=0
        ),
        "test_accuracy": accuracy_score(y_test, test_pred),
        "test_precision": precision_score(
            y_test, test_pred, zero_division=0
        ),
        "test_recall": recall_score(
            y_test, test_pred, zero_division=0
        ),
        "test_f1": f1_score(
            y_test, test_pred, zero_division=0
        ),
        "test_confusion_matrix": json.dumps(
            confusion_matrix(y_test, test_pred, labels=[0, 1]).tolist()
        ),
    })

results = pd.DataFrame(rows)
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
results.to_csv(OUTPUT_PATH, index=False)

print("\nRumination threshold experiment completed.")
print("The validation set is used to assess thresholds.")
print("Test results are diagnostic; do not select a threshold based on test scores.")
print("\nResults:")
print(results.to_string(index=False))
print(f"\nSaved results to: {OUTPUT_PATH}")