// ============================================================
// SmartLivestock AI — InferenceWindow Progress & Readiness Component
// ============================================================

import React from 'react';
import { Card } from '../common/Card';
import { WindowBufferState } from '../../types/telemetry';
import { Chip } from '../common/Chip';
import { Cpu } from 'lucide-react';

interface InferenceWindowProps {
  windowState?: WindowBufferState;
  behaviourLabel?: string | null;
  confidence?: number | null;
  lastInferenceTime?: string | null;
}

export const InferenceWindow: React.FC<InferenceWindowProps> = ({
  windowState,
  behaviourLabel,
  confidence,
  lastInferenceTime,
}) => {
  const count = windowState?.sample_count ?? 0;
  const required = windowState?.required_samples ?? 20;
  const isReady = windowState?.ready ?? false;
  const percent = windowState?.progress_percent ?? Math.min(100, Math.round((count / required) * 100));

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-farm-border dark:border-farm-darkBorder">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Rolling AI Inference Window
          </h3>
        </div>
        <Chip
          label={isReady ? 'WINDOW READY' : `COLLECTING (${count}/${required})`}
          variant={isReady ? 'success' : 'warning'}
          dot
        />
      </div>

      <div className="mt-4 space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Buffer Progress</span>
            <span className="font-mono font-medium">
              {count} / {required} samples ({percent}%)
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                isReady ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Current Inference Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-farm-darkBorder/40">
            <span className="text-gray-500 dark:text-gray-400 block mb-1">Current Active Behaviour</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white capitalize">
              {behaviourLabel || '--'}
            </span>
            {confidence !== null && confidence !== undefined && (
              <span className="text-gray-400 block mt-0.5 font-mono">
                Confidence: {(confidence * 100).toFixed(1)}%
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-farm-darkBorder/40">
            <span className="text-gray-500 dark:text-gray-400 block mb-1">Last Inference Cycle</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">
              {lastInferenceTime ? new Date(lastInferenceTime).toLocaleTimeString() : '--:--:--'}
            </span>
            <span className="text-gray-400 block mt-0.5">
              Target window: {required} samples @ 10 Hz
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

