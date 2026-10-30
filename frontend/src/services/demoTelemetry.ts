// ============================================================
// SmartLivestock AI — Dedicated Mock Telemetry Service for Demo Mode
// ============================================================

import { LiveDashboardResponse } from '../types/api';
import { AllAiModulesState } from '../types/ai';
import { formatTimeOnly } from '../utils/formatTime';

let demoTick = 0;

export function generateDemoDashboardPayload(cowId: string): LiveDashboardResponse {
  demoTick++;
  const now = new Date();
  const nowIso = now.toISOString();

  // Bounded simulated IMU waveforms for demo
  const t = demoTick * 0.2;
  const ax = parseFloat((0.95 + 0.15 * Math.sin(t)).toFixed(4));
  const ay = parseFloat((0.05 + 0.12 * Math.cos(t * 1.5)).toFixed(4));
  const az = parseFloat((0.28 + 0.18 * Math.sin(t * 0.8)).toFixed(4));
  const gx = parseFloat((1.2 * Math.sin(t * 2)).toFixed(2));
  const gy = parseFloat((1.5 * Math.cos(t * 1.8)).toFixed(2));
  const gz = parseFloat((0.8 * Math.sin(t * 1.2)).toFixed(2));

  return {
    api: {
      status: 'online',
      server_time: nowIso,
      version: '2.0.0-demo',
    },
    hardware: {
      status: 'online',
      connection_state: 'demo_simulated',
      cow_id: cowId,
      device_id: `ESP32_${cowId.replace('-', '')}`,
      last_received_at: nowIso,
      seconds_since_last_reading: 1.0,
      is_stale: false,
      total_readings: 120 + demoTick,
    },
    sensor: {
      timestamp: nowIso,
      received_at: nowIso,
      is_stale: false,
      values: {
        accel_x: ax,
        accel_y: ay,
        accel_z: az,
        gyro_x: gx,
        gyro_y: gy,
        gyro_z: gz,
        temperature_c: 38.6,
      },
    },
    window: {
      sample_count: 20,
      required_samples: 20,
      ready: true,
      progress_percent: 100,
    },
    ai: {
      behaviour: {
        status: 'available',
        label: demoTick % 4 === 0 ? 'grazing' : 'resting',
        probabilities: { grazing: 0.82, resting: 0.15, walking: 0.03 },
        model_version: 'Demo Classifier',
      },
      anomaly: {
        status: 'available',
        detected: false,
        score: 0.045,
        interpretation: 'Demonstration baseline grazing pattern.',
        model_version: 'Demo Isolation Forest',
      },
      rumination: {
        status: 'available',
        is_ruminating: true,
        probability: 0.84,
        confidence: 0.84,
        chewing_rhythm_score: 0.76,
        interpretation: 'Active simulated chewing pattern.',
        model_version: 'Demo RF',
      },
      estrus: {
        status: 'available',
        detected: false,
        risk_level: 'LOW',
        score: 0.12,
        mount_detected: false,
        activity_surge: 0.08,
        interpretation: 'Simulated activity within normal baseline.',
        model_version: 'Demo Estrus Monitor',
      },
      lameness: {
        status: 'available',
        detected: false,
        risk_level: 'LOW',
        locomotion_score: 1.2,
        gait_asymmetry_index: 0.14,
        contact_temperature_c: 38.6,
        temperature_status: 'NORMAL',
        interpretation: 'Simulated sound gait with normal temperature.',
        model_version: 'Demo Screener',
      },
    },
    alerts: [],
    technical_warnings: [],
    data_quality: {
      status: 'sufficient',
      reading_count: 20,
      min_required: 20,
      issues: [],
    },
    active_cows: [cowId],
  };
}

export function generateDemoTelemetryHistory(count: number = 15) {
  const points = [];
  const baseTime = Date.now() - count * 2000;
  for (let i = 0; i < count; i++) {
    const time = new Date(baseTime + i * 2000).toISOString();
    const t = i * 0.4;
    points.push({
      timestamp: time,
      timeFormatted: formatTimeOnly(time),
      accel_x: parseFloat((0.95 + 0.15 * Math.sin(t)).toFixed(4)),
      accel_y: parseFloat((0.05 + 0.12 * Math.cos(t * 1.5)).toFixed(4)),
      accel_z: parseFloat((0.28 + 0.18 * Math.sin(t * 0.8)).toFixed(4)),
      gyro_x: parseFloat((1.2 * Math.sin(t * 2)).toFixed(2)),
      gyro_y: parseFloat((1.5 * Math.cos(t * 1.8)).toFixed(2)),
      gyro_z: parseFloat((0.8 * Math.sin(t * 1.2)).toFixed(2)),
    });
  }
  return points;
}

