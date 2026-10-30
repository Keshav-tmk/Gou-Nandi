from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


# 1. Define project paths
ROOT = Path(__file__).resolve().parents[1]

INPUT_FILE = ROOT / "data" / "processed" / "mount_behaviour_features.csv"
OUTPUT_DIR = ROOT / "outputs"
MODEL_DIR = ROOT / "models"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)


# 2. Load the dataset
if not INPUT_FILE.exists():
    raise FileNotFoundError(
        f"Dataset not found: {INPUT_FILE}\n"
        "Run: python src/03_build_mount_features.py"
    )

df = pd.read_csv(INPUT_FILE)

if df.empty:
    raise ValueError("The input dataset is empty.")

# Your dataset uses 'label', not 'behaviour'
LABEL_COLUMN = "label"

if LABEL_COLUMN not in df.columns:
    raise ValueError(
        f"Label column '{LABEL_COLUMN}' not found. "
        f"Available columns: {df.columns.tolist()}"
    )


# 3. Select numeric sensor features
excluded_columns = {
    "label",
    "source_file",
    "file_name",
    "filename",
    "cow_id",
    "animal_id",
}

feature_columns = [
    column
    for column in df.select_dtypes(include=np.number).columns
    if column.lower() not in excluded_columns
]

if not feature_columns:
    raise ValueError("No numeric sensor features found.")


# 4. Select grazing observations as the provisional baseline
grazing_data = df[
    df[LABEL_COLUMN].astype(str).str.strip().str.lower() == "grazing"
].copy()

if len(grazing_data) < 10:
    raise ValueError(
        f"Only {len(grazing_data)} grazing rows found. "
        "At least 10 are required for this prototype."
    )

X_reference = grazing_data[feature_columns]
X_all = df[feature_columns]


# 5. Build the Isolation Forest pipeline
model = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
    ("detector", IsolationForest(
        n_estimators=200,
        contamination="auto",
        random_state=42
    ))
])


# 6. Train using grazing observations
model.fit(X_reference)


# 7. Detect unusual sensor patterns
predictions = model.predict(X_all)
scores = model.decision_function(X_all)

result = df.copy()

result["anomaly_flag"] = predictions == -1
result["anomaly_score"] = scores

result["interpretation"] = np.where(
    result["anomaly_flag"],
    "Unusual sensor pattern - review required",
    "No unusual pattern detected by the model"
)


# 8. Save anomaly results
output_file = OUTPUT_DIR / "abnormal_activity_candidates.csv"
result.to_csv(output_file, index=False)


# 9. Save the trained model and feature information
model_file = MODEL_DIR / "cow_activity_isolation_forest.joblib"

joblib.dump(
    {
        "model": model,
        "feature_columns": feature_columns,
        "reference_label": "grazing",
        "warning": (
            "Anomaly flags indicate unusual sensor patterns, "
            "not confirmed veterinary conditions."
        ),
    },
    model_file,
)


# 10. Save a summary report
summary = {
    "total_observations": int(len(result)),
    "grazing_reference_observations": int(len(grazing_data)),
    "number_of_sensor_features": int(len(feature_columns)),
    "anomaly_candidates": int(result["anomaly_flag"].sum()),
    "other_observations": int((~result["anomaly_flag"]).sum()),
    "input_file": str(INPUT_FILE),
    "results_file": str(output_file),
    "model_file": str(model_file),
    "warning": (
        "Anomaly candidates are unusual sensor patterns. "
        "They are not confirmed disease, lameness, or estrus diagnoses."
    ),
}

summary_file = OUTPUT_DIR / "abnormal_activity_summary.json"

with open(summary_file, "w", encoding="utf-8") as file:
    json.dump(summary, file, indent=4)


# 11. Display results
print("\nABNORMAL ACTIVITY DETECTION COMPLETED")
print("-------------------------------------")
print(f"Total observations: {len(result)}")
print(f"Grazing reference observations: {len(grazing_data)}")
print(f"Sensor features used: {len(feature_columns)}")
print(f"Anomaly candidates: {int(result['anomaly_flag'].sum())}")
print(f"Results saved to: {output_file}")
print(f"Summary saved to: {summary_file}")
print(f"Trained model saved to: {model_file}")
print("\nNote: Anomalies require review; they are not veterinary diagnoses.")