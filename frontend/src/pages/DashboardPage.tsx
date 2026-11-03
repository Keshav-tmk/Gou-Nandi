// ============================================================
// GouNandi — Redesigned Dashboard Page (Development 1)
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useTelemetry } from '../hooks/useTelemetry';
import { useAiResults } from '../hooks/useAiResults';
import { useAlerts } from '../hooks/useAlerts';
import { apiClient } from '../services/apiClient';
import { cowsService } from '../services/cows';
import { StatCard } from '../components/common/StatCard';
import { SectionHeader } from '../components/common/SectionHeader';
import { Card } from '../components/common/Card';
import { AiModuleGrid } from '../components/ai/AiModuleGrid';
import { AlertList } from '../components/alerts/AlertList';
import { WaveformChart } from '../components/telemetry/WaveformChart';
import { InferenceWindow } from '../components/telemetry/InferenceWindow';
import { MetricCard } from '../components/telemetry/MetricCard';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Chip } from '../components/common/Chip';
import { formatSensorValue } from '../utils/telemetry';
import { formatRelativeSeconds } from '../utils/formatTime';
import { DEMO_COW_PROFILES } from '../data/cows';
import { CowSummary } from '../types/cow';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Bell,
  ArrowRight,
  Sparkles,
  Gauge,
  Compass,
  Thermometer,
  Activity,
  ChevronRight,
  Radio,
} from 'lucide-react';

