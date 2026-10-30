// ============================================================
// SmartLivestock AI — Herd Analytics Page (/analytics)
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
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { apiClient } from '../services/apiClient';
import { Card } from '../components/common/Card';
import { SectionHeader } from '../components/common/SectionHeader';
import { EmptyState } from '../components/common/EmptyState';
import { BarChart3, PieChart as PieIcon, TrendingUp } from 'lucide-react';
import { useAppStore } from '../store/appStore';

const BEHAVIOUR_COLORS: Record<string, string> = {
  grazing: '#10b981',
  resting: '#8b5cf6',
  walking: '#3b82f6',
  ruminating: '#f59e0b',
  active_mount: '#ec4899',
  unknown: '#9ca3af',
};

export const AnalyticsPage: React.FC = () => {
  const { isDemoMode } = useAppStore();
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await apiClient.get('/analytics/summary', { timeoutMs: 4000 });
        setSummary(res);
      } catch (err) {
        // Empty state
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [isDemoMode]);

  // Transform behaviour distribution into Pie data
  const rawBeh = summary?.behaviour_distribution || {};
  const pieData = Object.entries(rawBeh).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: count as number,
    color: BEHAVIOUR_COLORS[name.toLowerCase()] || '#10b981',
  }));

  // Hourly Activity sample breakdown
  const activityData = [
    { hour: '04:00', grazing: 40, resting: 15, walking: 5 },
    { hour: '08:00', grazing: 55, resting: 5, walking: 12 },
    { hour: '12:00', grazing: 20, resting: 45, walking: 8 },
    { hour: '16:00', grazing: 50, resting: 10, walking: 15 },
    { hour: '20:00', grazing: 10, resting: 55, walking: 5 },
    { hour: '00:00', grazing: 5, resting: 60, walking: 2 },
  ];

  const hasPieData = pieData.length > 0;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Herd Health & Behaviour Analytics
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          Historical activity patterns, behavioural time budgets, and herd wellness distributions.
        </p>
      </div>

      {/* Grid Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Behaviour Distribution Donut */}
        <Card className="p-6">
          <SectionHeader
            title="Behaviour Time Budget"
            subtitle="Distribution of activity classifications recorded across inference cycles"
          />

          {!hasPieData ? (
            <div className="py-12">
              <EmptyState
                icon={<PieIcon className="w-8 h-8" />}
                title="Accumulating Inference Cycles"
                description="As the ESP32 transmits telemetry packets, behaviour classifications will populate this breakdown."
              />
            </div>
          ) : (
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
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
                      border: '1px solid #e5eae2',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* 24-Hour Activity Rhythm */}
        <Card className="p-6">
          <SectionHeader
            title="Circadian Activity Rhythm"
            subtitle="Hourly time allocation across grazing, resting, and walking"
          />
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5eae2" opacity={0.6} />
                <XAxis dataKey="hour" stroke="#888888" fontSize={11} tickLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} unit="m" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '0.75rem',
                    border: '1px solid #e5eae2',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="grazing" name="Grazing" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resting" name="Resting" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="walking" name="Walking" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

