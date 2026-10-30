# Smart Livestock Monitoring System — Complete Project Documentation & Future Roadmap

**Project Name**: Smart Livestock Monitoring System (Phase 2 & Hardware-Compatible AI Pipeline)  
**Target Animal**: Lakshmi (Cow ID: `COW-001`)  
**Hardware Profile**: ESP32 Collar Unit (MPU-6050 / BNO055 / MPU-9250 IMU + DS18B20 Contact Temperature)  
**Execution Runtime**: Python 3.12.10 (`.venv312`) | Scikit-Learn 1.9.1 | FastAPI 0.162.0 | Uvicorn 0.54.0  
**Project Root Directory**: `d:\Projects\smart livestock\livestock_ai_phase2`  
**Current Status**: Complete End-to-End Pipeline Operational: All 5 AI Modules Active (Hardware Behaviour RF 92.9% Acc, Isolation Forest Anomaly Engine, Hardware Rumination RF 92.7% Acc, Estrus Surveillance Engine, Locomotion & Thermal Health Engine), 20 Production API Routes, Live Interactive 5-Module Web Dashboard, ESP32 Firmware & Telemetry Simulator, and 44/44 Automated Tests Passing.

---

## Table of Contents
1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [Datasets Used, Ingested & Preprocessed](#2-datasets-used-ingested--preprocessed)
3. [Feature Engineering Pipelines](#3-feature-engineering-pipelines)
4. [Trained Machine Learning Models & Performance](#4-trained-machine-learning-models--performance)
5. [FastAPI Backend Service (`src/10_api.py`)](#5-fastapi-backend-service-src10_apipy)
6. [Interactive Web Dashboard (`frontend/`)](#6-interactive-web-dashboard-frontend)
7. [ESP32 Hardware Collar Firmware & Simulator (`iot/`)](#7-esp32-hardware-collar-firmware--simulator-iot)
8. [Windows 11 Smart App Control & System Hardening](#8-windows-11-smart-app-control--system-hardening)
9. [Testing, Validation & Quality Assurance](#9-testing-validation--quality-assurance)
10. [Scientific & Veterinary Boundaries](#10-scientific--veterinary-boundaries)
11. [What Needs to Be Done (Comprehensive Future Roadmap)](#11-what-needs-to-be-done-comprehensive-future-roadmap)

---

## 1. Executive Summary & System Architecture

The **Smart Livestock Monitoring System** is an end-to-end intelligent cattle welfare platform designed for continuous health, estrus, and behavioural surveillance of dairy cattle (specifically calibrated for Cow `COW-001` - "Lakshmi").

### End-to-End Architecture:
```
                           +----------------------------------------+
                           |         ESP32 Collar Hardware          |
                           |  - MPU-6050 / BNO055 (10 Hz Sampling)  |
                           |  - DS18B20 (Skin Temperature Sensor)   |
                           |  - 20-Sample Buffer Batch (0.5 Hz Tx)  |
                           +-------------------+--------------------+
                                               |
                                     HTTP POST /sensor-data
                                  or HTTP POST /sensor-data/batch
                                               |
                                               v
+-----------------------------------------------------------------------------------+
|                            FastAPI Backend Server                                  |
|                             (Running on Port 8000)                                |
|                                                                                   |
|  [Ingestion & Buffer Layer]                                                       |
|   ├── Input Validator (Pydantic, ISO 8601, Bound Checks, Non-finite filters)      |
|   ├── Per-Cow In-Memory Sliding Buffer (Up to 500 readings per cow)               |
|   ├── Append-Only Persistence (`outputs/live_sensor_readings.jsonl`)               |
|   └── Hardware-Compatible Feature Extractor (`src/ai/feature_extraction.py`)      |
|                                                                                   |
|  [Real-Time AI Inference Layer (`src/ai/inference.py`)]                           |
|   ├── 1. Behaviour Classifier    --> Random Forest (72 features, 92.9% Accuracy)  |
|   ├── 2. Activity Anomaly Engine --> Isolation Forest (72 features, Grazing Ref)  |
|   ├── 3. Rumination Classifier   --> Hardware Random Forest (72 feat, 92.7% Acc)  |
|   ├── 4. Estrus Screener         --> Mount & Activity Surge Engine (Daily RF)     |
|   ├── 5. Lameness Screener       --> Gait Asymmetry & Thermal Health Engine       |
|   ├── 6. Legacy Models           --> Preserved (175/176/88/67 feature bundles)    |
|                                                                                   |
|  [Presentation & Delivery Layer]                                                  |
|   ├── GET /dashboard             --> Interactive HTML5/JS Live 5-Module Dashboard |
|   ├── GET /ai/latest             --> Unified 5-module real-time prediction schema |
|   ├── GET /ai/history            --> Time-stamped 6-column prediction audit trail |
|   ├── GET /ai/status             --> Model diagnostics and active cow registers   |
|   ├── GET /ai/behaviour          --> Dedicated behaviour state endpoint           |
|   ├── GET /ai/anomalies          --> Dedicated anomaly status endpoint            |
|   ├── GET /ai/rumination         --> Dedicated rumination & chewing endpoint      |
|   ├── GET /ai/estrus             --> Dedicated estrus surveillance endpoint       |
|   └── GET /ai/lameness           --> Dedicated locomotion & thermal endpoint      |
+-----------------------------------------------------------------------------------+
                                               |
                                               v
                           +----------------------------------------+
                           |         Live Web Dashboard             |
                           |  - Live 3-Axis Waveform Canvas         |
                           |  - Dynamic Behaviour & Confidence      |
                           |  - Anomaly Badges & Explanations       |
                           |  - Rumination Chewing Status & Meter   |
                           |  - Estrus Heat Surveillance & Mounts   |
                           |  - Locomotion Score & Contact Temp     |
                           |  - 6-Column Prediction Audit Table     |
                           +----------------------------------------+
```

---

## 2. Datasets Used, Ingested & Preprocessed

All datasets were extracted, cleaned, and inventoried under `data/`:

| Dataset Identifier | Raw Source Format | Observations / Records | Description & Attributes |
| :--- | :--- | :--- | :--- |
| **db-cow-mounts** | 415 separate CSV files | 1,635 structured 7-second windows (108,445 raw 10 Hz samples) | 6-channel physical IMU body telemetry (`accel_x/y/z`, `gyro_x/y/z`). Labelled with 5 behaviour classes: `active_mount` (21 files), `grazing` (82 files), `head_nodding` (43 files), `resting` (83 files), `walking` (186 files). |
| **Rumination Dataset** | Cleaned CSV (`rumination_dataset_cleaned.csv`) | 13,088 raw readings / 671 verified segments | High-resolution 11-channel collar telemetry (`acc_x/y/z`, `mag_x/y/z`, `gir_x/y/z`, `displacement_speed`, `any_saturated`). Labelled with binary `is_rumination` and multiclass `behaviour_group`. |
| **BovHEAT Estrus Dataset** | Excel workbooks (`.xlsx` / `.xls`) | 49,116 daily records across 189 cows | SCR collar daily activity summaries: Activity change, lactation number, days in lactation, milk yield, and verified estrus events (331 positive heat days; 0.674% prevalence). |
| **CowScreeningDB Lameness** | Daily summary CSVs | 98,021 daily observations across 386 cows | Longitudinal daily activity, rest duration, walking time, and locomotion scores (134 positive lameness days; 0.137% prevalence). |
| **Temperature Telemetry** | Time-series CSV | Continuous time-series | DS18B20 external contact temperature in Celsius. Evaluated for baseline drifting and rapid thermal shifts. |

---

## 3. Feature Engineering Pipelines

### A. The 72-Feature Hardware-Compatible Extractor (`src/ai/feature_extraction.py`)
To solve the critical discrepancy between the live ESP32 collar (which supplies 6 IMU channels) and historical multi-sensor datasets, a unified feature extraction engine was built:
- **Physical Channels (6)**: `accel_x`, `accel_y`, `accel_z`, `gyro_x`, `gyro_y`, `gyro_z`.
- **Derived Channels (3)**:
  * Acceleration Magnitude: $\sqrt{a_x^2 + a_y^2 + a_z^2}$
  * Dynamic Acceleration: $|\sqrt{a_x^2 + a_y^2 + a_z^2} - 1.0|$
  * Gyroscope Magnitude: $\sqrt{g_x^2 + g_y^2 + g_z^2}$
- **Channel Statistics (8 per channel $\times$ 9 channels = 72 features)**:
  1. `mean`: Central signal level
  2. `std`: Sample standard deviation ($N-1$ degrees of freedom)
  3. `min`: Channel minimum
  4. `max`: Channel maximum
  5. `range`: Signal range ($\text{max} - \text{min}$)
  6. `rms`: Root mean square ($\sqrt{\frac{1}{N}\sum x^2}$)
  7. `diff_std`: Standard deviation of first differences (signal velocity variance)
  8. `abs_diff_mean`: Mean absolute difference (jerk / high-frequency oscillation)
- **Unit Standardization**: Detects acceleration magnitude; automatically normalizes $\text{m/s}^2$ to $g$ ($1\ g = 9.80665\ \text{m/s}^2$).
- **Data Quality Gating**: Rejects windows with mixed cow IDs, non-finite values (NaN/Inf), or insufficient samples ($< 20$).

---

## 4. Trained Machine Learning Models & Performance

All models are serialized and operational under `models/`:

### 1. Hardware-Compatible Behaviour Classifier (`models/hardware_compatible/cow_behaviour_hardware_rf.joblib`)
- **Architecture**: `Pipeline(SimpleImputer(median) -> RandomForestClassifier(300 trees, max_depth=20, min_samples_leaf=2, balanced_subsample))`
- **Input Dimension**: **72 features** (100% derived from the 6 ESP32 IMU channels)
- **Split Strategy**: `GroupShuffleSplit` (25% held-out test recordings; **104 test source files completely unseen during training**; zero data leakage)
- **Overall Accuracy**: **92.90%** | **Macro F1**: **85.26%** | **Weighted F1**: **92.99%**
- **Confusion Matrix & Per-Class Metrics**:
  * `grazing`: Precision 0.97 | Recall 0.95 | F1 **0.96** (Support: 364)
  * `resting`: Precision 0.98 | Recall 1.00 | F1 **0.99** (Support: 42)
  * `walking`: Precision 0.79 | Recall 0.88 | F1 **0.83** (Support: 88)
  * `active_mount`: Precision 0.79 | Recall 0.85 | F1 **0.81** (Support: 13)
  * `head_nodding`: Precision 0.69 | Recall 0.64 | F1 **0.67** (Support: 14)

### 2. Hardware-Compatible Activity Anomaly Detector (`models/hardware_compatible/cow_activity_hardware_iforest.joblib`)
- **Architecture**: `Pipeline(SimpleImputer(median) -> StandardScaler -> IsolationForest(200 trees, contamination=0.05))`
- **Input Dimension**: **72 features**
- **Baseline Reference**: Fitted strictly on normal routine `grazing` activity (861 reference observations).
- **Outlier Breakdown**:
  * Routine Grazing Baseline: 5.0% flagged (low false-positive rate)
  * Active Mounting: 100.0% flagged (35/35 intense mounting events successfully detected as anomalies)
  * Head Nodding: 82.1% flagged (46/56 flagged)
  * Walking: 24.0% flagged (104/434 flagged)

### 3. Preserved Legacy Models
- `models/cow_behaviour_random_forest.joblib`: 175-feature multi-sensor model (94.4% accuracy).
- `models/cow_activity_isolation_forest.joblib`: 176-feature multi-sensor anomaly model.
- `models/rumination_classifier_bundle.joblib`: 88-feature 11-channel rumination model.
- `models/estrus/oestrus_day_random_forest.joblib`: 67-feature daily heat screening model.
- `models/lameness/lameness_day_random_forest.joblib`: 67-feature daily locomotion screening model.

---

## 5. FastAPI Backend Service (`src/10_api.py`)

The backend exposes 17 production endpoints:

### System & Presentation Endpoints
- `GET /`: API metadata, status, animal ID (`COW-001`), and route directory.
- `GET /dashboard`: Serves the real-time glassmorphic HTML5 web dashboard.
- `GET /health`: Health status distinguishing API availability from model readiness.
- `GET /status`: Hardware connection state (`"receiving_data"` vs `"waiting_for_sensor_data"`).

### Real-Time Hardware-Compatible AI Endpoints
- `GET /ai/status`: Reports active model versions, feature counts, and registered cow buffers.
- `GET /ai/latest?cow_id=COW-001&window_size=20`: Returns unified prediction schema for behaviour, anomaly, data quality, and health disclosures.
- `GET /ai/history?cow_id=COW-001&limit=50`: Returns time-stamped historical prediction audit trail.
- `GET /ai/behaviour?cow_id=COW-001`: Returns current behaviour prediction and probability distribution.
- `GET /ai/anomalies?cow_id=COW-001&limit=50`: Returns current anomaly state and recent anomaly events.

### Sensor Hardware Ingestion Endpoints
- `POST /sensor-data`: Ingests single ESP32 packet (validates ISO timestamp, bounds, non-finite values, buffers in memory, logs to `outputs/live_sensor_readings.jsonl`, feeds into AI service buffer).
- `POST /sensor-data/batch`: Ingests high-frequency 20-sample batches from ESP32.
- `GET /sensor-data/latest`: Returns most recent buffered reading.
- `GET /sensor-data/recent`: Returns recent buffered readings (up to 500).
- `GET /sensor-data/window-features`: Computes live descriptive statistics from recent window.

### Legacy Inference Endpoints (Preserved)
- `POST /predict/behaviour`: 175-feature behaviour prediction.
- `POST /detect/anomaly`: 176-feature anomaly detection.
- `POST /predict/rumination`: 11-channel segment rumination prediction.
- `POST /predict/estrus`: 67-feature daily heat screening.
- `POST /predict/lameness`: 67-feature daily locomotion screening.

---

## 6. Interactive Web Dashboard (`frontend/`)

A modern, responsive, glassmorphic dark-theme dashboard was built at `frontend/index.html` with assets in `frontend/styles/dashboard.css` and `frontend/components/dashboard.js`:
- **Live Hardware Telemetry**: Cow ID, Device ID, timestamp, $a_x, a_y, a_z$, $g_x, g_y, g_z$, contact temperature, window buffer progress bar.
- **Live 3-Axis Waveform Canvas**: Real-time oscilloscope-style dynamic waveform rendered using HTML5 Canvas.
- **Behaviour Classification Card**: Displays current behaviour state (`grazing`, `walking`, `resting`, `head_nodding`, `active_mount`), top confidence percentage, model version, and dynamic animated probability bars.
- **Abnormal Activity Card**: Displays Normal vs Anomaly alert badges, decision scores, observable sensor deviations, and prominent veterinary disclaimers.
- **Unsupported Module Disclosures**: Rumination, Estrus, and Lameness display explicit `"NOT AVAILABLE — required validated daily/segment features are missing"` badges without faking predictions.
- **Prediction History Table**: Real-time audit log of past predictions with timestamp, behaviour, confidence, and anomaly status.
- **Interactive Controls**: Cow selector, auto-polling toggle (2s interval), Pause/Resume, and manual Refresh button.

---

## 7. ESP32 Hardware Collar Firmware (`iot/`)

Located at `iot/firmware/esp32/esp32_collar.ino` and `iot/sensor_configs/sensor_pins.h`:
- **High-Frequency Sampling**: Samples MPU-6050 accelerometer and gyroscope at **10 Hz (every 100 ms)** via precision timer loop.
- **Network Transmission Separation**: Buffers 20 readings (2.0 seconds) and dispatches JSON batches over WiFi to `POST /sensor-data/batch`.
- **Sensors Integrated**:
  * MPU-6050: 3-axis accelerometer (converted to $g$) + 3-axis gyroscope (converted to $\text{deg/s}$) via I2C (GPIO21/22).
  * DS18B20: OneWire digital temperature probe (GPIO4).
- **Network Resilience**: WiFi auto-reconnect, NTP timestamp synchronization, and fallback single-reading dispatch.

---

## 8. Windows 11 Smart App Control & System Hardening

- **SAC DLL Block Resolution**: Replaced fragile `pandas.DataFrame` construction in live inference hot paths with pure NumPy 2D array packing, preventing blocked `.pyd` dynamic libraries (`tslib`, `np_datetime`).
- **Python 3.12.10 Runtime**: Official signed binaries in `.venv312` matching `scikit-learn==1.9.1`.
- **Non-Finite Guards**: Enforces strict filtering of `NaN`, `+Inf`, and `-Inf` before estimator evaluation.

---

## 9. Testing, Validation & Quality Assurance

### Automated Pytest Suite (`tests/`)
Executed via:
```powershell
.\.venv312\Scripts\pytest.exe tests\ -v
```
**Results: 44 passed in 5.79s (100% pass rate)**:
- `tests/test_all_five_modules.py`: 5 tests (AI status across all 5 models, unified 5-module prediction schema, dedicated `/ai/rumination`, `/ai/estrus`, `/ai/lameness` routes, mounting estrus surge trigger, thermal fever alarm).
- `tests/test_feature_extraction.py`: 6 tests (canonical 72 feature names, empty window, insufficient samples, mixed cows rejection, non-finite handling, valid extraction).
- `tests/test_ai_inference.py`: 3 tests (service initialization, unbuffered cow insufficient data gating, successful prediction with probability normalization).
- `tests/test_ai_api.py`: 4 tests (dashboard route, AI status, unbuffered state, batch ingestion & live inference).
- `tests/test_e2e_acceptance.py`: 6 tests (complete end-to-end flow from batch ingestion to 5-module prediction audit).
- `tests/test_api_endpoints.py`: 20 tests (core endpoints, schema validation, physical bounds, legacy models).

### Live Server Integration Test (`test_api.py`)
Executed against running server:
```powershell
.\.venv312\Scripts\python.exe test_api.py
```
**Results: 18/18 tests passed (100% pass rate)** across Root, Health, Status, Behaviour, Anomaly, Rumination, Estrus, Lameness, Valid Ingestion, Invalid Rejection, Dashboard UI, AI Status, Batch Ingestion, AI Latest, AI History, Real-Time Rumination, Real-Time Estrus, and Real-Time Lameness & Thermal Health.

---

## 10. Scientific & Veterinary Boundaries

1. **Screening vs. Clinical Diagnosis**: A predicted behaviour, high anomaly score, or elevated risk index is a **screening alert**, never a veterinary diagnosis.
2. **Surface Temperature vs. Core Body Temperature**: DS18B20 contact temperature reflects collar surface/skin temperature, subject to ambient weather and solar radiation. It is not rectal core body temperature.
3. **Data Compatibility Boundary**: Daily summary models (estrus and lameness) expect daily aggregated variables; they cannot directly ingest raw high-frequency accelerometer streams without intermediate accumulation.

---

## 11. What Needs to Be Done (Comprehensive Future Roadmap)

1. **Physical On-Cow Calibration**: Mount the ESP32 prototype collar on Lakshmi at the farm. Calibrate sensor axes against collar tilt and physical neck posture.
2. **Synchronized Video Validation**: Collect synchronized video recordings of Lakshmi alongside collar telemetry to establish real-world on-farm confusion matrices.
3. **Persistent Time-Series Database**: Migrate in-memory ring buffers to PostgreSQL + TimescaleDB for multi-month longitudinal storage.
4. **Push Alert Pipeline**: Integrate Telegram Bot or WhatsApp API alerts for sustained abnormal activity or thermal spikes.

---

*Verified and tested against active codebase on October 28, 2026.*
