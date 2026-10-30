from pathlib import Path
import joblib

model_path = (
    Path(__file__).resolve().parent
    / "models"
    / "cow_behaviour_random_forest.joblib"
)

bundle = joblib.load(model_path)

features = bundle["feature_columns"]

print("\n=== COW BEHAVIOUR MODEL FEATURES ===")
print("Total features:", len(features))

for i, feature in enumerate(features, start=1):
    print(f"{i}. {feature}")

print("\n=== BEHAVIOUR CLASSES ===")
print(bundle["classes"])