from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "external" / "CowScreeningDB"
OUT = ROOT / "outputs"
OUT.mkdir(parents=True, exist_ok=True)

def main():
    if not DATA.exists() or not any(DATA.rglob("*.csv")):
        raise SystemExit(
            "No CowScreeningDB CSVs found.\n"
            "The dataset has a license/password request process. Follow the official instructions at:\n"
            "https://github.com/Shahid-Ismail/CowScreeningDB-A-public-database-for-lameness-detection\n"
            "After authorized extraction, place CSV files in data/external/CowScreeningDB/."
        )
    rows = []
    for path in DATA.rglob("*.csv"):
        try:
            df = pd.read_csv(path, nrows=10, low_memory=False)
            parent = path.parent.name
            # Repository docs describe folder names like cowID_illnessLevel; do not assume beyond inspection.
            suffix = parent.rsplit("_", 1)[-1] if "_" in parent else ""
            rows.append({
                "relative_path": str(path.relative_to(ROOT)),
                "folder_name": parent,
                "possible_folder_label_suffix": suffix,
                "preview_rows": len(df),
                "columns": " | ".join(map(str, df.columns)),
                "numeric_columns": " | ".join(str(c) for c in df.columns if pd.api.types.is_numeric_dtype(df[c])),
                "bytes": path.stat().st_size
            })
        except Exception as exc:
            rows.append({"relative_path": str(path.relative_to(ROOT)), "folder_name": path.parent.name,
                         "possible_folder_label_suffix": "", "preview_rows": "", "columns": "",
                         "numeric_columns": "", "bytes": path.stat().st_size, "error": str(exc)})
    destination = OUT / "lameness_dataset_inventory.csv"
    pd.DataFrame(rows).to_csv(destination, index=False)
    print(f"Inspected {len(rows)} lameness CSV files.")
    print(f"Inventory: {destination}")
    print("Review sensor columns and label definitions before training; cow-level illness severity is not an event timestamp.")

if __name__ == "__main__":
    main()
