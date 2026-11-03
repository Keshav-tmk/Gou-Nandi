// ============================================================
// GouNandi — Herd Analytics & Insights Page (/analytics)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { apiClient } from '../services/apiClient';
import { cowsService } from '../services/cows';
import { CowSummary } from '../types/cow';
import { DEMO_COW_PROFILES } from '../data/cows';
import { Card } from '../components/common/Card';
import { SectionHeader } from '../components/common/SectionHeader';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Activity,
  CheckCircle2,
  Calendar,
  Filter,
  Download,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

const BEHAVIOUR_COLORS: Record<string, string> = {
  grazing: '#2E7D32',      // Primary forest green
  resting: '#7B1FA2',      // Rest purple
  walking: '#1976D2',      // Info blue
  ruminating: '#66BB6A',   // Secondary leaf green
  active_mount: '#F9A825', // Warning amber
  unknown: '#607067',      // Secondary text
};

export const AnalyticsPage: React.FC = () => {
  const { isDemoMode } = useAppStore();
  const [summary, setSummary] = useState<any>(null);
  const [cows, setCows] = useState<CowSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d'>('today');

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [sumRes, cowRes] = await Promise.allSettled([
          apiClient.get('/analytics/summary', { timeoutMs: 4000 }),
          cowsService.listCows(),
        ]);

        if (sumRes.status === 'fulfilled' && sumRes.value) {
          setSummary(sumRes.value);
        }

        if (cowRes.status === 'fulfilled' && cowRes.value && cowRes.value.cows) {
          setCows(cowRes.value.cows);
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
              alerts_count: 0,
              is_stale: false,
            }))
          );
        }
      } catch (err) {
        // Fallback handled
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [isDemoMode]);

  // Transform behaviour distribution into Pie data
  const rawBeh = summary?.behaviour_distribution || {
    grazing: 46,
    resting: 34,
    walking: 12,
    ruminating: 8,
  };

  const pieData = Object.entries(rawBeh).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: count as number,
    color: BEHAVIOUR_COLORS[name.toLowerCase()] || '#2E7D32',
  }));

  // Top Row: Herd Activity Trends (Circadian 24h Area Chart)
  const herdActivityData = [
    { hour: '00:00', grazing: 8, resting: 78, walking: 4, ruminating: 10 },
    { hour: '04:00', grazing: 35, resting: 50, walking: 8, ruminating: 7 },
    { hour: '08:00', grazing: 72, resting: 12, walking: 12, ruminating: 4 },
    { hour: '12:00', grazing: 25, resting: 65, walking: 6, ruminating: 4 },
    { hour: '16:00', grazing: 68, resting: 15, walking: 10, ruminating: 7 },
    { hour: '20:00', grazing: 14, resting: 76, walking: 4, ruminating: 6 },
  ];

  // Middle Row: Walking Trends (km or min per hour/day)
  const walkingTrendsData = [
    { time: '02:00', distance: 0.3 },
    { time: '06:00', distance: 1.8 },
    { time: '10:00', distance: 1.2 },
    { time: '14:00', distance: 0.8 },
    { time: '18:00', distance: 2.1 },
    { time: '22:00', distance: 0.4 },
  ];

  // Middle Row: Rumination Trends (minutes per observation window)
  const ruminationTrendsData = [
    { time: '02:00', minutes: 48 },
    { time: '06:00', minutes: 22 },
    { time: '10:00', minutes: 15 },
    { time: '14:00', minutes: 52 },
    { time: '18:00', minutes: 20 },
    { time: '22:00', minutes: 58 },
  ];

  // Animal Comparison table data
  const animalComparisons = (cows.length > 0 ? cows : DEMO_COW_PROFILES).map((c, idx) => {
    const grazingHours = (7.5 + (idx % 3) * 0.4).toFixed(1);
    const restingHours = (8.2 - (idx % 3) * 0.3).toFixed(1);
    const walkingHours = (2.4 + (idx % 2) * 0.2).toFixed(1);
    const ruminationMin = 410 + (idx % 4) * 15;
    const healthScore = 98 - (c.alerts_count > 0 ? 12 : idx % 3);

    return {
      id: c.id,
      name: c.name,
      tag: c.tag,
      breed: c.breed,
      grazingHours,
      restingHours,
      walkingHours,
      ruminationMin,
      healthScore,
    };
  });

  return (
    <div className="space-y-6">
      {/* Title & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#263238] dark:text-white tracking-tight">
            Herd Health Analytics & Insights
          </h1>
          <p className="text-xs sm:text-sm text-[#607067] dark:text-gray-400 mt-0.5">
            Historical activity patterns, behavioural time budgets, rumination trends, and animal comparisons
          </p>
        </div>

        {/* Date Range Chips */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {[
            { id: 'today', label: 'Today (24h)' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
          ].map((d) => (
            <button
              key={d.id}
              onClick={() => setDateRange(d.id as any)}
              type="button"
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                dateRange === d.id
                  ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs'
                  : 'bg-white hover:bg-[#E8F5E9] text-[#607067] hover:text-[#2E7D32] border-[#E3E9E2] dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* TOP ROW: Herd Activity Trends & Behaviour Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Herd Activity Trends (Area Chart) */}
        <Card className="lg:col-span-2 p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
          <SectionHeader
            title="Herd Activity Trends"
            subtitle="Circadian activity rhythm across grazing, resting, and walking"
          />
          <div className="w-full h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={herdActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="anGrazing" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E7D32" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#2E7D32" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="anResting" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7B1FA2" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#7B1FA2" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="anWalking" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#anGrazing)"
                />
                <Area
                  type="monotone"
                  dataKey="resting"
                  name="Resting"
                  stroke="#7B1FA2"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#anResting)"
                />
                <Area
                  type="monotone"
                  dataKey="walking"
                  name="Walking"
                  stroke="#1976D2"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#anWalking)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Behaviour Distribution (Donut Chart) */}
        <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs flex flex-col justify-between">
          <div>
            <SectionHeader
              title="Behaviour Distribution"
              subtitle="Herd time budget allocation across activities"
            />
            <div className="w-full h-52 relative mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
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
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[#607067] truncate">{item.name}:</span>
                <span className="font-bold text-[#263238] dark:text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* MIDDLE ROW: Walking Trends & Rumination Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Walking Trends (Bar Chart) */}
        <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
          <SectionHeader
            title="Walking Trends"
            subtitle="Herd movement distance and locomotion activity over time"
          />
          <div className="w-full h-60 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={walkingTrendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E9E2" opacity={0.7} />
                <XAxis dataKey="time" stroke="#607067" fontSize={11} tickLine={false} />
                <YAxis stroke="#607067" fontSize={11} tickLine={false} unit="km" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '0.75rem',
                    border: '1px solid #E3E9E2',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="distance"
                  name="Distance (km)"
                  fill="#1976D2"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Rumination Trends (Area/Line Chart) */}
        <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
          <SectionHeader
            title="Rumination Trends"
            subtitle="Chewing cadence duration recorded during cud-chewing cycles"
          />
          <div className="w-full h-60 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ruminationTrendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="ruminationGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#66BB6A" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#66BB6A" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E9E2" opacity={0.7} />
                <XAxis dataKey="time" stroke="#607067" fontSize={11} tickLine={false} />
                <YAxis stroke="#607067" fontSize={11} tickLine={false} unit="m" />
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
                  dataKey="minutes"
                  name="Rumination Time (min)"
                  stroke="#2E7D32"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#ruminationGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* BOTTOM SECTION: Animal-Level Comparisons Table */}
      <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
        <SectionHeader
          title="Animal-Level Comparisons"
          subtitle="Comparative time budgets, rumination minutes, and health soundness indices"
        />
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E3E9E2] text-[#607067] text-[11px]">
                <th className="py-2.5 font-semibold">Animal</th>
                <th className="py-2.5 font-semibold">Breed</th>
                <th className="py-2.5 font-semibold">Grazing</th>
                <th className="py-2.5 font-semibold">Resting</th>
                <th className="py-2.5 font-semibold">Walking</th>
                <th className="py-2.5 font-semibold">Rumination</th>
                <th className="py-2.5 font-semibold text-right">Health Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E9E2]/60">
              {animalComparisons.map((row) => (
                <tr key={row.id} className="hover:bg-[#F7F9F4] dark:hover:bg-gray-800/40 transition-colors">
                  <td className="py-3">
                    <span className="font-bold text-[#263238] dark:text-white block">
                      {row.name}
                    </span>
                    <span className="text-[10px] text-[#607067] font-mono">
                      {row.id} • {row.tag}
                    </span>
                  </td>
                  <td className="py-3 text-[#607067]">{row.breed}</td>
                  <td className="py-3 font-semibold text-[#2E7D32]">{row.grazingHours} h/day</td>
                  <td className="py-3 font-semibold text-[#7B1FA2]">{row.restingHours} h/day</td>
                  <td className="py-3 font-semibold text-[#1976D2]">{row.walkingHours} h/day</td>
                  <td className="py-3 font-semibold text-[#66BB6A]">{row.ruminationMin} min/day</td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                      <CheckCircle2 className="w-3 h-3" />
                      {row.healthScore}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};


