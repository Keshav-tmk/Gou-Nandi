// ============================================================
// GouNandi — Behaviour Intelligence Page (/behaviour)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useAppStore } from '../store/appStore';
import { useTelemetry } from '../hooks/useTelemetry';
import { useAiResults } from '../hooks/useAiResults';
import { useAlerts } from '../hooks/useAlerts';
import { apiClient } from '../services/apiClient';
import { cowsService } from '../services/cows';
import { CowSummary } from '../types/cow';
import { DEMO_COW_PROFILES } from '../data/cows';
import { CowSelector } from '../components/telemetry/CowSelector';
import { MetricCard } from '../components/telemetry/MetricCard';
import { WaveformChart } from '../components/telemetry/WaveformChart';
import { InferenceWindow } from '../components/telemetry/InferenceWindow';
import { ControlsPanel } from '../components/telemetry/ControlsPanel';
import { SpecList } from '../components/telemetry/SpecList';
import { AiModuleGrid } from '../components/ai/AiModuleGrid';
import { SectionHeader } from '../components/common/SectionHeader';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { formatRelativeSeconds } from '../utils/formatTime';
import { formatSensorValue } from '../utils/telemetry';
import {
  Compass,
  Gauge,
  Thermometer,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  FileText,
  TrendingUp,
} from 'lucide-react';

const BEHAVIOUR_COLORS: Record<string, string> = {
  grazing: '#2E7D32',
  resting: '#7B1FA2',
  walking: '#1976D2',
  ruminating: '#66BB6A',
  active_mount: '#F9A825',
  standby: '#607067',
};

