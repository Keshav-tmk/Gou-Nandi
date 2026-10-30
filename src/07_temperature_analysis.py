from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "raw" / "temperature.csv"
OUT = ROOT / "outputs"
OUT.mkdir(parents=True, exist_ok=True)

# Exploratory data-quality/trend parameters, NOT veterinary thresholds.
ROLLING_WINDOW = 12
ROBUST_Z_THRESHOLD = 4.0
MAX_ABSOLUTE_CHANGE_C = 1.0

def main():
    if not INPUT.exists():
        raise SystemExit(
            f"Temperature file not found: {INPUT}\n"
            "Create it with columns timestamp,temperature_c. Use real sensor data, not the example values in README."
        )
    df = pd.read_csv(INPUT)
    needed = {"timestamp", "temperature_c"}
    if not needed.issubset(df.columns):
        raise SystemExit(f"Expected columns {sorted(needed)}; found {list(df.columns)}")
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
    df["temperature_c"] = pd.to_numeric(df["temperature_c"], errors="coerce")
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["data_quality_status"] = "ok"
    df.loc[df["timestamp"].isna() | df["temperature_c"].isna(), "data_quality_status"] = "invalid_timestamp_or_value"
    # Broad sensor sanity limits only; review against the sensor's actual operating range.
    df.loc[~df["temperature_c"].between(-20, 100), "data_quality_status"] = "possible_sensor_error_out_of_broad_range"
    df["change_c"] = df["temperature_c"].diff()
    prior = df["temperature_c"].shift(1)
    med = prior.rolling(ROLLING_WINDOW, min_periods=ROLLING_WINDOW).median()
    mad = prior.rolling(ROLLING_WINDOW, min_periods=ROLLING_WINDOW).apply(
        lambda x: np.median(np.abs(x - np.median(x))), raw=True
    )
    scale = 1.4826 * mad
    df["previous_readings_median_c"] = med
    df["robust_z"] = (df["temperature_c"] - med) / scale.replace(0, np.nan)
    df["unusual_change_flag"] = (
        (df["robust_z"].abs() >= ROBUST_Z_THRESHOLD) |
        (df["change_c"].abs() >= MAX_ABSOLUTE_CHANGE_C)
    )
    df["interpretation"] = "monitoring_only_not_diagnosis"
    dest = OUT / "temperature_analysis.csv"
    df.to_csv(dest, index=False)
    print(f"Rows analyzed: {len(df)}")
    print(f"Invalid/broad-range sensor warnings: {(df['data_quality_status'] != 'ok').sum()}")
    print(f"Unusual change flags: {df['unusual_change_flag'].fillna(False).sum()}")
    print(f"Output: {dest}")
    print("Note: DS18B20 contact/external temperature is not automatically core body temperature.")

if __name__ == "__main__":
    main()
