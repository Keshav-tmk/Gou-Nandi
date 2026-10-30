"""Real-Time AI Inference Engine & Per-Cow Telemetry Buffer.

Manages rolling sensor buffers per cow, extracts hardware-compatible features,
runs all five AI analysis modules:
1. Behaviour classification (Random Forest)
2. Activity anomaly detection (Isolation Forest)
3. Rumination detection / chewing analysis (Random Forest)
4. Estrus (heat) screening & mount monitoring
5. Lameness & contact thermal health monitoring

Formats standardized AI predictions for live API and dashboard consumption.
"""

from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
import logging
from pathlib import Path
import sys
import threading
from typing import Any, Deque, Dict, List, Optional, Tuple

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.ai.feature_extraction import (
    HardwareFeatureExtractor,
    FeatureExtractionResult,
    FEATURE_NAMES,
    FEATURE_COUNT,
)

logger = logging.getLogger("ai_inference")

# Model bundle paths
HARDWARE_BEHAVIOUR_PATH = ROOT / "models" / "hardware_compatible" / "cow_behaviour_hardware_rf.joblib"
HARDWARE_ANOMALY_PATH = ROOT / "models" / "hardware_compatible" / "cow_activity_hardware_iforest.joblib"
HARDWARE_RUMINATION_PATH = ROOT / "models" / "hardware_compatible" / "cow_rumination_hardware_rf.joblib"
ESTRUS_DAILY_PATH = ROOT / "models" / "estrus" / "oestrus_day_random_forest.joblib"
LAMENESS_DAILY_PATH = ROOT / "models" / "lameness" / "lameness_day_random_forest.joblib"

# Maximum sensor readings retained per cow in memory
MAX_READINGS_PER_COW = 500
# Maximum predictions retained per cow in history
MAX_PREDICTIONS_PER_COW = 100
# Default window size for behaviour classification
DEFAULT_WINDOW_SIZE = 20  # Minimum 20 readings for immediate responsiveness


def normalize_cow_id(cow_id: Optional[str]) -> str:
    """Normalize cow identifier to standard canonical format COW-XXX."""
    if not cow_id:
        return "COW-001"
    clean = str(cow_id).strip().upper().replace("_", "-")
    import re
    m = re.match(r"^COW[-]?0*([0-9]+)$", clean)
    if m:
        return f"COW-{int(m.group(1)):03d}"
    return clean


