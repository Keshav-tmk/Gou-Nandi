from pathlib import Path
import joblib

MODEL_DIR = Path("models")

MODEL_FILES = [
    "cow_behaviour_random_forest.joblib",
    "cow_activity_isolation_forest.joblib",
    "rumination_classifier_bundle.joblib",
    "estrus/oestrus_day_random_forest.joblib",
    "lameness/lameness_day_random_forest.joblib",
]


def inspect_object(obj, name, depth=0):
    """Inspect a model, pipeline, or model bundle."""
    indent = "  " * depth

    if depth > 4:
        return

    print(f"\n{indent}Object: {name}")
    print(f"{indent}Type: {type(obj).__name__}")

    # Show feature names expected during training, if available.
    features = getattr(obj, "feature_names_in_", None)

    if features is not None:
        print(f"{indent}Expected features:")
        for feature in features:
            print(f"{indent}  - {feature}")

    # Show the number of input features, if available.
    count = getattr(obj, "n_features_in_", None)

    if count is not None:
        print(f"{indent}Number of input features: {count}")

    # Inspect pipelines and their steps.
    steps = getattr(obj, "named_steps", None)

    if steps:
        for step_name, step_obj in steps.items():
            inspect_object(
                step_obj,
                step_name,
                depth + 1
            )

    # Inspect dictionaries used as model bundles.
    if isinstance(obj, dict):
        print(f"{indent}Bundle keys: {list(obj.keys())}")

        for key, value in obj.items():
            if hasattr(value, "predict") or isinstance(value, dict):
                inspect_object(value, str(key), depth + 1)


def main():
    print("=" * 60)
    print("SMART LIVESTOCK - MODEL INSPECTION")
    print("=" * 60)

    for relative_path in MODEL_FILES:
        model_path = MODEL_DIR / relative_path

        print("\n" + "=" * 60)
        print(f"MODEL FILE: {relative_path}")
        print("=" * 60)

        if not model_path.exists():
            print("FILE NOT FOUND")
            continue

        try:
            model = joblib.load(model_path)
            inspect_object(model, relative_path)

        except Exception as exc:
            print(f"Could not inspect model: {exc}")

    print("\nInspection complete.")


if __name__ == "__main__":
    main()