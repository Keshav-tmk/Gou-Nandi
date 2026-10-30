"""Smart Livestock Monitoring API.

FastAPI backend serving machine-learning inference models for cow behaviour

classification, abnormal activity detection, rumination monitoring, and

experimental daily-summary estrus and lameness screening, as well as an

ingestion endpoint for ESP32 sensor hardware.

"""

from __future__ import annotations

from datetime import datetime, timezone

import json

import logging

from pathlib import Path

from typing import Any, Dict, List, Optional

import warnings

import joblib

import numpy as np

from fastapi import FastAPI, HTTPException, Query, Request, status

from fastapi.middleware.cors import CORSMiddleware

from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from src.ai.inference import get_ai_service, normalize_cow_id

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Configure structured logging

logging.basicConfig(

    level=logging.INFO,

    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",

)

logger = logging.getLogger("livestock_api")

# Suppress scikit-learn version mismatch warnings on unpickle

warnings.filterwarnings("ignore", category=UserWarning)

# ============================================================

# PROJECT PATHS

# ============================================================

ROOT = Path(__file__).resolve().parent.parent

MODELS_DIR = ROOT / "models"

OUTPUTS_DIR = ROOT / "outputs"

DATA_DIR = ROOT / "data"

FRONTEND_DIR = ROOT / "frontend"

BEHAVIOUR_PATH = MODELS_DIR / "cow_behaviour_random_forest.joblib"

ANOMALY_PATH = MODELS_DIR / "cow_activity_isolation_forest.joblib"

RUMINATION_PATH = MODELS_DIR / "rumination_classifier_bundle.joblib"

ESTRUS_PATH = MODELS_DIR / "estrus" / "oestrus_day_random_forest.joblib"

LAMENESS_PATH = MODELS_DIR / "lameness" / "lameness_day_random_forest.joblib"

STATUS_PATH = OUTPUTS_DIR / "combined_monitoring_status.json"

SENSOR_LOG_PATH = OUTPUTS_DIR / "live_sensor_readings.jsonl"

# In-memory storage for latest received hardware sensor readings

_latest_sensor_reading: Optional[Dict[str, Any]] = None

_sensor_readings_buffer: List[Dict[str, Any]] = []

MAX_SENSOR_BUFFER_SIZE = 500

# ============================================================

# MODEL LOADING WITH DIAGNOSTICS

# ============================================================

behaviour_bundle: Optional[Dict[str, Any]] = None

behaviour_model: Any = None

behaviour_features: List[str] = []

anomaly_bundle: Optional[Dict[str, Any]] = None

anomaly_model: Any = None

anomaly_features: List[str] = []

rumination_bundle: Optional[Dict[str, Any]] = None

rumination_binary_model: Any = None

rumination_multiclass_model: Any = None

rumination_features: List[str] = []

rumination_sensor_columns: List[str] = []

rumination_statistics: List[str] = []

RUMINATION_THRESHOLD: float = 0.25

estrus_bundle: Optional[Dict[str, Any]] = None

estrus_model: Any = None

estrus_features: List[str] = []

ESTRUS_THRESHOLD: float = 0.12

lameness_bundle: Optional[Dict[str, Any]] = None

lameness_model: Any = None

lameness_features: List[str] = []

LAMENESS_THRESHOLD: float = 0.5

def load_all_models() -> Dict[str, bool]:

    """Load and validate all model bundles with diagnostics."""

    global behaviour_bundle, behaviour_model, behaviour_features

    global anomaly_bundle, anomaly_model, anomaly_features

    global rumination_bundle, rumination_binary_model, rumination_multiclass_model

    global rumination_features, rumination_sensor_columns, rumination_statistics, RUMINATION_THRESHOLD

    global estrus_bundle, estrus_model, estrus_features, ESTRUS_THRESHOLD

    global lameness_bundle, lameness_model, lameness_features, LAMENESS_THRESHOLD

    results = {}

    # 1. Behaviour Model (Required)

    if BEHAVIOUR_PATH.exists():

        try:

            behaviour_bundle = joblib.load(BEHAVIOUR_PATH)

            behaviour_model = behaviour_bundle["pipeline"]

            behaviour_features = list(behaviour_bundle["feature_columns"])

            results["behaviour"] = True

            logger.info("Loaded behaviour model (%d features)", len(behaviour_features))

        except Exception as exc:

            logger.error("Failed to load behaviour model: %s", exc)

            results["behaviour"] = False

    else:

        logger.warning("Behaviour model missing: %s", BEHAVIOUR_PATH)

        results["behaviour"] = False

    # 2. Anomaly Detection Model (Required)

    if ANOMALY_PATH.exists():

        try:

            anomaly_bundle = joblib.load(ANOMALY_PATH)

            anomaly_model = anomaly_bundle["model"]

            anomaly_features = list(anomaly_bundle["feature_columns"])

            results["anomaly"] = True

            logger.info("Loaded anomaly model (%d features)", len(anomaly_features))

        except Exception as exc:

            logger.error("Failed to load anomaly model: %s", exc)

            results["anomaly"] = False

    else:

        logger.warning("Anomaly model missing: %s", ANOMALY_PATH)

        results["anomaly"] = False

    # 3. Rumination Model Bundle (Optional/Modular)

    if RUMINATION_PATH.exists():

        try:

            rumination_bundle = joblib.load(RUMINATION_PATH)

            rumination_binary_model = rumination_bundle["binary_model"]

            rumination_multiclass_model = rumination_bundle["multiclass_model"]

            rumination_features = list(rumination_bundle["feature_columns"])

            rumination_sensor_columns = list(rumination_bundle["sensor_columns"])

            rumination_statistics = list(rumination_bundle["aggregation_statistics"])

            results["rumination"] = True

            logger.info("Loaded rumination bundle (%d sensor cols, %d features)",

                        len(rumination_sensor_columns), len(rumination_features))

        except Exception as exc:

            logger.error("Failed to load rumination bundle: %s", exc)

            results["rumination"] = False

    else:

        logger.warning("Rumination bundle missing: %s", RUMINATION_PATH)

        results["rumination"] = False

    # 4. Estrus Model (Optional/Experimental)

    if ESTRUS_PATH.exists():

        try:

            estrus_bundle = joblib.load(ESTRUS_PATH)

            estrus_model = estrus_bundle["model"]

            estrus_features = list(estrus_bundle["features"])

            ESTRUS_THRESHOLD = float(estrus_bundle.get("threshold", ESTRUS_THRESHOLD))

            results["estrus"] = True

            logger.info("Loaded estrus model (%d features, threshold=%.2f)",

                        len(estrus_features), ESTRUS_THRESHOLD)

        except Exception as exc:

            logger.error("Failed to load estrus model: %s", exc)

            results["estrus"] = False

    else:

        logger.warning("Estrus model missing: %s", ESTRUS_PATH)

        results["estrus"] = False

    # 5. Lameness Model (Optional/Experimental)

    if LAMENESS_PATH.exists():

        try:

            lameness_bundle = joblib.load(LAMENESS_PATH)

            lameness_model = lameness_bundle["model"]

            lameness_features = list(lameness_bundle["features"])

            LAMENESS_THRESHOLD = float(lameness_bundle.get("threshold", LAMENESS_THRESHOLD))

            results["lameness"] = True

            logger.info("Loaded lameness model (%d features, threshold=%.2f)",

                        len(lameness_features), LAMENESS_THRESHOLD)

        except Exception as exc:

            logger.error("Failed to load lameness model: %s", exc)

            results["lameness"] = False

    else:

        logger.warning("Lameness model missing: %s", LAMENESS_PATH)

        results["lameness"] = False

    return results

