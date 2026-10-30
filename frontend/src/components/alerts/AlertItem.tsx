// ============================================================
// SmartLivestock AI — AlertItem Component
// ============================================================

import React from 'react';
import { LivestockAlert } from '../../types/alerts';
import { Chip, ChipVariant } from '../common/Chip';
import { formatDateTime } from '../../utils/formatTime';
import { AlertTriangle, CheckCircle, ShieldAlert, Info } from 'lucide-react';

interface AlertItemProps {
  alert: LivestockAlert;
  onResolve?: (id: string) => void;
}

export const AlertItem: React.FC<AlertItemProps> = ({ alert, onResolve }) => {
  const getSeverityBadge = (severity: string) => {
    let variant: ChipVariant = 'warning';
    if (severity === 'critical' || severity === 'alert') variant = 'danger';
    if (severity === 'info') variant = 'info';
    return <Chip label={severity.toUpperCase()} variant={variant} dot />;
  };

  const getIcon = () => {
    if (alert.severity === 'critical' || alert.severity === 'alert') {
      return <ShieldAlert className="w-5 h-5 text-rose-600" />;
    }
    if (alert.severity === 'warning') {
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    }
    return <Info className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-farm-border dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-800/80 shrink-0">
          {getIcon()}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              {alert.title}
            </h4>
            <Chip label={alert.cow_id} variant="neutral" />
            {getSeverityBadge(alert.severity)}
          </div>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            {alert.message}
          </p>
          <span className="mt-1 block text-xs text-gray-400">
            {formatDateTime(alert.timestamp)} • Source: {alert.source || 'AI Inference Engine'}
          </span>
        </div>
      </div>

      {onResolve && !alert.resolved && (
        <div className="shrink-0 self-end sm:self-center">
          <button
            onClick={() => onResolve(alert.id)}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Acknowledge
          </button>
        </div>
      )}
    </div>
  );
};

