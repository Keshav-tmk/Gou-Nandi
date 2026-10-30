// ============================================================
// SmartLivestock AI — Card Component
// ============================================================

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white dark:bg-farm-darkCard rounded-2xl border border-farm-border dark:border-farm-darkBorder shadow-card p-5 transition-colors ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