# Initial load at import/startup

_load_status = load_all_models()

# ============================================================

# FASTAPI APPLICATION SETUP

# ============================================================

app = FastAPI(

    title="Smart Livestock Monitoring API",

    description=(

        "Production-grade FastAPI backend for cow behaviour classification, "

        "abnormal activity detection, rumination classification, experimental "

        "estrus/lameness screening, and ESP32 hardware sensor ingestion."

    ),

    version="2.0.0",

)

# CORS middleware for local Vite dev, mobile apps, and dashboard clients
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
    dist_assets = FRONTEND_DIR / "dist" / "assets"
    if dist_assets.exists():
        app.mount("/assets", StaticFiles(directory=str(dist_assets)), name="assets")

# ============================================================

# REQUEST SCHEMAS

# ============================================================

class SensorFeatures(BaseModel):

    model_config = ConfigDict(extra="forbid")

    features: Dict[str, float] = Field(

        ...,

        description="Feature values required by the selected model.",

    )

class RuminationSegment(BaseModel):

    model_config = ConfigDict(extra="forbid")

    readings: List[Dict[str, float]] = Field(

        ...,

        min_length=2,

        description=(

            "Sequence of sensor readings. Each reading must contain the "

            "sensor columns listed by the rumination model bundle."

        ),

    )

class ESPSensorPayload(BaseModel):

    model_config = ConfigDict(extra="forbid")

    cow_id: str = Field(

        ...,

        min_length=1,

        max_length=64,

        description="Unique identifier for the monitored animal, e.g., COW-001.",

    )

    device_id: str = Field(

        ...,

        min_length=1,

        max_length=64,

        description="Hardware device identifier, e.g., ESP32-COLLAR-01.",

    )

    timestamp: str = Field(

        ...,

        description="ISO 8601 UTC timestamp of observation, e.g. 2026-10-28T10:30:00Z.",

    )

    sensors: Dict[str, float] = Field(

        ...,

        description=(

            "Raw sensor measurements from ESP32 collar sensors (accelerometer, "

            "gyroscope, magnetometer, temperature, etc.)."

        ),

    )

    @field_validator("timestamp")

    @classmethod

    def validate_iso_timestamp(cls, val: str) -> str:

        # If microcontroller hasn't synchronized NTP yet, gracefully fallback to server UTC timestamp
        if not val or not str(val).strip():
            return datetime.now(timezone.utc).isoformat()

        # Standardize 'Z' to '+00:00' for fromisoformat compatibility

        clean_val = str(val).strip().replace("Z", "+00:00")

        try:

            datetime.fromisoformat(clean_val)

        except ValueError as exc:

            # Allow ISO formats without timezone offset e.g. 2026-10-29T08:25:00
            try:
                datetime.strptime(clean_val, "%Y-%m-%dT%H:%M:%S")
            except Exception:
                raise ValueError(f"Invalid ISO 8601 timestamp: {val}") from exc

        return val

    @field_validator("sensors")

    @classmethod

    def validate_sensor_values(cls, sensors: Dict[str, float]) -> Dict[str, float]:

        if not sensors:

            raise ValueError("Sensors dictionary must not be empty.")

        for name, value in sensors.items():

            if not isinstance(value, (int, float)):

                raise ValueError(f"Sensor '{name}' must have a numeric value.")

            if np.isnan(value) or np.isinf(value):

                raise ValueError(f"Sensor '{name}' contains non-finite value ({value}).")

            # Plausible physical sanity check for external DS18B20 temperature

            if "temp" in name.lower() and (value < -20.0 or value > 80.0):

                raise ValueError(f"Temperature reading {value}C for '{name}' is outside physical sensor bounds (-20 to 80C).")

        return sensors

# ============================================================

# RESILIENT FEATURE VALIDATION & PREPARATION

# ============================================================

def prepare_feature_array(

    supplied: Dict[str, float],

    required: List[str],

) -> np.ndarray:

    """Validate and pack feature values into a 2D numpy array [1, N].

    Ensures zero reliance on blocked external C-extensions while strictly

    enforcing feature names, completeness, order, and finite numeric values.

    """

    required_set = set(required)

    supplied_set = set(supplied)

    missing = sorted(required_set - supplied_set)

    unexpected = sorted(supplied_set - required_set)

    if missing or unexpected:

        detail: Dict[str, Any] = {}

        if missing:

            detail["missing_features"] = missing

        if unexpected:

            detail["unexpected_features"] = unexpected

        raise HTTPException(

            status_code=422,

            detail=detail,

        )

    try:

        row_values = []

        for name in required:

            val = float(supplied[name])

            if not np.isfinite(val):

                raise HTTPException(

                    status_code=422,

                    detail=f"Feature '{name}' has non-finite value: {val}",

                )

            row_values.append(val)

        return np.asarray([row_values], dtype=np.float64)

    except HTTPException:

        raise

    except (TypeError, ValueError, KeyError) as exc:

        raise HTTPException(

            status_code=422,

            detail=f"Invalid feature values: {exc}",

        ) from exc

