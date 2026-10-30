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
    const defaultUrl = 'http://127.0.0.1:8000';
    setInputUrl(defaultUrl);
    setApiBaseUrl(defaultUrl);
    setPollingIntervalMs(2000);
    setDemoMode(false);
    setSaveStatus({
      type: 'success',
      message: 'Restored default settings (http://127.0.0.1:8000, 2s interval).',
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          System Settings & Connections
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure API endpoints, polling cadence, and demonstration modes.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-6">
          {/* API Server URL */}
          <div>
            <label className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider block mb-1">
              Backend API Base URL
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              The FastAPI server address. In local development with Vite proxy, requests to this port are mapped automatically.
            </p>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="http://127.0.0.1:8000"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-farm-border dark:border-farm-darkBorder bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-white font-mono focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Polling Interval */}
          <div>
            <label className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider block mb-1">
              Telemetry Polling Frequency
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Transmission interval for dashboard refreshes. Matches the ESP32 ~2s cycle.
            </p>
            <div className="flex items-center gap-3">
              {[1000, 2000, 5000].map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => setPollingIntervalMs(ms)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                    pollingIntervalMs === ms
                      ? 'bg-emerald-700 text-white font-bold shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {ms / 1000} Second{ms > 1000 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Demo Mode Toggle */}
          <div className="pt-4 border-t border-farm-border dark:border-farm-darkBorder">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Demonstration / Offline Mode
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block">
                  When enabled, uses realistic simulated sensor feeds and demo classifiers for testing without physical hardware.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isDemoMode}
                onChange={(e) => setDemoMode(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Status Message */}
          {saveStatus.type !== 'idle' && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                saveStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              {saveStatus.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{saveStatus.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-farm-border dark:border-farm-darkBorder">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore Defaults
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-colors"
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

