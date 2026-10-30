import importlib
from fastapi.testclient import TestClient

api_module = importlib.import_module("src.10_api")
app = api_module.app
client = TestClient(app)


def test_list_cows_endpoint():
    response = client.get("/cows")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["count"] == 8
    cows = data["cows"]
    assert len(cows) == 8
    # Check Lakshmi
    lakshmi = next((c for c in cows if c["id"] == "COW-001"), None)
    assert lakshmi is not None
    assert lakshmi["name"] == "Lakshmi"
    assert "status" in lakshmi
    assert "has_live_telemetry" in lakshmi


def test_get_cow_detail_endpoint():
    response = client.get("/cows/COW-001")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["profile"]["name"] == "Lakshmi"
    assert "freshness" in data
    assert "ai" in data


def test_get_herd_alerts_endpoint():
    response = client.get("/alerts")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "active" in data
    assert isinstance(data["active"], list)


def test_get_analytics_summary_endpoint():
    response = client.get("/analytics/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "herd" in data
    assert data["herd"]["total_cows"] == 8


def test_react_app_endpoint():
    response = client.get("/app")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "SmartLivestock" in response.text