def predict_binary_bundle(

    bundle: Optional[Dict[str, Any]],

    model: Any,

    features: List[str],

    threshold: float,

    supplied: Dict[str, float],

    target_name: str,

    positive_label: str,

    validation_note: str,

) -> Dict[str, Any]:

    """Execute binary prediction using saved bundle, feature array, and threshold."""

    if bundle is None or model is None:

        raise HTTPException(

            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,

            detail=f"{target_name} model is unavailable on this server.",

        )

    X = prepare_feature_array(supplied, features)

    try:

        classes = list(getattr(model, "classes_", []))

        positive_index = next(

            (i for i, label in enumerate(classes) if str(label) == "1"),

            None,

        )

        probability: Optional[float] = None

        if hasattr(model, "predict_proba"):

            probabilities = model.predict_proba(X)[0]

            if positive_index is None:

                raise HTTPException(

                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

                    detail=f"{target_name} model has no positive class '1'.",

                )

            probability = float(probabilities[positive_index])

            prediction = int(probability >= threshold)

        else:

            prediction = int(model.predict(X)[0])

        return {

            "prediction": prediction,

            "label": positive_label if prediction == 1 else f"No {target_name.lower()} flag",

            "target": target_name,

            "model": "Random Forest",

            "probability_positive": round(probability, 4) if probability is not None else None,

            "decision_threshold": threshold,

            "input_feature_count": len(features),

            "interpretation": validation_note,

        }

    except HTTPException:

        raise

    except (ValueError, TypeError, IndexError) as exc:

        logger.error("%s prediction failed: %s", target_name, exc)

        raise HTTPException(

            status_code=422,

            detail=f"{target_name} prediction failed: {exc}",

        ) from exc

# ============================================================

# RUMINATION SENSOR AGGREGATION

# ============================================================

def aggregate_rumination_readings(

    readings: List[Dict[str, float]],

) -> np.ndarray:

    """Aggregate raw temporal readings into statistical feature vector.

    Calculates: mean, std, min, max, median, range, abs_diff_mean, diff_std

    for all expected sensor columns.

    """

    if rumination_bundle is None or rumination_binary_model is None:

        raise HTTPException(

            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,

            detail="Rumination model is unavailable. Restore its model bundle.",

        )

    expected = set(rumination_sensor_columns)

    column_arrays: Dict[str, List[float]] = {col: [] for col in rumination_sensor_columns}

    for index, reading in enumerate(readings):

        missing = sorted(expected - set(reading))

        unexpected = sorted(set(reading) - expected)

        if missing or unexpected:

            detail: Dict[str, Any] = {"reading_index": index}

            if missing:

                detail["missing_sensor_columns"] = missing

            if unexpected:

                detail["unexpected_sensor_columns"] = unexpected

            raise HTTPException(

                status_code=422,

                detail=detail,

            )

        for col in rumination_sensor_columns:

            try:

                val = float(reading[col])

            except (TypeError, ValueError) as exc:

                raise HTTPException(

                    status_code=422,

                    detail=f"Invalid value for column '{col}' in reading index {index}.",

                ) from exc

            if not np.isfinite(val):

                raise HTTPException(

                    status_code=422,

                    detail=f"Non-finite value for '{col}' in reading index {index}.",

                )

            column_arrays[col].append(val)

    # Compute statistical features across time dimension

    feature_dict: Dict[str, float] = {}

    for col in rumination_sensor_columns:

        arr = np.asarray(column_arrays[col], dtype=np.float64)

        diff = np.diff(arr)

        feature_dict[f"{col}__mean"] = float(np.mean(arr))

        feature_dict[f"{col}__std"] = float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0

        feature_dict[f"{col}__min"] = float(np.min(arr))

        feature_dict[f"{col}__max"] = float(np.max(arr))

        feature_dict[f"{col}__median"] = float(np.median(arr))

        feature_dict[f"{col}__range"] = float(np.max(arr) - np.min(arr))

        feature_dict[f"{col}__abs_diff_mean"] = float(np.mean(np.abs(diff))) if len(diff) > 0 else 0.0

        feature_dict[f"{col}__diff_std"] = float(np.std(diff, ddof=1)) if len(diff) > 1 else 0.0

    try:

        row_vals = [feature_dict[fname] for fname in rumination_features]

        return np.asarray([row_vals], dtype=np.float64)

    except KeyError as exc:

        raise HTTPException(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            detail=f"Rumination feature configuration is inconsistent: {exc}",

        ) from exc

# ============================================================

# API ENDPOINTS

# ============================================================

@app.get("/")
def home(request: Request) -> Any:
    """Root endpoint exposing API status, endpoints, and project metadata."""
    accept = request.headers.get("accept", "")
    if accept.startswith("text/html"):
        dist_file = FRONTEND_DIR / "dist" / "index.html"
        index_file = dist_file if dist_file.exists() else FRONTEND_DIR / "pages" / "index.html"
        if not index_file.exists():
            index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
    return {

        "project": "Smart Livestock Monitoring System",

        "status": "running",

        "documentation": "/docs",

        "dashboard": "/dashboard",

        "endpoints": [

            "GET  /dashboard",

            "GET  /health",

            "GET  /status",

            "GET  /ai/status",

            "GET  /ai/latest",

            "GET  /ai/history",

            "GET  /ai/behaviour",

            "GET  /ai/anomalies",

            "POST /predict/behaviour",

            "POST /detect/anomaly",

            "POST /predict/rumination",

            "POST /predict/estrus",

            "POST /predict/lameness",

            "POST /sensor-data",

            "POST /sensor-data/batch",

            "GET  /sensor-data/latest",

            "GET  /sensor-data/recent",

            "GET  /sensor-data/window-features",

        ],

        "hardware_integration": {

            "supported_device": "ESP32",

            "target_animal": "Lakshmi (COW-001)",

            "ingestion_endpoint": "POST /sensor-data",

        },

    }

@app.get("/health")

