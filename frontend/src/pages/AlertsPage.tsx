// ============================================================
// SmartLivestock AI — Herd Alerts Page (/alerts)
// ============================================================

import React, { useState } from 'react';
import { useAlerts } from '../hooks/useAlerts';
import { Card } from '../components/common/Card';
import { AlertList } from '../components/alerts/AlertList';
import { SectionHeader } from '../components/common/SectionHeader';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { RefreshCw, Bell, ShieldAlert, CheckCircle } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const { alerts, activeAlerts, resolvedAlerts, isLoading, refreshAlerts, resolveAlert } = useAlerts();
  const [tab, setTab] = useState<'all' | 'active' | 'resolved'>('active');

  const displayedAlerts = {
    all: alerts,
    active: activeAlerts,
    resolved: resolvedAlerts,
  }[tab];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Livestock Health Alerts & Vigilance
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Confirmed behavioural anomalies, estrus surge detections, fever spikes, and locomotion irregularities.
          </p>
        </div>

        <button
          onClick={refreshAlerts}
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-farm-border dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard hover:bg-gray-50 text-gray-700 dark:text-gray-200 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Alerts
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-farm-border dark:border-farm-darkBorder pb-3">
        <button
          onClick={() => setTab('active')}
          type="button"
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'active'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          Active Alerts ({activeAlerts.length})
        </button>

        <button
          onClick={() => setTab('all')}
          type="button"
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'all'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          All Recorded ({alerts.length})
        </button>

        <button
          onClick={() => setTab('resolved')}
          type="button"
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'resolved'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          Resolved ({resolvedAlerts.length})
        </button>
      </div>

      {/* Alerts Content */}
      {isLoading ? (
        <LoadingSkeleton className="h-28" rows={3} />
      ) : (
        <AlertList
          alerts={displayedAlerts}
          onResolve={resolveAlert}
          emptyTitle={tab === 'active' ? '0 Active Animal Health Alerts' : 'No alerts recorded'}
          emptyDescription={
            tab === 'active'
              ? 'All monitored animals exhibit sound physical movement and normal physiological baselines.'
              : 'No alerts match this filter category.'
          }
        />
      )}
    </div>
  );
};

