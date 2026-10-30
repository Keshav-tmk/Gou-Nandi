// ============================================================
// SmartLivestock AI — Cows & Herd Management Service
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
};

