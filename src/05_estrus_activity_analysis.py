from pathlib import Path
import zipfile
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / "data" / "external" / "bovheat"
OUT = ROOT / "outputs"
OUT.mkdir(parents=True, exist_ok=True)

REQUIRED = ["Cow Number", "Date", "Time", "Activity Change", "Lactation Number", "Days in Lactation"]
MIN_BASELINE = 12          # exploratory: 12 prior records, not a validated clinical setting
ROBUST_Z_THRESHOLD = 3.5   # exploratory threshold; calibrate on independent labels

def extract_nested_zip_files():
    for zpath in list(EXT.rglob("*.zip")):
        if zpath.name.lower() == "data_zipped.zip":
            dest = zpath.parent / "example_data_extracted"
            if not dest.exists():
                dest.mkdir(parents=True, exist_ok=True)
                try:
                    with zipfile.ZipFile(zpath) as zf:
                        base = dest.resolve()
                        for member in zf.infolist():
                            target = (dest / member.filename).resolve()
                            if target != base and base not in target.parents:
                                continue
                        zf.extractall(dest)
                    print(f"Extracted BovHEAT example archive to {dest}")
                except Exception as exc:
                    print(f"Could not extract {zpath}: {exc}")

def read_workbook(path):
    try:
        sheets = pd.read_excel(path, sheet_name=None)
    except Exception:
        return []
    return list(sheets.items())

def main():
    if not EXT.exists():
        raise SystemExit("BovHEAT repository not found. Run python src/01_download_datasets.py first.")
    extract_nested_zip_files()
    files = list(EXT.rglob("*.xlsx")) + list(EXT.rglob("*.xls"))
    outputs = []
    workbooks_seen = 0
    for path in files:
        for sheet_name, df in read_workbook(path):
            if df.empty:
                continue
            # Match headers flexibly while preserving original columns.
            colmap = {str(c).strip().lower(): c for c in df.columns}
            missing = [c for c in REQUIRED if c.lower() not in colmap]
            if missing:
                continue
            workbooks_seen += 1
            cow = colmap["cow number"]
            date = colmap["date"]
            time = colmap["time"]
            activity = colmap["activity change"]
            lact = colmap["lactation number"]
            dim = colmap["days in lactation"]
            work = df[[cow, date, time, activity, lact, dim]].copy()
            work.columns = ["cow_id", "date", "time", "activity_change", "lactation_number", "days_in_lactation"]
            work["timestamp"] = pd.to_datetime(
                work["date"].astype(str).str.strip() + " " + work["time"].astype(str).str.strip(),
                errors="coerce"
            )
            work["activity_change"] = pd.to_numeric(work["activity_change"], errors="coerce")
            work = work.dropna(subset=["timestamp", "activity_change"])
            work = work.sort_values(["cow_id", "timestamp"])
            for cow_id, group in work.groupby("cow_id", dropna=False):
                group = group.copy().reset_index(drop=True)
                # Baseline uses only preceding readings to avoid future-data leakage.
                previous = group["activity_change"].shift(1)
                rolling_median = previous.rolling(MIN_BASELINE, min_periods=MIN_BASELINE).median()
                rolling_mad = previous.rolling(MIN_BASELINE, min_periods=MIN_BASELINE).apply(
                    lambda x: np.median(np.abs(x - np.median(x))), raw=True
                )
                robust_scale = 1.4826 * rolling_mad
                robust_z = (group["activity_change"] - rolling_median) / robust_scale.replace(0, np.nan)
                group["baseline_median_previous_records"] = rolling_median
                group["robust_z_previous_records"] = robust_z
                group["candidate_activity_deviation"] = (
                    (robust_z >= ROBUST_Z_THRESHOLD) &
                    (group["activity_change"] > rolling_median)
                )
                group["source_file"] = str(path.relative_to(ROOT))
                group["source_sheet"] = str(sheet_name)
                group["label_status"] = "unverified_activity_candidate_not_confirmed_estrus"
                outputs.append(group)
    if not outputs:
        raise SystemExit(
            "No workbook sheets with the six expected SCR columns were found.\n"
            "Run 02_inspect_datasets.py and inspect outputs/dataset_inventory.csv. "
            "The downloaded repo may not include the example archive, or headers may differ."
        )
    result = pd.concat(outputs, ignore_index=True)
    dest = OUT / "estrus_activity_candidates.csv"
    result.to_csv(dest, index=False)
    candidates = int(result["candidate_activity_deviation"].fillna(False).sum())
    print(f"Workbook sheets processed: {workbooks_seen}")
    print(f"Rows analyzed: {len(result)}")
    print(f"Candidate activity-deviation observations: {candidates}")
    print(f"Output: {dest}")
    print("WARNING: These are statistical activity candidates, not confirmed heat timestamps.")
    print("No precision/recall can be reported without independent, timestamped heat-event labels.")

if __name__ == "__main__":
    main()
