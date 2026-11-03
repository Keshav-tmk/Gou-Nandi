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
    default: 'border-l-4 border-l-transparent',
    success: 'border-l-4 border-l-[#2E7D32]',
    warning: 'border-l-4 border-l-[#F9A825]',
    danger: 'border-l-4 border-l-[#D84343]',
  }[variant];

  return (
    <Card className={`relative overflow-hidden bg-white dark:bg-farm-darkCard border border-[#E3E9E2] dark:border-farm-darkBorder ${borderHighlight} transition-all duration-200 hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#607067] dark:text-gray-400">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-[#263238] dark:text-white">
              {value}
            </span>
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-[#607067] dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2.5 rounded-xl bg-[#F7F9F4] dark:bg-farm-darkBorder text-[#2E7D32] dark:text-emerald-400 border border-[#E3E9E2] dark:border-farm-darkBorder">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

