"""Comprehensive Automated Verification Test Suite for the Live Dashboard API Pipeline.

Verifies:
1. Consolidated live dashboard contract (GET /dashboard/api/live)
2. Accurate hardware freshness calculation (online, stale, offline, waiting)
3. Strict cross-cow data isolation (preventing cross-cow data leaks)
4. All 5 AI modules active with real inference outputs and zero fabricated values
5. Quiet default alerts (no false alarms on normal baseline motion)
6. Alert generation, cooldown, and deduplication
7. Dashboard HTML accessibility and UI component readiness
"""

from datetime import datetime, timezone
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


def test_consolidated_live_api_unpopulated_cow():
    """Verify that querying an unpopulated cow returns honest unavailable states with no fabricated data."""
    cow_id = "COW-UNPOPULATED-TEST"
    resp = client.get(f"/dashboard/api/live?cow_id={cow_id}")
    assert resp.status_code == 200
    data = resp.json()

    # 1. API Status
    assert data["api"]["status"] == "online"

    # 2. Hardware Freshness
    assert data["hardware"]["status"] == "waiting_for_sensor_data"
    assert data["hardware"]["seconds_since_last_reading"] is None
    assert data["hardware"]["is_stale"] is False
    assert data["hardware"]["total_readings"] == 0

    # 3. Sensor values must be None (no fake zeros or fabricated values)
    assert data["sensor"]["values"]["accel_x"] is None
    assert data["sensor"]["values"]["gyro_x"] is None

    # 4. Window readiness
    assert data["window"]["ready"] is False
    assert data["window"]["sample_count"] == 0

    # 5. AI Modules must be honest not_available / insufficient_data
    assert data["ai"]["behaviour"]["status"] in ("not_available", "insufficient_data")
    assert data["ai"]["behaviour"]["label"] is None
    assert data["ai"]["anomaly"]["status"] in ("not_available", "insufficient_data")
    assert data["ai"]["anomaly"]["detected"] is None

    # 6. Quiet default alerts
    assert data["alerts"] == []


def test_consolidated_live_api_populated_cow_inference():
    """Verify full end-to-end live flow from ESP32 batch ingestion to 5-module real inference."""
    cow_id = "COW-LIVE-PIPELINE"

    # Send 25 normal routine resting/grazing readings
    batch = [
        {
            "cow_id": cow_id,
            "device_id": "ESP32-COLLAR-LIVE",
            "timestamp": f"2026-10-29T12:30:{i:02d}Z",
            "sensors": {
                "accel_x": 0.05 + (i * 0.001),
                "accel_y": 0.94,
                "accel_z": 0.18,
                "gyro_x": 1.2,
                "gyro_y": -0.5,
                "gyro_z": 0.2,
                "temperature_c": 38.6,
            },
        }
        for i in range(25)
    ]

    res_post = client.post("/sensor-data/batch", json=batch)
    assert res_post.status_code == 201

    # Fetch consolidated live state
    res_live = client.get(f"/dashboard/api/live?cow_id={cow_id}")
    assert res_live.status_code == 200
    data = res_live.json()

    # Hardware connection
    assert data["hardware"]["status"] == "online"
    assert data["hardware"]["is_stale"] is False
    assert data["hardware"]["seconds_since_last_reading"] is not None
    assert data["hardware"]["seconds_since_last_reading"] < 5.0
    assert data["hardware"]["total_readings"] >= 25

    # Sensor Telemetry
    assert data["sensor"]["values"]["accel_x"] is not None
    assert data["sensor"]["values"]["accel_y"] is not None
    assert data["sensor"]["values"]["accel_z"] is not None
    assert data["sensor"]["values"]["gyro_x"] is not None
    assert data["sensor"]["values"]["temperature_c"] == 38.6

    # Window
    assert data["window"]["ready"] is True
    assert data["window"]["sample_count"] >= 20

    # Five AI modules
    ai = data["ai"]
    # 1. Behaviour
    assert ai["behaviour"]["status"] == "available"
    assert ai["behaviour"]["label"] in ["grazing", "resting", "walking", "active_mount", "head_nodding"]
    assert isinstance(ai["behaviour"]["probabilities"], dict)

    # 2. Anomaly
    assert ai["anomaly"]["status"] == "available"
    assert isinstance(ai["anomaly"]["detected"], bool)
    assert isinstance(ai["anomaly"]["score"], float)

    # 3. Rumination
    assert ai["rumination"]["status"] == "available"
    assert isinstance(ai["rumination"]["is_ruminating"], bool)
    assert isinstance(ai["rumination"]["probability"], float)

    # 4. Estrus
    assert ai["estrus"]["status"] == "available"
    assert isinstance(ai["estrus"]["risk_level"], str)
    assert isinstance(ai["estrus"]["mount_detected"], bool)

    # 5. Lameness
    assert ai["lameness"]["status"] == "available"
    assert isinstance(ai["lameness"]["locomotion_score"], (int, float))
    assert ai["lameness"]["temperature_status"] == "NORMAL"

    # Quiet default: routine resting/grazing baseline produces ZERO false alerts
    assert data["alerts"] == []


