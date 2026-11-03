"""Comprehensive test suite for GouNandi multi-farmer authentication and data isolation.

Validates:
1. Registration with all personal and farm fields.
2. Secure login and JWT generation.
3. Protected endpoints blocking unauthenticated access to /auth/me.
4. Strict backend data isolation between Farmer A and Farmer B.
5. Rejection of cross-farmer access attempts (HTTP 403).
6. Tamper resistance (backend relies exclusively on verified JWT).
"""

import importlib
import pytest
from fastapi.testclient import TestClient

api_module = importlib.import_module("src.10_api")
app = api_module.app
client = TestClient(app)


def test_farmer_a_login_and_token():
    """Verify Farmer A can log in and receives valid JWT token and profile."""
    resp = client.post("/auth/login", json={
        "email": "farmer_a@test.com",
        "password": "Password@123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "access_token" in data
    assert data["farmer"]["email"] == "farmer_a@test.com"
    assert data["farmer"]["farm"]["farm_name"] == "Green Valley Dairy"


def test_farmer_b_login_and_token():
    """Verify Farmer B can log in and receives valid JWT token and profile."""
    resp = client.post("/auth/login", json={
        "email": "farmer_b@test.com",
        "password": "Password@123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "access_token" in data
    assert data["farmer"]["email"] == "farmer_b@test.com"
    assert data["farmer"]["farm"]["farm_name"] == "Sunrise Dairy"


def test_login_invalid_credentials():
    """Verify login failure with incorrect credentials."""
    resp = client.post("/auth/login", json={
        "email": "farmer_a@test.com",
        "password": "WrongPassword",
    })
    assert resp.status_code == 401


def test_auth_me_requires_token():
    """Verify /auth/me rejects unauthenticated requests with 401."""
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_farmer_registration_full_flow():
    """Test registration of a new farmer with all required fields."""
    import secrets
    uniq = secrets.token_hex(3)
    new_email = f"farmer_{uniq}@dairyfarm.in"
    reg_payload = {
        "full_name": "Gopal Gowda",
        "email": new_email,
        "phone": "+91 99001 12233",
        "password": "SecurePassword123",
        "confirm_password": "SecurePassword123",
        "farm_name": "Nandi Hills Organic Dairy",
        "farm_location": "Devanahalli Road",
        "district": "Tumakuru",
        "state": "Karnataka",
        "number_of_cattle": 5,
    }
    resp = client.post("/auth/register", json=reg_payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "success"
    assert "access_token" in data
    assert data["farmer"]["email"] == new_email
    assert data["farmer"]["farm"]["farm_name"] == "Nandi Hills Organic Dairy"

    # Verify duplicate email registration is rejected
    dup_resp = client.post("/auth/register", json=reg_payload)
    assert dup_resp.status_code == 409


def test_registration_password_mismatch():
    """Verify registration fails if passwords do not match."""
    payload = {
        "full_name": "Test Mismatch",
        "email": "mismatch@test.com",
        "phone": "+91 99999 88888",
        "password": "Password1",
        "confirm_password": "Password2",
        "farm_name": "Mismatch Farm",
        "farm_location": "Nowhere",
    }
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 400


def test_farmer_data_isolation_cows_list():
    """TEST CASES 1 to 4: Verify Farmer A and Farmer B see only their own cattle."""
    # Farmer A Login
    res_a = client.post("/auth/login", json={"email": "farmer_a@test.com", "password": "Password@123"})
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Farmer B Login
    res_b = client.post("/auth/login", json={"email": "farmer_b@test.com", "password": "Password@123"})
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Farmer A Cattle List
    resp_cows_a = client.get("/cows", headers=headers_a)
    assert resp_cows_a.status_code == 200
    cows_a = resp_cows_a.json()["cows"]
    cow_ids_a = [c["id"] for c in cows_a]
    assert "COW-001" in cow_ids_a
    assert "COW-002" in cow_ids_a
    assert "COW-003" in cow_ids_a
    assert "COW-004" not in cow_ids_a  # Farmer B's cow must NOT appear!
    assert "COW-005" not in cow_ids_a
    assert "COW-006" not in cow_ids_a

    # Farmer B Cattle List
    resp_cows_b = client.get("/cows", headers=headers_b)
    assert resp_cows_b.status_code == 200
    cows_b = resp_cows_b.json()["cows"]
    cow_ids_b = [c["id"] for c in cows_b]
    assert "COW-004" in cow_ids_b
    assert "COW-005" in cow_ids_b
    assert "COW-006" in cow_ids_b
    assert "COW-001" not in cow_ids_b  # Farmer A's cow must NOT appear!
    assert "COW-002" not in cow_ids_b


def test_cross_farmer_cattle_access_rejected_403():
    """TEST CASE 5: Attempt to access Farmer B's cow record using Farmer A's account."""
    res_a = client.post("/auth/login", json={"email": "farmer_a@test.com", "password": "Password@123"})
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Farmer A tries to access COW-004 (Farmer B's cow)
    resp = client.get("/cows/COW-004", headers=headers_a)
    assert resp.status_code == 403, "Backend must return 403 Forbidden on unauthorized cross-farmer cow access"

    # Farmer A tries to query live dashboard for COW-004
    resp_live = client.get("/dashboard/api/live?cow_id=COW-004", headers=headers_a)
    assert resp_live.status_code == 403, "Backend must return 403 Forbidden on unauthorized cross-farmer live telemetry"


def test_tamper_resistance_frontend_farmer_id_ignored():
    """TEST CASE 6: Verify modifying farmer ID query parameter has no effect on authenticated query."""
    res_a = client.post("/auth/login", json={"email": "farmer_a@test.com", "password": "Password@123"})
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Query with attempted query param tamper ?farmer_id=FARM_002
    resp = client.get("/cows?farmer_id=FARM_002", headers=headers_a)
    assert resp.status_code == 200
    cows = resp.json()["cows"]
    cow_ids = [c["id"] for c in cows]
    # Still only returns Farmer A's cows!
    assert "COW-001" in cow_ids
    assert "COW-004" not in cow_ids


def test_add_cow_for_authenticated_farmer():
    """Verify an authenticated farmer can register a new cow and it automatically associates with their farm."""
    res_a = client.post("/auth/login", json={"email": "farmer_a@test.com", "password": "Password@123"})
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    add_resp = client.post("/cows", headers=headers_a, json={
        "name": "Nandini",
        "tag": "TAG-A99",
        "breed": "Gir",
        "weight_kg": 430.0,
        "deviceId": "ESP32_A99",
    })
    assert add_resp.status_code == 201
    new_cow = add_resp.json()["cow"]
    new_cow_id = new_cow["id"]

    # Farmer A can access it
    detail_resp = client.get(f"/cows/{new_cow_id}", headers=headers_a)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["profile"]["name"] == "Nandini"

    # Farmer B CANNOT access it
    res_b = client.post("/auth/login", json={"email": "farmer_b@test.com", "password": "Password@123"})
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    detail_resp_b = client.get(f"/cows/{new_cow_id}", headers=headers_b)
    assert detail_resp_b.status_code == 403

