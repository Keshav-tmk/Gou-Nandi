// ============================================================
// SmartLivestock AI — Telemetry & Sensor Type Definitions
// ============================================================

export interface SensorValues {
  accel_x: number | null;
  accel_y: number | null;
  accel_z: number | null;
  gyro_x: number | null;
  gyro_y: number | null;
  gyro_z: number | null;
  temperature_c: number | null;
}

export type HardwareStatus =
  | "online"
  | "stale"
  | "offline"
  | "waiting_for_sensor_data";

export interface HardwareInfo {
  status: HardwareStatus;
  connection_state: string;
  cow_id: string;
  device_id: string;
  last_received_at: string | null;
  seconds_since_last_reading: number | null;
  is_stale: boolean;
  total_readings: number;
}

export interface SensorReading {
  timestamp: string | null;
  received_at: string | null;
  is_stale: boolean;
  values: SensorValues;
}

export interface WindowBufferState {
  sample_count: number;
  required_samples: number;
  ready: boolean;
  progress_percent: number;
}

export interface TelemetryPoint {
  timestamp: string;
  timeFormatted: string;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  gyro_x?: number;
  gyro_y?: number;
  gyro_z?: number;
}

