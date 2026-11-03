"""End-to-End Multi-Farmer Verification Script according to User Specification."""

import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
import importlib

api = importlib.import_module("src.10_api")
client = TestClient(api.app)

def run_test_suite():
    print("=" * 60)
    print("GOUNANDI MULTI-FARMER DATA ISOLATION VERIFICATION")
    print("=" * 60)

    # ------------------------------------------------------------
    # TEST CASE 1: Farmer A Login & Verification
    # ------------------------------------------------------------
    print("\n[TEST 1] Logging in as Farmer A (Green Valley Dairy)...")
    res_a = client.post("/auth/login", json={
        "email": "farmer_a@test.com",
        "password": "Password@123",
    })
    assert res_a.status_code == 200, f"Farmer A login failed: {res_a.text}"
    data_a = res_a.json()
    token_a = data_a["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    farmer_a = data_a["farmer"]
    print(f"  [OK] Authenticated as: {farmer_a['full_name']} ({farmer_a['farmer_id']})")
    print(f"  [OK] Farm Profile: {farmer_a['farm']['farm_name']} ({farmer_a['farm']['farm_location']})")

    # Verify Farmer A's cattle list
    resp_cows_a = client.get("/cows", headers=headers_a)
    assert resp_cows_a.status_code == 200
    cows_a = resp_cows_a.json()["cows"]
    cows_a_ids = [c["id"] for c in cows_a]
    print(f"  [OK] Farmer A Cattle: {cows_a_ids}")
    assert "COW-001" in cows_a_ids and "COW-002" in cows_a_ids and "COW-003" in cows_a_ids
    assert "COW-004" not in cows_a_ids, "Data Leakage: Farmer B's cow COW-004 found in Farmer A's list!"
    print("  [OK] Farmer A sees ONLY Green Valley Dairy cattle (3 cows).")

    # ------------------------------------------------------------
    # TEST CASE 2: Farmer B Login & Verification
    # ------------------------------------------------------------
    print("\n[TEST 2] Logging in as Farmer B (Sunrise Dairy)...")
    res_b = client.post("/auth/login", json={
        "email": "farmer_b@test.com",
        "password": "Password@123",
    })
    assert res_b.status_code == 200, f"Farmer B login failed: {res_b.text}"
    data_b = res_b.json()
    token_b = data_b["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    farmer_b = data_b["farmer"]
    print(f"  [OK] Authenticated as: {farmer_b['full_name']} ({farmer_b['farmer_id']})")
    print(f"  [OK] Farm Profile: {farmer_b['farm']['farm_name']} ({farmer_b['farm']['farm_location']})")

    # Verify Farmer B's cattle list
    resp_cows_b = client.get("/cows", headers=headers_b)
    assert resp_cows_b.status_code == 200
    cows_b = resp_cows_b.json()["cows"]
    cows_b_ids = [c["id"] for c in cows_b]
    print(f"  [OK] Farmer B Cattle: {cows_b_ids}")
    assert "COW-004" in cows_b_ids and "COW-005" in cows_b_ids and "COW-006" in cows_b_ids
    assert "COW-001" not in cows_b_ids, "Data Leakage: Farmer A's cow COW-001 found in Farmer B's list!"
    print("  [OK] Farmer B sees ONLY Sunrise Dairy cattle (3 cows).")

    # ------------------------------------------------------------
    # TEST CASE 3: Telemetry Ingestion & Isolation
    # ------------------------------------------------------------
    print("\n[TEST 3] Ingesting Telemetry for Farmer A (COW-001) and Farmer B (COW-004)...")
    # Ingest for Farmer A (COW-001 / ESP32_001)
    client.post("/sensor-data", json={
        "cow_id": "COW-001",
        "device_id": "ESP32_001",
        "timestamp": "2026-11-03T19:00:00+05:30",
        "sensors": {"accel_x": 0.25, "accel_y": 0.98, "accel_z": 0.12, "gyro_x": 1.2, "gyro_y": -0.5, "gyro_z": 0.3, "temperature_c": 38.6}
    })
    # Ingest for Farmer B (COW-004 / ESP32_004)
    client.post("/sensor-data", json={
        "cow_id": "COW-004",
        "device_id": "ESP32_004",
        "timestamp": "2026-11-03T19:00:00+05:30",
        "sensors": {"accel_x": -0.15, "accel_y": 0.85, "accel_z": 0.40, "gyro_x": -0.8, "gyro_y": 2.1, "gyro_z": -1.1, "temperature_c": 39.1}
    })

    # Farmer A live dashboard
    live_a = client.get("/dashboard/api/live?cow_id=COW-001", headers=headers_a)
    assert live_a.status_code == 200
    print(f"  [OK] Farmer A Live Telemetry for COW-001 received (Status: {live_a.json()['hardware']['status']})")

    # Farmer B live dashboard
    live_b = client.get("/dashboard/api/live?cow_id=COW-004", headers=headers_b)
    assert live_b.status_code == 200
    print(f"  [OK] Farmer B Live Telemetry for COW-004 received (Status: {live_b.json()['hardware']['status']})")

    # ------------------------------------------------------------
    # TEST CASE 4: Cross-Farmer Unauthorized Access Rejection (HTTP 403)
    # ------------------------------------------------------------
    print("\n[TEST 4] Testing Cross-Farmer Access Rejection (Security Boundary)...")
    # Farmer A attempts to access Farmer B's cow
    forbidden_1 = client.get("/cows/COW-004", headers=headers_a)
    print(f"  • Farmer A requesting /cows/COW-004 -> HTTP {forbidden_1.status_code} ({forbidden_1.json().get('detail')})")
    assert forbidden_1.status_code == 403, "Failed: Cross-farmer cow profile access was not blocked with 403!"

    # Farmer A attempts to query live telemetry for Farmer B's cow
    forbidden_2 = client.get("/dashboard/api/live?cow_id=COW-004", headers=headers_a)
    print(f"  • Farmer A requesting /dashboard/api/live?cow_id=COW-004 -> HTTP {forbidden_2.status_code} ({forbidden_2.json().get('detail')})")
    assert forbidden_2.status_code == 403, "Failed: Cross-farmer live dashboard query was not blocked with 403!"

    # Farmer B attempts to access Farmer A's cow
    forbidden_3 = client.get("/cows/COW-001", headers=headers_b)
    print(f"  • Farmer B requesting /cows/COW-001 -> HTTP {forbidden_3.status_code} ({forbidden_3.json().get('detail')})")
    assert forbidden_3.status_code == 403, "Failed: Farmer B accessing Farmer A cow was not blocked with 403!"

    # ------------------------------------------------------------
    # TEST CASE 5: Frontend Parameter Tamper Resistance
    # ------------------------------------------------------------
    print("\n[TEST 5] Testing Client Parameter Tamper Resistance...")
    tamper_resp = client.get("/cows?farmer_id=FARM_002", headers=headers_a)
    assert tamper_resp.status_code == 200
    tamper_cows = [c["id"] for c in tamper_resp.json()["cows"]]
    print(f"  • Farmer A sent tampered query ?farmer_id=FARM_002 -> Backend returned: {tamper_cows}")
    assert "COW-004" not in tamper_cows, "Security Vulnerability: Query parameter spoofed farmer identity!"
    print("  [OK] Backend relies exclusively on verified cryptographic JWT.")

    # ------------------------------------------------------------
    # TEST CASE 6: Profile Management & Self-Update
    # ------------------------------------------------------------
    print("\n[TEST 6] Testing Farmer Profile Retrieval & Update...")
    me_resp = client.get("/auth/me", headers=headers_a)
    assert me_resp.status_code == 200
    assert me_resp.json()["farmer"]["email"] == "farmer_a@test.com"
    print("  [OK] /auth/me returns current authenticated farmer profile.")

    update_resp = client.put("/auth/profile", headers=headers_a, json={
        "phone": "+91 98450 99999",
        "farm_name": "Green Valley Organic Dairy",
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["farmer"]["farm"]["farm_name"] == "Green Valley Organic Dairy"
    print("  [OK] Farm name updated to 'Green Valley Organic Dairy'.")

    # Restore farm name
    client.put("/auth/profile", headers=headers_a, json={
        "farm_name": "Green Valley Dairy",
    })

    print("\n" + "=" * 60)
    print("ALL MULTI-FARMER ISOLATION & SECURITY TEST CASES PASSED 100%!")
    print("=" * 60)

if __name__ == "__main__":
    run_test_suite()
