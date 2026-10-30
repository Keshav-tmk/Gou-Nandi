// ============================================================
// SmartLivestock AI — 404 Not Found Page
// ============================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="text-center p-8 max-w-md">
        <div className="text-4xl mb-3">🐄</div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Page Not Found (404)
        </h2>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          The requested livestock dashboard page does not exist or has moved.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return to Dashboard
        </Link>
      </Card>
    </div>
  );
};

