// ============================================================
// GouNandi — AlertItem Component
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

  const getBorderColor = () => {
    if (alert.resolved) return 'border-l-4 border-l-[#2E7D32] border-[#E3E9E2]';
    if (alert.severity === 'critical' || alert.severity === 'alert') {
      return 'border-l-4 border-l-[#D84343] border-[#E3E9E2]';
    }
    if (alert.severity === 'warning') {
      return 'border-l-4 border-l-[#F9A825] border-[#E3E9E2]';
    }
    return 'border-l-4 border-l-[#1976D2] border-[#E3E9E2]';
  };

  const getIcon = () => {
    if (alert.resolved) {
      return <CheckCircle className="w-5 h-5 text-[#2E7D32]" />;
    }
    if (alert.severity === 'critical' || alert.severity === 'alert') {
      return <ShieldAlert className="w-5 h-5 text-[#D84343]" />;
    }
    if (alert.severity === 'warning') {
      return <AlertTriangle className="w-5 h-5 text-[#F9A825]" />;
    }
    return <Info className="w-5 h-5 text-[#1976D2]" />;
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl ${getBorderColor()} dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard/60 hover:bg-[#F7F9F4] dark:hover:bg-gray-800/40 transition-colors shadow-xs`}>
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/80 shrink-0 border border-[#E3E9E2] dark:border-gray-800">
          {getIcon()}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-extrabold text-[#263238] dark:text-white">
              {alert.title}
            </h4>
            <Chip label={alert.cow_id} variant="neutral" />
            {getSeverityBadge(alert.severity)}
          </div>
          <p className="mt-1 text-xs text-[#607067] dark:text-gray-300">
            {alert.message}
          </p>
          <span className="mt-1 block text-xs text-[#607067]/80 dark:text-gray-400">
            {formatDateTime(alert.timestamp)} • Source: {alert.source || 'AI Inference Engine'}
          </span>
        </div>
      </div>

      {onResolve && !alert.resolved && (
        <div className="shrink-0 self-end sm:self-center">
          <button
            onClick={() => onResolve(alert.id)}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#E8F5E9] hover:bg-[#C8E6C9] text-[#2E7D32] border border-[#C8E6C9] transition-all shadow-2xs cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Acknowledge
          </button>
        </div>
      )}
    </div>
  );
};