def health() -> Dict[str, Any]:

    """Health check distinguishing API availability from model readiness."""

    required_ready = (behaviour_model is not None) and (anomaly_model is not None)

    all_ready = required_ready and (rumination_bundle is not None) and (estrus_bundle is not None) and (lameness_bundle is not None)

    health_status = "ready" if all_ready else ("degraded" if required_ready else "unhealthy")

    return {

        "status": health_status,

        "api_online": True,

        "models_ready": required_ready,

        "behaviour_model_loaded": behaviour_model is not None,

        "anomaly_model_loaded": anomaly_model is not None,

        "rumination_model_loaded": rumination_bundle is not None,

        "estrus_model_loaded": estrus_bundle is not None,

        "lameness_model_loaded": lameness_bundle is not None,

        "behaviour_feature_count": len(behaviour_features),

        "anomaly_feature_count": len(anomaly_features),

        "rumination_feature_count": len(rumination_features),

        "rumination_sensor_column_count": len(rumination_sensor_columns),

        "estrus_feature_count": len(estrus_features),

        "lameness_feature_count": len(lameness_features),

        "estrus_threshold": ESTRUS_THRESHOLD,

        "lameness_threshold": LAMENESS_THRESHOLD,

        "rumination_threshold": RUMINATION_THRESHOLD,

        "hardware_readings_received": len(_sensor_readings_buffer),

    }

@app.get("/status")

