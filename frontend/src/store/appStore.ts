// ============================================================
// SmartLivestock AI — Central Zustand Application Store
// ============================================================

import { create } from 'zustand';

export type AppTheme = 'light' | 'dark';
export type BackendStatus = 'online' | 'offline' | 'checking';

interface AppState {
  // Cow selection
  selectedCowId: string;
  setSelectedCowId: (cowId: string) => void;

  // Theme
  theme: AppTheme;
  toggleTheme: () => void;
  setTheme: (theme: AppTheme) => void;

  // Operation Mode
  isDemoMode: boolean;
  setDemoMode: (isDemo: boolean) => void;

  // Polling Controls
  pollingIntervalMs: number;
  setPollingIntervalMs: (ms: number) => void;
  isPollingPaused: boolean;
  togglePollingPaused: () => void;
  setPollingPaused: (paused: boolean) => void;

  // API Configuration
  apiBaseUrl: string;
  setApiBaseUrl: (url: string) => void;

  // Mobile Drawer
  isMobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;

  // Connectivity
  backendStatus: BackendStatus;
  setBackendStatus: (status: BackendStatus) => void;
  lastSuccessfulSync: string | null;
  setLastSuccessfulSync: (isoTime: string | null) => void;
  lastErrorMessage: string | null;
  setLastErrorMessage: (msg: string | null) => void;
}

const STORAGE_KEY_SETTINGS = 'smartlivestock_settings';

function getInitialTheme(): AppTheme {
  const saved = localStorage.getItem(`${STORAGE_KEY_SETTINGS}_theme`);
  if (saved === 'dark' || saved === 'light') return saved;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function getInitialApiUrl(): string {
  const saved = localStorage.getItem(`${STORAGE_KEY_SETTINGS}_api_url`);
  if (saved && saved.trim()) return saved.trim();
  // If Vite env is set, use it; otherwise default to local FastAPI port
  return (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
}

function getInitialPollingInterval(): number {
  const saved = localStorage.getItem(`${STORAGE_KEY_SETTINGS}_polling_interval`);
  const parsed = saved ? parseInt(saved, 10) : 2000;
  return [1000, 2000, 5000].includes(parsed) ? parsed : 2000;
}

export const useAppStore = create<AppState>((set, get) => {
  const initialTheme = getInitialTheme();

  // Apply theme to document element immediately
  if (typeof document !== 'undefined') {
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  return {
    selectedCowId: 'COW-001',
    setSelectedCowId: (cowId) => set({ selectedCowId: cowId }),

    theme: initialTheme,
    toggleTheme: () => {
      const current = get().theme;
      const next: AppTheme = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem(`${STORAGE_KEY_SETTINGS}_theme`, next);
      if (typeof document !== 'undefined') {
        if (next === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      set({ theme: next });
    },
    setTheme: (theme) => {
      localStorage.setItem(`${STORAGE_KEY_SETTINGS}_theme`, theme);
      if (typeof document !== 'undefined') {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      set({ theme });
    },

    isDemoMode: false,
    setDemoMode: (isDemo) => set({ isDemoMode: isDemo }),

    pollingIntervalMs: getInitialPollingInterval(),
    setPollingIntervalMs: (ms) => {
      localStorage.setItem(`${STORAGE_KEY_SETTINGS}_polling_interval`, String(ms));
      set({ pollingIntervalMs: ms });
    },

    isPollingPaused: false,
    togglePollingPaused: () => set((s) => ({ isPollingPaused: !s.isPollingPaused })),
    setPollingPaused: (paused) => set({ isPollingPaused: paused }),

    apiBaseUrl: getInitialApiUrl(),
    setApiBaseUrl: (url) => {
      const clean = url.trim().replace(/\/+$/, '');
      localStorage.setItem(`${STORAGE_KEY_SETTINGS}_api_url`, clean);
      set({ apiBaseUrl: clean });
    },

    isMobileDrawerOpen: false,
    setMobileDrawerOpen: (open) => set({ isMobileDrawerOpen: open }),

    backendStatus: 'checking',
    setBackendStatus: (status) => set({ backendStatus: status }),
    lastSuccessfulSync: null,
    setLastSuccessfulSync: (isoTime) => set({ lastSuccessfulSync: isoTime }),
    lastErrorMessage: null,
    setLastErrorMessage: (msg) => set({ lastErrorMessage: msg }),
  };
});

