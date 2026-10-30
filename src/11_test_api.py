from pathlib import Path

import pandas as pd
import requests
import joblib

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "processed" / "mount_behaviour_features.csv"

BEHAVIOUR_MODEL_PATH = ROOT / "models" / "cow_behaviour_random_forest.joblib"
ANOMALY_MODEL_PATH = ROOT / "models" / "cow_activity_isolation_forest.joblib"

API = "http://127.0.0.1:8000"

# Check required files
for path in [DATA_PATH, BEHAVIOUR_MODEL_PATH, ANOMALY_MODEL_PATH]:
    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")

# Load actual processed public-dataset observations
data = pd.read_csv(DATA_PATH)

behaviour_bundle = joblib.load(BEHAVIOUR_MODEL_PATH)
anomaly_bundle = joblib.load(ANOMALY_MODEL_PATH)

behaviour_features = behaviour_bundle["feature_columns"]
anomaly_features = anomaly_bundle["feature_columns"]

# Select a row that contains the required features for both models.
common_features = set(behaviour_features) & set(anomaly_features)
available_features = common_features.intersection(data.columns)

if not set(behaviour_features).issubset(data.columns):
    missing = sorted(set(behaviour_features) - set(data.columns))
    raise ValueError(f"Behaviour features missing from dataset: {missing}")

if not set(anomaly_features).issubset(data.columns):
    missing = sorted(set(anomaly_features) - set(data.columns))
    raise ValueError(f"Anomaly features missing from dataset: {missing}")

# Select a row with finite numeric values for all required model features.
valid = data[behaviour_features + [
    feature for feature in anomaly_features
    if feature not in behaviour_features
]].apply(pd.to_numeric, errors="coerce")

valid = valid.dropna()
valid = valid.loc[
    valid.apply(lambda row: row.map(lambda value: pd.notna(value) and abs(value) != float("inf")).all(), axis=1)
]

if valid.empty:
    raise ValueError("No complete numeric row was found for both models.")

row = valid.iloc[0]

# Build the exact request payloads expected by each endpoint.
behaviour_payload = {
    "features": {
        feature: float(row[feature])
        for feature in behaviour_features
    }
}

anomaly_payload = {
    "features": {
        feature: float(row[feature])
        for feature in anomaly_features
    }
}

print("\n=== API HEALTH CHECK ===")
health = requests.get(f"{API}/health", timeout=10)
health.raise_for_status()
print(health.json())

print("\n=== RANDOM FOREST BEHAVIOUR PREDICTION ===")
response = requests.post(
    f"{API}/predict/behaviour",
    json=behaviour_payload,
    timeout=30,
)
print("HTTP status:", response.status_code)
print(response.text)
response.raise_for_status()

print("\n=== ISOLATION FOREST ANOMALY DETECTION ===")
response = requests.post(
    f"{API}/detect/anomaly",
    json=anomaly_payload,
    timeout=30,
)
print("HTTP status:", response.status_code)
print(response.text)
response.raise_for_status()

print("\nAPI TEST COMPLETED SUCCESSFULLY.")
print("Input came from the existing processed public dataset.")
print("This is not live sensor data or a real-farm validation.")
