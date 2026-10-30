"""Automated integration and unit tests for Smart Livestock Monitoring API."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Load the FastAPI app from src.10_api dynamically
api_module = importlib.import_module("src.10_api")
app = api_module.app
client = TestClient(app)

# Helper to construct synthetic features matching exact model requirements
def make_feature_payload(feature_list: list[str], default_val: float = 0.1) -> dict:
    return {"features": {name: default_val for name in feature_list}}


# ============================================================
# 1. CORE SYSTEM ENDPOINTS
# ============================================================

def test_root_endpoint():
    """Verify root endpoint returns project metadata and status."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "Smart Livestock Monitoring System"
    assert data["status"] == "running"
    assert "endpoints" in data
    assert "POST /sensor-data" in data["endpoints"]


def test_health_endpoint():
    """Verify health endpoint distinguishes API online from model readiness."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["api_online"] is True
    assert data["models_ready"] is True
    assert data["behaviour_model_loaded"] is True
    assert data["anomaly_model_loaded"] is True
    assert data["rumination_model_loaded"] is True
    assert data["estrus_model_loaded"] is True
    assert data["lameness_model_loaded"] is True
    assert data["behaviour_feature_count"] == 175
    assert data["anomaly_feature_count"] == 176
    assert data["rumination_feature_count"] == 88


def test_status_endpoint():
    """Verify monitoring status endpoint reports hardware telemetry state."""
    response = client.get("/status")
    assert response.status_code == 200
    data = response.json()
    assert "api_runtime" in data
    assert data["api_runtime"]["server_status"] == "online"
    assert "hardware_connection" in data["api_runtime"]


# ============================================================
# 2. BEHAVIOUR PREDICTION ENDPOINT
# ============================================================

def test_predict_behaviour_valid():
    """Verify behaviour prediction with complete synthetic feature vector."""
    payload = make_feature_payload(api_module.behaviour_features, 0.05)
    response = client.post("/predict/behaviour", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_behaviour" in data
    assert data["model"] == "Random Forest"
    assert data["input_feature_count"] == 175
    assert "class_probabilities" in data


def test_predict_behaviour_missing_feature():
    """Verify behaviour endpoint rejects missing required features with 422."""
    payload = {"features": {"BNO055_ax_world_mean": 0.1}}
    response = client.post("/predict/behaviour", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert "missing_features" in data["detail"]


def test_predict_behaviour_unexpected_feature():
    """Verify behaviour endpoint rejects unexpected features with 422."""
    payload = make_feature_payload(api_module.behaviour_features)
    payload["features"]["invalid_extra_feature"] = 99.9
    response = client.post("/predict/behaviour", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert "unexpected_features" in data["detail"]


def test_predict_behaviour_non_finite_value():
    """Verify behaviour endpoint rejects non-finite NaN/Infinity or invalid strings with 422."""
    first_col = api_module.behaviour_features[0]
    payload = make_feature_payload(api_module.behaviour_features)
    payload["features"][first_col] = "not-a-number"
    response = client.post("/predict/behaviour", json=payload)
    assert response.status_code == 422

    # Test raw unquoted NaN
    response_raw = client.post(
        "/predict/behaviour",
        content=f'{{"features": {{"{first_col}": NaN}}}}',
        headers={"Content-Type": "application/json"},
    )
    assert response_raw.status_code == 422


# ============================================================
# 3. ANOMALY DETECTION ENDPOINT
# ============================================================

def test_detect_anomaly_valid():
    """Verify anomaly detection executes with valid features."""
    payload = make_feature_payload(api_module.anomaly_features, 0.02)
    response = client.post("/detect/anomaly", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "anomaly_detected" in data
    assert isinstance(data["anomaly_detected"], bool)
    assert data["model"] == "Isolation Forest"
    assert "decision_score" in data
    assert "interpretation" in data


def test_detect_anomaly_missing_features():
    """Verify anomaly detection rejects incomplete feature set."""
    response = client.post("/detect/anomaly", json={"features": {}})
    assert response.status_code == 422


# ============================================================
# 4. RUMINATION MONITORING ENDPOINT
# ============================================================

def test_predict_rumination_valid():
    """Verify rumination prediction aggregates temporal sensor readings."""
    sensor_cols = api_module.rumination_sensor_columns
    readings = [
        {col: 0.1 for col in sensor_cols},
        {col: 0.2 for col in sensor_cols},
        {col: 0.15 for col in sensor_cols},
    ]
    response = client.post("/predict/rumination", json={"readings": readings})
    assert response.status_code == 200
    data = response.json()
    assert "rumination_detected" in data
    assert "rumination_class" in data
    assert "predicted_behaviour" in data
    assert data["model"] == "Random Forest"
    assert data["input_reading_count"] == 3
    assert data["aggregated_feature_count"] == 88


def test_predict_rumination_insufficient_readings():
    """Verify rumination endpoint rejects segments with fewer than 2 readings."""
    sensor_cols = api_module.rumination_sensor_columns
    readings = [{col: 0.1 for col in sensor_cols}]
    response = client.post("/predict/rumination", json={"readings": readings})
    assert response.status_code == 422


def test_predict_rumination_missing_sensor_column():
    """Verify rumination endpoint rejects readings with missing sensor columns."""
    readings = [
        {"acc_x": 0.1, "acc_y": 0.2},
        {"acc_x": 0.1, "acc_y": 0.2},
    ]
    response = client.post("/predict/rumination", json={"readings": readings})
    assert response.status_code == 422
    data = response.json()
    assert "missing_sensor_columns" in data["detail"]


# ============================================================
# 5. ESTRUS PREDICTION ENDPOINT
# ============================================================

def test_predict_estrus_valid():
    """Verify daily estrus screening executes with valid features."""
    payload = make_feature_payload(api_module.estrus_features, 0.1)
    response = client.post("/predict/estrus", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert "probability_positive" in data
    assert data["decision_threshold"] == 0.12
    assert data["target"] == "Estrus"


def test_predict_estrus_missing_features():
    """Verify estrus endpoint rejects missing features."""
    response = client.post("/predict/estrus", json={"features": {}})
    assert response.status_code == 422


# ============================================================
# 6. LAMENESS PREDICTION ENDPOINT
# ============================================================

def test_predict_lameness_valid():
    """Verify daily lameness screening executes with valid features."""
    payload = make_feature_payload(api_module.lameness_features, 0.1)
    response = client.post("/predict/lameness", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert "probability_positive" in data
    assert data["decision_threshold"] == 0.50
    assert data["target"] == "Lameness"


def test_predict_lameness_missing_features():
    """Verify lameness endpoint rejects missing features."""
    response = client.post("/predict/lameness", json={"features": {}})
    assert response.status_code == 422


# ============================================================
# 7. ESP32 SENSOR INGESTION ENDPOINT
# ============================================================

def test_sensor_ingestion_valid():
    """Verify ESP32 hardware sensor ingestion records valid readings."""
    payload = {
        "cow_id": "COW-001",
        "device_id": "ESP32-COLLAR-01",
        "timestamp": "2026-10-28T10:30:00Z",
        "sensors": {
            "acc_x": 0.05,
            "acc_y": 0.98,
            "acc_z": 0.12,
            "temperature_c": 38.6,
        },
    }
    response = client.post("/sensor-data", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert data["cow_id"] == "COW-001"
    assert data["sensor_count"] == 4

    # Verify status endpoint reflects received hardware reading
    status_resp = client.get("/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["api_runtime"]["hardware_connection"] == "receiving_data"
    assert status_data["api_runtime"]["latest_sensor_timestamp"] == "2026-10-28T10:30:00Z"


def test_sensor_ingestion_invalid_timestamp():
    """Verify sensor ingestion rejects invalid timestamp format."""
    payload = {
        "cow_id": "COW-001",
        "device_id": "ESP32-001",
        "timestamp": "invalid-timestamp-string",
        "sensors": {"acc_x": 0.05},
    }
    response = client.post("/sensor-data", json=payload)
    assert response.status_code == 422


def test_sensor_ingestion_temperature_out_of_bounds():
    """Verify sensor ingestion rejects physically impossible temperature readings."""
    payload = {
        "cow_id": "COW-001",
        "device_id": "ESP32-001",
        "timestamp": "2026-10-28T10:35:00Z",
        "sensors": {
            "temperature_c": 250.0,  # Physically impossible for living cow / DS18B20
        },
    }
    response = client.post("/sensor-data", json=payload)
    assert response.status_code == 422


def test_sensor_ingestion_empty_sensors():
    """Verify sensor ingestion rejects empty sensors dictionary."""
    payload = {
        "cow_id": "COW-001",
        "device_id": "ESP32-001",
        "timestamp": "2026-10-28T10:35:00Z",
        "sensors": {},
    }
    response = client.post("/sensor-data", json=payload)
    assert response.status_code == 422
