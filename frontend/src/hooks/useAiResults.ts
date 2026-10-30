// ============================================================
// SmartLivestock AI — AI Results Hook
// ============================================================

import { useMemo } from 'react';
import { adaptAiModulesResponse } from '../services/ai';
import { AllAiModulesState } from '../types/ai';

export function useAiResults(rawAiPayload: any, timestamp?: string | null): AllAiModulesState {
  return useMemo(() => {
    return adaptAiModulesResponse(rawAiPayload, timestamp);
  }, [rawAiPayload, timestamp]);
}

