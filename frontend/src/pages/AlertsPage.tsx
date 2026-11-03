// ============================================================
// GouNandi — Livestock Health Alerts Page (/alerts)
// ============================================================

import React, { useState } from 'react';
import { useAlerts } from '../hooks/useAlerts';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { AlertList } from '../components/alerts/AlertList';
import { SectionHeader } from '../components/common/SectionHeader';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import {
  RefreshCw,
  Bell,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  CheckCheck,
  Filter,
} from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const { alerts, activeAlerts, resolvedAlerts, isLoading, refreshAlerts, resolveAlert } = useAlerts();
  const [filterType, setFilterType] = useState<'all' | 'critical' | 'warning' | 'resolved'>('all');

  const criticalCount = alerts.filter(
    (a) => !a.resolved && (a.severity === 'critical' || a.severity === 'alert')
  ).length;

  const warningCount = alerts.filter(
    (a) => !a.resolved && a.severity === 'warning'
  ).length;

  const handleMarkAllAcknowledged = async () => {
    for (const a of activeAlerts) {
      await resolveAlert(a.id);
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filterType === 'all') return true;
    if (filterType === 'critical') return !alert.resolved && (alert.severity === 'critical' || alert.severity === 'alert');
    if (filterType === 'warning') return !alert.resolved && alert.severity === 'warning';
    if (filterType === 'resolved') return alert.resolved;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#263238] dark:text-white tracking-tight">
            Livestock Health Alerts & Vigilance
          </h1>
          <p className="text-xs sm:text-sm text-[#607067] dark:text-gray-400 mt-0.5">
            Confirmed behavioural anomalies, estrus surge detections, fever spikes, and locomotion irregularities
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {activeAlerts.length > 0 && (
            <button
              onClick={handleMarkAllAcknowledged}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-[#E8F5E9] hover:bg-[#C8E6C9] text-[#2E7D32] border border-[#C8E6C9] transition-all shadow-2xs cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark All Acknowledged
            </button>
          )}

          <button
            onClick={refreshAlerts}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard hover:bg-[#F7F9F4] text-[#607067] hover:text-[#263238] dark:text-gray-200 transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#2E7D32]" />
            Refresh Alerts
          </button>
        </div>
      </div>

      {/* 1. Four Summary Cards (Development 1 Specification) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Alerts"
          value={activeAlerts.length}
          subtitle="Requiring herd review"
          variant={activeAlerts.length > 0 ? 'warning' : 'default'}
          icon={<Bell className="w-5 h-5 text-[#F9A825]" />}
        />
        <StatCard
          title="Critical"
          value={criticalCount}
          subtitle="Immediate veterinary attention"
          variant={criticalCount > 0 ? 'danger' : 'default'}
          icon={<ShieldAlert className="w-5 h-5 text-[#D84343]" />}
        />
        <StatCard
          title="Warnings"
          value={warningCount}
          subtitle="Behavioural trend anomalies"
          icon={<AlertTriangle className="w-5 h-5 text-[#F9A825]" />}
        />
        <StatCard
          title="Resolved (24h)"
          value={resolvedAlerts.length}
          subtitle="Acknowledged and cleared"
          variant="success"
          icon={<CheckCircle className="w-5 h-5 text-[#2E7D32]" />}
        />
      </div>

      {/* 2. Compact Filter Chips */}
      <div className="flex items-center gap-2 border-b border-[#E3E9E2] dark:border-farm-darkBorder pb-3 flex-wrap">
        {[
          { id: 'all', label: `All Alerts (${alerts.length})` },
          { id: 'critical', label: `Critical (${criticalCount})` },
          { id: 'warning', label: `Warnings (${warningCount})` },
          { id: 'resolved', label: `Resolved (${resolvedAlerts.length})` },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => setFilterType(chip.id as any)}
            type="button"
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
              filterType === chip.id
                ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs'
                : 'bg-[#F7F9F4] text-[#607067] hover:text-[#2E7D32] hover:bg-[#E8F5E9] border-[#E3E9E2] dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 3. Alerts Content */}
      {isLoading ? (
        <LoadingSkeleton className="h-28" rows={3} />
      ) : (
        <AlertList
          alerts={filteredAlerts}
          onResolve={resolveAlert}
          emptyTitle={filterType === 'all' ? '0 Livestock Health Alerts Recorded' : 'No alerts match this filter'}
          emptyDescription={
            filterType === 'all'
              ? 'All monitored animals exhibit sound physical movement and normal physiological baselines.'
              : 'No health alerts found matching the selected filter criteria.'
          }
        />
      )}
    </div>
  );
};


