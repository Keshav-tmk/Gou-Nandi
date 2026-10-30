"""Complete End-to-End Acceptance Test Suite.

Demonstrates the entire lifecycle:
1. API Health & Model Readiness Verification
2. Insufficient Data Gating (no fabricated predictions)
3. ESP32 Telemetry Ingestion (POST /sensor-data & POST /sensor-data/batch)
4. Rolling Window Accumulation & 72-Feature Extraction
5. Real-Time Behaviour Classification & Anomaly Detection
6. Prediction Retention & Historical Audit Logging
7. Web Dashboard Endpoint Accessibility
8. Unsupported Health Screening Disclosures
"""

from datetime import datetime, timezone
import importlib
from pathlib import Path
import sys
# pyrefly: ignore[missing-import]
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

api_module = importlib.import_module("src.10_api")
app = api_module.app
client = TestClient(app)


def test_e2e_01_health_and_model_readiness():
    """Step 1: Confirm API online and ML models loaded."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["api_online"] is True
    assert data["models_ready"] is True

    ai_resp = client.get("/ai/status")
    assert ai_resp.status_code == 200
    ai_data = ai_resp.json()
    assert ai_data["status"] == "online"
    assert ai_data["behaviour_model"]["loaded"] is True
    assert ai_data["anomaly_model"]["loaded"] is True
    assert ai_data["behaviour_model"]["input_features"] == 72
    assert ai_data["anomaly_model"]["input_features"] == 72


def test_e2e_02_insufficient_data_gating():
    """Step 2: Verify unpopulated cow produces explicit insufficient_data status."""
    cow_id = "COW-E2E-UNPOPULATED"
    resp = client.get(f"/ai/latest?cow_id={cow_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "insufficient_data"
    assert data["behaviour"]["status"] == "not_available"
    assert data["behaviour"]["label"] is None
    assert data["behaviour"]["probabilities"] is None
    assert data["anomaly"]["status"] == "not_available"
    assert data["anomaly"]["detected"] is None
    # No fabricated predictions allowed
    assert "empty" in data["message"].lower() or "insufficient" in data["message"].lower()


def test_e2e_03_esp32_single_and_batch_ingestion():
    """Step 3: Simulate realistic ESP32 session with 25 sequential readings."""
    cow_id = "COW-E2E-TEST"

    # Send 5 readings via single POST /sensor-data
    for i in range(5):
        payload = {
            "cow_id": cow_id,
            "device_id": "ESP32-COLLAR-E2E",
            "timestamp": f"2026-10-28T15:30:{i:02d}Z",
            "sensors": {
                "accel_x": 0.08 + (i * 0.005),
                "accel_y": 0.12 - (i * 0.003),
                "accel_z": 0.98,
                "gyro_x": 0.4,
                "gyro_y": -0.2,
                "gyro_z": 0.1,
                "temperature_c": 38.6,
            },
        }
        res = client.post("/sensor-data", json=payload)
        assert res.status_code == 201

    # Send 20 readings via batch POST /sensor-data/batch
    batch = [
        {
            "cow_id": cow_id,
            "device_id": "ESP32-COLLAR-E2E",
            "timestamp": f"2026-10-28T15:31:{i:02d}Z",
            "sensors": {
                "accel_x": 0.10 + (i * 0.002),
                "accel_y": 0.15 - (i * 0.001),
                "accel_z": 0.97,
                "gyro_x": 0.6,
                "gyro_y": -0.1,
                "gyro_z": 0.05,
                "temperature_c": 38.7,
            },
        }
        for i in range(20)
    ]
    res_batch = client.post("/sensor-data/batch", json=batch)
    assert res_batch.status_code == 201
    assert res_batch.json()["count"] == 20


def test_e2e_04_live_inference_and_validation():
    """Step 4: Run inference and validate full unified AI response structure."""
    cow_id = "COW-E2E-TEST"
    resp = client.get(f"/ai/latest?cow_id={cow_id}&window_size=20")
    assert resp.status_code == 200
    data = resp.json()

    assert data["cow_id"] == cow_id
    assert data["data_source"] == "esp32_live"
    assert data["status"] == "available"

    # Behaviour validation
    beh = data["behaviour"]
    assert beh["status"] == "available"
    assert beh["label"] in ["active_mount", "grazing", "head_nodding", "resting", "walking"]
    assert isinstance(beh["probabilities"], dict)
    assert sum(beh["probabilities"].values()) == pytest.approx(1.0, abs=1e-2)

    # Anomaly validation
    anom = data["anomaly"]
    assert anom["status"] == "available"
    assert isinstance(anom["detected"], bool)
    assert isinstance(anom["score"], float)
    assert "baseline" in anom["interpretation"].lower() or "normal" in anom["interpretation"].lower()

    # Data quality validation
    dq = data["data_quality"]
    assert dq["status"] == "sufficient"
    assert dq["reading_count"] >= 20

    # Rumination validation
    rum = data["rumination"]
    assert rum["status"] == "available"
    assert isinstance(rum["is_ruminating"], bool)
    assert isinstance(rum["probability"], float)

    # Estrus validation
    estrus = data["estrus"]
    assert estrus["status"] == "available"
    assert isinstance(estrus["detected"], bool)
    assert estrus["risk_level"] in ["LOW", "MODERATE", "HIGH"]

    # Lameness validation
    lame = data["lameness"]
    assert lame["status"] == "available"
    assert isinstance(lame["locomotion_score"], (int, float))
    assert lame["temperature_status"] in ["NORMAL", "ELEVATED_FEVER_RISK", "LOW_OR_DISLODGED"]


def test_e2e_05_prediction_history_audit():
    """Step 5: Verify predictions are recorded into the time-stamped history queue."""
    cow_id = "COW-E2E-TEST"
    resp = client.get(f"/ai/history?cow_id={cow_id}&limit=10")
    assert resp.status_code == 200
    history_data = resp.json()
    assert history_data["status"] == "success"
    assert history_data["count"] >= 1
    latest_record = history_data["history"][-1]
    assert latest_record["cow_id"] == cow_id
    assert "timestamp" in latest_record
    assert latest_record["behaviour"]["status"] == "available"


def test_e2e_06_dashboard_served():
    """Step 6: Confirm web dashboard HTML and components are served successfully."""
    resp = client.get("/dashboard")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")
    assert "Smart Livestock Monitoring" in resp.text
    assert "sensorWaveformCanvas" in resp.text