def monitoring_status() -> Dict[str, Any]:

    """Return consolidated monitoring status and hardware connectivity."""

    status_data: Dict[str, Any] = {}

    if STATUS_PATH.exists():

        try:

            with STATUS_PATH.open("r", encoding="utf-8") as f:

                status_data = json.load(f)

        except Exception as exc:

            logger.warning("Could not parse status file: %s", exc)

    # Attach live runtime diagnostics and hardware telemetry state

    status_data["api_runtime"] = {

        "server_status": "online",

        "timestamp_utc": datetime.now(timezone.utc).isoformat(),

        "hardware_connection": (
            "receiving_data" if (
                _latest_sensor_reading is not None and (
                    datetime.now(timezone.utc) - datetime.fromisoformat(
                        _latest_sensor_reading.get("received_at", datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00")
                    )
                ).total_seconds() <= 20.0
            ) else ("offline" if _latest_sensor_reading is not None else "waiting_for_sensor_data")
        ),
        "hardware_status": (
            "online" if (
                _latest_sensor_reading is not None and (
                    datetime.now(timezone.utc) - datetime.fromisoformat(
                        _latest_sensor_reading.get("received_at", datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00")
                    )
                ).total_seconds() <= 6.0
            ) else ("stale" if (
                _latest_sensor_reading is not None and (
                    datetime.now(timezone.utc) - datetime.fromisoformat(
                        _latest_sensor_reading.get("received_at", datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00")
                    )
                ).total_seconds() <= 20.0
            ) else ("offline" if _latest_sensor_reading is not None else "waiting_for_sensor_data"))
        ),
        "seconds_since_last_reading": (
            round(max(0.0, (
                datetime.now(timezone.utc) - datetime.fromisoformat(
                    _latest_sensor_reading.get("received_at", datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00")
                )
            ).total_seconds()), 2)
            if _latest_sensor_reading and _latest_sensor_reading.get("received_at") else None
        ),
        "is_stale": (
            (
                datetime.now(timezone.utc) - datetime.fromisoformat(
                    _latest_sensor_reading.get("received_at", datetime.now(timezone.utc).isoformat()).replace("Z", "+00:00")
                )
            ).total_seconds() > 6.0
            if _latest_sensor_reading and _latest_sensor_reading.get("received_at") else False
        ),

        "latest_sensor_timestamp": (

            _latest_sensor_reading.get("timestamp") if _latest_sensor_reading else None

        ),

        "buffered_readings_count": len(_sensor_readings_buffer),

        "models_loaded": {

            "behaviour": behaviour_model is not None,

            "anomaly": anomaly_model is not None,

            "rumination": rumination_bundle is not None,

            "estrus": estrus_bundle is not None,

            "lameness": lameness_bundle is not None,

        },

    }

    return status_data

@app.post("/predict/behaviour")

def predict_behaviour(request: SensorFeatures) -> Dict[str, Any]:

    """Predict cow behaviour class from sensor features."""

    if behaviour_model is None:

        raise HTTPException(

            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,

            detail="Behaviour model is unavailable on this server.",

        )

    X = prepare_feature_array(request.features, behaviour_features)

    try:

        prediction = behaviour_model.predict(X)[0]

        result: Dict[str, Any] = {

            "predicted_behaviour": str(prediction),

            "model": "Random Forest",

            "input_feature_count": len(behaviour_features),

            "interpretation": (

                "Predicted behaviour class from supplied sensor features. "

                "This is not a veterinary diagnosis."

            ),

        }

        if hasattr(behaviour_model, "predict_proba"):

            probabilities = behaviour_model.predict_proba(X)[0]

            result["class_probabilities"] = {

                str(label): round(float(prob), 4)

                for label, prob in zip(behaviour_model.classes_, probabilities)

            }

        return result

    except (ValueError, TypeError) as exc:

        logger.error("Behaviour inference error: %s", exc)

        raise HTTPException(

            status_code=422,

            detail=f"Behaviour prediction failed: {exc}",

        ) from exc

@app.post("/detect/anomaly")

def detect_anomaly(request: SensorFeatures) -> Dict[str, Any]:

    """Detect abnormal activity from sensor features."""

    if anomaly_model is None:

        raise HTTPException(

            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,

            detail="Anomaly detection model is unavailable on this server.",

        )

    X = prepare_feature_array(request.features, anomaly_features)

    try:

        prediction = int(anomaly_model.predict(X)[0])

        score = float(anomaly_model.decision_function(X)[0])

        is_anomaly = (prediction == -1)

        interpretation = (

            "Unusual sensor pattern detected. Review the observation and "

            "its context. This does not prove illness."

            if is_anomaly

            else

            "Not flagged as unusual relative to the model reference data. "

            "This does not guarantee the animal is healthy."

        )

        return {

            "anomaly_detected": is_anomaly,

            "model": "Isolation Forest",

            "input_feature_count": len(anomaly_features),

            "decision_score": round(score, 6),

            "interpretation": interpretation,

        }

    except (ValueError, TypeError) as exc:

        logger.error("Anomaly detection error: %s", exc)

        raise HTTPException(

            status_code=422,

            detail=f"Anomaly detection failed: {exc}",

        ) from exc

@app.post("/predict/rumination")

def predict_rumination(request: RuminationSegment) -> Dict[str, Any]:

    """Predict rumination occurrence and behaviour from raw sensor sequence."""

    X = aggregate_rumination_readings(request.readings)

    try:

        probabilities = None

        rumination_probability = None

        if hasattr(rumination_binary_model, "predict_proba"):

            probabilities = rumination_binary_model.predict_proba(X)[0]

            class_indices = {

                int(label): index

                for index, label in enumerate(rumination_binary_model.classes_)

            }

            if 1 not in class_indices:

                raise HTTPException(

                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

                    detail="Rumination model lacks positive class index '1'.",

                )

            rumination_probability = float(probabilities[class_indices[1]])

            binary_prediction = int(rumination_probability >= RUMINATION_THRESHOLD)

        else:

            binary_prediction = int(rumination_binary_model.predict(X)[0])

        binary_classes = rumination_bundle.get("binary_classes", {}) if rumination_bundle else {}

        binary_label = binary_classes.get(binary_prediction, str(binary_prediction))

        multiclass_prediction = str(rumination_multiclass_model.predict(X)[0])

        result: Dict[str, Any] = {

            "rumination_detected": binary_prediction == 1,

            "rumination_class": binary_label,

            "predicted_behaviour": multiclass_prediction,

            "model": "Random Forest",

            "input_reading_count": len(request.readings),

            "aggregated_feature_count": len(rumination_features),

            "interpretation": (

                "Classification of the supplied sensor segment. "

                "This research prototype is not a veterinary diagnosis."

            ),

            "validation_note": (

                "Evaluated using a random segment-level holdout from a public "

                "dataset; not validated on animal-held-out or real-farm data."

            ),

        }

        if probabilities is not None:

            result["rumination_probabilities"] = {

                binary_classes.get(int(label), str(label)): round(float(prob), 4)

                for label, prob in zip(rumination_binary_model.classes_, probabilities)

            }

            result["rumination_threshold"] = RUMINATION_THRESHOLD

            result["rumination_probability"] = round(rumination_probability, 4)

        if hasattr(rumination_multiclass_model, "predict_proba"):

            behaviour_probabilities = rumination_multiclass_model.predict_proba(X)[0]

            result["behaviour_probabilities"] = {

                str(label): round(float(prob), 4)

                for label, prob in zip(

                    rumination_multiclass_model.classes_,

                    behaviour_probabilities,

                )

            }

        return result

    except HTTPException:

        raise

    except (ValueError, TypeError) as exc:

        logger.error("Rumination prediction error: %s", exc)

        raise HTTPException(

            status_code=422,

            detail=f"Rumination prediction failed: {exc}",

        ) from exc

@app.post("/predict/estrus")

def predict_estrus(request: SensorFeatures) -> Dict[str, Any]:

    """Experimental daily-summary prediction of estrus / heat activity."""

    return predict_binary_bundle(

        bundle=estrus_bundle,

        model=estrus_model,

        features=estrus_features,

        threshold=ESTRUS_THRESHOLD,

        supplied=request.features,

        target_name="Estrus",

        positive_label="Possible estrus/heat",

        validation_note=(

            "Experimental daily-summary prediction. It is a screening signal, "

            "not confirmation of heat or a veterinary diagnosis. Features must "

            "be calculated using the same definitions and time windows as training."

        ),

    )

@app.post("/predict/lameness")

def predict_lameness(request: SensorFeatures) -> Dict[str, Any]:

    """Experimental daily-summary prediction of lameness risk."""

    return predict_binary_bundle(

        bundle=lameness_bundle,

        model=lameness_model,

        features=lameness_features,

        threshold=LAMENESS_THRESHOLD,

        supplied=request.features,

        target_name="Lameness",

        positive_label="Possible lameness",

        validation_note=(

            "Experimental daily-summary prediction only; not a veterinary "

            "diagnosis. The current saved evaluation detected no positive "

            "lameness cases at its 0.5 threshold, so this endpoint must not be "

            "relied on to rule lameness in or out."

        ),

    )

# ============================================================

# ESP32 HARDWARE SENSOR INGESTION ENDPOINT

# ============================================================

def calculate_live_window_features(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate descriptive movement features from buffered ESP32 readings.

    These summaries are not behaviour classifications. Only pass them to a
    saved model after confirming that its training features and units match.
    """
    required = ("accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z")
    acceleration_magnitudes: List[float] = []
    gyroscope_magnitudes: List[float] = []

    for record in records:
        sensors = record.get("sensors", {})
        if any(name not in sensors for name in required):
            continue
        try:
            ax, ay, az = (float(sensors[name]) for name in required[:3])
            gx, gy, gz = (float(sensors[name]) for name in required[3:])
        except (TypeError, ValueError):
            continue

        values = (ax, ay, az, gx, gy, gz)
        if not all(np.isfinite(value) for value in values):
            continue

        acceleration_magnitudes.append(float(np.sqrt(ax * ax + ay * ay + az * az)))
        gyroscope_magnitudes.append(float(np.sqrt(gx * gx + gy * gy + gz * gz)))

    if not acceleration_magnitudes:
        return {
            "reading_count": 0,
            "message": "No valid readings with all six accelerometer and gyroscope fields were found.",
        }

    acceleration = np.asarray(acceleration_magnitudes, dtype=np.float64)
    gyroscope = np.asarray(gyroscope_magnitudes, dtype=np.float64)
    return {
        "reading_count": int(len(acceleration)),
        "acceleration_magnitude_mean_g": round(float(np.mean(acceleration)), 4),
        "acceleration_magnitude_min_g": round(float(np.min(acceleration)), 4),
        "acceleration_magnitude_max_g": round(float(np.max(acceleration)), 4),
        "acceleration_magnitude_std_g": round(float(np.std(acceleration)), 4),
        "dynamic_acceleration_mean_g": round(float(np.mean(np.abs(acceleration - 1.0))), 4),
        "gyroscope_magnitude_mean_dps": round(float(np.mean(gyroscope)), 4),
        "gyroscope_magnitude_min_dps": round(float(np.min(gyroscope)), 4),
        "gyroscope_magnitude_max_dps": round(float(np.max(gyroscope)), 4),
        "gyroscope_magnitude_std_dps": round(float(np.std(gyroscope)), 4),
        "interpretation": (
            "Descriptive sensor statistics only. These values do not by themselves "
            "identify a specific cow behaviour or diagnose illness."
        ),
    }


@app.get("/sensor-data/latest")
def latest_sensor_data(
    cow_id: Optional[str] = Query(default=None, min_length=1, max_length=64),
) -> Dict[str, Any]:
    """Return the latest ESP32 reading received since this API process started, optionally filtered by cow."""
    if cow_id is not None:
        target_norm = normalize_cow_id(cow_id)
        ai = get_ai_service()
        latest = ai._cow_latest_reading.get(cow_id) or ai._cow_latest_reading.get(target_norm)
        if not latest:
            for rec in reversed(_sensor_readings_buffer):
                if rec.get("cow_id") == cow_id or normalize_cow_id(rec.get("cow_id")) == target_norm:
                    latest = rec
                    break
        if latest is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No ESP32 sensor readings have been received for cow {cow_id}.",
            )
        return {"status": "success", "cow_id": cow_id, "reading": latest}

    if _latest_sensor_reading is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ESP32 sensor readings have been received since the API started.",
        )
    return {"status": "success", "reading": _latest_sensor_reading}


@app.get("/sensor-data/recent")
def recent_sensor_data(
    limit: int = Query(default=20, ge=1, le=500),
    cow_id: Optional[str] = Query(default=None, min_length=1, max_length=64),
) -> Dict[str, Any]:
    """Return recent buffered readings, optionally filtered by cow ID."""
    records = _sensor_readings_buffer
    if cow_id is not None:
        target_norm = normalize_cow_id(cow_id)
        matched = [
            record for record in records
            if record.get("cow_id") == cow_id or normalize_cow_id(record.get("cow_id")) == target_norm
        ]
        # Cross-cow fallback removed to prevent data leakage
        records = matched
    selected = records[-limit:]
    return {
        "status": "success",
        "count": len(selected),
        "limit": limit,
        "cow_id_filter": cow_id,
        "readings": selected,
        "note": "This in-memory buffer resets when the API process restarts.",
    }


@app.get("/sensor-data/window-features")
def live_sensor_window_features(
    window_size: int = Query(default=20, ge=2, le=500),
    cow_id: Optional[str] = Query(default=None, min_length=1, max_length=64),
) -> Dict[str, Any]:
    """Calculate descriptive features from the most recent buffered sensor window."""
    records = _sensor_readings_buffer
    if cow_id is not None:
        target_norm = normalize_cow_id(cow_id)
        matched = [
            record for record in records
            if record.get("cow_id") == cow_id or normalize_cow_id(record.get("cow_id")) == target_norm
        ]
        # Cross-cow fallback removed to prevent data leakage
        records = matched
    selected = records[-window_size:]
    if not selected:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No buffered sensor readings are available for the requested filter.",
        )
    return {
        "status": "success",
        "cow_id_filter": cow_id,
        "requested_window_size": window_size,
        "features": calculate_live_window_features(selected),
    }


@app.post("/sensor-data", status_code=status.HTTP_201_CREATED)

def ingest_sensor_data(payload: ESPSensorPayload) -> Dict[str, Any]:

    """Ingest genuine sensor readings from ESP32 collar hardware.

    Validates identifiers, timestamps, and sensor numeric values.

    Buffers the latest readings and appends to persistent audit log.

    Does not invent sensor data or make claims of clinical diagnosis.

    """

    global _latest_sensor_reading, _sensor_readings_buffer

    received_time = datetime.now(timezone.utc).isoformat()

    record = {

        "received_at": received_time,

        "cow_id": payload.cow_id,

        "device_id": payload.device_id,

        "timestamp": payload.timestamp,

        "sensors": payload.sensors,

        "sensor_count": len(payload.sensors),

    }

    # Store latest reading in memory

    _latest_sensor_reading = record

    _sensor_readings_buffer.append(record)

    if len(_sensor_readings_buffer) > MAX_SENSOR_BUFFER_SIZE:

        _sensor_readings_buffer.pop(0)

    # Persist reading to append-only JSONL log

    try:

        OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

        with SENSOR_LOG_PATH.open("a", encoding="utf-8") as f:

            f.write(json.dumps(record) + "\n")

    except OSError as exc:

        logger.error("Failed to append sensor reading to log: %s", exc)

    # Ingest into real-time AI service buffer for per-cow rolling inference
    try:
        get_ai_service().ingest_reading(record)
    except Exception as ai_exc:
        logger.warning("Could not buffer reading in AI service: %s", ai_exc)

    logger.info("Ingested ESP32 reading from %s (%s) with %d sensors",
                payload.cow_id, payload.device_id, len(payload.sensors))

    return {
        "status": "success",
        "message": "Sensor reading recorded successfully.",
        "cow_id": payload.cow_id,
        "device_id": payload.device_id,
        "received_at": received_time,
        "sensor_count": len(payload.sensors),
    }


# ============================================================
# WEB DASHBOARD & ADVANCED AI INFERENCE ENDPOINTS
# ============================================================

@app.get("/dashboard/api/live")
def dashboard_api_live(
    cow_id: str = Query(default="COW-001", min_length=1, max_length=64),
) -> Dict[str, Any]:
    """Consolidated real-time state for dashboard: hardware freshness, sensor readings, and 5 AI modules."""
    ai = get_ai_service()
    return ai.get_live_dashboard_payload(cow_id=cow_id)


@app.get("/dashboard")
def dashboard() -> FileResponse:
    """Serve the interactive real-time web dashboard."""
    index_file = FRONTEND_DIR / "pages" / "index.html"
    if not index_file.exists():
        index_file = FRONTEND_DIR / "dist" / "index.html"
    if not index_file.exists():
        index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard index.html not found.",
        )
    return FileResponse(str(index_file))


@app.get("/app")
def react_app() -> FileResponse:
    """Serve the SmartLivestock Dairy Farm React 18 / TypeScript application."""
    dist_file = FRONTEND_DIR / "dist" / "index.html"
    index_file = dist_file if dist_file.exists() else FRONTEND_DIR / "index.html"
    if not index_file.exists():
        index_file = FRONTEND_DIR / "pages" / "index.html"
    return FileResponse(str(index_file))


@app.post("/sensor-data/batch", status_code=status.HTTP_201_CREATED)
def ingest_sensor_data_batch(payloads: List[ESPSensorPayload]) -> Dict[str, Any]:
    """Ingest a batch of high-frequency sensor readings from ESP32 collar hardware."""
    if not payloads:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Batch readings list cannot be empty.",
        )
    count = 0
    for item in payloads:
        ingest_sensor_data(item)
        count += 1
    return {
        "status": "success",
        "message": f"Successfully ingested {count} sensor readings.",
        "count": count,
    }


@app.get("/ai/status")
def ai_status() -> Dict[str, Any]:
    """Return operational readiness and model diagnostics of the real-time AI layer."""
    ai = get_ai_service()
    return {
        "status": "online",
        "behaviour_model": {
            "version": ai.behaviour_model_version,
            "loaded": ai.behaviour_pipeline is not None,
            "classes": ai.behaviour_classes,
            "input_features": 72,
            "sensor_channels": ["accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z"],
        },
        "anomaly_model": {
            "version": ai.anomaly_model_version,
            "loaded": ai.anomaly_pipeline is not None,
            "input_features": 72,
        },
        "rumination_model": {
            "version": ai.rumination_model_version,
            "loaded": ai.rumination_pipeline is not None,
            "input_features": 72,
            "decision_threshold": ai.rumination_threshold,
        },
        "estrus_model": {
            "version": ai.estrus_model_version,
            "loaded": ai.estrus_pipeline is not None,
            "threshold": ai.estrus_threshold,
        },
        "lameness_model": {
            "version": ai.lameness_model_version,
            "loaded": ai.lameness_pipeline is not None,
            "threshold": ai.lameness_threshold,
        },
        "active_cows": ai.get_active_cows(),
        "min_window_samples": ai.min_window_samples,
    }


@app.get("/ai/latest")
def ai_latest(
    cow_id: str = Query(default="COW-001", min_length=1, max_length=64),
    window_size: int = Query(default=20, ge=10, le=200),
) -> Dict[str, Any]:
    """Run real-time inference on the latest rolling window for the specified cow."""
    ai = get_ai_service()
    return ai.run_inference_for_cow(cow_id=cow_id, window_size=window_size)


@app.get("/ai/history")
def ai_history(
    cow_id: str = Query(default="COW-001", min_length=1, max_length=64),
    limit: int = Query(default=50, ge=1, le=200),
) -> Dict[str, Any]:
    """Retrieve time-stamped prediction history for the specified cow."""
    ai = get_ai_service()
    history = ai.get_prediction_history(cow_id=cow_id, limit=limit)
    return {
        "status": "success",
        "cow_id": cow_id,
        "count": len(history),
        "limit": limit,
        "history": history,
    }


@app.get("/ai/behaviour")
def ai_behaviour(
    cow_id: str = Query(default="COW-001", min_length=1, max_length=64),
) -> Dict[str, Any]:
    """Retrieve the current behaviour classification for the specified cow."""
    ai = get_ai_service()
    res = ai.run_inference_for_cow(cow_id=cow_id)
    return {
        "cow_id": cow_id,
        "timestamp": res.get("timestamp"),
        "behaviour": res.get("behaviour"),
        "data_quality": res.get("data_quality"),
    }


@app.get("/ai/anomalies")
def ai_anomalies(
    cow_id: str = Query(default="COW-001", min_length=1, max_length=64),
    limit: int = Query(default=50, ge=1, le=200),
) -> Dict[str, Any]:
    """Retrieve current anomaly status and historical anomaly events for the cow."""
    ai = get_ai_service()
    res = ai.run_inference_for_cow(cow_id=cow_id)
    history = ai.get_prediction_history(cow_id=cow_id, limit=limit)
    anomalies = [h for h in history if h.get("anomaly", {}).get("detected") is True]
    return {
        "cow_id": cow_id,
        "current_anomaly": res.get("anomaly"),
        "recent_anomaly_count": len(anomalies),
        "history_limit": limit,
        "recent_anomalies": anomalies,
    }


@app.get("/ai/rumination")
def ai_rumination(
    cow_id: str = Query(default="COW-001", min_length=1, max_length=64),
) -> Dict[str, Any]:
    """Retrieve the current rumination prediction and chewing metrics for the cow."""
    ai = get_ai_service()
    res = ai.run_inference_for_cow(cow_id=cow_id)
    return {
        "cow_id": cow_id,
        "timestamp": res.get("timestamp"),
        "rumination": res.get("rumination"),
        "data_quality": res.get("data_quality"),
    }


@app.get("/ai/estrus")
def ai_estrus(
    cow_id: str = Query(default="COW-001", min_length=1, max_length=64),
) -> Dict[str, Any]:
    """Retrieve the current estrus heat screening assessment for the cow."""
    ai = get_ai_service()
    res = ai.run_inference_for_cow(cow_id=cow_id)
    return {
        "cow_id": cow_id,
        "timestamp": res.get("timestamp"),
        "estrus": res.get("estrus"),
        "data_quality": res.get("data_quality"),
    }


@app.get("/ai/lameness")
def ai_lameness(
    cow_id: str = Query(default="COW-001", min_length=1, max_length=64),
) -> Dict[str, Any]:
    """Retrieve the current lameness locomotion and thermal health status for the cow."""
    ai = get_ai_service()
    res = ai.run_inference_for_cow(cow_id=cow_id)
    return {
        "cow_id": cow_id,
        "timestamp": res.get("timestamp"),
        "lameness": res.get("lameness"),
        "data_quality": res.get("data_quality"),
    }



# ============================================================
# COW REGISTRY & HERD MANAGEMENT ENDPOINTS
# ============================================================

COW_REGISTRY = [
    {
        "id": "COW-001",
        "name": "Lakshmi",
        "tag": "TAG-101",
        "breed": "Gir",
        "deviceId": "ESP32_001",
        "date_of_birth": "2021-03-15",
        "lactation_stage": "Mid-lactation",
        "weight_kg": 420.0,
    },
    {
        "id": "COW-002",
        "name": "Ganga",
        "tag": "TAG-102",
        "breed": "Sahiwal",
        "deviceId": "ESP32_002",
        "date_of_birth": "2020-08-10",
        "lactation_stage": "Early-lactation",
        "weight_kg": 450.0,
    },
    {
        "id": "COW-003",
        "name": "Nandi",
        "tag": "TAG-103",
        "breed": "Red Sindhi",
        "deviceId": "ESP32_003",
        "date_of_birth": "2022-01-20",
        "lactation_stage": "Late-lactation",
        "weight_kg": 395.0,
    },
    {
        "id": "COW-004",
        "name": "Parvati",
        "tag": "TAG-104",
        "breed": "Tharparkar",
        "deviceId": "ESP32_004",
        "date_of_birth": "2019-11-05",
        "lactation_stage": "Dry",
        "weight_kg": 465.0,
    },
    {
        "id": "COW-005",
        "name": "Kamadhenu",
        "tag": "TAG-105",
        "breed": "Kankrej",
        "deviceId": "ESP32_005",
        "date_of_birth": "2021-06-18",
        "lactation_stage": "Mid-lactation",
        "weight_kg": 435.0,
    },
    {
        "id": "COW-006",
        "name": "Surabhi",
        "tag": "TAG-106",
        "breed": "Ongole",
        "deviceId": "ESP32_006",
        "date_of_birth": "2020-04-22",
        "lactation_stage": "Mid-lactation",
        "weight_kg": 480.0,
    },
    {
        "id": "COW-007",
        "name": "Kalyani",
        "tag": "TAG-107",
        "breed": "Rathi",
        "deviceId": "ESP32_007",
        "date_of_birth": "2022-05-12",
        "lactation_stage": "Early-lactation",
        "weight_kg": 410.0,
    },
    {
        "id": "COW-008",
        "name": "Gauri",
        "tag": "TAG-108",
        "breed": "Krishna Valley",
        "deviceId": "ESP32_008",
        "date_of_birth": "2021-09-30",
        "lactation_stage": "Mid-lactation",
        "weight_kg": 440.0,
    },
]


@app.get("/cows")
def list_cows() -> Dict[str, Any]:
    """Retrieve all cows in the herd with real-time status and telemetry metadata."""
    ai = get_ai_service()
    now_iso = datetime.now(timezone.utc).isoformat()
    cows_out = []

    for cow in COW_REGISTRY:
        cow_id = cow["id"]
        freshness = ai.get_cow_freshness(cow_id)
        hw_status = freshness["status"]
        readings = ai.get_cow_readings(cow_id, limit=1)
        latest_r = readings[0] if readings else None

        # Check latest behaviour if available
        beh_label = None
        if latest_r:
            pred_history = ai.get_prediction_history(cow_id, limit=1)
            if pred_history and pred_history[0].get("behaviour"):
                beh_label = pred_history[0]["behaviour"].get("label")

        # Active alerts for this cow
        cow_alerts = [a for a in ai.get_all_active_alerts() if a.get("cow_id") == cow_id]

        cows_out.append({
            **cow,
            "status": hw_status,
            "has_live_telemetry": bool(latest_r),
            "last_received_at": freshness.get("last_received_at"),
            "seconds_since_last_reading": freshness.get("seconds_since_last_reading"),
            "total_readings": freshness.get("total_readings", 0),
            "latest_behaviour": beh_label,
            "alerts_count": len(cow_alerts),
            "is_stale": freshness.get("is_stale", False),
        })

    return {
        "status": "success",
        "count": len(cows_out),
        "timestamp": now_iso,
        "cows": cows_out,
    }


@app.get("/cows/{cow_id}")
def get_cow_detail(cow_id: str) -> Dict[str, Any]:
    """Retrieve detailed profile, live telemetry, and recent history for a specific cow."""
    ai = get_ai_service()
    norm_id = normalize_cow_id(cow_id)
    
    # Locate cow in registry or create on-the-fly profile
    cow_meta = next((c for c in COW_REGISTRY if c["id"] == cow_id or normalize_cow_id(c["id"]) == norm_id), None)
    if not cow_meta:
        cow_meta = {
            "id": cow_id,
            "name": f"Cow {cow_id}",
            "tag": f"TAG-{cow_id}",
            "breed": "Indigenous",
            "deviceId": f"ESP32_{cow_id}",
            "date_of_birth": "2021-01-01",
            "lactation_stage": "Unknown",
            "weight_kg": 400.0,
        }

    freshness = ai.get_cow_freshness(cow_id)
    recent_readings = ai.get_cow_readings(cow_id, limit=15)
    live_payload = ai.get_live_dashboard_payload(cow_id)
    pred_history = ai.get_prediction_history(cow_id, limit=10)
    alerts = [a for a in ai.get_all_active_alerts() if a.get("cow_id") == norm_id or a.get("cow_id") == cow_id]

    return {
        "status": "success",
        "profile": cow_meta,
        "freshness": freshness,
        "latest_telemetry": live_payload.get("sensor"),
        "recent_readings": recent_readings,
        "window": live_payload.get("window"),
        "ai": live_payload.get("ai"),
        "alerts": alerts,
        "prediction_history": pred_history,
    }


@app.get("/alerts")
def get_herd_alerts() -> Dict[str, Any]:
    """Retrieve current active and recent livestock health alerts."""
    ai = get_ai_service()
    alerts = ai.get_all_active_alerts()
    return {
        "status": "success",
        "total": len(alerts),
        "active": alerts,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/alerts/{alert_id}/resolve")
def resolve_herd_alert(alert_id: str) -> Dict[str, Any]:
    """Resolve/acknowledge an alert by ID."""
    ai = get_ai_service()
    success = ai.resolve_alert(alert_id)
    return {
        "status": "success" if success else "not_found",
        "alert_id": alert_id,
        "resolved": success,
        "message": "Alert resolved" if success else "Alert not found or already cleared",
    }


@app.get("/analytics/summary")
def get_analytics_summary() -> Dict[str, Any]:
    """Provide real herd-wide aggregate analytics across cows and predictions."""
    ai = get_ai_service()
    now_iso = datetime.now(timezone.utc).isoformat()
    active_cows = ai.get_active_cows()
    all_alerts = ai.get_all_active_alerts()

    # Aggregate behaviour distribution across prediction histories
    beh_counts: Dict[str, int] = {}
    total_preds = 0
    for cow in COW_REGISTRY:
        history = ai.get_prediction_history(cow["id"], limit=50)
        for h in history:
            b = h.get("behaviour")
            if b and b.get("label"):
                lbl = b["label"]
                beh_counts[lbl] = beh_counts.get(lbl, 0) + 1
                total_preds += 1

    return {
        "status": "success",
        "timestamp": now_iso,
        "herd": {
            "total_cows": len(COW_REGISTRY),
            "telemetry_active_cows": len(active_cows),
            "healthy_cows": max(0, len(COW_REGISTRY) - len(all_alerts)),
            "attention_cows": len(set(a.get("cow_id") for a in all_alerts)),
            "active_alerts_count": len(all_alerts),
        },
        "behaviour_distribution": beh_counts,
        "total_inferences_recorded": total_preds,
    }