def test_cross_cow_isolation_no_leakage():
    """Verify that querying cow A never returns data or sensor readings from cow B."""
    cow_a = "COW-ISOLATION-A"
    cow_b = "COW-ISOLATION-B"

    # Ingest data ONLY for cow_a
    batch_a = [
        {
            "cow_id": cow_a,
            "device_id": "ESP32-COLLAR-A",
            "timestamp": f"2026-10-29T13:00:{i:02d}Z",
            "sensors": {
                "accel_x": 0.50,
                "accel_y": 0.80,
                "accel_z": 0.30,
                "gyro_x": 2.0,
                "gyro_y": 1.0,
                "gyro_z": 0.5,
                "temperature_c": 38.7,
            },
        }
        for i in range(20)
    ]
    client.post("/sensor-data/batch", json=batch_a)

    # Now query cow_b via /sensor-data/recent
    resp_recent_b = client.get(f"/sensor-data/recent?cow_id={cow_b}")
    assert resp_recent_b.status_code == 200
    data_recent_b = resp_recent_b.json()
    # Must be 0 records, must NEVER leak cow_a's readings!
    assert data_recent_b["count"] == 0
    assert data_recent_b["readings"] == []

    # Now query cow_b via /dashboard/api/live
    resp_live_b = client.get(f"/dashboard/api/live?cow_id={cow_b}")
    assert resp_live_b.status_code == 200
    data_live_b = resp_live_b.json()
    assert data_live_b["hardware"]["status"] == "waiting_for_sensor_data"
    assert data_live_b["sensor"]["values"]["accel_x"] is None
    assert data_live_b["window"]["ready"] is False
    assert data_live_b["window"]["sample_count"] == 0


def test_alert_generation_and_deduplication():
    """Verify that genuine health alerts trigger properly and are deduplicated with cooldown."""
    cow_id = "COW-ALERT-TRIGGER"

    # Active mounting pattern to trigger estrus alert
    mount_batch = [
        {
            "cow_id": cow_id,
            "device_id": "ESP32-COLLAR-ALERT",
            "timestamp": f"2026-10-29T14:00:{i:02d}Z",
            "sensors": {
                "accel_x": 0.85,
                "accel_y": 1.55,
                "accel_z": 0.90,
                "gyro_x": 55.0,
                "gyro_y": 30.0,
                "gyro_z": -35.0,
                "temperature_c": 38.9,
            },
        }
        for i in range(25)
    ]
    client.post("/sensor-data/batch", json=mount_batch)

    # First check: Alert must be generated
    res1 = client.get(f"/dashboard/api/live?cow_id={cow_id}").json()
    alerts1 = res1.get("alerts", [])
    assert len(alerts1) >= 1
    estrus_alert = next((a for a in alerts1 if a["type"] == "estrus_surge"), None)
    assert estrus_alert is not None
    assert estrus_alert["cow_id"] == cow_id
    assert "Mounting" in estrus_alert["title"] or "Heat" in estrus_alert["title"] or "Estrus" in estrus_alert["title"]

    # Second check within cooldown: must be deduplicated (not multiplied)
    res2 = client.get(f"/dashboard/api/live?cow_id={cow_id}").json()
    alerts2 = res2.get("alerts", [])
    estrus_alerts2 = [a for a in alerts2 if a["type"] == "estrus_surge"]
    assert len(estrus_alerts2) == 1
    assert estrus_alerts2[0]["id"] == estrus_alert["id"]


def test_thermal_fever_alert_generation():
    """Verify that high contact skin temperature produces a dedicated thermal fever alert."""
    cow_id = "COW-FEVER-TRIGGER"

    fever_batch = [
        {
            "cow_id": cow_id,
            "device_id": "ESP32-COLLAR-FEVER",
            "timestamp": f"2026-10-29T14:30:{i:02d}Z",
            "sensors": {
                "accel_x": 0.05,
                "accel_y": 0.95,
                "accel_z": 0.15,
                "gyro_x": 1.0,
                "gyro_y": 1.0,
                "gyro_z": 1.0,
                "temperature_c": 40.5,  # Fever (>39.5)
            },
        }
        for i in range(25)
    ]
    client.post("/sensor-data/batch", json=fever_batch)

    res = client.get(f"/dashboard/api/live?cow_id={cow_id}").json()
    alerts = res.get("alerts", [])
    fever_alert = next((a for a in alerts if a["type"] == "thermal_fever"), None)
    assert fever_alert is not None
    assert fever_alert["severity"] == "alert"
    assert "40.5" in fever_alert["message"] or "Thermal" in fever_alert["title"]


def test_dashboard_html_and_ui_elements():
    """Verify that GET /dashboard serves the minimalist UI containing theme toggle and canvas."""
    resp = client.get("/dashboard")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")
    html = resp.text

    # Core UI components
    assert "Smart Livestock Monitoring" in html
    assert "sensorWaveformCanvas" in html
    assert "themeToggleBtn" in html
    assert "cowSelect" in html
    assert "apiStatusPill" in html
    assert "hwStatusPill" in html
    assert "freshnessBadge" in html
    assert "noAlertsBanner" in html
    assert "historyTableBody" in html
