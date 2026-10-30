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
    <Card className={`p-4 ${isStale ? 'opacity-75' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </span>
        {icon && (
          <span className="text-gray-400 dark:text-gray-500 text-sm">
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white font-mono">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {unit}
          </span>
        )}
      </div>

      {subValue && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate">
          {subValue}
        </p>
      )}
    </Card>
  );
};

