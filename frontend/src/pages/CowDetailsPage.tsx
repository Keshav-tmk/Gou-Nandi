// ============================================================
// SmartLivestock AI — Individual Cow Details Page (/cows/:id)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cowsService } from '../services/cows';
import { CowDetailResponse } from '../types/api';
import { useAiResults } from '../hooks/useAiResults';
import { useAppStore } from '../store/appStore';
import { Card } from '../components/common/Card';
import { Chip, ChipVariant } from '../components/common/Chip';
import { SectionHeader } from '../components/common/SectionHeader';
import { AiModuleGrid } from '../components/ai/AiModuleGrid';
import { AlertList } from '../components/alerts/AlertList';
import { WaveformChart } from '../components/telemetry/WaveformChart';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { formatDateTime, formatRelativeSeconds } from '../utils/formatTime';
import { parseTelemetryPoint } from '../utils/telemetry';
import { ArrowLeft, Radio, Calendar, Scale, Tag, Activity } from 'lucide-react';
import { DEMO_COW_PROFILES } from '../data/cows';

export const CowDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cowId = id ? id.toUpperCase() : 'COW-001';

  const { isDemoMode } = useAppStore();
  const [cowDetail, setCowDetail] = useState<CowDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDetail() {
      setIsLoading(true);
      try {
        const res = await cowsService.getCowDetail(cowId);
        if (res && res.profile) {
          setCowDetail(res);
        }
      } catch (err) {
        // Fallback to static profile
        const p = DEMO_COW_PROFILES.find((c) => c.id === cowId) || DEMO_COW_PROFILES[0];
        setCowDetail({
          status: 'success',
          profile: p,
          freshness: { status: 'waiting_for_sensor_data' },
          latest_telemetry: { timestamp: null, received_at: null, is_stale: false, values: {} as any },
          recent_readings: [],
          window: { sample_count: 0, required_samples: 20, ready: false, progress_percent: 0 },
          ai: {},
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

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          type="button"
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-farm-darkCard border border-farm-border dark:border-farm-darkBorder transition-colors"
          aria-label="Back to cows list"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {profile?.name || cowId} ({profile?.id || cowId})
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Individual dairy animal profile, live telemetry window, and AI health assessments.
          </p>
        </div>
      </div>

      {isLoading && !cowDetail ? (
        <LoadingSkeleton className="h-64" rows={2} />
      ) : (
        <>
          {/* Cow Profile Summary Card */}
          <Card className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-farm-border dark:border-farm-darkBorder">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-3xl">
                  🐄
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      {profile?.name}
                    </h2>
                    <Chip label={profile?.tag || 'TAG-000'} variant="neutral" />
                    <Chip
                      label={hw?.status ? hw.status.toUpperCase() : 'WAITING'}
                      variant={hw?.status === 'online' ? 'success' : hw?.status === 'stale' ? 'warning' : 'neutral'}
                      dot
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Collar Hardware:{' '}
                    <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                      {hw?.device_id || profile?.deviceId}
                    </span>{' '}
                    • Last Seen: {formatRelativeSeconds(hw?.seconds_since_last_reading)}
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Bio Details */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-400" />
                <div>
                  <span className="text-gray-400 block">Breed</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{profile?.breed}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <span className="text-gray-400 block">Date of Birth</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {profile?.date_of_birth || 'March 2021'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-gray-400" />
                <div>
                  <span className="text-gray-400 block">Body Weight</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {profile?.weight_kg ? `${profile.weight_kg} kg` : '420 kg'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-400" />
                <div>
                  <span className="text-gray-400 block">Lactation Stage</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {profile?.lactation_stage || 'Mid-lactation'}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Mini Waveform Chart */}
          <WaveformChart data={waveformPoints} cowId={cowId} />

          {/* 5 AI Modules for this Cow */}
          <div>
            <SectionHeader
              title="Real-Time AI Multi-Module Inferences"
              subtitle={`Models evaluated on ${cowDetail?.window?.sample_count ?? 0} buffered sensor samples`}
            />
            <AiModuleGrid modules={aiModules} cowId={cowId} />
          </div>

          {/* Active Alerts for this Cow */}
          <div>
            <SectionHeader
              title={`Alerts & Health Observations for ${profile?.name}`}
              subtitle="Confirmed health alerts and locomotion warnings"
            />
            <AlertList
              alerts={cowDetail?.alerts || []}
              emptyTitle={`0 Active Alerts for ${profile?.name}`}
              emptyDescription="No anomalies or health risks detected for this animal."
            />
          </div>
        </>
      )}
    </div>
  );
};