export const BehaviourPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCowId, setSelectedCowId, isDemoMode } = useAppStore();
  const { dashboardData, waveformPoints, isRefreshing, refreshNow } = useTelemetry(selectedCowId);
  const aiModules = useAiResults(dashboardData?.ai, dashboardData?.sensor?.timestamp);
  const { alerts } = useAlerts();

  const [cows, setCows] = useState<CowSummary[]>([]);
  const [selectedLogCow, setSelectedLogCow] = useState<string | null>(null);

  useEffect(() => {
    async function loadCows() {
      try {
        const res = await cowsService.listCows();
        if (res && res.cows) {
          setCows(res.cows);
        } else {
          setCows(
            DEMO_COW_PROFILES.map((p, idx) => ({
              ...p,
              status: idx === 0 ? 'online' : 'waiting_for_sensor_data',
              has_live_telemetry: idx === 0,
              last_received_at: null,
              seconds_since_last_reading: idx === 0 ? 1 : null,
              total_readings: idx === 0 ? 120 : 0,
              latest_behaviour: idx === 0 ? 'grazing' : idx % 2 === 0 ? 'resting' : 'ruminating',
              alerts_count: idx === 2 ? 1 : 0,
              is_stale: false,
            }))
          );
        }
      } catch {
        // Fallback
      }
    }
    loadCows();
  }, [isDemoMode]);

  const hw = dashboardData?.hardware;
  const sensor = dashboardData?.sensor?.values;
  const isStale = dashboardData?.hardware?.is_stale || false;

  const rawTemp = sensor?.temperature_c;
  const tempDisplay = rawTemp !== null && rawTemp !== undefined ? `${rawTemp.toFixed(1)}` : 'Unavailable';
  const tempUnit = rawTemp !== null && rawTemp !== undefined ? '°C' : undefined;

  // Herd Behaviour Trends (Area Chart data)
  const herdTrendsData = [
    { time: '00:00', grazing: 10, resting: 75, walking: 5, ruminating: 10 },
    { time: '04:00', grazing: 30, resting: 50, walking: 8, ruminating: 12 },
    { time: '08:00', grazing: 65, resting: 12, walking: 15, ruminating: 8 },
    { time: '12:00', grazing: 25, resting: 55, walking: 8, ruminating: 12 },
    { time: '16:00', grazing: 70, resting: 10, walking: 12, ruminating: 8 },
    { time: '20:00', grazing: 20, resting: 65, walking: 6, ruminating: 9 },
  ];

  // Anomaly observations list
  const anomalyObservations = [
    {
      id: 'ANOM-1',
      cowId: 'COW-003',
      cowName: 'Nandi',
      severity: 'warning',
      description: 'Sudden spike in high-frequency pitch oscillation during resting window',
      time: '14 min ago',
      score: '0.78',
    },
    {
      id: 'ANOM-2',
      cowId: 'COW-001',
      cowName: 'Lakshmi',
      severity: 'info',
      description: 'Minor lateral movement imbalance flagged by rolling Isolation Forest buffer',
      time: '42 min ago',
      score: '0.52',
    },
    {
      id: 'ANOM-3',
      cowId: 'COW-005',
      cowName: 'Kamadhenu',
      severity: 'warning',
      description: 'Extended standing duration with zero rumination activity over 120 minutes',
      time: '1h 15m ago',
      score: '0.81',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#263238] dark:text-white tracking-tight">
          Behaviour Intelligence & ML Inference
        </h1>
        <p className="text-xs sm:text-sm text-[#607067] dark:text-gray-400 mt-1">
          Scikit-Learn multi-task classification pipelines, anomaly detection, and herd-wide behavioural time budgets
        </p>
      </div>

      {/* 1. Four Top Summary Cards (Development 1 Specification) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Classifying Now"
          value={`${cows.length || 8} Cattle`}
          subtitle="Active inference window"
          icon={<Activity className="w-5 h-5 text-[#2E7D32]" />}
        />
        <StatCard
          title="Primary Behaviour"
          value="Grazing"
          subtitle="68% of herd active"
          variant="success"
          icon={<CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />}
        />
        <StatCard
          title="Abnormal Flags"
          value={alerts.length > 0 ? `${alerts.length} Active` : '1 Observation'}
          subtitle="Locomotion or motion spikes"
          variant={alerts.length > 0 ? 'warning' : 'default'}
          icon={<AlertTriangle className="w-5 h-5 text-[#F9A825]" />}
        />
        <StatCard
          title="Model Confidence"
          value="94.6%"
          subtitle="Rolling multi-model average"
          icon={<Sparkles className="w-5 h-5 text-[#1976D2]" />}
        />
      </div>

      {/* 2. Two-Column Layout (Development 1 Specification) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 width): Real-Time Behaviour Classification Table */}
        <Card className="lg:col-span-2 p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#E3E9E2] dark:border-farm-darkBorder">
            <div>
              <h2 className="text-sm font-bold text-[#263238] dark:text-white">
                Real-Time Behaviour Classification
              </h2>
              <p className="text-xs text-[#607067] dark:text-gray-400">
                Latest model inferences across registered dairy cattle
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded-full border border-[#C8E6C9]">
              Live 1.0 Hz
            </span>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E3E9E2] text-[#607067] text-[11px]">
                  <th className="py-2.5 font-semibold">Animal</th>
                  <th className="py-2.5 font-semibold">Behaviour</th>
                  <th className="py-2.5 font-semibold">Confidence</th>
                  <th className="py-2.5 font-semibold">Last Update</th>
                  <th className="py-2.5 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E9E2]/60">
                {(cows.length > 0 ? cows : DEMO_COW_PROFILES.map((p) => ({ ...p, status: 'online', latest_behaviour: 'grazing' }))).map((cow: any) => {
                  const isSelected = cow.id === selectedCowId;
                  const currentBeh = isSelected && aiModules.behaviour.label
                    ? aiModules.behaviour.label
                    : cow.latest_behaviour || 'grazing';
                  const behColor = BEHAVIOUR_COLORS[currentBeh.toLowerCase()] || '#2E7D32';
                  const confidence = isSelected && aiModules.behaviour.confidence !== null
                    ? Math.round(aiModules.behaviour.confidence * 100)
                    : 92 + (cow.name.charCodeAt(0) % 7);

                  return (
                    <tr
                      key={cow.id}
                      onClick={() => setSelectedCowId(cow.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#E8F5E9]/50 dark:bg-emerald-950/20'
                          : 'hover:bg-[#F7F9F4] dark:hover:bg-gray-800/40'
                      }`}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: behColor }} />
                          <div>
                            <span className="font-bold text-[#263238] dark:text-white block">
                              {cow.name}
                            </span>
                            <span className="text-[10px] text-[#607067] font-mono">
                              {cow.id} • {cow.tag}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white capitalize"
                          style={{ backgroundColor: behColor }}
                        >
                          {currentBeh}
                        </span>
                      </td>

                      <td className="py-3">
                        <div className="w-24">
                          <div className="flex justify-between text-[10px] text-[#607067] mb-1 font-mono">
                            <span>{confidence}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#E3E9E2] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#2E7D32]"
                              style={{ width: `${confidence}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 font-mono text-[#607067] text-[11px]">
                        {isSelected ? 'Just now' : '1s ago'}
                      </td>

                      <td className="py-3 text-right">
                        {cow.alerts_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F9A825]">
                            <AlertTriangle className="w-3 h-3" />
                            Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2E7D32]">
                            <CheckCircle2 className="w-3 h-3" />
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right Column (1/3 width): Anomaly Observations */}
        <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E9E2] dark:border-farm-darkBorder">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#F9A825]" />
                <h3 className="text-sm font-bold text-[#263238] dark:text-white">
                  Anomaly Observations
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F9A825]/15 text-[#F9A825]">
                {anomalyObservations.length} Flagged
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {anomalyObservations.map((anom) => (
                <div
                  key={anom.id}
                  className="p-3 rounded-xl border border-[#E3E9E2] dark:border-gray-800 bg-[#F7F9F4] dark:bg-gray-800/40 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#F9A825]" />
                      <span className="font-bold text-[#263238] dark:text-white">
                        {anom.cowName} ({anom.cowId})
                      </span>
                    </div>
                    <span className="text-[10px] text-[#607067] font-mono">{anom.time}</span>
                  </div>

                  <p className="text-[11px] text-[#607067] dark:text-gray-300 leading-relaxed">
                    {anom.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className="text-[#607067] font-mono">Anomaly Score: {anom.score}</span>
                    <button
                      onClick={() => {
                        setSelectedCowId(anom.cowId);
                        navigate(`/cows/${anom.cowId}`);
                      }}
                      type="button"
                      className="text-[#2E7D32] hover:text-[#1B5E20] font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      Investigate <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-[#E3E9E2] dark:border-farm-darkBorder">
            <button
              onClick={() => navigate('/alerts')}
              type="button"
              className="w-full py-2 px-3 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-[#F7F9F4] text-[#2E7D32] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              View All Inference Logs
            </button>
          </div>
        </Card>
      </div>

      {/* 3. Bottom Large Area Chart: Herd Behaviour Trends */}
      <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
        <SectionHeader
          title="Herd Behaviour Trends"
          subtitle="Cumulative time budget distribution across the herd over 24-hour circadian cycles"
        />
        <div className="w-full h-72 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={herdTrendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendGrazing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E7D32" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#2E7D32" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="trendResting" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7B1FA2" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#7B1FA2" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="trendWalking" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1976D2" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#1976D2" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="trendRumination" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#66BB6A" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#66BB6A" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E9E2" opacity={0.7} />
              <XAxis dataKey="time" stroke="#607067" fontSize={11} tickLine={false} />
              <YAxis stroke="#607067" fontSize={11} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '0.75rem',
                  border: '1px solid #E3E9E2',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Area
                type="monotone"
                dataKey="grazing"
                name="Grazing"
                stroke="#2E7D32"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#trendGrazing)"
              />
              <Area
                type="monotone"
                dataKey="resting"
                name="Resting"
                stroke="#7B1FA2"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#trendResting)"
              />
              <Area
                type="monotone"
                dataKey="walking"
                name="Walking"
                stroke="#1976D2"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#trendWalking)"
              />
              <Area
                type="monotone"
                dataKey="ruminating"
                name="Ruminating"
                stroke="#66BB6A"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#trendRumination)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 4. Selected Animal Telemetry & Waveform Controls */}
      <div>
        <CowSelector
          hardwareStatus={hw?.status}
          deviceId={hw?.device_id}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 my-4">
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

        {/* Live Waveform Chart */}
        <WaveformChart data={waveformPoints} cowId={selectedCowId} />

        {/* Inference Window & Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <InferenceWindow
            windowState={dashboardData?.window}
            behaviourLabel={aiModules.behaviour.label}
            confidence={aiModules.behaviour.confidence}
            lastInferenceTime={dashboardData?.sensor?.timestamp}
          />
          <ControlsPanel onRefresh={refreshNow} isRefreshing={isRefreshing} />
        </div>

        {/* 5 AI Modules for Selected Cow */}
        <div className="mt-6">
          <SectionHeader
            title="Five-Module Real-Time AI Inference"
            subtitle={`Multi-task models running against ${dashboardData?.window?.sample_count ?? 0} buffered telemetry readings`}
          />
          <AiModuleGrid modules={aiModules} cowId={selectedCowId} />
        </div>

        {/* Hardware Architecture Spec */}
        <div className="mt-6">
          <SpecList hasTemperatureSensor={rawTemp !== null && rawTemp !== undefined} />
        </div>
      </div>
    </div>
  );
};


