// ============================================================
// SmartLivestock AI — StatCard Component
// ============================================================

import React from 'react';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
}) => {
  const borderHighlight = {
    default: '',
    success: 'border-l-4 border-l-emerald-600',
    warning: 'border-l-4 border-l-amber-500',
    danger: 'border-l-4 border-l-rose-500',
  }[variant];

  return (
    <Card className={`relative overflow-hidden ${borderHighlight}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {value}
            </span>
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-farm-darkBorder text-gray-600 dark:text-gray-300">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

