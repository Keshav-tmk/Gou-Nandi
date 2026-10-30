// ============================================================
// SmartLivestock AI — Demo Mode Banner
// ============================================================

import React from 'react';
import { useAppStore } from '../../store/appStore';
import { AlertCircle } from 'lucide-react';

export const DemoBanner: React.FC = () => {
  const { isDemoMode, setDemoMode } = useAppStore();

  if (!isDemoMode) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-semibold flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>
          DEMO MODE ACTIVE: Sensor telemetry and AI outputs are simulated for demonstration. No live hardware connection.
        </span>
      </div>
      <button
        onClick={() => setDemoMode(false)}
        className="underline hover:text-white transition-colors ml-4"
      >
        Exit Demo
      </button>
    </div>
  );
};

