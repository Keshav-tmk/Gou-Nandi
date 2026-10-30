// ============================================================
// SmartLivestock AI — ConnectionStatus Component
// ============================================================

import React from 'react';
import { Chip, ChipVariant } from './Chip';
import { HardwareStatus } from '../../types/telemetry';

interface ConnectionStatusProps {
  apiStatus: 'online' | 'offline' | 'checking';
  hardwareStatus?: HardwareStatus;
  secondsSinceLastReading?: number | null;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  apiStatus,
  hardwareStatus,
  secondsSinceLastReading,
}) => {
  const getApiChip = () => {
    if (apiStatus === 'online') {
      return <Chip label="API ONLINE" variant="success" dot />;
    }
    if (apiStatus === 'checking') {
      return <Chip label="API CHECKING" variant="info" dot />;
    }
    return <Chip label="API OFFLINE" variant="danger" dot />;
  };

  const getHwChip = () => {
    if (!hardwareStatus) return null;
    let variant: ChipVariant = 'neutral';
    let label = 'WAITING FOR SENSOR';

    if (hardwareStatus === 'online') {
      variant = 'success';
      label = secondsSinceLastReading !== null && secondsSinceLastReading !== undefined
        ? `HARDWARE ONLINE (${secondsSinceLastReading.toFixed(1)}s)`
        : 'HARDWARE ONLINE';
    } else if (hardwareStatus === 'stale') {
      variant = 'warning';
      label = `STALE (${secondsSinceLastReading?.toFixed(1) ?? '--'}s)`;
    } else if (hardwareStatus === 'offline') {
      variant = 'danger';
      label = 'HARDWARE OFFLINE';
    }

    return <Chip label={label} variant={variant} dot />;
  };

  return (
    <div className="flex items-center gap-2">
      {getApiChip()}
      {getHwChip()}
    </div>
  );
};

