"""Unit tests for AIInferenceService."""

from pathlib import Path
import sys
import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.ai.inference import AIInferenceService


def test_ai_inference_service_initialization():
    """Verify that inference service initializes and loads models."""
    service = AIInferenceService(min_window_samples=15)
    assert service.behaviour_pipeline is not None
    assert service.anomaly_pipeline is not None
    assert len(service.behaviour_classes) == 5
    assert "grazing" in service.behaviour_classes
    assert "resting" in service.behaviour_classes


def test_ai_inference_empty_cow_buffer():
    """Verify that querying an empty cow returns insufficient_data status."""
    service = AIInferenceService(min_window_samples=20)
    res = service.run_inference_for_cow("COW-999")
    assert res["status"] == "insufficient_data"
    assert res["behaviour"]["status"] == "not_available"
    assert res["anomaly"]["status"] == "not_available"
    assert res["rumination"]["status"] == "not_available"
    assert res["estrus"]["status"] == "not_available"
    assert res["lameness"]["status"] == "not_available"


def test_ai_inference_successful_prediction():
    """Verify inference once sufficient readings have accumulated."""
    service = AIInferenceService(min_window_samples=20)
    cow_id = "COW-001"

    # Ingest 25 valid readings
    for i in range(25):
        reading = {
            "cow_id": cow_id,
            "device_id": "ESP32-COLLAR-01",
            "timestamp": f"2026-10-28T10:00:{i:02d}Z",
            "sensors": {
                "accel_x": 0.05,
                "accel_y": 0.1,
                "accel_z": 0.98,
                "gyro_x": 0.2,
                "gyro_y": -0.1,
                "gyro_z": 0.05,
            },
        }
        service.ingest_reading(reading)

    assert service.get_cow_buffer_length(cow_id) == 25
    res = service.run_inference_for_cow(cow_id)

    assert res["status"] == "available"
    assert res["behaviour"]["status"] == "available"
    assert res["behaviour"]["label"] in service.behaviour_classes
    assert isinstance(res["behaviour"]["probabilities"], dict)

    # Probabilities must sum to ~1.0
    prob_sum = sum(res["behaviour"]["probabilities"].values())
    assert prob_sum == pytest.approx(1.0, abs=1e-2)

    # Anomaly output
    assert res["anomaly"]["status"] == "available"
    assert isinstance(res["anomaly"]["detected"], bool)
    assert isinstance(res["anomaly"]["score"], float)

    # Check that prediction was stored in history
    history = service.get_prediction_history(cow_id)
    assert len(history) >= 1
    assert history[-1]["behaviour"]["label"] == res["behaviour"]["label"]
