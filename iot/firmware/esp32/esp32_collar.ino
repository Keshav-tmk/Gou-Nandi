/*
 * ==============================================================================
 * Smart Livestock Monitoring System — ESP32 Smart Collar Firmware
 * Target Animal: Lakshmi (Cow ID: COW-001)
 * Device ID:     ESP32-COLLAR-01
 * 
 * Hardware Architecture:
 * - Microcontroller: ESP32-WROOM-32 (240MHz dual-core, 520KB SRAM)
 * - IMU Sensor:      MPU-6050 / BNO055 (I2C: SDA=GPIO21, SCL=GPIO22)
 * - Temp Sensor:     DS18B20 Digital Thermometer (OneWire: GPIO4)
 * - Battery Monitor: Voltage Divider (ADC: GPIO34)
 * 
 * Frequency Separation (as required by AI Pipeline Specification):
 * 1. Sensor Acquisition Frequency: 10 Hz (every 100 ms) via precision interval
 * 2. Network Transmission Cadence: 0.5 Hz (every 2000 ms = batch of 20 samples)
 * 3. Backend Inference Cadence:   Rolling window evaluation (20 to 70 samples)
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <time.h>

// --- Network Configuration ---
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://192.168.1.100:8000/sensor-data/batch";
const char* SERVER_FALLBACK_URL = "http://192.168.1.100:8000/sensor-data";

// --- Device Identifiers ---
const char* COW_ID    = "COW-001";
const char* DEVICE_ID = "ESP32-COLLAR-01";

// --- Sensor Pin Mapping ---
#define I2C_SDA_PIN    21
#define I2C_SCL_PIN    22
#define DS18B20_PIN    4
#define STATUS_LED_PIN 2

// --- Sampling Parameters ---
const unsigned long SAMPLE_INTERVAL_MS = 100;   // 10 Hz acquisition
const int BATCH_SIZE = 20;                     // 20 readings = 2.0 seconds window
const float GRAVITY = 9.80665f;

// --- MPU-6050 Registers ---
#define MPU6050_ADDR         0x68
#define MPU6050_PWR_MGMT_1   0x6B
#define MPU6050_ACCEL_XOUT_H 0x3B
#define MPU6050_GYRO_XOUT_H  0x43

// Sensitivity Scale Factors for ±2g and ±250 deg/s
const float ACCEL_SCALE = 16384.0f; // LSB/g
const float GYRO_SCALE  = 131.0f;   // LSB/(deg/s)

// Data structure for one timestamped reading
struct SensorReading {
  char timestamp[32];
  float accel_x;
  float accel_y;
  float accel_z;
  float gyro_x;
  float gyro_y;
  float gyro_z;
  float temperature_c;
};

// Batch buffer
SensorReading sampleBuffer[BATCH_SIZE];
int bufferIndex = 0;
unsigned long lastSampleTime = 0;

// NTP Time Client for True UTC Timestamps
const char* NTP_SERVER = "pool.ntp.org";
const long  GMT_OFFSET_SEC = 0;
const int   DAYLIGHT_OFFSET_SEC = 0;

void setupMPU6050() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, 400000); // 400kHz fast I2C
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_PWR_MGMT_1);
  Wire.write(0x00); // Wake up MPU-6050
  Wire.endTransmission(true);
  Serial.println("[INFO] MPU-6050 initialized.");
}

void getIsoTimestamp(char* outBuffer, size_t maxLen) {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    // Fallback to relative milliseconds if NTP not yet synced
    snprintf(outBuffer, maxLen, "2026-10-28T00:00:%02luZ", (millis() / 1000) % 60);
    return;
  }
  strftime(outBuffer, maxLen, "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
}

void readSensors(SensorReading& outReading) {
  // Read 14 bytes from MPU-6050 (Accel 6B, Temp 2B, Gyro 6B)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_ACCEL_XOUT_H);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_ADDR, 14, true);

  if (Wire.available() >= 14) {
    int16_t raw_ax = (Wire.read() << 8) | Wire.read();
    int16_t raw_ay = (Wire.read() << 8) | Wire.read();
    int16_t raw_az = (Wire.read() << 8) | Wire.read();
    int16_t raw_t  = (Wire.read() << 8) | Wire.read();
    int16_t raw_gx = (Wire.read() << 8) | Wire.read();
    int16_t raw_gy = (Wire.read() << 8) | Wire.read();
    int16_t raw_gz = (Wire.read() << 8) | Wire.read();

    outReading.accel_x = (float)raw_ax / ACCEL_SCALE; // in g
    outReading.accel_y = (float)raw_ay / ACCEL_SCALE; // in g
    outReading.accel_z = (float)raw_az / ACCEL_SCALE; // in g

    outReading.gyro_x = (float)raw_gx / GYRO_SCALE;   // in dps
    outReading.gyro_y = (float)raw_gy / GYRO_SCALE;   // in dps
    outReading.gyro_z = (float)raw_gz / GYRO_SCALE;   // in dps

    // MPU internal die temperature (or external DS18B20)
    outReading.temperature_c = ((float)raw_t / 340.0f) + 36.53f;
  }

  getIsoTimestamp(outReading.timestamp, sizeof(outReading.timestamp));
}

void transmitBatch() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] WiFi disconnected. Reconnecting...");
    WiFi.reconnect();
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Construct JSON batch array
  String json = "[";
  for (int i = 0; i < BATCH_SIZE; i++) {
    if (i > 0) json += ",";
    json += "{\"cow_id\":\"";
    json += COW_ID;
    json += "\",\"device_id\":\"";
    json += DEVICE_ID;
    json += "\",\"timestamp\":\"";
    json += sampleBuffer[i].timestamp;
    json += "\",\"sensors\":{";
    json += "\"accel_x\":" + String(sampleBuffer[i].accel_x, 4) + ",";
    json += "\"accel_y\":" + String(sampleBuffer[i].accel_y, 4) + ",";
    json += "\"accel_z\":" + String(sampleBuffer[i].accel_z, 4) + ",";
    json += "\"gyro_x\":" + String(sampleBuffer[i].gyro_x, 4) + ",";
    json += "\"gyro_y\":" + String(sampleBuffer[i].gyro_y, 4) + ",";
    json += "\"gyro_z\":" + String(sampleBuffer[i].gyro_z, 4) + ",";
    json += "\"temperature_c\":" + String(sampleBuffer[i].temperature_c, 2);
    json += "}}";
  }
  json += "]";

  int httpCode = http.POST(json);
  if (httpCode == 201 || httpCode == 200) {
    Serial.printf("[INFO] Batch sent: %d readings (HTTP %d)\n", BATCH_SIZE, httpCode);
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(20);
    digitalWrite(STATUS_LED_PIN, LOW);
  } else {
    Serial.printf("[ERROR] HTTP POST failed: %d (%s)\n", httpCode, http.errorToString(httpCode).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED_PIN, OUTPUT);

  Serial.println("\n==============================================");
  Serial.println("Smart Livestock Monitoring Collar Starting...");
  Serial.println("==============================================");

  setupMPU6050();

  // Connect WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[INFO] Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[INFO] WiFi Connected. IP: " + WiFi.localIP().toString());
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  } else {
    Serial.println("\n[WARN] WiFi connection failed. Will retry in loop.");
  }

  lastSampleTime = millis();
}

void loop() {
  unsigned long now = millis();

  // 10 Hz Acquisition Loop (every 100 ms)
  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime += SAMPLE_INTERVAL_MS;

    readSensors(sampleBuffer[bufferIndex]);
    bufferIndex++;

    // When 20 samples (2 seconds) accumulated, transmit batch
    if (bufferIndex >= BATCH_SIZE) {
      transmitBatch();
      bufferIndex = 0;
    }
  }
}
