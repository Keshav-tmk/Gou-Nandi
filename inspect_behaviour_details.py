
from pathlib import Path
import joblib

model_path = (
    Path(__file__).resolve().parent
    / "models"
    / "cow_behaviour_random_forest.joblib"
)

if not model_path.exists():
    print(f"Model not found: {model_path}")
    raise SystemExit(1)

model = joblib.load(model_path)

print("\n=== COW BEHAVIOUR MODEL DETAILS ===")
print("Model type:", type(model).__name__)

if isinstance(model, dict):
    print("Bundle keys:", list(model.keys()))

    for key, value in model.items():
        print(f"\n--- {key} ---")

        if hasattr(value, "classes_"):
            print("Classes:", value.classes_)

        if hasattr(value, "feature_names_in_"):
            print("Feature count:", len(value.feature_names_in_))
            print("First 20 features:")
            for feature in value.feature_names_in_[:20]:
                print(" ", feature)

        if hasattr(value, "n_features_in_"):
            print("Number of input features:", value.n_features_in_)

        if isinstance(value, dict):
            print("Nested keys:", list(value.keys()))

else:
    if hasattr(model, "classes_"):
        print("Classes:", model.classes_)

    if hasattr(model, "feature_names_in_"):
        print("Features:")
        for feature in model.feature_names_in_:
            print(" ", feature)

    if hasattr(model, "n_features_in_"):
        print("Number of input features:", model.n_features_in_)

print("\nInspection completed.")
