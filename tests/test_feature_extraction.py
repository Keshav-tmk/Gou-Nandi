"""Unit tests for HardwareFeatureExtractor."""

import math
from pathlib import Path
import sys
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.ai.feature_extraction import (
    HardwareFeatureExtractor,
    FEATURE_NAMES,
    FEATURE_COUNT,
    PHYSICAL_CHANNELS,
)


def test_feature_names_and_count():
    """Verify that canonical feature names list has exactly 72 elements with expected names."""
    assert len(FEATURE_NAMES) == 72
    assert FEATURE_COUNT == 72
    for channel in PHYSICAL_CHANNELS:
        assert f"{channel}_mean" in FEATURE_NAMES
        assert f"{channel}_std" in FEATURE_NAMES
        assert f"{channel}_min" in FEATURE_NAMES
        assert f"{channel}_max" in FEATURE_NAMES
        assert f"{channel}_range" in FEATURE_NAMES
        assert f"{channel}_rms" in FEATURE_NAMES
        assert f"{channel}_diff_std" in FEATURE_NAMES
        assert f"{channel}_abs_diff_mean" in FEATURE_NAMES

    # Check derived channels
    for derived in ("accel_magnitude", "dynamic_acceleration", "gyro_magnitude"):
        assert f"{derived}_mean" in FEATURE_NAMES
        assert f"{derived}_rms" in FEATURE_NAMES


def test_empty_window():
    """Verify that an empty window is marked invalid with clear diagnostic."""
    extractor = HardwareFeatureExtractor(min_samples=10)
    result = extractor.extract_features([])
    assert not result.is_valid
    assert result.metadata["status"] == "empty_window"
    assert "empty" in result.error_message.lower()


def test_insufficient_samples():
    """Verify that a window with fewer than min_samples is marked invalid."""
    extractor = HardwareFeatureExtractor(min_samples=20)
    samples = [
        {
            "cow_id": "COW-001",
            "accel_x": 0.05, "accel_y": 0.1, "accel_z": 0.98,
            "gyro_x": 0.0, "gyro_y": 0.0, "gyro_z": 0.0,
        }
        for _ in range(10)
    ]
    result = extractor.extract_features(samples)
    assert not result.is_valid
    assert result.metadata["status"] == "insufficient_samples"
    assert "20" in result.error_message


def test_mixed_cows_rejected():
    """Verify that mixing data from different cows in a single window is rejected."""
    extractor = HardwareFeatureExtractor(min_samples=5)
    samples = [
        {
            "cow_id": "COW-001" if i < 15 else "COW-002",
            "accel_x": 0.1, "accel_y": 0.2, "accel_z": 0.98,
            "gyro_x": 0.1, "gyro_y": 0.1, "gyro_z": 0.1,
        }
        for i in range(25)
    ]
    result = extractor.extract_features(samples, cow_id="COW-001")
    assert not result.is_valid
    assert result.metadata["status"] == "mixed_cows_error"
    assert "mixed" in result.error_message.lower()


def test_non_finite_values_filtered():
    """Verify that NaN and Inf entries are safely filtered without crashing."""
    extractor = HardwareFeatureExtractor(min_samples=5)
    samples = [
        {
            "cow_id": "COW-001",
            "accel_x": float("nan") if i % 2 == 0 else 0.1,
            "accel_y": float("inf") if i % 3 == 0 else 0.2,
            "accel_z": 0.98,
            "gyro_x": 0.0, "gyro_y": 0.0, "gyro_z": 0.0,
        }
        for i in range(30)
    ]
    result = extractor.extract_features(samples, cow_id="COW-001")
    # Result should handle finite rows safely
    assert isinstance(result.is_valid, bool)
    if result.is_valid:
        assert all(math.isfinite(val) for val in result.feature_vector)


def test_valid_feature_extraction():
    """Verify complete feature extraction on clean realistic 25-reading window."""
    extractor = HardwareFeatureExtractor(min_samples=20, normalize_acceleration_to_g=True)
    samples = [
        {
            "cow_id": "COW-001",
            "device_id": "ESP32-COLLAR-01",
            "timestamp": f"2026-10-28T12:00:{i:02d}.000Z",
            "sensors": {
                "accel_x": 0.1 + (i * 0.005),
                "accel_y": 0.2 - (i * 0.002),
                "accel_z": 0.98,
                "gyro_x": 1.5,
                "gyro_y": -0.8,
                "gyro_z": 0.2,
            },
        }
        for i in range(25)
    ]
    result = extractor.extract_features(samples, cow_id="COW-001")
    assert result.is_valid
    assert len(result.features) == 72
    assert len(result.feature_vector) == 72
    assert result.metadata["reading_count"] == 25
    assert result.metadata["status"] == "sufficient_data"

    # Spot-check math
    assert result.features["accel_z_mean"] == pytest.approx(0.98, abs=1e-4)
    assert result.features["gyro_x_mean"] == pytest.approx(1.5, abs=1e-4)
    assert result.features["accel_magnitude_mean"] > 0.95
