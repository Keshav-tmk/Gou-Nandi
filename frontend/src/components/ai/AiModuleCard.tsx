// ============================================================
// SmartLivestock AI — AI Module Card Component
// ============================================================

import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Chip, ChipVariant } from '../common/Chip';
import { AiModuleResult, ModuleStatus } from '../../types/ai';
import { ChevronDown, ChevronUp, AlertCircle, Info } from 'lucide-react';

interface AiModuleCardProps {
  title: string;
  moduleIndex: number;
  result: AiModuleResult;
  icon: React.ReactNode;
  primaryValue?: string | null;
  detailRows?: Array<{ label: string; value: string | number | null | undefined }>;
  note?: string | null;
  modelVersion?: string | null;
}

export const AiModuleCard: React.FC<AiModuleCardProps> = ({
  title,
  moduleIndex,
  result,
  icon,
  primaryValue,
  detailRows = [],
  note,
  modelVersion,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusBadge = (status: ModuleStatus) => {
    let variant: ChipVariant = 'neutral';
    let label = 'Unavailable';

    switch (status) {
      case 'available':
        variant = 'success';
        label = 'Active';
        break;
      case 'warming_up':
        variant = 'warning';
        label = 'Warming Up';
        break;
      case 'insufficient_data':
        variant = 'warning';
        label = 'Collecting Readings';
        break;
      case 'error':
        variant = 'danger';
        label = 'Error';
        break;
      default:
        variant = 'neutral';
        label = 'Unavailable';
    }

    return <Chip label={label} variant={variant} dot />;
  };

  const isAvailable = result.status === 'available';

  return (
    <Card className="flex flex-col justify-between h-full border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#E3E9E2] dark:border-farm-darkBorder">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <span className="text-xs font-extrabold text-[#263238] dark:text-white uppercase tracking-wider">
              {moduleIndex}. {title}
            </span>
          </div>
          {getStatusBadge(result.status)}
        </div>

        {/* Primary Display */}
        <div className="py-4">
          {isAvailable ? (
            <div>
              <div className="text-xl font-extrabold text-[#263238] dark:text-white capitalize tracking-tight">
                {primaryValue || result.label || '--'}
              </div>
              {result.confidence !== null && result.confidence !== undefined && (
                <div className="mt-1 text-xs text-[#607067] dark:text-gray-400">
                  Confidence: <span className="font-bold text-[#2E7D32] dark:text-emerald-400">{(result.confidence * 100).toFixed(1)}%</span>
                </div>
              )}
              {note && (
                <p className="mt-2 text-xs text-[#607067] dark:text-gray-400 leading-relaxed">
                  {note}
                </p>
              )}
            </div>
          ) : (
            <div className="py-2 text-left">
              <div className="flex items-start gap-2 text-[#B7791F] dark:text-amber-400 text-xs bg-[#FFF8E1] dark:bg-amber-950/40 p-2.5 rounded-xl border border-[#FFE082] dark:border-amber-800">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#F9A825]" />
                <span className="leading-snug">
                  {result.reason || (result.status === 'insufficient_data'
                    ? 'Awaiting additional rolling window telemetry to satisfy model minimum window size.'
                    : 'Module currently unavailable or unconfigured.')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Detail Rows */}
        {isAvailable && detailRows.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-[#E3E9E2] dark:border-farm-darkBorder/60 text-xs">
            {detailRows.map((row, idx) => (
              <div key={idx} className="flex justify-between text-[#607067] dark:text-gray-400">
                <span>{row.label}:</span>
                <span className="font-semibold text-[#263238] dark:text-gray-200">
                  {row.value ?? '--'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer & Expandable diagnostics */}
      <div className="pt-3 mt-3 border-t border-[#E3E9E2] dark:border-farm-darkBorder flex items-center justify-between text-xs text-[#607067]/80">
        <span className="truncate text-[11px]">
          Model: {modelVersion || 'Hardware Scikit-Learn'}
        </span>
        {result.reason && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-0.5 text-[#2E7D32] hover:text-[#1B5E20] font-semibold text-[11px]"
          >
            Diagnostics {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {showDetails && result.reason && (
        <div className="mt-2 p-2 bg-[#F7F9F4] dark:bg-gray-800 rounded-lg text-xs text-[#263238] dark:text-gray-400 font-mono break-words border border-[#E3E9E2]">
          {result.reason}
        </div>
      )}
    </Card>
  );
};

