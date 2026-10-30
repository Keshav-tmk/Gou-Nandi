# Smart Livestock Monitoring System — AI & IoT Backend

A production-grade Python FastAPI backend and machine-learning inference engine for cow behaviour monitoring, abnormal activity detection, rumination analysis, experimental estrus and lameness screening, and genuine ESP32 hardware telemetry ingestion.

---

## 1. System Overview

- **Target Animal**: Lakshmi (Cow ID: `COW-001`)
- **Recommended Python**: **Python 3.12** (verified with Python 3.12.10)
- **Framework**: FastAPI + Uvicorn
- **ML Framework**: Scikit-Learn 1.9.1 (exact match with trained model serialization), Joblib 1.6.0, NumPy 2.5.4, SciPy 1.18.1
- **IoT Hardware**: ESP32 collar unit (IMU 9-DOF: BNO055 / MPU9250 accelerometer, gyroscope, magnetometer, orientation quaternion + DS18B20 contact temperature)

---

## 2. Windows 11 & Application Control Diagnostics

On Windows 11 with **Smart App Control (SAC)** or **Code Integrity Policies** enabled (`CodeIntegrityPolicyEnforcementStatus: 2`), unsigned `.pyd` dynamic libraries that are uncataloged in Microsoft's Intelligent Security Graph (such as pre-release Python 3.14 alpha wheels or certain unsigned C-extensions like `tslib` / `np_datetime`) are blocked with:
```text
ImportError: DLL load failed while importing tslib: An Application Control policy has blocked this file.
```

### Approved Architecture Resolution:
1. **Official Python 3.12.10**: Created a clean virtual environment `.venv312` utilizing signed official Python 3.12 binaries and `scikit-learn==1.9.1`.
2. **Resilient Feature Ingestion**: Replaced the fragile `pd.DataFrame` C-extension bottleneck inside `src/10_api.py` with pure NumPy array feature packing and aggregation (`prepare_feature_array` and `aggregate_rumination_readings`). All models execute natively without triggering App Control blocks.

---

## 3. Environment Setup & Installation

### Option A: Quick Setup (PowerShell)
```powershell
# 1. Verify Python 3.12 is installed
py -3.12 --version

# 2. Create the clean virtual environment
py -3.12 -m venv .venv312

# 3. Activate the environment
.\.venv312\Scripts\Activate.ps1

# 4. Install tested dependencies
pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org
```

---

## 4. Running the Server

### Automated Startup Script
Run the robust PowerShell startup script from the project root:
```powershell
.\scripts\start_backend.ps1
```
*Options:*
- `-HostAddress <IP>`: Default `127.0.0.1` (use `0.0.0.0` or local LAN IP to connect from a physical phone).
- `-Port <int>`: Default `8000`. Detects port conflicts and displays the owning process.
- `-Reload`: Enable live auto-reloading for development.

### Manual Startup Command
```powershell
.\.venv312\Scripts\python.exe -m uvicorn src.10_api:app --host 127.0.0.1 --port 8000
```

---

## 5. Running Automated Tests

### Comprehensive Pytest Suite
Runs 20 unit and integration tests covering root, health, status, all five ML inference endpoints, input schema validation, non-finite rejection, and ESP32 ingestion:
```powershell
.\scripts\test_backend.ps1
```

### Live Server Integration Test
Starts tests against an active, running server instance:
```powershell
# In terminal 1:
.\scripts\start_backend.ps1

# In terminal 2:
.\scripts\test_backend.ps1 -LiveServer
# Or directly:
.\.venv312\Scripts\python.exe test_api.py
```

---

## 6. Model Artifacts & Preserved Bundles

All original model artifacts are preserved in `models/` without retraining or modification:
- `models/cow_behaviour_random_forest.joblib` (175 features, Random Forest pipeline)
- `models/cow_activity_isolation_forest.joblib` (176 features, Isolation Forest)
- `models/rumination_classifier_bundle.joblib` (11 sensor columns, 88 statistical features)
- `models/estrus/oestrus_day_random_forest.joblib` (67 features, threshold = 0.12)
- `models/lameness/lameness_day_random_forest.joblib` (67 features, threshold = 0.50)

---

## 7. API Endpoints & Request/Response Formats

### 1. `GET /` — Root Status
Returns API version, available routes, and hardware metadata.

### 2. `GET /health` — Health & Model Readiness
Distinguishes between API process availability and ML model readiness:
```json
{
  "status": "ready",
  "api_online": true,
  "models_ready": true,
  "behaviour_model_loaded": true,
  "anomaly_model_loaded": true,
  "rumination_model_loaded": true,
  "estrus_model_loaded": true,
  "lameness_model_loaded": true,
  "behaviour_feature_count": 175,
  "anomaly_feature_count": 176,
  "rumination_feature_count": 88
}
```

### 3. `GET /status` — Monitoring & Telemetry Status
Consolidates pipeline status from `outputs/combined_monitoring_status.json` with live hardware connection state (`"receiving_data"` or `"waiting_for_sensor_data"`).

