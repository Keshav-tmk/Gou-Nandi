// ============================================================
// SmartLivestock AI — LoadingSkeleton Component
// ============================================================

import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
  rows?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ className = 'h-6 w-full', rows = 1 }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-gray-200 dark:bg-gray-800 rounded-lg ${className}`}
        />
      ))}
    </div>
  );
};

