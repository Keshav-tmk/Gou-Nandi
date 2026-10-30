// ============================================================
// SmartLivestock AI — Live Telemetry Service
// ============================================================

import { apiClient } from './apiClient';
import { LiveDashboardResponse } from '../types/api';

export const telemetryService = {
  async getLiveDashboard(cowId: string, signal?: AbortSignal): Promise<LiveDashboardResponse> {
    return apiClient.get<LiveDashboardResponse>('/dashboard/api/live', {
      params: { cow_id: cowId },
      signal,
      timeoutMs: 5000,
    });
  },

  async getRecentReadings(cowId: string, limit: number = 20, signal?: AbortSignal) {
    return apiClient.get('/sensor-data/recent', {
      params: { cow_id: cowId, limit },
      signal,
      timeoutMs: 5000,
    });
  },

  async getLatestReading(cowId: string, signal?: AbortSignal) {
    return apiClient.get('/sensor-data/latest', {
      params: { cow_id: cowId },
      signal,
      timeoutMs: 5000,
    });
  },

  async getWindowFeatures(cowId: string, windowSize: number = 20, signal?: AbortSignal) {
    return apiClient.get('/sensor-data/window-features', {
      params: { cow_id: cowId, window_size: windowSize },
      signal,
      timeoutMs: 5000,
    });
  },
};

