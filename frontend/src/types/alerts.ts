// ============================================================
// SmartLivestock AI — Alert System Type Definitions
// ============================================================

export type AlertSeverity = 'critical' | 'alert' | 'warning' | 'info';

export interface LivestockAlert {
  id: string;
  cow_id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  score?: number | null;
  source?: string;
  timestamp: string;
  resolved?: boolean;
}

export interface TechnicalWarning {
  type: string;
  message: string;
  timestamp: string;
}