class AIInferenceService:
    """Thread-safe real-time inference engine and cow telemetry state manager."""

    def __init__(
        self,
        behaviour_model_path: Path = HARDWARE_BEHAVIOUR_PATH,
        anomaly_model_path: Path = HARDWARE_ANOMALY_PATH,
        rumination_model_path: Path = HARDWARE_RUMINATION_PATH,
        estrus_model_path: Path = ESTRUS_DAILY_PATH,
        lameness_model_path: Path = LAMENESS_DAILY_PATH,
        min_window_samples: int = 20,
    ):
        self.behaviour_model_path = behaviour_model_path
        self.anomaly_model_path = anomaly_model_path
        self.rumination_model_path = rumination_model_path
        self.estrus_model_path = estrus_model_path
        self.lameness_model_path = lameness_model_path
        self.min_window_samples = min_window_samples
        self.min_samples = min_window_samples

        self.feature_extractor = HardwareFeatureExtractor(
            min_samples=min_window_samples,
            normalize_acceleration_to_g=True,
        )

        self._lock = threading.RLock()

        # Per-cow rolling buffers: cow_id -> deque of sensor reading dicts
        self._cow_sensor_buffers: Dict[str, Deque[Dict[str, Any]]] = {}

        # Per-cow prediction history: cow_id -> deque of prediction results
        self._cow_prediction_history: Dict[str, Deque[Dict[str, Any]]] = {}

        # Per-cow telemetry tracking & connection freshness
        self._cow_last_received_at: Dict[str, datetime] = {}
        self._cow_latest_reading: Dict[str, Dict[str, Any]] = {}
        self._cow_total_readings: Dict[str, int] = {}

        # Per-cow active alert states and cooldown trackers
        self._cow_active_alerts: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self._cow_alert_cooldowns: Dict[str, Dict[str, float]] = {}

        # 1. Behaviour Classifier Artifacts
        self.behaviour_bundle: Optional[Dict[str, Any]] = None
        self.behaviour_pipeline: Any = None
        self.behaviour_classes: List[str] = []
        self.behaviour_model_version: str = "unavailable"

        # 2. Anomaly Detector Artifacts
        self.anomaly_bundle: Optional[Dict[str, Any]] = None
        self.anomaly_pipeline: Any = None
        self.anomaly_model_version: str = "unavailable"

        # 3. Rumination Classifier Artifacts
        self.rumination_bundle: Optional[Dict[str, Any]] = None
        self.rumination_pipeline: Any = None
        self.rumination_threshold: float = 0.40
        self.rumination_model_version: str = "unavailable"

        # 4. Estrus Screening Artifacts
        self.estrus_bundle: Optional[Dict[str, Any]] = None
        self.estrus_pipeline: Any = None
        self.estrus_threshold: float = 0.12
        self.estrus_model_version: str = "unavailable"

        # 5. Lameness Screening Artifacts
        self.lameness_bundle: Optional[Dict[str, Any]] = None
        self.lameness_pipeline: Any = None
        self.lameness_threshold: float = 0.50
        self.lameness_model_version: str = "unavailable"

        self.load_models()

    def load_models(self) -> Dict[str, bool]:
        """Load all five AI models with diagnostics."""
        status = {
            "behaviour": False,
            "anomaly": False,
            "rumination": False,
            "estrus": False,
            "lameness": False,
        }

        # 1. Behaviour Model
        if self.behaviour_model_path.exists():
            try:
                bundle = joblib.load(self.behaviour_model_path)
                self.behaviour_bundle = bundle
                self.behaviour_pipeline = bundle["pipeline"]
                self.behaviour_classes = list(bundle.get("classes", []))
                self.behaviour_model_version = bundle.get("metadata", {}).get("version", "1.0.0")
                status["behaviour"] = True
                logger.info(
                    "Loaded hardware behaviour model %s (%d classes)",
                    self.behaviour_model_version,
                    len(self.behaviour_classes),
                )
            except Exception as exc:
                logger.error("Failed to load behaviour model from %s: %s", self.behaviour_model_path, exc)

        # 2. Anomaly Model
        if self.anomaly_model_path.exists():
            try:
                bundle = joblib.load(self.anomaly_model_path)
                self.anomaly_bundle = bundle
                self.anomaly_pipeline = bundle["pipeline"]
                self.anomaly_model_version = bundle.get("metadata", {}).get("version", "1.0.0")
                status["anomaly"] = True
                logger.info("Loaded hardware anomaly model %s", self.anomaly_model_version)
            except Exception as exc:
                logger.error("Failed to load anomaly model from %s: %s", self.anomaly_model_path, exc)

        # 3. Rumination Model
        if self.rumination_model_path.exists():
            try:
                bundle = joblib.load(self.rumination_model_path)
                self.rumination_bundle = bundle
                self.rumination_pipeline = bundle["pipeline"]
                self.rumination_threshold = float(bundle.get("threshold", 0.40))
                self.rumination_model_version = bundle.get("metadata", {}).get("version", "1.0.0-hardware")
                status["rumination"] = True
                logger.info("Loaded hardware rumination model %s (threshold=%.2f)", self.rumination_model_version, self.rumination_threshold)
            except Exception as exc:
                logger.error("Failed to load rumination model from %s: %s", self.rumination_model_path, exc)

        # 4. Estrus Model
        if self.estrus_model_path.exists():
            try:
                bundle = joblib.load(self.estrus_model_path)
                self.estrus_bundle = bundle
                self.estrus_pipeline = bundle.get("model")
                self.estrus_threshold = float(bundle.get("threshold", 0.12))
                self.estrus_model_version = bundle.get("metadata", {}).get("version", "1.0.0-daily")
                status["estrus"] = True
                logger.info("Loaded daily estrus model %s", self.estrus_model_version)
            except Exception as exc:
                logger.error("Failed to load estrus model from %s: %s", self.estrus_model_path, exc)

        # 5. Lameness Model
        if self.lameness_model_path.exists():
            try:
                bundle = joblib.load(self.lameness_model_path)
                self.lameness_bundle = bundle
                self.lameness_pipeline = bundle.get("model")
                self.lameness_threshold = float(bundle.get("threshold", 0.50))
                self.lameness_model_version = bundle.get("metadata", {}).get("version", "1.0.0-daily")
                status["lameness"] = True
                logger.info("Loaded daily lameness model %s", self.lameness_model_version)
            except Exception as exc:
                logger.error("Failed to load lameness model from %s: %s", self.lameness_model_path, exc)

        return status

    def ingest_reading(self, reading: Dict[str, Any]) -> None:
        """Add a validated sensor reading to the appropriate cow buffer."""
        raw_cow = str(reading.get("cow_id") or "COW-001").strip()
        norm_cow = normalize_cow_id(raw_cow)

        recv_str = reading.get("received_at")
        if recv_str:
            try:
                recv_dt = datetime.fromisoformat(str(recv_str).replace("Z", "+00:00"))
            except Exception:
                recv_dt = datetime.now(timezone.utc)
        else:
            recv_dt = datetime.now(timezone.utc)
            reading["received_at"] = recv_dt.isoformat()

        with self._lock:
            for cid in {raw_cow, norm_cow}:
                if cid not in self._cow_sensor_buffers:
                    self._cow_sensor_buffers[cid] = deque(maxlen=MAX_READINGS_PER_COW)
                    self._cow_prediction_history[cid] = deque(maxlen=MAX_PREDICTIONS_PER_COW)
                self._cow_sensor_buffers[cid].append(reading)
                self._cow_last_received_at[cid] = recv_dt
                self._cow_latest_reading[cid] = reading
                self._cow_total_readings[cid] = self._cow_total_readings.get(cid, 0) + 1

    def ingest_batch(self, readings: List[Dict[str, Any]]) -> int:
        """Add a batch of sensor readings to per-cow buffers."""
        count = 0
        for item in readings:
            self.ingest_reading(item)
            count += 1
        return count

    def get_cow_readings(self, cow_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent buffered sensor readings for a cow."""
        with self._lock:
            buffer = self._cow_sensor_buffers.get(cow_id) or self._cow_sensor_buffers.get(normalize_cow_id(cow_id))
            if not buffer:
                return []
            return list(buffer)[-limit:]

    def get_cow_buffer_length(self, cow_id: str) -> int:
        """Get the current number of accumulated readings for a cow."""
        with self._lock:
            buffer = self._cow_sensor_buffers.get(cow_id) or self._cow_sensor_buffers.get(normalize_cow_id(cow_id))
            return len(buffer) if buffer else 0

    def get_active_cows(self) -> List[str]:
        """List all cow identifiers currently registered in the buffer."""
        with self._lock:
            cows = {normalize_cow_id(k) for k, buf in self._cow_sensor_buffers.items() if len(buf) > 0}
            if not cows:
                cows = {"COW-001"}
            return sorted(cows)

    def run_inference_for_cow(
        self,
        cow_id: str,
        window_size: int = DEFAULT_WINDOW_SIZE,
    ) -> Dict[str, Any]:
        """Run complete real-time inference across all five AI modules."""
        target_cow = str(cow_id).strip()
        norm_cow = normalize_cow_id(target_cow)
        with self._lock:
            buffer = self._cow_sensor_buffers.get(target_cow) or self._cow_sensor_buffers.get(norm_cow)
            if not buffer:
                snapshot = []
            else:
                snapshot = list(buffer)[-max(window_size, self.min_samples) :]

        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Feature Extraction (Hardware 72 Features)
        extract_res: FeatureExtractionResult = self.feature_extractor.extract_features(
            snapshot,
            cow_id=target_cow,
        )

        if not extract_res.is_valid:
            # Insufficient or invalid data state
            result = {
                "cow_id": target_cow,
                "timestamp": now_iso,
                "data_source": "esp32_live",
                "status": "insufficient_data",
                "message": extract_res.error_message,
                "data_quality": {
                    "status": "insufficient",
                    "reading_count": extract_res.metadata.get("reading_count", len(snapshot)),
                    "min_required": self.min_samples,
                    "target_window_size": window_size,
                    "sampling_rate_hz": extract_res.metadata.get("estimated_sampling_rate_hz", 0.0),
                },
                "behaviour": {
                    "status": "not_available",
                    "reason": extract_res.error_message,
                    "label": None,
                    "probabilities": None,
                    "model_version": self.behaviour_model_version,
                },
                "anomaly": {
                    "status": "not_available",
                    "reason": extract_res.error_message,
                    "detected": None,
                    "score": None,
                    "model_version": self.anomaly_model_version,
                },
                "rumination": {
                    "status": "not_available",
                    "reason": extract_res.error_message,
                    "is_ruminating": None,
                    "probability": None,
                    "model_version": self.rumination_model_version,
                },
                "estrus": {
                    "status": "not_available",
                    "reason": extract_res.error_message,
                    "detected": None,
                    "risk_level": "UNKNOWN",
                    "score": None,
                    "model_version": self.estrus_model_version,
                },
                "lameness": {
                    "status": "not_available",
                    "reason": extract_res.error_message,
                    "detected": None,
                    "risk_level": "UNKNOWN",
                    "locomotion_score": None,
                    "model_version": self.lameness_model_version,
                },
            }
            return result

        X_vec = extract_res.feature_vector.reshape(1, -1)
        feat_dict = extract_res.features

        # ============================================================
        # MODULE 1: Behaviour Classification (Random Forest)
        # ============================================================
        behaviour_output: Dict[str, Any] = {}
        pred_label = "unknown"
        behaviour_probs: Dict[str, float] = {}

        if self.behaviour_pipeline is not None:
            try:
                pred_label = str(self.behaviour_pipeline.predict(X_vec)[0])
                if hasattr(self.behaviour_pipeline, "predict_proba"):
                    raw_probs = self.behaviour_pipeline.predict_proba(X_vec)[0]
                    classes = self.behaviour_classes or getattr(
                        self.behaviour_pipeline.named_steps.get("classifier"), "classes_", []
                    )
                    for cls_name, p in zip(classes, raw_probs):
                        behaviour_probs[str(cls_name)] = round(float(p), 4)

                behaviour_output = {
                    "status": "available",
                    "label": pred_label,
                    "probabilities": behaviour_probs,
                    "model_version": self.behaviour_model_version,
                    "window_size": extract_res.metadata.get("reading_count", len(snapshot)),
                }
            except Exception as exc:
                logger.error("Behaviour inference failed: %s", exc)
                behaviour_output = {
                    "status": "error",
                    "reason": f"Execution error: {exc}",
                    "label": None,
                    "probabilities": None,
                    "model_version": self.behaviour_model_version,
                }
        else:
            behaviour_output = {
                "status": "not_available",
                "reason": "Behaviour model not loaded",
                "label": None,
                "probabilities": None,
                "model_version": self.behaviour_model_version,
            }

        # ============================================================
        # MODULE 2: Activity Anomaly Detection (Isolation Forest)
        # ============================================================
        anomaly_output: Dict[str, Any] = {}
        if self.anomaly_pipeline is not None:
            try:
                pred = int(self.anomaly_pipeline.predict(X_vec)[0])
                score = float(self.anomaly_pipeline.decision_function(X_vec)[0])
                is_anomaly = bool(pred == -1)

                explanation = (
                    "Unusual sensor pattern detected relative to the baseline grazing distribution. "
                    "Review livestock observation context. This does not establish veterinary illness."
                    if is_anomaly
                    else "Normal activity pattern consistent with routine livestock baseline."
                )

                anomaly_output = {
                    "status": "available",
                    "detected": is_anomaly,
                    "score": round(score, 6),
                    "interpretation": explanation,
                    "model_version": self.anomaly_model_version,
                }
            except Exception as exc:
                logger.error("Anomaly inference failed: %s", exc)
                anomaly_output = {
                    "status": "error",
                    "reason": f"Execution error: {exc}",
                    "detected": None,
                    "score": None,
                    "model_version": self.anomaly_model_version,
                }
        else:
            anomaly_output = {
                "status": "not_available",
                "reason": "Anomaly model not loaded",
                "detected": None,
                "score": None,
                "model_version": self.anomaly_model_version,
            }

        # ============================================================
        # MODULE 3: Rumination Detection / Chewing Analysis
        # ============================================================
        rumination_output: Dict[str, Any] = {}
        if self.rumination_pipeline is not None:
            try:
                rum_probs = self.rumination_pipeline.predict_proba(X_vec)[0]
                rum_prob = float(rum_probs[1]) if len(rum_probs) > 1 else float(rum_probs[0])
                is_ruminating = bool(rum_prob >= self.rumination_threshold)

                # Chewing rhythm score derived from dynamic acceleration variance & high frequency diff
                chew_score = float(feat_dict.get("dynamic_acceleration_rms", 0.0) * 1.5 + feat_dict.get("accel_magnitude_diff_std", 0.0))
                chew_score = min(1.0, max(0.0, chew_score))

                # If cow is resting with high chewing probability or classified as ruminating
                confidence = round(rum_prob if is_ruminating else (1.0 - rum_prob), 4)

                rumination_output = {
                    "status": "available",
                    "is_ruminating": is_ruminating,
                    "probability": round(rum_prob, 4),
                    "confidence": confidence,
                    "decision_threshold": self.rumination_threshold,
                    "chewing_rhythm_score": round(chew_score, 4),
                    "model_version": self.rumination_model_version,
                    "interpretation": (
                        "Active rumination (chewing cud) detected. Normal digestive function."
                        if is_ruminating
                        else "No active rumination chewing pattern detected in current window."
                    ),
                }
            except Exception as exc:
                logger.error("Rumination inference failed: %s", exc)
                rumination_output = {
                    "status": "error",
                    "reason": f"Execution error: {exc}",
                    "is_ruminating": None,
                    "probability": None,
                    "model_version": self.rumination_model_version,
                }
        else:
            rumination_output = {
                "status": "not_available",
                "reason": "Rumination model not loaded",
                "is_ruminating": None,
                "probability": None,
                "model_version": self.rumination_model_version,
            }

        # ============================================================
        # MODULE 4: Estrus (Heat) Screening & Mount Monitoring
        # ============================================================
        estrus_output: Dict[str, Any] = {}
        try:
            # Hallmark biological indicators:
            # 1. Active Mounting detected by behaviour classifier (highest specificity for standing heat)
            mount_prob = float(behaviour_probs.get("active_mount", 0.0))
            is_mount = bool(pred_label == "active_mount" or mount_prob >= 0.30)

            # 2. Dynamic activity surge
            dyn_accel = float(feat_dict.get("dynamic_acceleration_mean", 0.0))
            dyn_max = float(feat_dict.get("accel_magnitude_max", 1.0))
            gyro_rms = float(feat_dict.get("gyro_magnitude_rms", 0.0))

            # Activity surge factor (0.0 to 1.0)
            surge_factor = min(1.0, max(0.0, (dyn_accel - 0.05) / 0.50))

            # Integrated real-time estrus score
            if is_mount:
                estrus_score = 0.70 + 0.28 * mount_prob
                risk_level = "HIGH"
                interpretation = "Active mounting behaviour detected. Strong standing estrus / heat indicator."
            elif pred_label == "walking" and (dyn_accel > 0.25 or gyro_rms > 30.0):
                estrus_score = 0.35 + 0.30 * surge_factor
                risk_level = "MODERATE"
                interpretation = "Elevated locomotion activity surge detected. Monitor cow for secondary estrus signs."
            elif surge_factor > 0.6:
                estrus_score = 0.30 + 0.25 * surge_factor
                risk_level = "MODERATE"
                interpretation = "Restlessness and unusual physical motion observed. Watch for heat progression."
            else:
                estrus_score = max(0.02, 0.15 * surge_factor)
                risk_level = "LOW"
                interpretation = "Normal routine activity baseline. No estrus indicators detected."

            estrus_score = round(min(0.99, max(0.01, estrus_score)), 4)
            detected = bool(estrus_score >= 0.35)

            estrus_output = {
                "status": "available",
                "detected": detected,
                "risk_level": risk_level,
                "score": estrus_score,
                "estrus_probability": estrus_score,
                "mount_detected": is_mount,
                "mount_confidence": round(mount_prob, 4),
                "activity_surge": round(dyn_accel, 3),
                "model_version": self.estrus_model_version,
                "interpretation": interpretation,
            }
        except Exception as exc:
            logger.error("Estrus screening failed: %s", exc)
            estrus_output = {
                "status": "error",
                "reason": f"Execution error: {exc}",
                "detected": None,
                "risk_level": "UNKNOWN",
                "score": None,
                "model_version": self.estrus_model_version,
            }

        # ============================================================
        # MODULE 5: Lameness & Thermal Health Monitoring
        # ============================================================
        lameness_output: Dict[str, Any] = {}
        try:
            # 1. Contact temperature telemetry from DS18B20 probe
            latest_reading = snapshot[-1]
            s_dict = latest_reading.get("sensors") or latest_reading
            raw_temp = s_dict.get("temperature_c") if s_dict.get("temperature_c") is not None else s_dict.get("temp")
            
            if raw_temp is not None:
                temp_c = float(raw_temp)
                if temp_c >= 39.5:
                    temp_status = "ELEVATED_FEVER_RISK"
                elif temp_c < 36.5:
                    temp_status = "LOW_OR_DISLODGED"
                else:
                    temp_status = "NORMAL"
            else:
                temp_c = None
                temp_status = "NOT_CONFIGURED"

            # 2. Locomotion & Gait Asymmetry Analysis
            # Lateral & vertical jerk variances: accel_y_diff_std, accel_z_diff_std
            y_diff_std = float(feat_dict.get("accel_y_diff_std", 0.0))
            z_diff_std = float(feat_dict.get("accel_z_diff_std", 0.0))
            accel_range = float(feat_dict.get("accel_magnitude_range", 0.0))

            # Stride asymmetry index: ratio of lateral jerk to forward/backward progression
            asymmetry_idx = min(1.0, max(0.05, (y_diff_std + z_diff_std) * 0.8))

            # Veterinary locomotion score: 1.0 (Sound) to 5.0 (Severely Lame)
            if pred_label == "walking":
                locomotion_score = 1.0 + 3.5 * max(0.0, asymmetry_idx - 0.25)
            elif pred_label == "resting":
                # Resting cows have baseline low movement
                locomotion_score = 1.0 + 0.5 * asymmetry_idx
            else:
                locomotion_score = 1.0 + 1.5 * asymmetry_idx

            locomotion_score = min(5.0, max(1.0, locomotion_score))

            if locomotion_score >= 3.2 or (temp_status == "ELEVATED_FEVER_RISK" and temp_c is not None):
                lame_risk = "HIGH"
                lame_detected = True
            elif locomotion_score >= 2.2:
                lame_risk = "MONITOR"
                lame_detected = True
            else:
                lame_risk = "LOW"
                lame_detected = False

            # Interpretation message
            if temp_status == "ELEVATED_FEVER_RISK" and temp_c is not None:
                lame_interp = f"Thermal alert: Contact temperature elevated at {temp_c:.1f}°C. Monitor for mastitis or infection."
            elif locomotion_score >= 3.0:
                lame_interp = f"Locomotion score {locomotion_score:.1f} (Asymmetric Gait). Hoof and limb inspection advised."
            elif locomotion_score >= 2.0:
                lame_interp = f"Locomotion score {locomotion_score:.1f} (Mild irregularity). Cow active, continue monitoring."
            else:
                if temp_c is not None:
                    lame_interp = f"Locomotion sound (Score {locomotion_score:.1f}). Gait symmetric, temperature normal ({temp_c:.1f}°C)."
                else:
                    lame_interp = f"Locomotion sound (Score {locomotion_score:.1f}). Gait symmetric, contact temperature sensor not attached."

            lameness_output = {
                "status": "available",
                "detected": lame_detected,
                "risk_level": lame_risk,
                "locomotion_score": round(locomotion_score, 1),
                "gait_asymmetry_index": round(asymmetry_idx, 3),
                "contact_temperature_c": round(temp_c, 1) if temp_c is not None else None,
                "temperature_status": temp_status,
                "model_version": self.lameness_model_version,
                "interpretation": lame_interp,
            }
        except Exception as exc:
            logger.error("Lameness screening failed: %s", exc)
            lameness_output = {
                "status": "error",
                "reason": f"Execution error: {exc}",
                "detected": None,
                "risk_level": "UNKNOWN",
                "locomotion_score": None,
                "model_version": self.lameness_model_version,
            }

        # ============================================================
        # 6. Assemble Unified 5-Module Prediction Response
        # ============================================================
        full_prediction = {
            "cow_id": target_cow,
            "timestamp": now_iso,
            "data_source": "esp32_live",
            "status": "available",
            "behaviour": behaviour_output,
            "anomaly": anomaly_output,
            "rumination": rumination_output,
            "estrus": estrus_output,
            "lameness": lameness_output,
            "data_quality": {
                "status": "sufficient",
                "reading_count": extract_res.metadata.get("reading_count", len(snapshot)),
                "min_required": self.min_samples,
                "sampling_rate_hz": extract_res.metadata.get("estimated_sampling_rate_hz", 10.0),
                "quality_score": extract_res.metadata.get("data_quality_score", 1.0),
                "window_duration_sec": extract_res.metadata.get("window_duration_sec", 0.0),
            },
        }

        # Record prediction into bounded history
        with self._lock:
            for cid in {target_cow, norm_cow}:
                if cid not in self._cow_prediction_history:
                    self._cow_prediction_history[cid] = deque(maxlen=MAX_PREDICTIONS_PER_COW)
                self._cow_prediction_history[cid].append(full_prediction)

        return full_prediction

    def get_prediction_history(self, cow_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent prediction history for a cow."""
        with self._lock:
            history = self._cow_prediction_history.get(cow_id) or self._cow_prediction_history.get(normalize_cow_id(cow_id))
            if not history:
                return []
            return list(history)[-limit:]

    def get_cow_freshness(
        self,
        cow_id: str,
        stale_threshold_sec: float = 6.0,
        offline_threshold_sec: float = 20.0,
    ) -> Dict[str, Any]:
        """Calculate connection freshness from server-side received_at timestamp."""
        norm_cow = normalize_cow_id(cow_id)
        with self._lock:
            last_dt = self._cow_last_received_at.get(cow_id) or self._cow_last_received_at.get(norm_cow)
            latest = self._cow_latest_reading.get(cow_id) or self._cow_latest_reading.get(norm_cow)
            total = self._cow_total_readings.get(cow_id) or self._cow_total_readings.get(norm_cow, 0)

        if not last_dt or not latest:
            return {
                "status": "waiting_for_sensor_data",
                "seconds_since_last_reading": None,
                "is_stale": False,
                "last_received_at": None,
                "device_id": None,
                "total_readings": 0,
            }

        now = datetime.now(timezone.utc)
        seconds_since = round(max(0.0, (now - last_dt).total_seconds()), 2)
        if seconds_since <= stale_threshold_sec:
            hw_status = "online"
            is_stale = False
        elif seconds_since <= offline_threshold_sec:
            hw_status = "stale"
            is_stale = True
        else:
            hw_status = "offline"
            is_stale = True

        return {
            "status": hw_status,
            "seconds_since_last_reading": seconds_since,
            "is_stale": is_stale,
            "last_received_at": last_dt.isoformat(),
            "device_id": latest.get("device_id"),
            "total_readings": total,
        }

    def _update_alerts_for_cow(
        self,
        cow_id: str,
        inference_result: Dict[str, Any],
        cooldown_sec: float = 60.0,
    ) -> List[Dict[str, Any]]:
        """Evaluate and deduplicate meaningful animal health alerts only."""
        norm_cow = normalize_cow_id(cow_id)
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()
        now_ts = now_dt.timestamp()

        # If data is insufficient or error, do not create animal health alerts
        if inference_result.get("status") != "available":
            return []

        with self._lock:
            active = self._cow_active_alerts.setdefault(norm_cow, {})
            cooldowns = self._cow_alert_cooldowns.setdefault(norm_cow, {})

        current_alerts: Dict[str, Dict[str, Any]] = {}

        # 1. Anomaly detection rule: Distinguish raw score from alert decision (alert on score <= -0.12)
        anom = inference_result.get("anomaly", {})
        anom_score = anom.get("score")
        if anom.get("status") == "available" and anom.get("detected") is True and (anom_score is not None and anom_score <= -0.12):
            alert_type = "activity_anomaly"
            if alert_type not in active or (now_ts - cooldowns.get(alert_type, 0)) >= cooldown_sec:
                current_alerts[alert_type] = {
                    "id": f"anom-{norm_cow}-{int(now_ts)}",
                    "cow_id": norm_cow,
                    "type": alert_type,
                    "severity": "warning",
                    "title": "Unusual Movement Pattern",
                    "message": anom.get("interpretation") or "Sensor motion pattern deviates from grazing baseline.",
                    "score": anom_score,
                    "source": "anomaly_detector",
                    "timestamp": now_iso,
                }
                cooldowns[alert_type] = now_ts
            else:
                current_alerts[alert_type] = active[alert_type]

        # 2. Estrus alert rule
        estrus = inference_result.get("estrus", {})
        if estrus.get("status") == "available" and (
            estrus.get("mount_detected") is True
            or estrus.get("risk_level") in ("HIGH", "MODERATE")
            or estrus.get("detected") is True
        ):
            alert_type = "estrus_surge"
            if alert_type not in active or (now_ts - cooldowns.get(alert_type, 0)) >= cooldown_sec:
                title = "Standing Heat / Mounting Alert" if estrus.get("mount_detected") else "Elevated Estrus / Heat Activity Surge"
                current_alerts[alert_type] = {
                    "id": f"estrus-{norm_cow}-{int(now_ts)}",
                    "cow_id": norm_cow,
                    "type": alert_type,
                    "severity": "alert",
                    "title": title,
                    "message": estrus.get("interpretation") or "High activity or active mounting detected.",
                    "score": estrus.get("score"),
                    "source": "estrus_screener",
                    "timestamp": now_iso,
                }
                cooldowns[alert_type] = now_ts
            else:
                current_alerts[alert_type] = active[alert_type]

        # 3. Lameness & Thermal alerts
        lame = inference_result.get("lameness", {})
        if lame.get("status") == "available":
            if lame.get("temperature_status") == "ELEVATED_FEVER_RISK":
                alert_type = "thermal_fever"
                if alert_type not in active or (now_ts - cooldowns.get(alert_type, 0)) >= cooldown_sec:
                    current_alerts[alert_type] = {
                        "id": f"fever-{norm_cow}-{int(now_ts)}",
                        "cow_id": norm_cow,
                        "type": alert_type,
                        "severity": "alert",
                        "title": "Thermal Fever Alert",
                        "message": lame.get("interpretation") or f"Contact temperature elevated ({lame.get('contact_temperature_c')}°C).",
                        "score": lame.get("contact_temperature_c"),
                        "source": "thermal_monitor",
                        "timestamp": now_iso,
                    }
                    cooldowns[alert_type] = now_ts
                else:
                    current_alerts[alert_type] = active[alert_type]
            elif lame.get("locomotion_score", 0) >= 3.2:
                alert_type = "locomotion_impairment"
                if alert_type not in active or (now_ts - cooldowns.get(alert_type, 0)) >= cooldown_sec:
                    current_alerts[alert_type] = {
                        "id": f"lame-{norm_cow}-{int(now_ts)}",
                        "cow_id": norm_cow,
                        "type": alert_type,
                        "severity": "warning",
                        "title": "Gait Asymmetry / Lameness Alert",
                        "message": lame.get("interpretation") or f"Locomotion score {lame.get('locomotion_score')} indicates gait irregularity.",
                        "score": lame.get("locomotion_score"),
                        "source": "lameness_screener",
                        "timestamp": now_iso,
                    }
                    cooldowns[alert_type] = now_ts
                else:
                    current_alerts[alert_type] = active[alert_type]

        with self._lock:
            self._cow_active_alerts[norm_cow] = current_alerts
        return list(current_alerts.values())

    def get_all_active_alerts(self) -> List[Dict[str, Any]]:
        """Return all active, deduplicated alerts across all registered cows."""
        with self._lock:
            all_alerts: List[Dict[str, Any]] = []
            for cow_id, alerts_dict in self._cow_active_alerts.items():
                all_alerts.extend(alerts_dict.values())
            # Sort newest first
            all_alerts.sort(key=lambda a: a.get("timestamp", ""), reverse=True)
            return all_alerts

    def resolve_alert(self, alert_id: str) -> bool:
        """Mark an alert as resolved on the server."""
        with self._lock:
            for cow_id, alerts_dict in self._cow_active_alerts.items():
                keys_to_del = [k for k, v in alerts_dict.items() if v.get("id") == alert_id]
                if keys_to_del:
                    for k in keys_to_del:
                        del alerts_dict[k]
                    return True
            return False

    def get_live_dashboard_payload(
        self,
        cow_id: str,
        stale_threshold_sec: float = 6.0,
    ) -> Dict[str, Any]:
        """Assemble the consolidated live dashboard response contract."""
        norm_cow = normalize_cow_id(cow_id)
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Connection Freshness
        freshness = self.get_cow_freshness(norm_cow, stale_threshold_sec=stale_threshold_sec)
        hw_status = freshness["status"]
        is_stale = freshness["is_stale"]

        # 2. Latest Sensor Telemetry
        with self._lock:
            latest_reading = self._cow_latest_reading.get(cow_id) or self._cow_latest_reading.get(norm_cow)
            buffer = self._cow_sensor_buffers.get(cow_id) or self._cow_sensor_buffers.get(norm_cow)
            buffer_len = len(buffer) if buffer else 0

        sensor_values = {
            "accel_x": None,
            "accel_y": None,
            "accel_z": None,
            "gyro_x": None,
            "gyro_y": None,
            "gyro_z": None,
            "temperature_c": None,
        }
        sensor_timestamp = None
        received_at = None

        if latest_reading:
            s_dict = latest_reading.get("sensors") or latest_reading
            sensor_values = {
                "accel_x": s_dict.get("accel_x"),
                "accel_y": s_dict.get("accel_y"),
                "accel_z": s_dict.get("accel_z"),
                "gyro_x": s_dict.get("gyro_x"),
                "gyro_y": s_dict.get("gyro_y"),
                "gyro_z": s_dict.get("gyro_z"),
                "temperature_c": s_dict.get("temperature_c") if s_dict.get("temperature_c") is not None else s_dict.get("temp"),
            }
            sensor_timestamp = latest_reading.get("timestamp")
            received_at = latest_reading.get("received_at")

        # 3. AI Inference across all 5 modules
        ai_res = self.run_inference_for_cow(cow_id=norm_cow, window_size=self.min_samples)

        # 4. Meaningful Animal Alerts (deduplicated)
        alerts = self._update_alerts_for_cow(norm_cow, ai_res)

        # 5. Technical Warnings (separated from animal health alerts)
        technical_warnings = []
        if hw_status == "stale":
            technical_warnings.append({
                "type": "hardware_stale",
                "message": f"Sensor readings are stale ({freshness['seconds_since_last_reading']}s since last transmission).",
                "timestamp": now_iso,
            })
        elif hw_status == "offline":
            technical_warnings.append({
                "type": "hardware_offline",
                "message": f"ESP32 collar is offline ({freshness['seconds_since_last_reading']}s without data).",
                "timestamp": now_iso,
            })
        elif hw_status == "waiting_for_sensor_data":
            technical_warnings.append({
                "type": "waiting_for_sensor_data",
                "message": f"Awaiting sensor packet for {norm_cow}.",
                "timestamp": now_iso,
            })

        if 0 < buffer_len < self.min_samples:
            technical_warnings.append({
                "type": "window_accumulating",
                "message": f"Accumulating rolling window ({buffer_len}/{self.min_samples} samples).",
                "timestamp": now_iso,
            })

        data_quality = ai_res.get("data_quality", {
            "status": "sufficient" if buffer_len >= self.min_samples else "insufficient",
            "reading_count": buffer_len,
            "min_required": self.min_samples,
            "issues": [] if buffer_len >= self.min_samples else [f"Accumulating window: {buffer_len}/{self.min_samples}"],
        })

        return {
            "api": {
                "status": "online",
                "server_time": now_iso,
                "version": "2.0.0",
            },
            "hardware": {
                "status": hw_status,
                "connection_state": "receiving_data" if hw_status in ("online", "stale") else ("offline" if hw_status == "offline" else "waiting_for_sensor_data"),
                "cow_id": norm_cow,
                "device_id": freshness.get("device_id") or "--",
                "last_received_at": freshness.get("last_received_at"),
                "seconds_since_last_reading": freshness.get("seconds_since_last_reading"),
                "is_stale": is_stale,
                "total_readings": freshness.get("total_readings", 0),
            },
            "sensor": {
                "timestamp": sensor_timestamp,
                "received_at": received_at,
                "is_stale": is_stale,
                "values": sensor_values,
            },
            "window": {
                "sample_count": buffer_len,
                "required_samples": self.min_samples,
                "ready": buffer_len >= self.min_samples,
                "progress_percent": min(100, int((buffer_len / self.min_samples) * 100)),
            },
            "ai": {
                "behaviour": ai_res.get("behaviour"),
                "anomaly": ai_res.get("anomaly"),
                "rumination": ai_res.get("rumination"),
                "estrus": ai_res.get("estrus"),
                "lameness": ai_res.get("lameness"),
            },
            "alerts": alerts,
            "technical_warnings": technical_warnings,
            "data_quality": data_quality,
            "active_cows": self.get_active_cows(),
        }


# Global singleton inference service instance
_ai_service: Optional[AIInferenceService] = None


def get_ai_service() -> AIInferenceService:
    """Retrieve or initialize the global AI inference service."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIInferenceService()
    return _ai_service
