import json
import pandas as pd
import requests

DATASET = "data/raw/rumination_dataset_cleaned.csv"
API_URL = "http://127.0.0.1:8000/predict/rumination"

sensor_columns = [
    "acc_x", "acc_y", "acc_z",
    "mag_x", "mag_y", "mag_z",
    "gir_x", "gir_y", "gir_z",
    "displacement_speed", "any_saturated"
]

df = pd.read_csv(DATASET)

required = sensor_columns + [
    "segment_id", "is_rumination", "behaviour_group"
]
missing = sorted(set(required) - set(df.columns))

if missing:
    raise ValueError(f"Missing dataset columns: {missing}")

# Choose the first segment with consistent labels and at least two readings.
selected = None

for segment_id, group in df.groupby("segment_id", sort=False):
    binary_labels = pd.to_numeric(
        group["is_rumination"], errors="coerce"
    ).dropna().unique()

    behaviour_labels = (
        group["behaviour_group"].dropna().astype(str).str.lower().unique()
    )

    if (
        len(group) >= 2
        and len(binary_labels) == 1
        and len(behaviour_labels) == 1
        and behaviour_labels[0] in {
            "grazing", "resting", "ruminating", "walking"
        }
    ):
        selected = (segment_id, group.copy(), int(binary_labels[0]),
                    behaviour_labels[0])
        break

if selected is None:
    raise ValueError("No suitable segment found.")

segment_id, group, true_binary, true_behaviour = selected

# Send the original sensor readings from this segment to the API.
readings_df = group[sensor_columns].copy()

for col in sensor_columns:
    readings_df[col] = pd.to_numeric(readings_df[col], errors="coerce")

readings_df = readings_df.replace([float("inf"), float("-inf")], float("nan"))
readings_df = readings_df.dropna()

if len(readings_df) < 2:
    raise ValueError("Selected segment has fewer than two valid sensor readings.")

payload = {
    "readings": readings_df.to_dict(orient="records")
}

print(f"Segment ID: {segment_id}")
print(f"Valid sensor readings sent: {len(readings_df)}")
print(f"Dataset rumination label: {'rumination' if true_binary == 1 else 'not_rumination'}")
print(f"Dataset broad behaviour label: {true_behaviour}")
print("\nSending readings to API...")

try:
    response = requests.post(API_URL, json=payload, timeout=60)
    print(f"\nHTTP status: {response.status_code}")
    response.raise_for_status()
    result = response.json()

    print("\nAPI prediction:")
    print(json.dumps(result, indent=2))

    predicted_binary = result["rumination_class"]
    predicted_behaviour = result["predicted_behaviour"]

    expected_binary = "rumination" if true_binary == 1 else "not_rumination"

    print("\nComparison with dataset labels:")
    print(f"Binary rumination match: {predicted_binary == expected_binary}")
    print(f"Broad behaviour match: {predicted_behaviour == true_behaviour}")

except requests.RequestException as exc:
    print(f"API request failed: {exc}")
    if getattr(exc, "response", None) is not None:
        print(exc.response.text)
