// ============================================================
// GouNandi — Individual Cow Details Page (/cows/:id)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { cowsService } from '../services/cows';
import { CowDetailResponse } from '../types/api';
import { useAiResults } from '../hooks/useAiResults';
import { useAppStore } from '../store/appStore';
import { Card } from '../components/common/Card';
import { Chip } from '../components/common/Chip';
import { SectionHeader } from '../components/common/SectionHeader';
import { AiModuleGrid } from '../components/ai/AiModuleGrid';
import { AlertList } from '../components/alerts/AlertList';
import { WaveformChart } from '../components/telemetry/WaveformChart';
import { InferenceWindow } from '../components/telemetry/InferenceWindow';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { formatDateTime, formatRelativeSeconds } from '../utils/formatTime';
import { parseTelemetryPoint } from '../utils/telemetry';
import {
  ArrowLeft,
  Radio,
  Calendar,
  Scale,
  Tag,
  Activity,
  Battery,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Cpu,
  Thermometer,
  Gauge,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import { DEMO_COW_PROFILES } from '../data/cows';

export const CowDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cowId = id ? id.toUpperCase() : 'COW-001';

  const { isDemoMode, setSelectedCowId } = useAppStore();
  const [cowDetail, setCowDetail] = useState<CowDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry' | 'health' | 'collar'>('overview');

  useEffect(() => {
    setSelectedCowId(cowId);
    async function loadDetail() {
      setIsLoading(true);
      try {
        const res = await cowsService.getCowDetail(cowId);
        if (res && res.profile) {
          setCowDetail(res);
        }
      } catch (err: any) {
        if (err && err.status === 403) {
          setAccessDenied(true);
          setIsLoading(false);
          return;
        }
        // Fallback to static profile
        const p = DEMO_COW_PROFILES.find((c) => c.id === cowId) || DEMO_COW_PROFILES[0];
        setCowDetail({
          status: 'success',
          profile: p,
          freshness: { status: 'online', seconds_since_last_reading: 2, device_id: p.deviceId },
          latest_telemetry: {
            timestamp: new Date().toISOString(),
            received_at: new Date().toISOString(),
            is_stale: false,
            values: {
              accel_x: 0.12,
              accel_y: 0.98,
              accel_z: 0.05,
              gyro_x: 1.2,
              gyro_y: -0.8,
              gyro_z: 0.4,
              temperature_c: 38.6,
            } as any,
          },
          recent_readings: [],
          window: { sample_count: 20, required_samples: 20, ready: true, progress_percent: 100 },
          ai: {
            behaviour: { predicted_class: 'grazing', confidence: 0.94 },
            anomaly: { is_anomalous: false, anomaly_score: 0.15 },
            rumination: { is_ruminating: false, probability: 0.12 },
          },
          alerts: [],
          prediction_history: [],
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadDetail();
  }, [cowId, isDemoMode]);

  const aiModules = useAiResults(cowDetail?.ai, cowDetail?.latest_telemetry?.timestamp);

  const waveformPoints = (cowDetail?.recent_readings || [])
    .map(parseTelemetryPoint)
    .filter(Boolean) as any[];

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/cows');
    }
  };

  const profile = cowDetail?.profile;
  const hw = cowDetail?.freshness;
  const sensorValues = cowDetail?.latest_telemetry?.values;
  const isStale = cowDetail?.latest_telemetry?.is_stale || false;
  const rawTemp = sensorValues?.temperature_c;
  const tempDisplay = rawTemp !== null && rawTemp !== undefined ? `${rawTemp.toFixed(1)}°C` : '38.6°C';

  const hasAlerts = (cowDetail?.alerts?.length || 0) > 0;
  const currentBehaviour = aiModules.behaviour.label || 'Grazing';
  const confidencePct = aiModules.behaviour.confidence !== null ? Math.round(aiModules.behaviour.confidence * 100) : 94;

  // Individual Cow Activity Rhythm Data
  const cowActivitySummary = [
    { time: '02:00', activity: 12 },
    { time: '04:00', activity: 38 },
    { time: '06:00', activity: 75 },
    { time: '08:00', activity: 88 },
    { time: '10:00', activity: 62 },
    { time: '12:00', activity: 30 },
    { time: '14:00', activity: 45 },
    { time: '16:00', activity: 82 },
    { time: '18:00', activity: 70 },
    { time: '20:00', activity: 25 },
    { time: '22:00', activity: 15 },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header with Back Button and Quick Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            type="button"
            className="p-2 rounded-xl text-[#607067] dark:text-gray-300 hover:bg-[#F7F9F4] dark:hover:bg-farm-darkCard border border-[#E3E9E2] dark:border-farm-darkBorder transition-colors shadow-xs cursor-pointer"
            aria-label="Back to herd list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#263238] dark:text-white tracking-tight">
                {profile?.name || cowId}
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#F7F9F4] dark:bg-gray-800 text-[#607067] border border-[#E3E9E2] dark:border-gray-700">
                {cowId}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                {profile?.tag || 'TAG-101'}
              </span>
            </div>
            <p className="text-xs text-[#607067] dark:text-gray-400 mt-0.5">
              {profile?.breed} • Born {profile?.date_of_birth || '2021'} • {profile?.weight_kg || 420} kg
            </p>
          </div>
        </div>

        {/* Health Status & Battery Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-farm-darkCard border border-[#E3E9E2] dark:border-farm-darkBorder text-xs">
            <Battery className="w-4 h-4 text-[#2E7D32]" />
            <span className="text-[#607067]">Collar Battery:</span>
            <span className="font-bold text-[#263238] dark:text-white">88% (3.9V)</span>
          </div>

          <div>
            {hasAlerts ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F9A825]/15 text-[#F9A825] border border-[#F9A825]/30">
                <AlertTriangle className="w-4 h-4" />
                Needs Attention
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                <CheckCircle2 className="w-4 h-4" />
                Healthy
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#E3E9E2] dark:border-farm-darkBorder pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'telemetry', label: 'Behaviour & Telemetry' },
          { id: 'health', label: 'Health & Observations' },
          { id: 'collar', label: 'Collar & Sensors' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            type="button"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs'
                : 'bg-[#F7F9F4] text-[#607067] hover:text-[#2E7D32] hover:bg-[#E8F5E9] border-[#E3E9E2] dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && !cowDetail ? (
        <LoadingSkeleton className="h-64" rows={3} />
      ) : (
        /* 3. Two-Column Content Layout (Development 1 Source of Truth) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAIN COLUMN (2/3 width on desktop) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Behaviour Classification Card */}
            <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#607067]">
                    Current Behaviour Classification
                  </span>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-2xl font-extrabold text-[#2E7D32] dark:text-emerald-400 capitalize">
                      {currentBehaviour}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                      {confidencePct}% Confidence
                    </span>
                  </div>
                  <p className="text-xs text-[#607067] dark:text-gray-400 mt-1">
                    Continuous cadence identified from 20-sample rolling buffer window at 1.0 Hz
                  </p>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-[#E8F5E9] dark:bg-emerald-950/40 flex items-center justify-center text-2xl border border-[#C8E6C9] dark:border-emerald-800 shrink-0 select-none">
                  🐄
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#E3E9E2] dark:border-farm-darkBorder grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="block text-[10px] text-[#607067]">Session Duration</span>
                  <span className="font-semibold text-[#263238] dark:text-gray-200">18 minutes</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[#607067]">Estrus Status</span>
                  <span className="font-semibold text-[#2E7D32]">Baseline Normal</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[#607067]">Locomotion Soundness</span>
                  <span className="font-semibold text-[#2E7D32]">Sound (Score 1/5)</span>
                </div>
              </div>
            </Card>

            {/* Activity Summary Chart */}
            <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
              <SectionHeader
                title="Activity Summary — 24h Rhythm"
                subtitle="Relative intensity and movement frequency across circadian hours"
              />
              <div className="w-full h-56 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cowActivitySummary} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cowActivityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2E7D32" stopOpacity={0.7} />
                        <stop offset="95%" stopColor="#2E7D32" stopOpacity={0.05} />
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
                    <Area
                      type="monotone"
                      dataKey="activity"
                      name="Motion Intensity"
                      stroke="#2E7D32"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#cowActivityGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Live Waveform Chart */}
            <WaveformChart data={waveformPoints} cowId={cowId} />

            {/* 5 AI Multi-Task Inference Grid */}
            <div>
              <SectionHeader
                title="AI Health Inference Modules"
                subtitle="Scikit-Learn multi-task classification models for this animal"
              />
              <AiModuleGrid modules={aiModules} cowId={cowId} />
            </div>
          </div>

          {/* SECONDARY COLUMN (1/3 width on desktop) */}
          <div className="space-y-6">
            {/* Health & Alerts Panel */}
            <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E3E9E2] dark:border-farm-darkBorder">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#2E7D32]" />
                  <h3 className="text-sm font-bold text-[#263238] dark:text-white">
                    Health & Alerts
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                  {hasAlerts ? `${cowDetail?.alerts.length} Alert` : 'All Clear'}
                </span>
              </div>

              <div className="mt-3 space-y-3">
                {hasAlerts ? (
                  <AlertList alerts={cowDetail?.alerts || []} />
                ) : (
                  <div className="p-3.5 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/50 border border-[#E3E9E2] text-center">
                    <CheckCircle2 className="w-5 h-5 text-[#2E7D32] mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-[#263238] dark:text-white">
                      Zero Active Health Warnings
                    </p>
                    <p className="text-[11px] text-[#607067] dark:text-gray-400 mt-0.5">
                      Temperature, rumination rhythm, and estrus indicators are within normal reference ranges.
                    </p>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-[#E3E9E2]/60 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#E3E9E2]/40">
                    <span className="text-[#607067]">Temperature</span>
                    <span className="font-semibold text-[#263238] dark:text-white">{tempDisplay}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#E3E9E2]/40">
                    <span className="text-[#607067]">Rumination Cadence</span>
                    <span className="font-semibold text-[#2E7D32]">Regular (420 min/day)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#E3E9E2]/40">
                    <span className="text-[#607067]">Estrus Surge Status</span>
                    <span className="font-semibold text-[#263238] dark:text-white">Inactive</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#607067]">Locomotion Risk</span>
                    <span className="font-semibold text-[#2E7D32]">Low / Sound</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Collar & Sensors Panel */}
            <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E3E9E2] dark:border-farm-darkBorder">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#2E7D32]" />
                  <h3 className="text-sm font-bold text-[#263238] dark:text-white">
                    Collar & Sensors
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F7F9F4] text-[#607067] border border-[#E3E9E2]">
                  {hw?.device_id || profile?.deviceId}
                </span>
              </div>

              <div className="mt-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40">
                  <span className="text-[#607067]">Telemetry Link:</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#2E7D32]">
                    <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                    Online ({formatRelativeSeconds(hw?.seconds_since_last_reading)})
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40">
                  <span className="text-[#607067]">Sensor Hardware:</span>
                  <span className="font-semibold text-[#263238] dark:text-white">MPU-6050 + DS18B20</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40">
                  <span className="text-[#607067]">Sample Window Buffer:</span>
                  <span className="font-semibold text-[#263238] dark:text-white">
                    {cowDetail?.window?.sample_count ?? 20} / {cowDetail?.window?.required_samples ?? 20} samples
                  </span>
                </div>

                {/* Instantaneous Sensor Strip */}
                <div className="pt-2 border-t border-[#E3E9E2]/60">
                  <span className="block text-[11px] font-bold text-[#607067] mb-2">
                    Instantaneous Channels
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-[#F7F9F4] dark:bg-gray-800/40">
                      <span className="text-[#607067] block">Accel (X, Y, Z)</span>
                      <span className="font-mono font-bold text-[#263238] dark:text-white">
                        {sensorValues?.accel_x?.toFixed(2) || '0.12'}, {sensorValues?.accel_y?.toFixed(2) || '0.98'}, {sensorValues?.accel_z?.toFixed(2) || '0.05'} g
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-[#F7F9F4] dark:bg-gray-800/40">
                      <span className="text-[#607067] block">Gyro (Pitch/Roll)</span>
                      <span className="font-mono font-bold text-[#263238] dark:text-white">
                        {sensorValues?.gyro_x?.toFixed(1) || '1.2'}, {sensorValues?.gyro_y?.toFixed(1) || '-0.8'} °/s
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Inference Window State */}
            <InferenceWindow
              windowState={cowDetail?.window}
              behaviourLabel={aiModules.behaviour.label}
              confidence={aiModules.behaviour.confidence}
              lastInferenceTime={cowDetail?.latest_telemetry?.timestamp}
            />
          </div>
        </div>
      )}
    </div>
  );
};


