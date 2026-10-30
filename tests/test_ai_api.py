"""Integration tests for new AI API endpoints and Dashboard route."""

import importlib
from pathlib import Path
import sys
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

api_module = importlib.import_module("src.10_api")
app = api_module.app
client = TestClient(app)


def test_dashboard_endpoint():
    """Verify that /dashboard returns the HTML dashboard."""
    response = client.get("/dashboard")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "Smart Livestock Monitoring" in response.text
    assert "COW-001" in response.text


def test_ai_status_endpoint():
    """Verify that /ai/status reports model and buffer readiness."""
    response = client.get("/ai/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "behaviour_model" in data
    assert "anomaly_model" in data
    assert data["behaviour_model"]["input_features"] == 72
    assert data["anomaly_model"]["input_features"] == 72
    assert len(data["behaviour_model"]["classes"]) == 5


def test_ai_latest_empty_state():
    """Verify /ai/latest returns insufficient_data for an unknown or unbuffered cow."""
    response = client.get("/ai/latest?cow_id=COW-UNBUFFERED-99")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "insufficient_data"
    assert data["behaviour"]["status"] == "not_available"
    assert data["rumination"]["status"] == "not_available"
    assert data["estrus"]["status"] == "not_available"
    assert data["lameness"]["status"] == "not_available"


def test_sensor_batch_ingestion_and_ai_inference():
    """Verify POST /sensor-data/batch ingests readings and triggers live inference."""
    cow_id = "COW-INTEGRATION-01"
    batch_payload = [
        {
            "cow_id": cow_id,
            "device_id": "ESP32-COLLAR-TEST",
            "timestamp": f"2026-10-28T14:00:{i:02d}Z",
            "sensors": {
                "accel_x": 0.05 + (i * 0.002),
                "accel_y": 0.1,
                "accel_z": 0.98,
                "gyro_x": 0.5,
                "gyro_y": -0.2,
                "gyro_z": 0.1,
                "temperature_c": 38.6,
            },
        }
        for i in range(25)
    ]

    # Ingest batch
    resp_batch = client.post("/sensor-data/batch", json=batch_payload)
    assert resp_batch.status_code == 201
    assert resp_batch.json()["count"] == 25

    # Check /ai/latest
    resp_latest = client.get(f"/ai/latest?cow_id={cow_id}")
    assert resp_latest.status_code == 200
    latest_data = resp_latest.json()
    assert latest_data["status"] == "available"
    assert latest_data["behaviour"]["status"] == "available"
    assert latest_data["behaviour"]["label"] is not None
    assert latest_data["anomaly"]["status"] == "available"

    # Check /ai/behaviour
    resp_beh = client.get(f"/ai/behaviour?cow_id={cow_id}")
    assert resp_beh.status_code == 200
    beh_data = resp_beh.json()
    assert beh_data["behaviour"]["status"] == "available"

    # Check /ai/anomalies
    resp_anom = client.get(f"/ai/anomalies?cow_id={cow_id}")
    assert resp_anom.status_code == 200
    anom_data = resp_anom.json()
    assert "current_anomaly" in anom_data

    # Check /ai/history
    resp_hist = client.get(f"/ai/history?cow_id={cow_id}")
    assert resp_hist.status_code == 200
    hist_data = resp_hist.json()
    assert hist_data["count"] >= 1
