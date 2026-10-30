"""Hardware-Compatible Feature Extraction Module.

Extracts deterministic, leakage-resistant statistical features from rolling windows
of 6-channel ESP32 IMU sensor readings (accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z).

Used identically in:
1. Model training
2. Offline model evaluation
3. Live real-time API inference
4. Automated unit tests
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
import math
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import numpy as np


# Standard gravity constant for acceleration unit conversion
STANDARD_GRAVITY = 9.80665

# The 6 physical sensor channels provided by the ESP32 collar hardware
PHYSICAL_CHANNELS: Tuple[str, ...] = (
    "accel_x",
    "accel_y",
    "accel_z",
    "gyro_x",
    "gyro_y",
    "gyro_z",
)

# Derived kinematic signals computed from physical channels
DERIVED_CHANNELS: Tuple[str, ...] = (
    "accel_magnitude",
    "dynamic_acceleration",
    "gyro_magnitude",
)

# All 9 analyzed channels
ALL_CHANNELS: Tuple[str, ...] = PHYSICAL_CHANNELS + DERIVED_CHANNELS

# Statistics computed per channel (8 per channel * 9 channels = 72 features)
CHANNEL_STATISTICS: Tuple[str, ...] = (
    "mean",
    "std",
    "min",
    "max",
    "range",
    "rms",
    "diff_std",
    "abs_diff_mean",
)


def _build_feature_names() -> List[str]:
    """Build canonical list of feature names in strict deterministic order."""
    names = []
    for channel in ALL_CHANNELS:
        for stat in CHANNEL_STATISTICS:
            names.append(f"{channel}_{stat}")
    return names


# The 72 canonical model input features
FEATURE_NAMES: List[str] = _build_feature_names()
FEATURE_COUNT: int = len(FEATURE_NAMES)  # Exactly 72


@dataclass
class FeatureExtractionResult:
    """Encapsulates the extracted feature vector and window diagnostic metadata."""

    features: Dict[str, float]
    feature_vector: np.ndarray
    feature_names: List[str]
    metadata: Dict[str, Any]
    is_valid: bool
    error_message: Optional[str] = None


def parse_timestamp(value: Any) -> Optional[float]:
    """Parse various timestamp representations into Unix epoch seconds (UTC)."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # Plausible Unix epoch (after year 2020)
        if value > 1577836800:
            return float(value)
        # Monotonic milliseconds or seconds offset
        return float(value)
    if isinstance(value, str):
        val_str = value.strip()
        try:
            # Try ISO 8601 parsing
            dt = datetime.fromisoformat(val_str.replace("Z", "+00:00"))
            return dt.timestamp()
        except Exception:
            pass
        # Try standard space-separated datetime
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
            try:
                dt = datetime.strptime(val_str, fmt)
                return dt.timestamp()
            except Exception:
                pass
    return None


def _normalize_cow_id(cow_id: Optional[str]) -> str:
    """Normalize cow identifier to standard canonical format COW-XXX."""
    if not cow_id:
        return ""
    clean = str(cow_id).strip().upper().replace("_", "-")
    import re
    m = re.match(r"^COW[-]?0*([0-9]+)$", clean)
    if m:
        return f"COW-{int(m.group(1)):03d}"
    return clean


