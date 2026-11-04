
// ============================================================
// GouNandi AI — Central Zustand Application Store
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

const PRODUCTION_API_URL = 'https://gou-nandi.onrender.com';

// ============================================================
// INITIAL THEME
// ============================================================

function getInitialTheme(): AppTheme {
  const saved = localStorage.getItem(
    `${STORAGE_KEY_SETTINGS}_theme`
  );

  if (saved === 'dark' || saved === 'light') {
    return saved;
  }

  return 'light';
}

// ============================================================
// INITIAL API URL
// ============================================================

function getInitialApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  // Production: prioritize the Vercel environment variable.
  // Never fall back to localhost, relative URL, or outdated localStorage in production.
  if (import.meta.env.PROD) {
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/+$/, '');
    }
    return PRODUCTION_API_URL;
  }

  // Development: use previously saved API URL if available.
  const saved = localStorage.getItem(
    `${STORAGE_KEY_SETTINGS}_api_url`
  );

  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }

  // Local Vite development server.
  if (
    typeof window !== 'undefined' &&
    window.location.port === '5173'
  ) {
    return '';
  }

  return (
    envUrl?.replace(/\/+$/, '') ||
    'http://127.0.0.1:8000'
  );
}

// ============================================================
// INITIAL POLLING INTERVAL
// ============================================================

function getInitialPollingInterval(): number {
  const saved = localStorage.getItem(
    `${STORAGE_KEY_SETTINGS}_polling_interval`
  );

  const parsed = saved ? parseInt(saved, 10) : 2000;

  return [1000, 2000, 5000].includes(parsed)
    ? parsed
    : 2000;
}

// ============================================================
// ZUSTAND STORE
// ============================================================

export const useAppStore = create<AppState>((set, get) => {
  const initialTheme = getInitialTheme();

  // Apply theme immediately.
  if (typeof document !== 'undefined') {
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  return {
    // Cow selection
    selectedCowId: 'COW-001',

    setSelectedCowId: (cowId) =>
      set({ selectedCowId: cowId }),

    // Theme
    theme: initialTheme,

    toggleTheme: () => {
      const current = get().theme;

      const next: AppTheme =
        current === 'dark' ? 'light' : 'dark';

      localStorage.setItem(
        `${STORAGE_KEY_SETTINGS}_theme`,
        next
      );

      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle(
          'dark',
          next === 'dark'
        );
      }

      set({ theme: next });
    },

    setTheme: (theme) => {
      localStorage.setItem(
        `${STORAGE_KEY_SETTINGS}_theme`,
        theme
      );

      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle(
          'dark',
          theme === 'dark'
        );
      }

      set({ theme });
    },

    // Operation Mode
    isDemoMode: false,

    setDemoMode: (isDemo) =>
      set({ isDemoMode: isDemo }),

    // Polling Controls
    pollingIntervalMs: getInitialPollingInterval(),

    setPollingIntervalMs: (ms) => {
      localStorage.setItem(
        `${STORAGE_KEY_SETTINGS}_polling_interval`,
        String(ms)
      );

      set({ pollingIntervalMs: ms });
    },

    isPollingPaused: false,

    togglePollingPaused: () =>
      set((state) => ({
        isPollingPaused: !state.isPollingPaused,
      })),

    setPollingPaused: (paused) =>
      set({ isPollingPaused: paused }),

    // API Configuration
    apiBaseUrl: getInitialApiUrl(),

    setApiBaseUrl: (url) => {
      const clean = url.trim().replace(/\/+$/, '');

      if (!import.meta.env.PROD) {
        localStorage.setItem(
          `${STORAGE_KEY_SETTINGS}_api_url`,
          clean
        );
      } else if (clean.startsWith('https://') && !clean.includes('localhost') && !clean.includes('127.0.0.1')) {
        localStorage.setItem(
          `${STORAGE_KEY_SETTINGS}_api_url`,
          clean
        );
      }

      set({ apiBaseUrl: clean });
    },

    // Mobile Drawer
    isMobileDrawerOpen: false,

    setMobileDrawerOpen: (open) =>
      set({ isMobileDrawerOpen: open }),

    // Connectivity
    backendStatus: 'checking',

    setBackendStatus: (status) =>
      set({ backendStatus: status }),

    lastSuccessfulSync: null,

    setLastSuccessfulSync: (isoTime) =>
      set({ lastSuccessfulSync: isoTime }),

    lastErrorMessage: null,

    setLastErrorMessage: (msg) =>
      set({ lastErrorMessage: msg }),
  };
});
