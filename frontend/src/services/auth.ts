// ============================================================
// GouNandi AI — Authentication & Farmer Profile Service
// ============================================================

import { apiClient } from './apiClient';
import { AuthResponse, FarmerProfile, FarmerRegisterData, ProfileUpdateData } from '../types/auth';

export const authService = {
  async register(data: FarmerRegisterData): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/register', data);
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', { email, password });
  },

  async getProfile(): Promise<{ status: string; farmer: FarmerProfile }> {
    return apiClient.get<{ status: string; farmer: FarmerProfile }>('/auth/me');
  },

  async updateProfile(data: ProfileUpdateData): Promise<{ status: string; message: string; farmer: FarmerProfile }> {
    return apiClient.put('/auth/profile', data);
  },

  async changePassword(current_password: string, new_password: string, confirm_password: string): Promise<{ status: string; message: string }> {
    return apiClient.put('/auth/change-password', {
      current_password,
      new_password,
      confirm_password,
    });
  },

  async logout(): Promise<{ status: string; message: string }> {
    return apiClient.post('/auth/logout');
  },
};

