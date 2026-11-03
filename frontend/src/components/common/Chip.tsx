// ============================================================
// SmartLivestock AI — Chip / Badge Component
// ============================================================

import React from 'react';

export type ChipVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'rest';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<ChipVariant, string> = {
  success: 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9] dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  warning: 'bg-[#FFF8E1] text-[#B7791F] border-[#FFE082] dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  danger: 'bg-[#FFEBEE] text-[#D84343] border-[#FFCDD2] dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
  info: 'bg-[#E3F2FD] text-[#1976D2] border-[#BBDEFB] dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  neutral: 'bg-[#F1F5F0] text-[#607067] border-[#E3E9E2] dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  rest: 'bg-[#F3E5F5] text-[#7B1FA2] border-[#E1BEE7] dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
};

const dotColors: Record<ChipVariant, string> = {
  success: 'bg-[#2E7D32]',
  warning: 'bg-[#F9A825]',
  danger: 'bg-[#D84343]',
  info: 'bg-[#1976D2]',
  neutral: 'bg-[#607067]',
  rest: 'bg-[#7B1FA2]',
};

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'neutral',
  dot = false,
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {label}
    </span>
  );
};

