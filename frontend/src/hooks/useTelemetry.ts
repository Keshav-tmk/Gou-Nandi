// ============================================================
// SmartLivestock AI — Live Telemetry Hook with Non-Overlapping Polling
// ============================================================

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { telemetryService } from '../services/telemetry';
import { generateDemoDashboardPayload, generateDemoTelemetryHistory } from '../services/demoTelemetry';
import { LiveDashboardResponse } from '../types/api';
import { TelemetryPoint } from '../types/telemetry';
import { parseTelemetryPoint } from '../utils/telemetry';

export function useTelemetry(cowIdOverride?: string) {
  const {
    selectedCowId,
    pollingIntervalMs,
    isPollingPaused,
    isDemoMode,
    setBackendStatus,
    setLastSuccessfulSync,
    setLastErrorMessage,
  } = useAppStore();

  const targetCowId = cowIdOverride || selectedCowId;

  const [dashboardData, setDashboardData] = useState<LiveDashboardResponse | null>(null);
  const [waveformPoints, setWaveformPoints] = useState<TelemetryPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isMounted = useRef<boolean>(true);
  const isFetchingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerIdRef = useRef<any>(null);

  // Fetch function with overlap guard and AbortController
  const fetchTelemetry = useCallback(
    async (isManualRefresh = false) => {
      if (isFetchingRef.current) return;
      if (!isMounted.current) return;

      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      // Handle DEMO MODE
      if (isDemoMode) {
        const demoData = generateDemoDashboardPayload(targetCowId);
        if (isMounted.current) {
          setDashboardData(demoData);
          setWaveformPoints(generateDemoTelemetryHistory(15));
          setIsLoading(false);
          setIsRefreshing(false);
          setFetchError(null);
          setLastSuccessfulSync(new Date().toISOString());
        }
        return;
      }

      isFetchingRef.current = true;
      abortControllerRef.current = new AbortController();

      try {
        const data = await telemetryService.getLiveDashboard(targetCowId, abortControllerRef.current.signal);

        if (!isMounted.current) return;

        setDashboardData(data);
        setFetchError(null);
        setLastErrorMessage(null);
        setBackendStatus('online');
        setLastSuccessfulSync(new Date().toISOString());

        // Update waveform points: keep at most 15 readings
        if (data.sensor && data.sensor.values) {
          const pt = parseTelemetryPoint(data.sensor);
          if (pt) {
            setWaveformPoints((prev) => {
              // Avoid duplicate timestamps
              if (prev.length > 0 && prev[prev.length - 1].timestamp === pt.timestamp) {
                return prev;
              }
              const next = [...prev, pt];
              return next.slice(-15);
            });
          }
        }
      } catch (err: any) {
        if (!isMounted.current) return;
        if (err.name !== 'AbortError') {
          setFetchError(err.message || 'Failed to fetch telemetry');
          setBackendStatus('offline');
          setLastErrorMessage(err.message);
        }
      } finally {
        isFetchingRef.current = false;
        if (isMounted.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [targetCowId, isDemoMode, setBackendStatus, setLastSuccessfulSync, setLastErrorMessage]
  );

  // Reset waveform when cow changes to prevent cross-cow leakage
  useEffect(() => {
    setWaveformPoints([]);
    setDashboardData(null);
    setIsLoading(true);
    setFetchError(null);
    fetchTelemetry();
  }, [targetCowId, fetchTelemetry]);

  // Main polling lifecycle
  useEffect(() => {
    isMounted.current = true;

    // Visibility change handler (pauses while tab is hidden)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTelemetry();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Polling scheduler
    const scheduleNextPoll = () => {
      if (timerIdRef.current) clearTimeout(timerIdRef.current);
      if (isPollingPaused) return;

      timerIdRef.current = setTimeout(async () => {
        if (document.visibilityState === 'visible') {
          await fetchTelemetry();
        }
        if (isMounted.current && !isPollingPaused) {
          scheduleNextPoll();
        }
      }, pollingIntervalMs);
    };

    scheduleNextPoll();

    return () => {
      isMounted.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerIdRef.current) clearTimeout(timerIdRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchTelemetry, pollingIntervalMs, isPollingPaused]);

  return {
    dashboardData,
    waveformPoints,
    isLoading,
    isRefreshing,
    fetchError,
    refreshNow: () => fetchTelemetry(true),
  };
}

