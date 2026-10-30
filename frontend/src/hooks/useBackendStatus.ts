// ============================================================
// SmartLivestock AI — Backend Health & Status Hook
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { apiClient } from '../services/apiClient';
import { HealthResponse } from '../types/api';

export function useBackendStatus() {
  const { apiBaseUrl, backendStatus, setBackendStatus, setLastErrorMessage } = useAppStore();
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const isMounted = useRef(true);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      const data = await apiClient.get<HealthResponse>('/health', { timeoutMs: 3500 });
      if (!isMounted.current) return;
      if (data && (data.status === 'healthy' || data.status === 'ok')) {
        setHealthData(data);
        setBackendStatus('online');
        setLastErrorMessage(null);
      } else {
        setBackendStatus('offline');
      }
    } catch (err: any) {
      if (!isMounted.current) return;
      setBackendStatus('offline');
      setLastErrorMessage(err.message || 'API Unreachable');
      setHealthData(null);
    } finally {
      if (isMounted.current) {
        setIsChecking(false);
      }
    }
  }, [setBackendStatus, setLastErrorMessage]);

  useEffect(() => {
    isMounted.current = true;
    checkHealth();

    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [checkHealth, apiBaseUrl]);

  return {
    status: backendStatus,
    isOnline: backendStatus === 'online',
    isChecking,
    healthData,
    checkHealth,
  };
}

