// ============================================================
// SmartLivestock AI — EmptyState Component
// ============================================================

import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-farm-darkCard/50 rounded-2xl border border-dashed border-farm-border dark:border-farm-darkBorder">
      {icon && (
        <div className="p-3 mb-3 text-gray-400 dark:text-gray-500 rounded-full bg-gray-100 dark:bg-gray-800">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