### 4. `POST /predict/behaviour` — Behaviour Classification
Expects the 175 exact features from `cow_behaviour_random_forest.joblib`:
```json
{
  "features": {
    "BNO055_ax_world_mean": 0.05,
    "...": 0.0
  }
}
```
**Response**:
```json
{
  "predicted_behaviour": "resting",
  "model": "Random Forest",
  "input_feature_count": 175,
  "class_probabilities": {
    "active mounting": 0.02,
    "grazing": 0.08,
    "head nodding": 0.05,
    "resting": 0.82,
    "walking": 0.03
  }
}
```

### 5. `POST /detect/anomaly` — Activity Anomaly Detection
Expects the 176 exact features from `cow_activity_isolation_forest.joblib`:
```json
{
  "anomaly_detected": true,
  "model": "Isolation Forest",
  "input_feature_count": 176,
  "decision_score": -0.103193,
  "interpretation": "Unusual sensor pattern detected. Review the observation and its context. This does not prove illness."
}
```

### 6. `POST /predict/rumination` — Rumination Monitoring
Accepts a temporal sequence of readings (minimum length: 2) containing the 11 required sensor columns:
```json
{
  "readings": [
    {
      "acc_x": 0.1, "acc_y": 0.2, "acc_z": 0.15,
      "mag_x": 20.0, "mag_y": -10.0, "mag_z": 40.0,
      "gir_x": 0.01, "gir_y": 0.02, "gir_z": 0.0,
      "displacement_speed": 0.05, "any_saturated": 0.0
    },
    {
      "acc_x": 0.12, "acc_y": 0.22, "acc_z": 0.14,
      "mag_x": 20.1, "mag_y": -9.9, "mag_z": 40.1,
      "gir_x": 0.01, "gir_y": 0.02, "gir_z": 0.0,
      "displacement_speed": 0.06, "any_saturated": 0.0
    }
  ]
}
```

### 7. `POST /predict/estrus` & `POST /predict/lameness`
Accept 67 daily summary features and apply calibrated thresholds (`0.12` for estrus, `0.50` for lameness).

### 8. `POST /sensor-data` & `POST /sensor-data/batch` — ESP32 Ingestion
Ingests single packets or high-frequency 20-sample batches (10 Hz) directly from ESP32 microcontrollers:
```json
[
  {
    "cow_id": "COW-001",
    "device_id": "ESP32-COLLAR-01",
    "timestamp": "2026-10-29T08:00:00Z",
    "sensors": {
      "accel_x": 0.05,
      "accel_y": 0.95,
      "accel_z": 0.15,
      "gyro_x": 1.5,
      "gyro_y": -0.8,
      "gyro_z": 0.3,
      "temperature_c": 38.6
    }
  }
]
```

### 9. Real-Time Hardware-Compatible AI Endpoints
The real-time AI service evaluates all five modules from rolling 6-channel IMU windows:
- `GET /dashboard` — Interactive glassmorphic HTML5 web dashboard with real-time waveform and all 5 module cards.
- `GET /ai/status` — Operational status and input dimensions of all 5 active AI models.
- `GET /ai/latest?cow_id=COW-001` — Returns unified 5-module prediction schema:
  * `behaviour`: Predicted activity class (`grazing`, `resting`, `walking`, `active_mount`, `head_nodding`) and probabilities.
  * `anomaly`: Isolation Forest score and baseline deviation alert.
  * `rumination`: Hardware Random Forest cud chewing detection (`is_ruminating`, probability, chewing rhythm score).
  * `estrus`: Mount detection and dynamic activity surge risk level (`LOW`, `MODERATE`, `HIGH`).
  * `lameness`: Gait asymmetry index, locomotion score (1.0 to 5.0), and DS18B20 thermal health status.
- `GET /ai/history?cow_id=COW-001` — Time-stamped 6-column prediction audit trail.
- `GET /ai/rumination?cow_id=COW-001` — Dedicated rumination chewing metrics.
- `GET /ai/estrus?cow_id=COW-001` — Dedicated estrus heat surveillance metrics.
- `GET /ai/lameness?cow_id=COW-001` — Dedicated locomotion and thermal health metrics.

---

## 9. ESP32 Collar Telemetry Simulator

Run the hardware collar simulator to stream genuine 10 Hz telemetry batches into the running system:
```powershell
.\.venv312\Scripts\python.exe iot\simulation\esp32_collar_simulator.py --url http://127.0.0.1:8000 --cow-id COW-001 --batches 10 --interval 2.0 --mode cycle
```
Supported modes: `cycle`, `grazing`, `rumination`, `walking`, `active_mount`, `fever`, `lameness`.

---

## 10. Limitations & Clinical Boundaries

1. **Hardware Telemetry vs. Simulation**: Running test scripts with synthetic feature vectors validates software integration and mathematical pipelines, but does NOT validate real-world physical livestock behavior.
2. **Veterinary Disclaimer**: Predictions are research-prototype screening signals, not veterinary diagnoses.
3. **Sensor Placement**: DS18B20 external contact temperature reflects skin/collar surface, not core body temperature.
