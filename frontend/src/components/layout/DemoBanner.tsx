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
    <div className="bg-[#FFF8E1] text-[#B7791F] border-b border-[#FFE082] px-4 py-2 text-xs font-semibold flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-[#F9A825]" />
        <span>
          DEMO MODE ACTIVE: Sensor telemetry and AI outputs are simulated for demonstration. No live hardware connection.
        </span>
      </div>
      <button
        onClick={() => setDemoMode(false)}
        className="px-2.5 py-1 rounded-lg bg-[#F9A825] text-white hover:bg-[#B7791F] font-bold text-[11px] transition-colors ml-4 shadow-2xs"
      >
        Exit Demo
      </button>
    </div>
  );
};

