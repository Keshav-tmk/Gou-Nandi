// ============================================================
// SmartLivestock AI — Telemetry Processing Utilities
// ============================================================

import { SensorValues, TelemetryPoint } from '../types/telemetry';
import { formatTimeOnly } from './formatTime';

export function formatSensorValue(val: number | null | undefined, unit: string = '', decimals: number = 3): string {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return '--';
  }
  const formatted = val.toFixed(decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function parseTelemetryPoint(reading: any): TelemetryPoint | null {
  if (!reading) return null;
  const s = reading.sensors || reading.values || reading;
  if (!s || typeof s !== 'object') return null;

  // Strict check: if accelerometer coordinates are null/undefined, do NOT fabricate 0.0g!
  if (
    s.accel_x === null || s.accel_x === undefined ||
    s.accel_y === null || s.accel_y === undefined ||
    s.accel_z === null || s.accel_z === undefined
  ) {
    return null;
  }

  const ax = Number(s.accel_x);
  const ay = Number(s.accel_y);
  const az = Number(s.accel_z);

  if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(az)) {
    return null;
  }

  const gx = s.gyro_x !== null && s.gyro_x !== undefined && Number.isFinite(Number(s.gyro_x))
    ? Number(s.gyro_x)
    : 0;
  const gy = s.gyro_y !== null && s.gyro_y !== undefined && Number.isFinite(Number(s.gyro_y))
    ? Number(s.gyro_y)
    : 0;
  const gz = s.gyro_z !== null && s.gyro_z !== undefined && Number.isFinite(Number(s.gyro_z))
    ? Number(s.gyro_z)
    : 0;

  const rawTime = reading.timestamp || reading.received_at || new Date().toISOString();
  return {
    timestamp: rawTime,
    timeFormatted: formatTimeOnly(rawTime),
    accel_x: parseFloat(ax.toFixed(4)),
    accel_y: parseFloat(ay.toFixed(4)),
    accel_z: parseFloat(az.toFixed(4)),
    gyro_x: parseFloat(gx.toFixed(2)),
    gyro_y: parseFloat(gy.toFixed(2)),
    gyro_z: parseFloat(gz.toFixed(2)),
  };
}

