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
  const ax = typeof s.accel_x === 'number' ? s.accel_x : 0;
  const ay = typeof s.accel_y === 'number' ? s.accel_y : 0;
  const az = typeof s.accel_z === 'number' ? s.accel_z : 0;
  const gx = typeof s.gyro_x === 'number' ? s.gyro_x : 0;
  const gy = typeof s.gyro_y === 'number' ? s.gyro_y : 0;
  const gz = typeof s.gyro_z === 'number' ? s.gyro_z : 0;

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