const BEHAVIOUR_COLORS: Record<string, string> = {
  Grazing: '#2E7D32',
  Resting: '#7B1FA2',
  Walking: '#1976D2',
  Ruminating: '#66BB6A',
  'Active Mount': '#F9A825',
  Standby: '#607067',
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCowId, setSelectedCowId, isDemoMode } = useAppStore();
  const { farmer, farm } = useAuthStore();
  const { dashboardData, waveformPoints, isLoading } = useTelemetry(selectedCowId);
  const aiModules = useAiResults(dashboardData?.ai, dashboardData?.sensor?.timestamp);
  const { alerts, activeAlerts, resolveAlert } = useAlerts();

  const [cowsList, setCowsList] = useState<CowSummary[]>([]);
  const [herdStats, setHerdStats] = useState({
    totalCows: 8,
    healthyCows: 8,
    attentionCows: 0,
    activeAlerts: 0,
  });

  // Fetch summary & herd cows
  useEffect(() => {
    async function loadData() {
      try {
        const [sumRes, cowRes] = await Promise.allSettled([
          apiClient.get('/analytics/summary', { timeoutMs: 4000 }),
          cowsService.listCows(),
        ]);

        if (sumRes.status === 'fulfilled' && sumRes.value && (sumRes.value as any).herd) {
          const h = (sumRes.value as any).herd;
          setHerdStats({
            totalCows: h.total_cows || 8,
            healthyCows: h.healthy_cows || 8,
            attentionCows: h.attention_cows || 0,
            activeAlerts: h.active_alerts_count || 0,
          });
        }

        if (cowRes.status === 'fulfilled' && cowRes.value && cowRes.value.cows) {
          setCowsList(cowRes.value.cows);
          if (cowRes.value.cows.length > 0 && !cowRes.value.cows.some((c: any) => c.id === selectedCowId)) {
            setSelectedCowId(cowRes.value.cows[0].id);
          }
        } else {
          // Fallback to local 8 demo cows
          const fallback: CowSummary[] = DEMO_COW_PROFILES.map((p, idx) => ({
            ...p,
            status: idx === 0 ? 'online' : 'waiting_for_sensor_data',
            has_live_telemetry: idx === 0,
            last_received_at: null,
            seconds_since_last_reading: idx === 0 ? 1 : null,
            total_readings: idx === 0 ? 120 : 0,
            latest_behaviour: idx === 0 ? 'grazing' : idx % 2 === 0 ? 'resting' : 'ruminating',
            alerts_count: 0,
            is_stale: false,
          }));
          setCowsList(fallback);
        }
      } catch {
        // Fallback
      }
    }
    loadData();
  }, [alerts, isDemoMode]);

  const hw = dashboardData?.hardware;
  const sensor = dashboardData?.sensor?.values;
  const isStale = hw?.is_stale || false;

  const rawTemp = sensor?.temperature_c;
  const tempDisplay = rawTemp !== null && rawTemp !== undefined ? `${rawTemp.toFixed(1)}` : 'Unavailable';
  const tempUnit = rawTemp !== null && rawTemp !== undefined ? '°C' : undefined;

  // Hourly circadian activity rhythm data
  const rhythmData = [
    { hour: '00:00', grazing: 8, resting: 78, walking: 4 },
    { hour: '04:00', grazing: 35, resting: 50, walking: 15 },
    { hour: '08:00', grazing: 72, resting: 12, walking: 16 },
    { hour: '12:00', grazing: 25, resting: 65, walking: 10 },
    { hour: '16:00', grazing: 68, resting: 15, walking: 17 },
    { hour: '20:00', grazing: 14, resting: 76, walking: 10 },
  ];

  // Daily Behaviour Distribution Donut Data
  const donutData = [
    { name: 'Grazing', value: 46, color: '#2E7D32' },
    { name: 'Resting', value: 34, color: '#7B1FA2' },
    { name: 'Walking', value: 12, color: '#1976D2' },
    { name: 'Ruminating', value: 8, color: '#66BB6A' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Hero Welcome Card — Rounded Pasture Landscape with GouNandi Branding */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-[#2E7D32] via-[#236627] to-[#144217] text-white border-0 shadow-md p-6 sm:p-8 rounded-2xl">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#C8E6C9_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        <div className="absolute top-6 right-6 w-28 h-28 bg-white/10 rounded-2xl p-2.5 backdrop-blur-xs border border-white/20 hidden md:flex items-center justify-center overflow-hidden pointer-events-none">
          <img src="/logo.png" alt="GouNandi Emblem" className="w-full h-full object-contain filter invert opacity-90" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F5E9]/20 text-[#C8E6C9] text-xs font-semibold mb-3 border border-[#66BB6A]/40 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#81C784]" />
            GouNandi Precision Cattle Health Intelligence
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Welcome back, {farmer?.full_name || 'Farmer'}
          </h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs sm:text-sm text-[#C8E6C9] font-semibold">
            <span>{farm?.farm_name || 'GouNandi Dairy Farm'}</span>
            {farm?.farm_location && (
              <>
                <span>•</span>
                <span className="text-[#E8F5E9]/90 font-normal">{farm.farm_location}, {farm.district || ''}</span>
              </>
            )}
            {farmer?.farmer_id && (
              <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                Farmer ID: {farmer.farmer_id}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs sm:text-sm text-[#E8F5E9]/90 leading-relaxed font-normal">
            Continuous wireless motion telemetry and 5-module Scikit-Learn AI monitoring for your dairy livestock health, estrus cycles, rumination cadence, and locomotion.
          </p>
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <Link
              to="/cows"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[#2E7D32] font-bold text-xs sm:text-sm shadow-sm hover:bg-[#F7F9F4] transition-all"
            >
              View Herd Registry
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/behaviour"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2E7D32]/80 hover:bg-[#2E7D32] text-white font-semibold text-xs sm:text-sm border border-[#66BB6A]/40 transition-all"
            >
              Full Collar Telemetry
            </Link>
          </div>
        </div>
      </Card>

      {/* 2. Herd Vitality Metric Cards */}
      <div>
        <SectionHeader
          title="Herd Vitality Overview"
          subtitle="Real-time herd telemetry health and vigilance summary"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Cattle"
            value={herdStats.totalCows}
            subtitle="Registered dairy cattle"
            icon={<Users className="w-5 h-5 text-[#2E7D32]" />}
          />
          <StatCard
            title="Healthy Herd"
            value={herdStats.healthyCows}
            subtitle="Sound health activity"
            variant="success"
            icon={<CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />}
          />
          <StatCard
            title="Needs Attention"
            value={herdStats.attentionCows}
            subtitle="Observations or alerts"
            variant={herdStats.attentionCows > 0 ? 'warning' : 'default'}
            icon={<AlertTriangle className="w-5 h-5 text-[#F9A825]" />}
          />
          <StatCard
            title="Critical Alerts"
            value={herdStats.activeAlerts}
            subtitle="Unresolved health alerts"
            variant={herdStats.activeAlerts > 0 ? 'danger' : 'default'}
            icon={<Bell className="w-5 h-5 text-[#D84343]" />}
          />
        </div>
      </div>

      {/* 3. "What the Herd Is Doing" — Compact Cow Behaviour Gallery */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#263238] dark:text-white">
              What the Herd Is Doing
            </h2>
            <p className="text-xs text-[#607067] dark:text-gray-400">
              Live behavioural state and AI classification for registered herd animals
            </p>
          </div>
          <Link
            to="/cows"
            className="text-xs font-semibold text-[#2E7D32] hover:text-[#1B5E20] dark:text-emerald-400 flex items-center gap-1"
          >
            All Animals <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {(cowsList.length > 0 ? cowsList : DEMO_COW_PROFILES.map((p) => ({ ...p, status: 'online', latest_behaviour: 'grazing' }))).map((cow: any) => {
            const isSelected = cow.id === selectedCowId;
            const currentBeh = isSelected && aiModules.behaviour.label
              ? aiModules.behaviour.label
              : cow.latest_behaviour || 'Grazing';
            const behCapitalized = currentBeh.charAt(0).toUpperCase() + currentBeh.slice(1);
            const badgeColor = BEHAVIOUR_COLORS[behCapitalized] || '#2E7D32';

            return (
              <div
                key={cow.id}
                onClick={() => setSelectedCowId(cow.id)}
                className={`cursor-pointer p-3 rounded-xl border transition-all text-center flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#E8F5E9] border-[#2E7D32] ring-2 ring-[#2E7D32]/20 shadow-xs'
                    : 'bg-white dark:bg-farm-darkCard border-[#E3E9E2] dark:border-farm-darkBorder hover:border-[#66BB6A]'
                }`}
              >
                <div>
                  <div className="w-8 h-8 mx-auto rounded-full bg-[#E8F5E9] dark:bg-emerald-950/40 flex items-center justify-center border border-[#C8E6C9] dark:border-emerald-800 mb-1.5 text-base select-none">
                    🐄
                  </div>
                  <div className="text-xs font-bold text-[#263238] dark:text-white truncate">
                    {cow.name}
                  </div>
                  <div className="text-[10px] text-[#607067] font-mono">
                    {cow.id}
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-[#E3E9E2]/60">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold text-white truncate max-w-full"
                    style={{ backgroundColor: badgeColor }}
                  >
                    {behCapitalized}
                  </span>
                  {isSelected && aiModules.behaviour.confidence !== null && (
                    <div className="text-[9px] text-[#607067] mt-0.5 font-mono">
                      {(aiModules.behaviour.confidence * 100).toFixed(0)}% conf
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Herd Activity Charts: Herd Activity Rhythm & Daily Behaviour Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Herd Activity Rhythm (Area Chart) */}
        <Card className="lg:col-span-2 p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
          <SectionHeader
            title="Herd Activity Rhythm"
            subtitle="Circadian activity pattern across the 24-hour cycle"
          />
          <div className="w-full h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rhythmData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGrazing" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E7D32" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#2E7D32" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorResting" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7B1FA2" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#7B1FA2" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorWalking" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1976D2" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#1976D2" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E9E2" opacity={0.7} />
                <XAxis dataKey="hour" stroke="#607067" fontSize={11} tickLine={false} />
                <YAxis stroke="#607067" fontSize={11} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '0.75rem',
                    border: '1px solid #E3E9E2',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Area
                  type="monotone"
                  dataKey="grazing"
                  name="Grazing"
                  stroke="#2E7D32"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorGrazing)"
                />
                <Area
                  type="monotone"
                  dataKey="resting"
                  name="Resting"
                  stroke="#7B1FA2"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorResting)"
                />
                <Area
                  type="monotone"
                  dataKey="walking"
                  name="Walking"
                  stroke="#1976D2"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorWalking)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Daily Behaviour Distribution (Donut Chart) */}
        <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs flex flex-col justify-between">
          <div>
            <SectionHeader
              title="Daily Behaviour Distribution"
              subtitle="Herd time budget allocation across primary activities"
            />
            <div className="w-full h-52 relative mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '0.75rem',
                      border: '1px solid #E3E9E2',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-extrabold text-[#263238] dark:text-white">46%</span>
                <span className="text-[10px] text-[#607067] font-medium">Grazing</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#E3E9E2] dark:border-farm-darkBorder text-xs">
            {donutData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[#607067] truncate">{item.name}:</span>
                <span className="font-bold text-[#263238] dark:text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 5. Lower Section: Needs Your Attention & Live Collar Telemetry */}
      <div className="space-y-6">
        {/* Needs Your Attention (Alerts) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#263238] dark:text-white">
                Needs Your Attention
              </h2>
              <p className="text-xs text-[#607067] dark:text-gray-400">
                Actionable health observations, locomotion concerns, and estrus cycle markers
              </p>
            </div>
            <Link
              to="/alerts"
              className="text-xs font-semibold text-[#2E7D32] hover:text-[#1B5E20] dark:text-emerald-400 flex items-center gap-1"
            >
              All Alerts ({alerts.length}) <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <AlertList
            alerts={activeAlerts.slice(0, 3)}
            onResolve={resolveAlert}
            emptyTitle="0 Active Health Alerts"
            emptyDescription="All monitored herd animals exhibit sound motion characteristics and normal physiological baselines."
          />
        </div>

        {/* Live Collar Telemetry Preview */}
        <div>
          <SectionHeader
            title={`Live Collar Telemetry — Monitored Animal: ${selectedCowId}`}
            subtitle={`Hardware readings from ${hw?.device_id || 'COLLAR-ESP32-001'} • Freshness: ${formatRelativeSeconds(hw?.seconds_since_last_reading)}`}
            action={
              <Link
                to="/behaviour"
                className="text-xs font-semibold text-[#2E7D32] hover:text-[#1B5E20] dark:text-emerald-400 flex items-center gap-1"
              >
                Full Collar Telemetry <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          />

          {/* 7 Channels Quick Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
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

          {/* Live Waveform Chart & Rolling AI Window */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <WaveformChart
                data={waveformPoints}
                cowId={selectedCowId}
                isLive={!isStale && hw?.status === 'online'}
              />
            </div>
            <div>
              <InferenceWindow
                windowState={dashboardData?.window}
                behaviourLabel={aiModules.behaviour.label}
                confidence={aiModules.behaviour.confidence}
                lastInferenceTime={dashboardData?.sensor?.timestamp}
              />
            </div>
          </div>
        </div>

        {/* 5-Module Scikit-Learn AI Multi-Task Inference Grid */}
        <div>
          <SectionHeader
            title={`Five-Module AI Inference — ${selectedCowId}`}
            subtitle={`Real-time multi-task machine learning inference across ${dashboardData?.window?.sample_count ?? 0} buffered readings`}
          />

          {isLoading && !dashboardData ? (
            <LoadingSkeleton className="h-44" rows={2} />
          ) : (
            <AiModuleGrid modules={aiModules} cowId={selectedCowId} />
          )}
        </div>
      </div>
    </div>
  );
};


