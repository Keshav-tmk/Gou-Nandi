// ============================================================
// SmartLivestock AI — Five-Module AI Inference Type Definitions
// ============================================================

export type ModuleStatus =
  | "available"
  | "warming_up"
  | "insufficient_data"
  | "unavailable"
  | "error";

export interface AiModuleResult {
  status: ModuleStatus;
  label: string | null;
  score: number | null;
  confidence: number | null;
  updatedAt: string | null;
  reason: string | null;
}

export interface BehaviourResult extends AiModuleResult {
  probabilities: Record<string, number> | null;
  modelVersion: string | null;
}

export interface AnomalyResult extends AiModuleResult {
  detected: boolean | null;
  interpretation: string | null;
  modelVersion: string | null;
}

export interface RuminationResult extends AiModuleResult {
  isRuminating: boolean | null;
  probability: number | null;
  chewingRhythmScore: number | null;
  interpretation: string | null;
  modelVersion: string | null;
}

export interface EstrusResult extends AiModuleResult {
  detected: boolean | null;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
  mountDetected: boolean | null;
  activitySurge: number | null;
  interpretation: string | null;
  modelVersion: string | null;
}

export interface LamenessResult extends AiModuleResult {
  detected: boolean | null;
  riskLevel: "LOW" | "MONITOR" | "HIGH" | "UNKNOWN";
  locomotionScore: number | null;
  gaitAsymmetryIndex: number | null;
  contactTemperatureC: number | null;
  temperatureStatus: string | null;
  interpretation: string | null;
  modelVersion: string | null;
}

export interface AllAiModulesState {
  behaviour: BehaviourResult;
  anomaly: AnomalyResult;
  rumination: RuminationResult;
  estrus: EstrusResult;
  lameness: LamenessResult;
}

