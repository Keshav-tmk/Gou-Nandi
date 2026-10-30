// ============================================================
// SmartLivestock AI — Alerts Management Service
// ============================================================

import { apiClient } from './apiClient';
import { AlertsResponse } from '../types/api';

export const alertsService = {
  async getHerdAlerts(signal?: AbortSignal): Promise<AlertsResponse> {
    return apiClient.get<AlertsResponse>('/alerts', { signal, timeoutMs: 5000 });
  },

  async resolveAlert(alertId: string): Promise<{ status: string; resolved: boolean }> {
    return apiClient.post(`/alerts/${encodeURIComponent(alertId)}/resolve`, {});
  },
};

