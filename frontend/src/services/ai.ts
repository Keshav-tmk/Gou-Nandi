// ============================================================
// SmartLivestock AI — AI Inference Service & Adapters
// ============================================================

import { apiClient } from './apiClient';
import {
  AllAiModulesState,
  BehaviourResult,
  AnomalyResult,
  RuminationResult,
  EstrusResult,
  LamenessResult,
  ModuleStatus,
} from '../types/ai';

export function normalizeModuleStatus(rawStatus?: string | null): ModuleStatus {
  if (!rawStatus) return 'unavailable';
  const s = String(rawStatus).toLowerCase();
  if (s === 'available' || s === 'ready' || s === 'success') return 'available';
  if (s === 'warming_up') return 'warming_up';
  if (s === 'insufficient_data' || s === 'collecting' || s === 'waiting') return 'insufficient_data';
  if (s === 'error' || s === 'failed') return 'error';
  return 'unavailable';
}

export function adaptAiModulesResponse(aiPayload?: any, timestamp?: string | null): AllAiModulesState {
  const p = aiPayload || {};

  // 1. Behaviour
  const rawBeh = p.behaviour || {};
  const behStatus = normalizeModuleStatus(rawBeh.status);
  const behaviour: BehaviourResult = {
    status: behStatus,
    label: behStatus === 'available' ? rawBeh.label || null : null,
    score: null,
    confidence: behStatus === 'available' && rawBeh.probabilities && rawBeh.label ? rawBeh.probabilities[rawBeh.label] || null : null,
    probabilities: behStatus === 'available' ? rawBeh.probabilities || null : null,
    modelVersion: rawBeh.model_version || 'Hardware RF',
    updatedAt: timestamp || null,
    reason: rawBeh.reason || (behStatus !== 'available' ? 'Insufficient sensor window for behavioural classification' : null),
  };

  // 2. Anomaly
  const rawAnom = p.anomaly || {};
  const anomStatus = normalizeModuleStatus(rawAnom.status);
  const anomaly: AnomalyResult = {
    status: anomStatus,
    label: anomStatus === 'available' ? (rawAnom.detected ? 'Anomaly Detected' : 'Normal Activity') : null,
    score: anomStatus === 'available' && typeof rawAnom.score === 'number' ? rawAnom.score : null,
    confidence: null,
    detected: anomStatus === 'available' ? Boolean(rawAnom.detected) : null,
    interpretation: anomStatus === 'available' ? rawAnom.interpretation || null : null,
    modelVersion: rawAnom.model_version || 'Isolation Forest',
    updatedAt: timestamp || null,
    reason: rawAnom.reason || (anomStatus !== 'available' ? 'Awaiting sensor baseline for anomaly detection' : null),
  };

  // 3. Rumination
  const rawRum = p.rumination || {};
  const rumStatus = normalizeModuleStatus(rawRum.status);
  const rumination: RuminationResult = {
    status: rumStatus,
    label: rumStatus === 'available' ? (rawRum.is_ruminating ? 'Active Rumination' : 'Not Ruminating') : null,
    score: rumStatus === 'available' && typeof rawRum.probability === 'number' ? rawRum.probability : null,
    confidence: rumStatus === 'available' && typeof rawRum.confidence === 'number' ? rawRum.confidence : null,
    isRuminating: rumStatus === 'available' ? Boolean(rawRum.is_ruminating) : null,
    probability: rumStatus === 'available' && typeof rawRum.probability === 'number' ? rawRum.probability : null,
    chewingRhythmScore: rumStatus === 'available' && typeof rawRum.chewing_rhythm_score === 'number' ? rawRum.chewing_rhythm_score : null,
    interpretation: rumStatus === 'available' ? rawRum.interpretation || null : null,
    modelVersion: rawRum.model_version || 'Rumination RF',
    updatedAt: timestamp || null,
    reason: rawRum.reason || (rumStatus !== 'available' ? 'Insufficient motion telemetry for rumination pattern' : null),
  };

  // 4. Estrus
  const rawEstrus = p.estrus || {};
  const estrusStatus = normalizeModuleStatus(rawEstrus.status);
  const estrus: EstrusResult = {
    status: estrusStatus,
    label: estrusStatus === 'available' ? `${rawEstrus.risk_level || 'LOW'} RISK` : null,
    score: estrusStatus === 'available' && typeof rawEstrus.score === 'number' ? rawEstrus.score : null,
    confidence: null,
    detected: estrusStatus === 'available' ? Boolean(rawEstrus.detected) : null,
    riskLevel: estrusStatus === 'available' ? (rawEstrus.risk_level || 'LOW') : 'UNKNOWN',
    mountDetected: estrusStatus === 'available' ? Boolean(rawEstrus.mount_detected) : null,
    activitySurge: estrusStatus === 'available' && typeof rawEstrus.activity_surge === 'number' ? rawEstrus.activity_surge : null,
    interpretation: estrusStatus === 'available' ? rawEstrus.interpretation || null : null,
    modelVersion: rawEstrus.model_version || 'Estrus Monitor',
    updatedAt: timestamp || null,
    reason: rawEstrus.reason || (estrusStatus !== 'available' ? 'Awaiting movement pattern for estrus screening' : null),
  };

  // 5. Lameness
  const rawLame = p.lameness || {};
  const lameStatus = normalizeModuleStatus(rawLame.status);
  const lameness: LamenessResult = {
    status: lameStatus,
    label: lameStatus === 'available' ? `Score ${rawLame.locomotion_score ?? '--'} / 5.0` : null,
    score: lameStatus === 'available' && typeof rawLame.locomotion_score === 'number' ? rawLame.locomotion_score : null,
    confidence: null,
    detected: lameStatus === 'available' ? Boolean(rawLame.detected) : null,
    riskLevel: lameStatus === 'available' ? (rawLame.risk_level || 'LOW') : 'UNKNOWN',
    locomotionScore: lameStatus === 'available' && typeof rawLame.locomotion_score === 'number' ? rawLame.locomotion_score : null,
    gaitAsymmetryIndex: lameStatus === 'available' && typeof rawLame.gait_asymmetry_index === 'number' ? rawLame.gait_asymmetry_index : null,
    contactTemperatureC: lameStatus === 'available' && typeof rawLame.contact_temperature_c === 'number' ? rawLame.contact_temperature_c : null,
    temperatureStatus: lameStatus === 'available' ? rawLame.temperature_status || null : null,
    interpretation: lameStatus === 'available' ? rawLame.interpretation || null : null,
    modelVersion: rawLame.model_version || 'Locomotion Screener',
    updatedAt: timestamp || null,
    reason: rawLame.reason || (lameStatus !== 'available' ? 'Awaiting locomotion telemetry' : null),
  };

  return {
    behaviour,
    anomaly,
    rumination,
    estrus,
    lameness,
  };
}

export const aiService = {
  async getAiStatus(signal?: AbortSignal) {
    return apiClient.get('/ai/status', { signal, timeoutMs: 5000 });
  },

  async getAiLatest(cowId: string, signal?: AbortSignal) {
    return apiClient.get('/ai/latest', { params: { cow_id: cowId }, signal, timeoutMs: 5000 });
  },

  async getAiHistory(cowId: string, limit: number = 20, signal?: AbortSignal) {
    return apiClient.get('/ai/history', { params: { cow_id: cowId, limit }, signal, timeoutMs: 5000 });
  },

  async getBehaviour(cowId: string, signal?: AbortSignal) {
    return apiClient.get('/ai/behaviour', { params: { cow_id: cowId }, signal, timeoutMs: 5000 });
  },

  async getAnomalies(cowId: string, signal?: AbortSignal) {
    return apiClient.get('/ai/anomalies', { params: { cow_id: cowId }, signal, timeoutMs: 5000 });
  },
};

