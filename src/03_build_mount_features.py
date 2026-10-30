from pathlib import Path
import re
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "data" / "external" / "db-cow-mounts"
OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

WINDOW_SECONDS = 7
SAMPLING_HZ = 10
WINDOW_SAMPLES = WINDOW_SECONDS * SAMPLING_HZ
MIN_ROWS = 20

BEHAVIOUR_NAMES = {
    "active mount": "active_mount",
    "active_mount": "active_mount",
    "grazing": "grazing",
    "head nodding": "head_nodding",
    "head_nodding": "head_nodding",
    "resting": "resting",
    "walking": "walking",
}

def label_from_path(path: Path) -> str:
    for part in reversed(path.parts):
        norm = part.lower().replace("_", " ").strip()
        if norm in BEHAVIOUR_NAMES:
            return BEHAVIOUR_NAMES[norm]
    return "unknown"

def load_csv(path: Path) -> pd.DataFrame:
    # Standard CSV first; numeric coercion below handles non-numeric time columns.
    try:
        return pd.read_csv(path, low_memory=False)
    except Exception:
        return pd.read_csv(path, header=None, low_memory=False)

def numeric_sensor_columns(df: pd.DataFrame):
    chosen = []
    for col in df.columns:
        name = str(col).lower()
        if any(token in name for token in ["time", "date", "timestamp", "index", "unnamed"]):
            continue
        numeric = pd.to_numeric(df[col], errors="coerce")
        valid_fraction = numeric.notna().mean() if len(numeric) else 0
        if valid_fraction >= 0.80 and numeric.nunique(dropna=True) > 1:
            chosen.append(col)
    return chosen

def feature_row(segment: pd.DataFrame, columns, path: Path, label: str, window_no: int):
    row = {"label": label, "source_file": str(path.relative_to(ROOT)), "window_no": window_no}
    matrix = segment[columns].apply(pd.to_numeric, errors="coerce").replace([np.inf, -np.inf], np.nan)
    matrix = matrix.dropna(axis=1, how="all").interpolate(limit_direction="both")
    if matrix.empty or matrix.shape[1] == 0:
        return None
    for col in matrix.columns:
        values = matrix[col].dropna().to_numpy(dtype=float)
        if len(values) < MIN_ROWS:
            continue
        key = re.sub(r"[^a-zA-Z0-9]+", "_", str(col)).strip("_")[:50] or "sensor"
        row[f"{key}_mean"] = float(np.mean(values))
        row[f"{key}_std"] = float(np.std(values))
        row[f"{key}_min"] = float(np.min(values))
        row[f"{key}_max"] = float(np.max(values))
        row[f"{key}_range"] = float(np.max(values) - np.min(values))
        row[f"{key}_rms"] = float(np.sqrt(np.mean(values ** 2)))
        row[f"{key}_diff_std"] = float(np.std(np.diff(values))) if len(values) > 1 else 0.0
    if not any(k.endswith("_mean") for k in row):
        return None
    return row

def main():
    if not DATA_ROOT.exists():
        raise SystemExit(f"Dataset folder not found: {DATA_ROOT}\nRun python src/01_download_datasets.py first.")
    csv_files = list(DATA_ROOT.rglob("*.csv"))
    if not csv_files:
        raise SystemExit("No CSV files found under db-cow-mounts. Check dataset_inventory.csv and repository structure.")
    rows, skipped = [], []
    for path in csv_files:
        label = label_from_path(path)
        if label == "unknown":
            skipped.append((str(path), "could not infer behaviour from folder name"))
            continue
        try:
            df = load_csv(path)
            columns = numeric_sensor_columns(df)
            if not columns or len(df) < MIN_ROWS:
                skipped.append((str(path), "no usable numeric sensor columns or too few rows"))
                continue
            # Sliding non-overlapping windows; each source file remains a group during evaluation.
            window_no = 0
            for start in range(0, len(df), WINDOW_SAMPLES):
                segment = df.iloc[start:start + WINDOW_SAMPLES]
                if len(segment) < MIN_ROWS:
                    continue
                item = feature_row(segment, columns, path, label, window_no)
                if item:
                    rows.append(item)
                window_no += 1
        except Exception as exc:
            skipped.append((str(path), str(exc)))
    out_file = OUT / "mount_behaviour_features.csv"
    pd.DataFrame(rows).to_csv(out_file, index=False)
    skip_file = OUT / "mount_feature_skips.csv"
    pd.DataFrame(skipped, columns=["path", "reason"]).to_csv(skip_file, index=False)
    print(f"Feature rows created: {len(rows)}")
    print(f"Source CSV files inspected: {len(csv_files)}")
    print(f"Files skipped: {len(skipped)}")
    print(f"Features: {out_file}")
    if rows:
        print("\nWindow counts by behaviour:")
        print(pd.Series([r["label"] for r in rows]).value_counts().to_string())
    print(f"Skip log: {skip_file}")

if __name__ == "__main__":
    main()
