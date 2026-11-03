// ============================================================
// SmartLivestock AI — MetricCard Component
// ============================================================

import React from 'react';
import { Card } from '../common/Card';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subValue?: string;
  icon?: React.ReactNode;
  isStale?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subValue,
  icon,
  isStale = false,
}) => {
  return (
    <Card className={`p-3.5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs ${isStale ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#607067] dark:text-gray-400">
          {label}
        </span>
        {icon && (
          <span className="text-[#2E7D32] dark:text-emerald-400 text-sm">
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#263238] dark:text-white font-mono">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-semibold text-[#607067] dark:text-gray-400">
            {unit}
          </span>
        )}
      </div>

      {subValue && (
        <p className="mt-1 text-[11px] text-[#607067] dark:text-gray-400 truncate">
          {subValue}
        </p>
      )}
    </Card>
  );
};

