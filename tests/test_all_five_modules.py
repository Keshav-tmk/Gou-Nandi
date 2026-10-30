"""Comprehensive integration tests for all five AI analysis modules.

Validates:
1. Behaviour classification (Random Forest)
2. Activity anomaly detection (Isolation Forest)
3. Rumination detection (Hardware Random Forest)
4. Estrus heat screening & mount detection
5. Lameness & contact thermal health monitoring
6. Dedicated endpoints: /ai/rumination, /ai/estrus, /ai/lameness
"""

import importlib
from pathlib import Path
import sys

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

api_module = importlib.import_module("src.10_api")
app = api_module.app
client = TestClient(app)


def test_ai_status_all_five_models():
    """Verify that /ai/status reports all five models loaded and operational."""
    resp = client.get("/ai/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "online"

    # Module 1
    assert "behaviour_model" in data
    assert data["behaviour_model"]["loaded"] is True
    assert data["behaviour_model"]["input_features"] == 72

    # Module 2
    assert "anomaly_model" in data
    assert data["anomaly_model"]["loaded"] is True
    assert data["anomaly_model"]["input_features"] == 72

    # Module 3
    assert "rumination_model" in data
    assert data["rumination_model"]["loaded"] is True
    assert data["rumination_model"]["input_features"] == 72

    # Module 4
    assert "estrus_model" in data
    assert data["estrus_model"]["loaded"] is True

    # Module 5
    assert "lameness_model" in data
    assert data["lameness_model"]["loaded"] is True


def test_all_five_modules_live_predictions():
    """Ingest sensor data and verify all 5 AI modules return active predictions."""
    cow_id = "COW-FIVE-TEST"

    # Ingest 25 readings representing a routine resting/grazing state
    readings = [
        {
            "cow_id": cow_id,
            "device_id": "ESP32-COLLAR-FIVE",
            "timestamp": f"2026-10-29T10:00:{i:02d}Z",
            "sensors": {
                "accel_x": 0.08 + (i * 0.001),
                "accel_y": 0.95,
                "accel_z": 0.15,
                "gyro_x": 1.5,
                "gyro_y": -0.8,
                "gyro_z": 0.3,
                "temperature_c": 38.6,
            },
        }
        for i in range(25)
    ]

    resp_ingest = client.post("/sensor-data/batch", json=readings)
    assert resp_ingest.status_code == 201

    # 1. Unified /ai/latest endpoint
    resp_latest = client.get(f"/ai/latest?cow_id={cow_id}")
    assert resp_latest.status_code == 200
    res = resp_latest.json()

    assert res["status"] == "available"
    assert res["data_quality"]["status"] == "sufficient"

    # Module 1: Behaviour
    beh = res["behaviour"]
    assert beh["status"] == "available"
    assert beh["label"] in ["grazing", "resting", "walking", "active_mount", "head_nodding"]
    assert isinstance(beh["probabilities"], dict)

    # Module 2: Anomaly
    anom = res["anomaly"]
    assert anom["status"] == "available"
    assert isinstance(anom["detected"], bool)
    assert isinstance(anom["score"], float)

    # Module 3: Rumination
    rum = res["rumination"]
    assert rum["status"] == "available"
    assert isinstance(rum["is_ruminating"], bool)
    assert isinstance(rum["probability"], float)
    assert 0.0 <= rum["probability"] <= 1.0
    assert "chewing_rhythm_score" in rum

    # Module 4: Estrus
    estrus = res["estrus"]
    assert estrus["status"] == "available"
    assert isinstance(estrus["detected"], bool)
    assert estrus["risk_level"] in ["LOW", "MODERATE", "HIGH"]
    assert 0.0 <= estrus["estrus_probability"] <= 1.0
    assert "mount_detected" in estrus

    # Module 5: Lameness
    lame = res["lameness"]
    assert lame["status"] == "available"
    assert isinstance(lame["locomotion_score"], (int, float))
    assert 1.0 <= lame["locomotion_score"] <= 5.0
    assert lame["temperature_status"] in ["NORMAL", "ELEVATED_FEVER_RISK", "LOW_OR_DISLODGED"]
    assert lame["contact_temperature_c"] == 38.6


def test_dedicated_ai_endpoints():
    """Verify dedicated endpoints: /ai/rumination, /ai/estrus, /ai/lameness."""
    cow_id = "COW-FIVE-TEST"

    # Test /ai/rumination
    resp_rum = client.get(f"/ai/rumination?cow_id={cow_id}")
    assert resp_rum.status_code == 200
    data_rum = resp_rum.json()
    assert data_rum["cow_id"] == cow_id
    assert data_rum["rumination"]["status"] == "available"

    # Test /ai/estrus
    resp_estrus = client.get(f"/ai/estrus?cow_id={cow_id}")
    assert resp_estrus.status_code == 200
    data_estrus = resp_estrus.json()
    assert data_estrus["cow_id"] == cow_id
    assert data_estrus["estrus"]["status"] == "available"

    # Test /ai/lameness
    resp_lame = client.get(f"/ai/lameness?cow_id={cow_id}")
    assert resp_lame.status_code == 200
    data_lame = resp_lame.json()
    assert data_lame["cow_id"] == cow_id
    assert data_lame["lameness"]["status"] == "available"


def test_estrus_mount_detection_trigger():
    """Verify that an active mounting telemetry window triggers high estrus alert."""
    cow_id = "COW-MOUNT-TEST"

    # High dynamic acceleration burst simulating active mounting / standing heat
    mount_readings = [
        {
            "cow_id": cow_id,
            "device_id": "ESP32-COLLAR-TEST",
            "timestamp": f"2026-10-29T11:00:{i:02d}Z",
            "sensors": {
                "accel_x": 0.70 + (i * 0.02),
                "accel_y": 1.45,
                "accel_z": 0.85,
                "gyro_x": 45.0,
                "gyro_y": 25.0,
                "gyro_z": -30.0,
                "temperature_c": 38.9,
            },
        }
        for i in range(25)
    ]

    client.post("/sensor-data/batch", json=mount_readings)
    resp = client.get(f"/ai/estrus?cow_id={cow_id}")
    assert resp.status_code == 200
    estrus_data = resp.json()["estrus"]
    assert estrus_data["status"] == "available"
    # Dynamic surge should elevate estrus risk
    assert estrus_data["activity_surge"] > 0.20
    assert estrus_data["risk_level"] in ["MODERATE", "HIGH"]


def test_thermal_fever_alert():
    """Verify that elevated skin temperature flags fever status in lameness/health."""
    cow_id = "COW-FEVER-TEST"

    fever_readings = [
        {
            "cow_id": cow_id,
            "device_id": "ESP32-COLLAR-TEST",
            "timestamp": f"2026-10-29T12:00:{i:02d}Z",
            "sensors": {
                "accel_x": 0.1,
                "accel_y": 0.9,
                "accel_z": 0.2,
                "gyro_x": 1.0,
                "gyro_y": 1.0,
                "gyro_z": 1.0,
                "temperature_c": 40.2,  # Fever (> 39.5)
            },
        }
        for i in range(25)
    ]

    client.post("/sensor-data/batch", json=fever_readings)
    resp = client.get(f"/ai/lameness?cow_id={cow_id}")
    assert resp.status_code == 200
    lame_data = resp.json()["lameness"]
    assert lame_data["status"] == "available"
    assert lame_data["temperature_status"] == "ELEVATED_FEVER_RISK"
    assert lame_data["risk_level"] == "HIGH"
    assert "thermal" in lame_data["interpretation"].lower() or "fever" in lame_data["interpretation"].lower()
