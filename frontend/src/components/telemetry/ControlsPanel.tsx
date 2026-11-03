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
    <Card className="mb-6 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E3E9E2] dark:border-farm-darkBorder">
        <div>
          <h3 className="text-sm font-extrabold text-[#263238] dark:text-white">
            Sensor Connection & Controls
          </h3>
          <p className="text-xs text-[#607067] dark:text-gray-400 mt-0.5">
            Configured API: <span className="font-mono text-[#263238] dark:text-gray-300">{apiBaseUrl}</span>
            {isDemoMode && <span className="ml-2 text-[#B7791F] font-bold px-1.5 py-0.5 rounded bg-[#FFF8E1] border border-[#FFE082]">(Demo Active)</span>}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#F7F9F4] hover:bg-[#E8F5E9] border border-[#E3E9E2] text-[#607067] hover:text-[#2E7D32] transition-colors disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#2E7D32]' : ''}`} />
            Refresh Readings
          </button>

          <button
            onClick={togglePollingPaused}
            type="button"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors border shadow-xs ${
              isPollingPaused
                ? 'bg-[#FFF8E1] hover:bg-[#FFE082] text-[#B7791F] border-[#FFE082]'
                : 'bg-[#F7F9F4] hover:bg-[#E8F5E9] text-[#607067] hover:text-[#2E7D32] border-[#E3E9E2]'
            }`}
          >
            {isPollingPaused ? <Play className="w-3.5 h-3.5 text-[#F9A825]" /> : <Pause className="w-3.5 h-3.5" />}
            {isPollingPaused ? 'Resume Updates' : 'Pause Updates'}
          </button>

          <button
            onClick={testConnection}
            disabled={isTesting}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white shadow-xs border border-[#2E7D32] transition-colors disabled:opacity-50"
          >
            <Activity className="w-3.5 h-3.5" />
            {isTesting ? 'Testing...' : 'Test Backend Connection'}
          </button>
        </div>
      </div>

      {/* Interval Selector & Status feedback */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#607067] dark:text-gray-400 font-medium">Polling Cadence:</span>
          {[1000, 2000, 5000].map((ms) => (
            <button
              key={ms}
              onClick={() => setPollingIntervalMs(ms)}
              type="button"
              className={`px-2.5 py-1 rounded-lg font-mono font-semibold text-xs transition-all border ${
                pollingIntervalMs === ms
                  ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]'
                  : 'bg-[#F7F9F4] text-[#607067] border-[#E3E9E2] hover:bg-[#E8F5E9]'
              }`}
            >
              {ms / 1000}s
            </button>
          ))}
        </div>

        {testResult.status !== 'idle' && (
          <div
            className={`flex items-center gap-1.5 font-semibold ${
              testResult.status === 'success' ? 'text-[#2E7D32]' : 'text-[#D84343]'
            }`}
          >
            {testResult.status === 'success' ? (
              <CheckCircle className="w-4 h-4 text-[#2E7D32]" />
            ) : (
              <XCircle className="w-4 h-4 text-[#D84343]" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>
    </Card>
  );
};

