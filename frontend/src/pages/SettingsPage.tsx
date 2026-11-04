// ============================================================
// SmartLivestock AI — Application Settings Page (/settings)
// ============================================================

import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Card } from '../components/common/Card';
import { SectionHeader } from '../components/common/SectionHeader';
import { ConnectionStatus } from '../components/common/ConnectionStatus';
import { isValidUrl } from '../utils/validation';
import { apiClient } from '../services/apiClient';
import { Settings, Save, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const {
    apiBaseUrl,
    setApiBaseUrl,
    pollingIntervalMs,
    setPollingIntervalMs,
    isDemoMode,
    setDemoMode,
    backendStatus,
    setBackendStatus,
  } = useAppStore();

  const [inputUrl, setInputUrl] = useState(apiBaseUrl);
  const [saveStatus, setSaveStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUrl(inputUrl)) {
      setSaveStatus({
        type: 'error',
        message: 'Invalid URL. Please provide a valid HTTP or HTTPS endpoint (e.g., http://127.0.0.1:8000).',
      });
      return;
    }

    setApiBaseUrl(inputUrl);

    // Verify endpoint immediately
    try {
      await apiClient.get('/health', { timeoutMs: 3000 });
      setBackendStatus('online');
      setSaveStatus({
        type: 'success',
        message: 'Settings saved and connection verified successfully!',
      });
    } catch (err: any) {
      setBackendStatus('offline');
      setSaveStatus({
        type: 'error',
        message: `Settings saved, but health check failed: ${err.message}`,
      });
    }
  };

  const handleRestoreDefaults = () => {
    const defaultUrl = import.meta.env.PROD
      ? 'https://gou-nandi.onrender.com'
      : 'http://127.0.0.1:8000';
    setInputUrl(defaultUrl);
    setApiBaseUrl(defaultUrl);
    setPollingIntervalMs(2000);
    setDemoMode(false);
    setSaveStatus({
      type: 'success',
      message: `Restored default settings (${defaultUrl}, 2s interval).`,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#263238] dark:text-white tracking-tight">
          System Settings & Connections
        </h1>
        <p className="text-xs sm:text-sm text-[#607067] dark:text-gray-400 mt-1">
          Configure API endpoints, polling cadence, and demonstration modes.
        </p>
      </div>

      <Card className="p-6 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
        <form onSubmit={handleSave} className="space-y-6">
          {/* API Server URL */}
          <div>
            <label className="text-xs font-extrabold text-[#263238] dark:text-white uppercase tracking-wider block mb-1">
              Backend API Base URL
            </label>
            <p className="text-xs text-[#607067] dark:text-gray-400 mb-2">
              The FastAPI server address. In local development with Vite proxy, requests to this port are mapped automatically.
            </p>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="http://127.0.0.1:8000"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-farm-darkBorder bg-[#F7F9F4] dark:bg-gray-800/50 text-[#263238] dark:text-white font-mono focus:outline-hidden focus:ring-1 focus:ring-[#2E7D32]"
            />
          </div>

          {/* Polling Interval */}
          <div>
            <label className="text-xs font-extrabold text-[#263238] dark:text-white uppercase tracking-wider block mb-1">
              Telemetry Polling Frequency
            </label>
            <p className="text-xs text-[#607067] dark:text-gray-400 mb-2">
              Transmission interval for dashboard refreshes. Matches the ESP32 ~2s transmission cycle.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {[1000, 2000, 5000].map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => setPollingIntervalMs(ms)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                    pollingIntervalMs === ms
                      ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs'
                      : 'bg-[#F7F9F4] hover:bg-[#E8F5E9] text-[#607067] hover:text-[#2E7D32] border-[#E3E9E2] dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {ms / 1000} Second{ms > 1000 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Demo Mode Toggle */}
          <div className="pt-4 border-t border-[#E3E9E2] dark:border-farm-darkBorder">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-[#263238] dark:text-white block">
                  Demonstration / Offline Mode
                </span>
                <span className="text-xs text-[#607067] dark:text-gray-400 mt-0.5 block">
                  When enabled, uses realistic simulated sensor feeds and demo classifiers for testing without physical hardware.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isDemoMode}
                onChange={(e) => setDemoMode(e.target.checked)}
                className="w-4 h-4 text-[#2E7D32] accent-[#2E7D32] rounded-md focus:ring-[#2E7D32]"
              />
            </div>
          </div>

          {/* Status Message */}
          {saveStatus.type !== 'idle' && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                saveStatus.type === 'success'
                  ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]'
                  : 'bg-[#FFEBEE] text-[#D84343] border border-[#FFCDD2]'
              }`}
            >
              {saveStatus.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-[#2E7D32]" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#D84343]" />
              )}
              <span className="font-semibold">{saveStatus.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E3E9E2] dark:border-farm-darkBorder">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#607067] hover:text-[#263238] font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore Defaults
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs shadow-xs border border-[#2E7D32] transition-all"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

