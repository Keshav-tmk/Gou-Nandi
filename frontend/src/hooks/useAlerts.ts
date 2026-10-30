// ============================================================
// SmartLivestock AI — Herd Alerts Hook
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { alertsService } from '../services/alerts';
import { LivestockAlert } from '../types/alerts';
import { useAppStore } from '../store/appStore';

export function useAlerts() {
  const { isDemoMode } = useAppStore();
  const [alerts, setAlerts] = useState<LivestockAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef<boolean>(true);

  const fetchAlerts = useCallback(async () => {
    if (isDemoMode) {
      if (isMounted.current) {
        setAlerts([]);
        setIsLoading(false);
        setError(null);
      }
      return;
    }

    try {
      const res = await alertsService.getHerdAlerts();
      if (!isMounted.current) return;
      setAlerts(res.active || []);
      setError(null);
    } catch (err: any) {
      if (!isMounted.current) return;
      setError(err.message || 'Failed to load alerts');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [isDemoMode]);

  const resolveAlert = useCallback(
    async (alertId: string) => {
      try {
        await alertsService.resolveAlert(alertId);
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      } catch (err) {
        console.error('Failed to resolve alert:', err);
      }
    },
    []
  );

  useEffect(() => {
    isMounted.current = true;
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchAlerts]);

  return {
    alerts,
    activeAlerts: alerts.filter((a) => !a.resolved),
    resolvedAlerts: alerts.filter((a) => a.resolved),
    isLoading,
    error,
    refreshAlerts: fetchAlerts,
    resolveAlert,
  };
}

