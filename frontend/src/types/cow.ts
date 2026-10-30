// ============================================================
// SmartLivestock AI — Cow & Herd Type Definitions
// ============================================================

import { HardwareStatus } from './telemetry';

export interface CowProfile {
  id: string;
  name: string;
  tag: string;
  breed: string;
  deviceId: string;
  date_of_birth?: string;
  lactation_stage?: string;
  weight_kg?: number;
}

export interface CowSummary extends CowProfile {
  status: HardwareStatus;
  has_live_telemetry: boolean;
  last_received_at: string | null;
  seconds_since_last_reading: number | null;
  total_readings: number;
  latest_behaviour: string | null;
  alerts_count: number;
  is_stale: boolean;
}

