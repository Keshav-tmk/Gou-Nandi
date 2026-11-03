// ============================================================
// GouNandi AI — Multi-Farmer Authentication Zustand Store
// ============================================================

import { create } from 'zustand';
import { FarmerProfile, FarmProfile, FarmerRegisterData, ProfileUpdateData } from '../types/auth';

const TOKEN_KEY = 'gounandi_jwt_token';
const FARMER_KEY = 'gounandi_farmer_profile';

interface AuthState {
  token: string | null;
  farmer: FarmerProfile | null;
  farm: FarmProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;

  setAuth: (token: string, farmer: FarmerProfile) => void;
  logout: () => void;
  setAuthError: (error: string | null) => void;
  updateLocalProfile: (farmer: FarmerProfile) => void;
}

function getStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredFarmer(): FarmerProfile | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const data = localStorage.getItem(FARMER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => {
  const initialToken = getStoredToken();
  const initialFarmer = getStoredFarmer();

  return {
    token: initialToken,
    farmer: initialFarmer,
    farm: initialFarmer ? initialFarmer.farm : null,
    isAuthenticated: Boolean(initialToken && initialFarmer),
    isLoading: false,
    authError: null,

    setAuth: (token, farmer) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(FARMER_KEY, JSON.stringify(farmer));
      set({
        token,
        farmer,
        farm: farmer.farm,
        isAuthenticated: true,
        authError: null,
      });
    },

    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(FARMER_KEY);
      set({
        token: null,
        farmer: null,
        farm: null,
        isAuthenticated: false,
        authError: null,
      });
    },

    setAuthError: (error) => set({ authError: error }),

    updateLocalProfile: (farmer) => {
      localStorage.setItem(FARMER_KEY, JSON.stringify(farmer));
      set({
        farmer,
        farm: farmer.farm,
      });
    },
  };
});

