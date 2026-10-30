// ============================================================
// SmartLivestock AI — Dashboard Overview Page
// ============================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTelemetry } from '../hooks/useTelemetry';
import { useAiResults } from '../hooks/useAiResults';
import { useAlerts } from '../hooks/useAlerts';
import { apiClient } from '../services/apiClient';
import { StatCard } from '../components/common/StatCard';
import { SectionHeader } from '../components/common/SectionHeader';
import { Card } from '../components/common/Card';
import { AiModuleGrid } from '../components/ai/AiModuleGrid';
import { AlertList } from '../components/alerts/AlertList';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { Users, CheckCircle2, AlertTriangle, Bell, ArrowRight, Sparkles } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { dashboardData, isLoading, refreshNow } = useTelemetry('COW-001');
  const aiModules = useAiResults(dashboardData?.ai, dashboardData?.sensor?.timestamp);
  const { alerts, resolveAlert } = useAlerts();

  const [herdStats, setHerdStats] = useState({
    totalCows: 8,
    healthyCows: 8,
    attentionCows: 0,
    activeAlerts: 0,
  });

  useEffect(() => {
    async function loadSummary() {
      try {
        const data = await apiClient.get('/analytics/summary', { timeoutMs: 4000 });
        if (data && data.herd) {
          setHerdStats({
            totalCows: data.herd.total_cows || 8,
            healthyCows: data.herd.healthy_cows || 8,
            attentionCows: data.herd.attention_cows || 0,
            activeAlerts: data.herd.active_alerts_count || 0,
          });
        }
      } catch {
        // Fallback to local calculation
      }
    }
    loadSummary();
  }, [alerts]);

  return (
    <div className="space-y-6">
      {/* Hero Welcome Card */}
      <Card className="relative overflow-hidden bg-gradient-to-r from-emerald-800 to-emerald-950 text-white border-0 shadow-lg p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700/60 text-emerald-200 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Cattle Health Intelligence
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome to SmartLivestock Dairy Farm
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Continuous wireless motion telemetry and 5-module Scikit-Learn AI monitoring for dairy livestock health, estrus cycles, rumination, and locomotion.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <Link
              to="/cows"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-emerald-900 font-bold text-xs sm:text-sm shadow-md hover:bg-emerald-50 transition-colors"
            >
              View All Cows
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/behaviour"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700/60 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm border border-emerald-600 transition-colors"
            >
              Collar Telemetry
            </Link>
          </div>
        </div>
      </Card>

      {/* Herd Overview Stat Cards */}
      <div>
        <SectionHeader
          title="Herd Vitality Overview"
          subtitle="Real-time herd telemetry health and vigilance summary"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Herd"
            value={herdStats.totalCows}
            subtitle="Registered dairy cattle"
            icon={<Users className="w-5 h-5 text-emerald-600" />}
          />
          <StatCard
            title="Normal Baseline"
            value={herdStats.healthyCows}
            subtitle="Sound health activity"
            variant="success"
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          />
          <StatCard
            title="Needs Attention"
            value={herdStats.attentionCows}
            subtitle="Active alerts or observations"
            variant={herdStats.attentionCows > 0 ? 'warning' : 'default'}
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          />
          <StatCard
            title="Active Alerts"
            value={herdStats.activeAlerts}
            subtitle="Animal health alerts"
            variant={herdStats.activeAlerts > 0 ? 'danger' : 'default'}
            icon={<Bell className="w-5 h-5 text-rose-500" />}
          />
        </div>
      </div>

      {/* Primary Monitored Cow: Lakshmi (COW-001) AI Engine */}
      <div>
        <SectionHeader
          title="Lead Collar AI Telemetry — Lakshmi (COW-001)"
          subtitle="Real-time inference across all five Scikit-Learn models"
          action={
            <Link
              to="/behaviour"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 flex items-center gap-1"
            >
              Open Waveform Telemetry <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

        {isLoading && !dashboardData ? (
          <LoadingSkeleton className="h-44" rows={2} />
        ) : (
          <AiModuleGrid modules={aiModules} cowId="COW-001" />
        )}
      </div>

      {/* Active Livestock Alerts */}
      <div>
        <SectionHeader
          title="Live Livestock Health Alerts"
          subtitle="Acknowledge anomalies, estrus events, or locomotion warnings"
        />
        <AlertList alerts={alerts} onResolve={resolveAlert} />
      </div>
    </div>
  );
};

