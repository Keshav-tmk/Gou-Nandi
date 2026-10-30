// ============================================================
// SmartLivestock AI — Live Collar Telemetry Page (/behaviour)
// ============================================================

import React from 'react';
import { useAppStore } from '../store/appStore';
import { useTelemetry } from '../hooks/useTelemetry';
import { useAiResults } from '../hooks/useAiResults';
import { CowSelector } from '../components/telemetry/CowSelector';
import { MetricCard } from '../components/telemetry/MetricCard';
import { WaveformChart } from '../components/telemetry/WaveformChart';
import { InferenceWindow } from '../components/telemetry/InferenceWindow';
import { ControlsPanel } from '../components/telemetry/ControlsPanel';
import { SpecList } from '../components/telemetry/SpecList';
import { AiModuleGrid } from '../components/ai/AiModuleGrid';
import { SectionHeader } from '../components/common/SectionHeader';
import { formatRelativeSeconds, formatTimeOnly } from '../utils/formatTime';
import { formatSensorValue } from '../utils/telemetry';
import { Compass, Gauge, Thermometer, Clock, Radio } from 'lucide-react';

export const BehaviourPage: React.FC = () => {
  const { selectedCowId } = useAppStore();
  const { dashboardData, waveformPoints, isRefreshing, refreshNow } = useTelemetry(selectedCowId);
  const aiModules = useAiResults(dashboardData?.ai, dashboardData?.sensor?.timestamp);

  const hw = dashboardData?.hardware;
  const sensor = dashboardData?.sensor?.values;
  const isStale = dashboardData?.hardware?.is_stale || false;

  const rawTemp = sensor?.temperature_c;
  const tempDisplay = rawTemp !== null && rawTemp !== undefined ? `${rawTemp.toFixed(1)}` : 'Unavailable';
  const tempUnit = rawTemp !== null && rawTemp !== undefined ? '°C' : undefined;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Live Collar Hardware Telemetry
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          Genuine ESP32 MPU-6050 sensor readings, live waveform charts, and real-time AI behaviour inference.
        </p>
      </div>

      {/* Cow Selector Card */}
      <CowSelector
        hardwareStatus={hw?.status}
        deviceId={hw?.device_id}
      />

      {/* Sensor Metric Cards Grid */}
      <div>
        <SectionHeader
          title="Inertial & Environmental Channels"
          subtitle={`Current sensor packet from ${hw?.device_id || '--'} • Freshness: ${formatRelativeSeconds(hw?.seconds_since_last_reading)}`}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <MetricCard
            label="Accel X"
            value={formatSensorValue(sensor?.accel_x, '', 4)}
            unit="g"
            subValue="Lateral motion"
            icon={<Gauge className="w-4 h-4" />}
            isStale={isStale}
          />
          <MetricCard
            label="Accel Y"
            value={formatSensorValue(sensor?.accel_y, '', 4)}
            unit="g"
            subValue="Dorso-ventral"
            icon={<Gauge className="w-4 h-4" />}
            isStale={isStale}
          />
          <MetricCard
            label="Accel Z"
            value={formatSensorValue(sensor?.accel_z, '', 4)}
            unit="g"
            subValue="Cranio-caudal"
            icon={<Gauge className="w-4 h-4" />}
            isStale={isStale}
          />
          <MetricCard
            label="Gyro X"
            value={formatSensorValue(sensor?.gyro_x, '', 2)}
            unit="°/s"
            subValue="Pitch rate"
            icon={<Compass className="w-4 h-4" />}
            isStale={isStale}
          />
          <MetricCard
            label="Gyro Y"
            value={formatSensorValue(sensor?.gyro_y, '', 2)}
            unit="°/s"
            subValue="Roll rate"
            icon={<Compass className="w-4 h-4" />}
            isStale={isStale}
          />
          <MetricCard
            label="Gyro Z"
            value={formatSensorValue(sensor?.gyro_z, '', 2)}
            unit="°/s"
            subValue="Yaw rate"
            icon={<Compass className="w-4 h-4" />}
            isStale={isStale}
          />
          <MetricCard
            label="Skin Temp"
            value={tempDisplay}
            unit={tempUnit}
            subValue={rawTemp !== null && rawTemp !== undefined ? 'Contact DS18B20' : 'Sensor not attached'}
            icon={<Thermometer className="w-4 h-4" />}
            isStale={isStale}
          />
        </div>
      </div>

      {/* Live Waveform Chart */}
      <WaveformChart data={waveformPoints} cowId={selectedCowId} />

      {/* Inference Window & Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InferenceWindow
          windowState={dashboardData?.window}
          behaviourLabel={aiModules.behaviour.label}
          confidence={aiModules.behaviour.confidence}
          lastInferenceTime={dashboardData?.sensor?.timestamp}
        />
        <ControlsPanel onRefresh={refreshNow} isRefreshing={isRefreshing} />
      </div>

      {/* 5 AI Modules for Selected Cow */}
      <div>
        <SectionHeader
          title="Five-Module Real-Time AI Inference"
          subtitle={`Multi-task models running against ${dashboardData?.window?.sample_count ?? 0} buffered telemetry readings`}
        />
        <AiModuleGrid modules={aiModules} cowId={selectedCowId} />
      </div>

      {/* Hardware Architecture Spec */}
      <SpecList hasTemperatureSensor={rawTemp !== null && rawTemp !== undefined} />
    </div>
  );
};

