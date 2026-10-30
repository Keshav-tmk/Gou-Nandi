"""End-to-end integration test client for Smart Livestock Monitoring API.

Tests all active endpoints against a running backend instance:
1. Root metadata (GET /)
2. Health & model readiness check (GET /health)
3. Combined monitoring status (GET /status)
4. Behaviour classification (POST /predict/behaviour)
5. Anomaly detection (POST /detect/anomaly)
6. Rumination monitoring (POST /predict/rumination)
7. Estrus screening (POST /predict/estrus)
8. Lameness screening (POST /predict/lameness)
9. Hardware sensor ingestion (POST /sensor-data)
"""

from __future__ import annotations

import json
from pathlib import Path
import sys
import joblib
import requests

BASE_URL = "http://127.0.0.1:8000"
ROOT = Path(__file__).resolve().parent
MODELS = ROOT / "models"

total_tests = 0
passed_tests = 0


def log_test(name: str, passed: bool, detail: str = ""):
    global total_tests, passed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
        print(f" [PASS] {name} {detail}")
    else:
        print(f" [FAIL] {name} {detail}")


def check_server_online() -> bool:
    print(f"\nConnecting to backend server at {BASE_URL}...")
    try:
        resp = requests.get(f"{BASE_URL}/", timeout=5)
        if resp.status_code == 200:
            print(" Connected to Smart Livestock Monitoring API.")
            return True
        else:
            print(f" Server returned HTTP {resp.status_code}")
            return False
    except requests.RequestException as exc:
        print(f" Could not connect to {BASE_URL}: {exc}")
        print(" Please start the server using scripts\\start_backend.ps1 before running this test.")
        return False


