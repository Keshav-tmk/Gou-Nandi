from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field


# Project paths
ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"
STATUS_PATH = ROOT / "outputs" / "combined_monitoring_status.json"

BEHAVIOUR_PATH = MODELS_DIR / "cow_behaviour_random_forest.joblib"
ANOMALY_PATH = MODELS_DIR / "cow_activity_isolation_forest.joblib"


# Load the saved model bundles
if not BEHAVIOUR_PATH.exists():
    raise FileNotFoundError(f"Behaviour model not found: {BEHAVIOUR_PATH}")

if not ANOMALY_PATH.exists():
    raise FileNotFoundError(f"Anomaly model not found: {ANOMALY_PATH}")

behaviour_bundle = joblib.load(BEHAVIOUR_PATH)
anomaly_bundle = joblib.load(ANOMALY_PATH)

# The saved files contain dictionaries, not direct model objects.
behaviour_model = behaviour_bundle["pipeline"]
behaviour_features = behaviour_bundle["feature_columns"]

anomaly_model = anomaly_bundle["model"]
anomaly_features = anomaly_bundle["feature_columns"]


# FastAPI application
app = FastAPI(
    title="Smart Livestock Monitoring API",
    description=(
        "Research prototype for cow behaviour classification "
        "and unusual sensor activity detection."
    ),
    version="1.0.0",
)


# Request body format
class SensorFeatures(BaseModel):
    model_config = ConfigDict(extra="forbid")

    features: dict[str, float] = Field(
        ...,
        description="Sensor-derived features required by the selected model.",
    )


# Validate the incoming features and arrange them in training order.
def prepare_features(
    supplied: dict[str, float],
    required: list[str],
) -> pd.DataFrame:

    required_set = set(required)
    supplied_set = set(supplied)

    missing = sorted(required_set - supplied_set)
    unexpected = sorted(supplied_set - required_set)

    if missing or unexpected:
        detail = {}

        if missing:
            detail["missing_features"] = missing

        if unexpected:
            detail["unexpected_features"] = unexpected

        raise HTTPException(status_code=422, detail=detail)

    try:
        values = [supplied[name] for name in required]
        frame = pd.DataFrame([values], columns=required)
        frame = frame.replace([np.inf, -np.inf], np.nan)

        if frame.isna().any().any():
            raise HTTPException(
                status_code=422,
                detail="Feature values must be finite numbers.",
            )

        return frame

    except (TypeError, ValueError, KeyError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid feature values: {exc}",
        ) from exc


# Home endpoint
@app.get("/")
def home():
    return {
        "project": "Smart Livestock Monitoring Using IoT and AI",
        "status": "running",
        "documentation": "/docs",
        "endpoints": [
            "GET /health",
            "GET /status",
            "POST /predict/behaviour",
            "POST /detect/anomaly",
        ],
    }


# Health check
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "behaviour_model_loaded": behaviour_model is not None,
        "anomaly_model_loaded": anomaly_model is not None,
        "behaviour_feature_count": len(behaviour_features),
        "anomaly_feature_count": len(anomaly_features),
    }


# Combined module status
@app.get("/status")
def monitoring_status():
    if not STATUS_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Monitoring status file is unavailable.",
        )

    try:
        with STATUS_PATH.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not read monitoring status: {exc}",
        ) from exc


# Random Forest behaviour prediction
@app.post("/predict/behaviour")
def predict_behaviour(request: SensorFeatures):
    frame = prepare_features(request.features, behaviour_features)

    try:
        prediction = behaviour_model.predict(frame)[0]

        result = {
            "predicted_behaviour": str(prediction),
            "model": "Random Forest",
            "input_feature_count": len(behaviour_features),
            "interpretation": (
                "Predicted behaviour class from supplied sensor features. "
                "This is not a health diagnosis."
            ),
        }

        if hasattr(behaviour_model, "predict_proba"):
            probabilities = behaviour_model.predict_proba(frame)[0]
            classes = behaviour_model.classes_

            result["class_probabilities"] = {
                str(label): round(float(probability), 4)
                for label, probability in zip(classes, probabilities)
            }

        return result

    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Behaviour prediction failed: {exc}",
        ) from exc


# Isolation Forest unusual activity detection
@app.post("/detect/anomaly")
def detect_anomaly(request: SensorFeatures):
    frame = prepare_features(request.features, anomaly_features)

    try:
        prediction = int(anomaly_model.predict(frame)[0])
        score = float(anomaly_model.decision_function(frame)[0])

        is_anomaly = prediction == -1

        if is_anomaly:
            interpretation = (
                "Unusual sensor pattern detected. Review the observation "
                "and its context. This does not prove illness."
            )
        else:
            interpretation = (
                "Not flagged as unusual relative to the model reference "
                "data. This does not guarantee the animal is healthy."
            )

        return {
            "anomaly_detected": is_anomaly,
            "model": "Isolation Forest",
            "input_feature_count": len(anomaly_features),
            "decision_score": round(score, 6),
            "interpretation": interpretation,
        }

    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Anomaly detection failed: {exc}",
        ) from exc