class HardwareFeatureExtractor:
    """Robust feature extractor for rolling windows of collar IMU telemetry."""

    def __init__(
        self,
        min_samples: int = 20,
        expected_sample_rate_hz: float = 10.0,
        normalize_acceleration_to_g: bool = True,
    ):
        """
        Args:
            min_samples: Minimum required readings in a window (default: 20).
            expected_sample_rate_hz: Target sampling frequency (default: 10 Hz).
            normalize_acceleration_to_g: Convert m/s^2 to g if magnitude exceeds 4.0.
        """
        self.min_samples = min_samples
        self.expected_sample_rate_hz = expected_sample_rate_hz
        self.normalize_acceleration_to_g = normalize_acceleration_to_g

    def extract_features(
        self,
        readings: Sequence[Dict[str, Any]],
        cow_id: Optional[str] = None,
    ) -> FeatureExtractionResult:
        """Extract the canonical 72-feature vector from a sequence of sensor readings.

        Args:
            readings: List of sensor dictionaries. Each reading must contain
                      either a nested 'sensors' dictionary or flat channel keys.
            cow_id: Optional expected cow identifier. If provided, verifies
                    that all readings belong strictly to this cow.

        Returns:
            FeatureExtractionResult containing the feature dict, 1D NumPy vector,
            and diagnostic metadata.
        """
        if not readings:
            return FeatureExtractionResult(
                features={},
                feature_vector=np.zeros(FEATURE_COUNT, dtype=np.float64),
                feature_names=FEATURE_NAMES,
                metadata={"reading_count": 0, "status": "empty_window"},
                is_valid=False,
                error_message="Window is empty; no readings provided.",
            )

        if len(readings) < self.min_samples:
            return FeatureExtractionResult(
                features={},
                feature_vector=np.zeros(FEATURE_COUNT, dtype=np.float64),
                feature_names=FEATURE_NAMES,
                metadata={"reading_count": len(readings), "min_required": self.min_samples, "status": "insufficient_samples"},
                is_valid=False,
                error_message=f"Window contains {len(readings)} readings, but minimum required is {self.min_samples}.",
            )

        # Validate single-cow consistency
        cows_found = set()
        timestamps: List[float] = []
        valid_rows: List[Tuple[float, float, float, float, float, float]] = []

        for idx, item in enumerate(readings):
            c_id = item.get("cow_id")
            if c_id is not None:
                cows_found.add(str(c_id).strip())

            # Handle both flat records {"accel_x": 0.1, ...} and nested records {"sensors": {"accel_x": 0.1, ...}}
            sensors = item.get("sensors")
            if not isinstance(sensors, dict):
                sensors = item

            # Check presence and finite values for the 6 required physical channels
            try:
                ax = float(sensors["accel_x"])
                ay = float(sensors["accel_y"])
                az = float(sensors["accel_z"])
                gx = float(sensors["gyro_x"])
                gy = float(sensors["gyro_y"])
                gz = float(sensors["gyro_z"])
            except (KeyError, TypeError, ValueError):
                continue

            row = (ax, ay, az, gx, gy, gz)
            if not all(math.isfinite(val) for val in row):
                continue

            valid_rows.append(row)

            # Collect timestamp
            ts_val = item.get("timestamp") or item.get("received_at") or item.get("Time") or item.get("TIME")
            parsed_ts = parse_timestamp(ts_val)
            if parsed_ts is not None:
                timestamps.append(parsed_ts)

        normalized_cows = {_normalize_cow_id(c) for c in cows_found if c}
        expected_norm = _normalize_cow_id(cow_id) if cow_id is not None else None

        if expected_norm and normalized_cows and (normalized_cows != {expected_norm}):
            return FeatureExtractionResult(
                features={},
                feature_vector=np.zeros(FEATURE_COUNT, dtype=np.float64),
                feature_names=FEATURE_NAMES,
                metadata={"cows_found": sorted(cows_found), "status": "mixed_cows_error"},
                is_valid=False,
                error_message=f"Mixed cow data detected in single window: {sorted(cows_found)} (expected {cow_id}).",
            )

        if len(normalized_cows) > 1:
            return FeatureExtractionResult(
                features={},
                feature_vector=np.zeros(FEATURE_COUNT, dtype=np.float64),
                feature_names=FEATURE_NAMES,
                metadata={"cows_found": sorted(cows_found), "status": "mixed_cows_error"},
                is_valid=False,
                error_message=f"Multiple cow IDs detected in single window: {sorted(cows_found)}.",
            )

        if len(valid_rows) < self.min_samples:
            return FeatureExtractionResult(
                features={},
                feature_vector=np.zeros(FEATURE_COUNT, dtype=np.float64),
                feature_names=FEATURE_NAMES,
                metadata={
                    "total_received": len(readings),
                    "valid_rows": len(valid_rows),
                    "min_required": self.min_samples,
                    "status": "insufficient_valid_rows",
                },
                is_valid=False,
                error_message=f"Only {len(valid_rows)} valid finite sensor readings found; minimum required is {self.min_samples}.",
            )

        # Convert to NumPy matrix (N x 6)
        matrix = np.asarray(valid_rows, dtype=np.float64)
        ax = matrix[:, 0]
        ay = matrix[:, 1]
        az = matrix[:, 2]
        gx = matrix[:, 3]
        gy = matrix[:, 4]
        gz = matrix[:, 5]

        # Standardize acceleration units to g (1 g = 1.0)
        # If input has mean magnitude ~9.8 (m/s^2), divide by 9.80665.
        raw_accel_mag = np.sqrt(ax * ax + ay * ay + az * az)
        mean_accel_mag = float(np.mean(raw_accel_mag))
        if self.normalize_acceleration_to_g and mean_accel_mag >= 4.0:
            ax = ax / STANDARD_GRAVITY
            ay = ay / STANDARD_GRAVITY
            az = az / STANDARD_GRAVITY
            accel_mag = raw_accel_mag / STANDARD_GRAVITY
        else:
            accel_mag = raw_accel_mag

        dynamic_accel = np.abs(accel_mag - 1.0)
        gyro_mag = np.sqrt(gx * gx + gy * gy + gz * gz)

        channel_dict = {
            "accel_x": ax,
            "accel_y": ay,
            "accel_z": az,
            "gyro_x": gx,
            "gyro_y": gy,
            "gyro_z": gz,
            "accel_magnitude": accel_mag,
            "dynamic_acceleration": dynamic_accel,
            "gyro_magnitude": gyro_mag,
        }

        # Calculate statistics for each channel
        features: Dict[str, float] = {}
        for ch_name in ALL_CHANNELS:
            vals = channel_dict[ch_name]
            n_pts = len(vals)

            ch_mean = float(np.mean(vals))
            ch_std = float(np.std(vals, ddof=1)) if n_pts > 1 else 0.0
            ch_min = float(np.min(vals))
            ch_max = float(np.max(vals))
            ch_range = ch_max - ch_min
            ch_rms = float(np.sqrt(np.mean(vals * vals)))

            if n_pts > 1:
                diffs = np.diff(vals)
                ch_diff_std = float(np.std(diffs, ddof=1)) if len(diffs) > 1 else 0.0
                ch_abs_diff_mean = float(np.mean(np.abs(diffs)))
            else:
                ch_diff_std = 0.0
                ch_abs_diff_mean = 0.0

            features[f"{ch_name}_mean"] = round(ch_mean, 6)
            features[f"{ch_name}_std"] = round(ch_std, 6)
            features[f"{ch_name}_min"] = round(ch_min, 6)
            features[f"{ch_name}_max"] = round(ch_max, 6)
            features[f"{ch_name}_range"] = round(ch_range, 6)
            features[f"{ch_name}_rms"] = round(ch_rms, 6)
            features[f"{ch_name}_diff_std"] = round(ch_diff_std, 6)
            features[f"{ch_name}_abs_diff_mean"] = round(ch_abs_diff_mean, 6)

        # Assemble fixed-order 1D vector
        vector = np.array([features[fname] for fname in FEATURE_NAMES], dtype=np.float64)

        # Calculate timing and data-quality metadata
        duration_sec = 0.0
        sampling_rate_hz = self.expected_sample_rate_hz
        if len(timestamps) >= 2:
            time_span = timestamps[-1] - timestamps[0]
            if time_span > 0:
                duration_sec = round(time_span, 3)
                sampling_rate_hz = round((len(timestamps) - 1) / time_span, 2)

        data_quality_score = round(len(valid_rows) / max(len(readings), 1), 3)

        resolved_cow_id = list(cows_found)[0] if cows_found else (cow_id or "COW-001")

        metadata: Dict[str, Any] = {
            "cow_id": resolved_cow_id,
            "reading_count": len(valid_rows),
            "total_input_readings": len(readings),
            "data_quality_score": data_quality_score,
            "window_duration_sec": duration_sec,
            "estimated_sampling_rate_hz": sampling_rate_hz,
            "acceleration_normalized_to_g": bool(self.normalize_acceleration_to_g and mean_accel_mag >= 4.0),
            "status": "sufficient_data",
        }

        return FeatureExtractionResult(
            features=features,
            feature_vector=vector,
            feature_names=FEATURE_NAMES,
            metadata=metadata,
            is_valid=True,
            error_message=None,
        )
