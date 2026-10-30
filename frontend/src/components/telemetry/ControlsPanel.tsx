// ============================================================
// SmartLivestock AI — ControlsPanel Component
// ============================================================

import React, { useState } from 'react';
import { Card } from '../common/Card';
import { useAppStore } from '../../store/appStore';
import { apiClient } from '../../services/apiClient';
import { RefreshCw, Play, Pause, Activity, CheckCircle, XCircle } from 'lucide-react';

interface ControlsPanelProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({ onRefresh, isRefreshing = false }) => {
  const {
    apiBaseUrl,
    backendStatus,
    isPollingPaused,
    togglePollingPaused,
    pollingIntervalMs,
    setPollingIntervalMs,
    isDemoMode,
  } = useAppStore();

  const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });
  const [isTesting, setIsTesting] = useState(false);

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult({ status: 'idle', message: '' });
    try {
      const data = await apiClient.get('/health', { timeoutMs: 3000 });
      setTestResult({
        status: 'success',
        message: `Connected successfully to ${data.service || 'livestock API'} (${data.status}).`,
      });
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: `Connection failed: ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-farm-border dark:border-farm-darkBorder">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Sensor Connection & Controls
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Configured API: <span className="font-mono text-gray-700 dark:text-gray-300">{apiBaseUrl}</span>
            {isDemoMode && <span className="ml-2 text-amber-600 font-bold">(Demo Mode Active)</span>}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Readings
          </button>

          <button
            onClick={togglePollingPaused}
            type="button"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${
              isPollingPaused
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
          >
            {isPollingPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPollingPaused ? 'Resume Updates' : 'Pause Updates'}
          </button>

          <button
            onClick={testConnection}
            disabled={isTesting}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <Activity className="w-3.5 h-3.5" />
            {isTesting ? 'Testing...' : 'Test Backend Connection'}
          </button>
        </div>
      </div>

      {/* Interval Selector & Status feedback */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">Polling Interval:</span>
          {[1000, 2000, 5000].map((ms) => (
            <button
              key={ms}
              onClick={() => setPollingIntervalMs(ms)}
              type="button"
              className={`px-2 py-0.5 rounded-lg font-mono font-medium ${
                pollingIntervalMs === ms
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {ms / 1000}s
            </button>
          ))}
        </div>

        {testResult.status !== 'idle' && (
          <div
            className={`flex items-center gap-1.5 font-medium ${
              testResult.status === 'success' ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {testResult.status === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>
    </Card>
  );
};

