// ============================================================
// SmartLivestock AI — API Contract & Response Type Definitions
// ============================================================

import { HardwareInfo, SensorReading, WindowBufferState } from './telemetry';
import { LivestockAlert, TechnicalWarning } from './alerts';
import { CowSummary, CowProfile } from './cow';

export interface ApiStatusInfo {
  status: 'online' | 'offline' | 'degraded';
  server_time?: string;
  version?: string;
}

export interface LiveDashboardResponse {
  api: ApiStatusInfo;
  hardware: HardwareInfo;
  sensor: SensorReading;
  window: WindowBufferState;
  ai: {
    behaviour: any;
    anomaly: any;
    rumination: any;
    estrus: any;
    lameness: any;
  };
  alerts: LivestockAlert[];
  technical_warnings: TechnicalWarning[];
  data_quality: {
    status: string;
    reading_count: number;
    min_required: number;
    issues?: string[];
  };
  active_cows: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  models_loaded: Record<string, boolean>;
}

export interface CowsListResponse {
  status: string;
  count: number;
  timestamp: string;
  cows: CowSummary[];
}

export interface CowDetailResponse {
  status: string;
  profile: CowProfile;
  freshness: any;
  latest_telemetry: SensorReading;
  recent_readings: any[];
  window: WindowBufferState;
  ai: any;
  alerts: LivestockAlert[];
  prediction_history: any[];
}

export interface AlertsResponse {
  status: string;
  total: number;
  active: LivestockAlert[];
  timestamp: string;
}

export interface AnalyticsSummaryResponse {
  status: string;
  timestamp: string;
  herd: {
    total_cows: number;
    telemetry_active_cows: number;
    healthy_cows: number;
    attention_cows: number;
    active_alerts_count: number;
  };
  behaviour_distribution: Record<string, number>;
  total_inferences_recorded: number;
}

