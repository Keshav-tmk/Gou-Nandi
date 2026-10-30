from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / "data" / "external"
OUT = ROOT / "outputs"
OUT.mkdir(parents=True, exist_ok=True)

def main():
    rows = []
    for path in EXT.rglob("*"):
        if not path.is_file() or path.name.startswith("~$"):
            continue
        suffix = path.suffix.lower()
        if suffix not in {".csv", ".xlsx", ".xls"}:
            continue
        try:
            if suffix == ".csv":
                df = pd.read_csv(path, nrows=8, low_memory=False)
            else:
                df = pd.read_excel(path, nrows=8)
            rows.append({
                "relative_path": str(path.relative_to(ROOT)),
                "extension": suffix,
                "preview_rows": len(df),
                "column_count": len(df.columns),
                "columns": " | ".join(str(c) for c in df.columns),
                "file_bytes": path.stat().st_size,
                "read_error": ""
            })
        except Exception as exc:
            rows.append({
                "relative_path": str(path.relative_to(ROOT)),
                "extension": suffix,
                "preview_rows": "",
                "column_count": "",
                "columns": "",
                "file_bytes": path.stat().st_size,
                "read_error": str(exc)
            })
    inventory = pd.DataFrame(rows)
    destination = OUT / "dataset_inventory.csv"
    inventory.to_csv(destination, index=False)
    print(f"Inspected {len(rows)} CSV/XLS/XLSX files.")
    print(f"Inventory saved to: {destination}")
    if not inventory.empty:
        print("\nFirst 20 entries:")
        print(inventory[["relative_path", "column_count", "columns", "read_error"]].head(20).to_string(index=False))
    else:
        print("No tabular files found. Run 01_download_datasets.py first.")

if __name__ == "__main__":
    main()
