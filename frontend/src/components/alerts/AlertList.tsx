// ============================================================
// SmartLivestock AI — AlertList Component
// ============================================================

import React from 'react';
import { LivestockAlert } from '../../types/alerts';
import { AlertItem } from './AlertItem';
import { CheckCircle2 } from 'lucide-react';

interface AlertListProps {
  alerts: LivestockAlert[];
  onResolve?: (id: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const AlertList: React.FC<AlertListProps> = ({
  alerts,
  onResolve,
  emptyTitle = '0 Active Animal Alerts',
  emptyDescription = 'No confirmed anomalies, estrus surges, fever conditions, or gait irregularities detected across monitored livestock.',
}) => {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <span className="text-xs font-bold block">{emptyTitle}</span>
          <span className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 block">
            {emptyDescription}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} onResolve={onResolve} />
      ))}
    </div>
  );
};

