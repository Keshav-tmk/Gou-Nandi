// ============================================================
// GouNandi AI — Cows & Herd Management Service
// ============================================================

import { apiClient } from './apiClient';
import { CowsListResponse, CowDetailResponse } from '../types/api';

export const cowsService = {
  async listCows(signal?: AbortSignal): Promise<CowsListResponse> {
    return apiClient.get<CowsListResponse>('/cows', { signal, timeoutMs: 5000 });
  },

  async getCowDetail(cowId: string, signal?: AbortSignal): Promise<CowDetailResponse> {
    return apiClient.get<CowDetailResponse>(`/cows/${encodeURIComponent(cowId)}`, {
      signal,
      timeoutMs: 5000,
    });
  },

  async addCow(data: {
    name: string;
    tag: string;
    breed: string;
    weight_kg: number;
    deviceId?: string;
    date_of_birth?: string;
    lactation_stage?: string;
  }): Promise<{ status: string; cow: any }> {
    return apiClient.post('/cows', data);
  },
};