def run_tests():
    if not check_server_online():
        sys.exit(1)

    print("\n" + "=" * 60)
    print("RUNNING END-TO-END ENDPOINT VERIFICATION")
    print("=" * 60)

    # 1. Root Endpoint
    try:
        resp = requests.get(f"{BASE_URL}/", timeout=10)
        log_test("GET / (Root)", resp.status_code == 200, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("GET / (Root)", False, str(e))

    # 2. Health Endpoint
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        data = resp.json()
        ready = resp.status_code == 200 and data.get("models_ready") is True
        log_test("GET /health", ready, f"Status: {data.get('status')}, Models Ready: {data.get('models_ready')}")
    except Exception as e:
        log_test("GET /health", False, str(e))

    # 3. Status Endpoint
    try:
        resp = requests.get(f"{BASE_URL}/status", timeout=10)
        data = resp.json()
        log_test("GET /status", resp.status_code == 200, f"Hardware State: {data.get('api_runtime', {}).get('hardware_connection')}")
    except Exception as e:
        log_test("GET /status", False, str(e))

    # 4. Behaviour Prediction
    try:
        b_bundle = joblib.load(MODELS / "cow_behaviour_random_forest.joblib")
        b_cols = b_bundle["feature_columns"]
        payload = {"features": {col: 0.05 for col in b_cols}}
        resp = requests.post(f"{BASE_URL}/predict/behaviour", json=payload, timeout=30)
        data = resp.json()
        log_test("POST /predict/behaviour", resp.status_code == 200, f"Predicted: '{data.get('predicted_behaviour')}' (Features: {len(b_cols)})")
    except Exception as e:
        log_test("POST /predict/behaviour", False, str(e))

    # 5. Anomaly Detection
    try:
        a_bundle = joblib.load(MODELS / "cow_activity_isolation_forest.joblib")
        a_cols = a_bundle["feature_columns"]
        payload = {"features": {col: 0.02 for col in a_cols}}
        resp = requests.post(f"{BASE_URL}/detect/anomaly", json=payload, timeout=30)
        data = resp.json()
        log_test("POST /detect/anomaly", resp.status_code == 200, f"Anomaly Flag: {data.get('anomaly_detected')}, Score: {data.get('decision_score')}")
    except Exception as e:
        log_test("POST /detect/anomaly", False, str(e))

    # 6. Rumination Prediction
    try:
        r_bundle = joblib.load(MODELS / "rumination_classifier_bundle.joblib")
        s_cols = r_bundle["sensor_columns"]
        readings = [
            {col: 0.1 for col in s_cols},
            {col: 0.2 for col in s_cols},
            {col: 0.15 for col in s_cols},
        ]
        resp = requests.post(f"{BASE_URL}/predict/rumination", json={"readings": readings}, timeout=30)
        data = resp.json()
        log_test("POST /predict/rumination", resp.status_code == 200, f"Rumination: {data.get('rumination_class')}, Behaviour: '{data.get('predicted_behaviour')}'")
    except Exception as e:
        log_test("POST /predict/rumination", False, str(e))

    # 7. Estrus Prediction
    try:
        e_bundle = joblib.load(MODELS / "estrus" / "oestrus_day_random_forest.joblib")
        e_cols = e_bundle["features"]
        payload = {"features": {col: 0.1 for col in e_cols}}
        resp = requests.post(f"{BASE_URL}/predict/estrus", json=payload, timeout=30)
        data = resp.json()
        log_test("POST /predict/estrus", resp.status_code == 200, f"Label: {data.get('label')}, Probability: {data.get('probability_positive')}")
    except Exception as e:
        log_test("POST /predict/estrus", False, str(e))

    # 8. Lameness Prediction
    try:
        l_bundle = joblib.load(MODELS / "lameness" / "lameness_day_random_forest.joblib")
        l_cols = l_bundle["features"]
        payload = {"features": {col: 0.1 for col in l_cols}}
        resp = requests.post(f"{BASE_URL}/predict/lameness", json=payload, timeout=30)
        data = resp.json()
        log_test("POST /predict/lameness", resp.status_code == 200, f"Label: {data.get('label')}, Probability: {data.get('probability_positive')}")
    except Exception as e:
        log_test("POST /predict/lameness", False, str(e))

    # 9. ESP32 Hardware Sensor Ingestion
    try:
        esp_payload = {
            "cow_id": "COW-001",
            "device_id": "ESP32-COLLAR-01",
            "timestamp": "2026-10-28T10:30:00Z",
            "sensors": {
                "acc_x": 0.02,
                "acc_y": 0.98,
                "acc_z": 0.15,
                "gir_x": 0.01,
                "gir_y": 0.02,
                "gir_z": 0.00,
                "mag_x": 23.4,
                "mag_y": -12.1,
                "mag_z": 45.2,
                "temperature_c": 38.5,
            },
        }
        resp = requests.post(f"{BASE_URL}/sensor-data", json=esp_payload, timeout=10)
        data = resp.json()
        log_test("POST /sensor-data (Valid)", resp.status_code == 201, f"Recorded {data.get('sensor_count')} sensors for {data.get('cow_id')}")
    except Exception as e:
        log_test("POST /sensor-data (Valid)", False, str(e))

    # 10. ESP32 Invalid Sensor Ingestion Rejection
    try:
        invalid_payload = {
            "cow_id": "COW-001",
            "device_id": "ESP32-COLLAR-01",
            "timestamp": "invalid-timestamp",
            "sensors": {"temperature_c": 999.0},
        }
        resp = requests.post(f"{BASE_URL}/sensor-data", json=invalid_payload, timeout=10)
        log_test("POST /sensor-data (Invalid Rejected)", resp.status_code == 422, f"Expected 422, got HTTP {resp.status_code}")
    except Exception as e:
        log_test("POST /sensor-data (Invalid Rejected)", False, str(e))

    # 11. Dashboard Route
    try:
        resp = requests.get(f"{BASE_URL}/dashboard", timeout=10)
        log_test("GET /dashboard (Web UI)", resp.status_code == 200 and "Smart Livestock" in resp.text, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("GET /dashboard (Web UI)", False, str(e))

    # 12. AI Status Endpoint
    try:
        resp = requests.get(f"{BASE_URL}/ai/status", timeout=10)
        data = resp.json()
        log_test("GET /ai/status", resp.status_code == 200 and data.get("status") == "online", f"Models loaded: {data.get('behaviour_model', {}).get('loaded')}")
    except Exception as e:
        log_test("GET /ai/status", False, str(e))

    # 13. ESP32 Batch Ingestion
    try:
        batch_payload = [
            {
                "cow_id": "COW-001",
                "device_id": "ESP32-COLLAR-01",
                "timestamp": f"2026-10-28T16:00:{i:02d}Z",
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
        resp = requests.post(f"{BASE_URL}/sensor-data/batch", json=batch_payload, timeout=10)
        log_test("POST /sensor-data/batch", resp.status_code == 201, f"Ingested {resp.json().get('count')} readings")
    except Exception as e:
        log_test("POST /sensor-data/batch", False, str(e))

    # 14. Real-Time AI Latest Inference
    try:
        resp = requests.get(f"{BASE_URL}/ai/latest?cow_id=COW-001&window_size=20", timeout=10)
        data = resp.json()
        beh = data.get("behaviour", {}).get("label")
        log_test("GET /ai/latest", resp.status_code == 200 and data.get("status") == "available", f"Predicted: '{beh}', Anomaly: {data.get('anomaly', {}).get('detected')}")
    except Exception as e:
        log_test("GET /ai/latest", False, str(e))

    # 15. Real-Time AI Prediction History
    try:
        resp = requests.get(f"{BASE_URL}/ai/history?cow_id=COW-001&limit=10", timeout=10)
        data = resp.json()
        log_test("GET /ai/history", resp.status_code == 200 and data.get("count", 0) >= 1, f"History records: {data.get('count')}")
    except Exception as e:
        log_test("GET /ai/history", False, str(e))

    # 16. Real-Time Rumination Endpoint
    try:
        resp = requests.get(f"{BASE_URL}/ai/rumination?cow_id=COW-001", timeout=10)
        data = resp.json()
        rum = data.get("rumination", {})
        log_test("GET /ai/rumination", resp.status_code == 200 and rum.get("status") == "available", f"Is Ruminating: {rum.get('is_ruminating')}, Prob: {rum.get('probability')}")
    except Exception as e:
        log_test("GET /ai/rumination", False, str(e))

    # 17. Real-Time Estrus Endpoint
    try:
        resp = requests.get(f"{BASE_URL}/ai/estrus?cow_id=COW-001", timeout=10)
        data = resp.json()
        est = data.get("estrus", {})
        log_test("GET /ai/estrus", resp.status_code == 200 and est.get("status") == "available", f"Risk Level: {est.get('risk_level')}, Prob: {est.get('estrus_probability')}")
    except Exception as e:
        log_test("GET /ai/estrus", False, str(e))

    # 18. Real-Time Lameness & Thermal Endpoint
    try:
        resp = requests.get(f"{BASE_URL}/ai/lameness?cow_id=COW-001", timeout=10)
        data = resp.json()
        lame = data.get("lameness", {})
        log_test("GET /ai/lameness", resp.status_code == 200 and lame.get("status") == "available", f"Score: {lame.get('locomotion_score')}, Temp: {lame.get('contact_temperature_c')}°C")
    except Exception as e:
        log_test("GET /ai/lameness", False, str(e))

    # 19. Consolidated Live Dashboard API Contract
    try:
        resp = requests.get(f"{BASE_URL}/dashboard/api/live?cow_id=COW-001", timeout=10)
        data = resp.json()
        valid = (
            resp.status_code == 200
            and data.get("api", {}).get("status") == "online"
            and data.get("hardware", {}).get("status") in ("online", "stale")
            and data.get("window", {}).get("ready") is True
            and data.get("ai", {}).get("behaviour", {}).get("status") == "available"
        )
        log_test("GET /dashboard/api/live", valid, f"Hardware: {data.get('hardware', {}).get('status')}, Behaviour: {data.get('ai', {}).get('behaviour', {}).get('label')}")
    except Exception as e:
        log_test("GET /dashboard/api/live", False, str(e))

    print("=" * 60)
    print(f"VERIFICATION COMPLETE: {passed_tests}/{total_tests} tests passed.")
    print("=" * 60 + "\n")

    if passed_tests < total_tests:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
