
from pathlib import Path
import json
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"
OUT.mkdir(parents=True, exist_ok=True)


def count_flag(path, column):
    """Count true-like values in a CSV column."""
    if not path.exists():
        return None

    try:
        df = pd.read_csv(path)

        if column not in df.columns:
            return None

        values = df[column].astype(str).str.strip().str.lower()
        return int(values.isin(["true", "1", "yes"]).sum())

    except Exception as error:
        print(f"Could not read {path.name}: {error}")
        return None


def file_status(path):
    return "available" if path.exists() else "unavailable"


def main():
    estrus = OUT / "estrus_activity_candidates.csv"
    behaviour = OUT / "behaviour_predictions.csv"
    anomaly = OUT / "abnormal_activity_candidates.csv"
    temperature = OUT / "temperature_analysis.csv"
    lameness = OUT / "lameness_dataset_inventory.csv"

    status = {
        "system": "smart_livestock_monitoring_ai",

        "behaviour_classification": {
            "status": file_status(behaviour),
            "prediction_rows": (
                len(pd.read_csv(behaviour))
                if behaviour.exists()
                else None
            ),
            "model": "Random Forest",
            "meaning": (
                "Classifies behaviours represented in the training dataset. "
                "A predicted behaviour is not a health diagnosis."
            )
        },

        "abnormal_activity_detection": {
            "status": file_status(anomaly),
            "anomaly_candidates": count_flag(
                anomaly, "anomaly_flag"
            ),
            "model": "Isolation Forest",
            "meaning": (
                "Flags observations that differ from the grazing "
                "reference data. Unusual activity does not prove illness."
            )
        },

        "estrus_associated_activity": {
            "status": file_status(estrus),
            "candidate_observations": count_flag(
                estrus, "candidate_activity_deviation"
            ),
            "meaning": (
                "Statistical activity deviations only; these are not "
                "confirmed estrus events."
            )
        },

        "temperature": {
            "status": file_status(temperature),
            "unusual_change_observations": count_flag(
                temperature, "unusual_change_flag"
            ),
            "meaning": (
                "Temperature analysis is unavailable until suitable "
                "temperature data are provided. A temperature trend "
                "alone is not a disease diagnosis."
            )
        },

        "lameness": {
            "status": file_status(lameness),
            "meaning": (
                "A dataset inventory does not establish that a validated "
                "lameness prediction model exists."
            )
        },

        "overall_interpretation": (
            "This is a research prototype. Missing module outputs are "
            "unavailable, not normal. Activity and behaviour flags are "
            "not veterinary diagnoses."
        )
    }

    output_path = OUT / "combined_monitoring_status.json"
    output_path.write_text(
        json.dumps(status, indent=2),
        encoding="utf-8"
    )

    print(json.dumps(status, indent=2))
    print(f"\nSaved combined status to: {output_path}")


if __name__ == "__main__":
    main()
