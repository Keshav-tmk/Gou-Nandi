from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
FEATURES = ROOT / "data" / "processed" / "mount_behaviour_features.csv"
MODELS = ROOT / "models"
OUT = ROOT / "outputs"
MODELS.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

def main():
    if not FEATURES.exists():
        raise SystemExit("Feature file missing. Run python src/03_build_mount_features.py first.")
    df = pd.read_csv(FEATURES)
    if len(df) < 20:
        raise SystemExit(f"Only {len(df)} feature windows found; not enough for a meaningful split.")
    df = df[df["label"].notna() & df["source_file"].notna()].copy()
    counts = df["label"].value_counts()
    if len(counts) < 2:
        raise SystemExit("Need at least two behaviour classes to train.")
    non_features = {"label", "source_file", "window_no"}
    feature_cols = [c for c in df.columns if c not in non_features and pd.api.types.is_numeric_dtype(df[c])]
    X = df[feature_cols].replace([np.inf, -np.inf], np.nan)
    y = df["label"].astype(str)
    groups = df["source_file"].astype(str)

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups=groups))
    train_classes = set(y.iloc[train_idx])
    test_classes = set(y.iloc[test_idx])
    if len(train_classes) < 2:
        raise SystemExit("Group split left fewer than 2 classes in training. More labelled source files are needed.")
    model = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("classifier", RandomForestClassifier(
            n_estimators=300, class_weight="balanced_subsample",
            random_state=42, n_jobs=-1, min_samples_leaf=2
        ))
    ])
    model.fit(X.iloc[train_idx], y.iloc[train_idx])
    predictions = model.predict(X.iloc[test_idx])
    report = classification_report(y.iloc[test_idx], predictions, zero_division=0)
    cm = confusion_matrix(y.iloc[test_idx], predictions, labels=sorted(set(y)))
    metrics = {
        "rows_total": int(len(df)),
        "source_files_total": int(groups.nunique()),
        "train_rows": int(len(train_idx)),
        "test_rows": int(len(test_idx)),
        "accuracy": float(accuracy_score(y.iloc[test_idx], predictions)),
        "macro_f1": float(f1_score(y.iloc[test_idx], predictions, average="macro", zero_division=0)),
        "train_classes": sorted(train_classes),
        "test_classes": sorted(test_classes),
        "classes_all": sorted(set(y)),
        "warning": "Results apply only to this dataset and split; mounting classification is not estrus diagnosis."
    }
    (OUT / "behaviour_classification_report.txt").write_text(
        "CLASSIFICATION REPORT (held-out source files)\n\n" + report +
        "\n\nConfusion matrix labels: " + repr(sorted(set(y))) + "\n" + str(cm) +
        "\n\nMETADATA\n" + json.dumps(metrics, indent=2), encoding="utf-8"
    )
    pred_df = df.iloc[test_idx][["label", "source_file", "window_no"]].copy()
    pred_df["predicted_label"] = predictions
    pred_df.to_csv(OUT / "behaviour_predictions.csv", index=False)
    joblib.dump({"pipeline": model, "feature_columns": feature_cols, "classes": sorted(set(y))},
                MODELS / "cow_behaviour_random_forest.joblib")
    print(report)
    print(json.dumps(metrics, indent=2))
    print(f"Report: {OUT / 'behaviour_classification_report.txt'}")
    print(f"Predictions: {OUT / 'behaviour_predictions.csv'}")
    print(f"Model: {MODELS / 'cow_behaviour_random_forest.joblib'}")
    if test_classes != set(y):
        print("WARNING: Some classes are absent from the held-out split; interpret class-wise metrics cautiously.")

if __name__ == "__main__":
    main()
