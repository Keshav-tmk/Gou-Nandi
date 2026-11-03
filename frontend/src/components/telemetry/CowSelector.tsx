// ============================================================
// SmartLivestock AI — CowSelector Component
// ============================================================

import React from 'react';
import { useAppStore } from '../../store/appStore';
import { DEMO_COW_PROFILES } from '../../data/cows';
import { Card } from '../common/Card';
import { Chip } from '../common/Chip';
import { HardwareStatus } from '../../types/telemetry';

interface CowSelectorProps {
  hardwareStatus?: HardwareStatus;
  deviceId?: string;
}

export const CowSelector: React.FC<CowSelectorProps> = ({ hardwareStatus, deviceId }) => {
  const { selectedCowId, setSelectedCowId } = useAppStore();

  const currentCow = DEMO_COW_PROFILES.find((c) => c.id === selectedCowId) || DEMO_COW_PROFILES[0];

  return (
    <Card className="mb-6 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Cow Info */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#E8F5E9] dark:bg-emerald-950/60 flex items-center justify-center text-2xl border border-[#C8E6C9] dark:border-emerald-800 shrink-0 select-none">
            🐄
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-[#263238] dark:text-white">
                {currentCow.name} ({currentCow.id})
              </h3>
              <Chip label={currentCow.tag} variant="neutral" />
              {hardwareStatus === 'online' && <Chip label="Online" variant="success" dot />}
              {hardwareStatus === 'stale' && <Chip label="Stale" variant="warning" dot />}
              {hardwareStatus === 'offline' && <Chip label="Offline" variant="danger" dot />}
              {(!hardwareStatus || hardwareStatus === 'waiting_for_sensor_data') && (
                <Chip label="Waiting for Sensor" variant="neutral" dot />
              )}
            </div>
            <p className="text-xs text-[#607067] dark:text-gray-400 mt-1">
              Breed: <span className="font-semibold text-[#263238] dark:text-gray-300">{currentCow.breed}</span> • Device:{' '}
              <span className="font-mono text-[#263238] dark:text-gray-300">{deviceId || currentCow.deviceId}</span>
            </p>
          </div>
        </div>

        {/* Quick Switch Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-[#607067] mr-1">Switch Cow:</span>
          {DEMO_COW_PROFILES.map((cow) => {
            const isSelected = cow.id === selectedCowId;
            return (
              <button
                key={cow.id}
                onClick={() => setSelectedCowId(cow.id)}
                type="button"
                className={`px-3 py-1.5 text-xs rounded-xl font-semibold transition-all border ${
                  isSelected
                    ? 'bg-[#2E7D32] text-white shadow-xs border-[#2E7D32]'
                    : 'bg-[#F7F9F4] hover:bg-[#E8F5E9] text-[#607067] hover:text-[#2E7D32] border-[#E3E9E2] dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                }`}
              >
                {cow.name}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

