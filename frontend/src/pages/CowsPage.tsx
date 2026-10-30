// ============================================================
// SmartLivestock AI — Herd Cows List Page (/cows)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cowsService } from '../services/cows';
import { CowSummary } from '../types/cow';
import { Card } from '../components/common/Card';
import { Chip, ChipVariant } from '../components/common/Chip';
import { SectionHeader } from '../components/common/SectionHeader';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { formatRelativeSeconds } from '../utils/formatTime';
import { Search, Radio, ChevronRight, Activity } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { DEMO_COW_PROFILES } from '../data/cows';

export const CowsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSelectedCowId, isDemoMode } = useAppStore();

  const [cows, setCows] = useState<CowSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function loadCows() {
      setIsLoading(true);
      try {
        const res = await cowsService.listCows();
        if (res && res.cows) {
          setCows(res.cows);
        }
      } catch (err) {
        // Fallback to local 8 demo profiles if API error
        const fallback: CowSummary[] = DEMO_COW_PROFILES.map((p) => ({
          ...p,
          status: 'waiting_for_sensor_data',
          has_live_telemetry: false,
          last_received_at: null,
          seconds_since_last_reading: null,
          total_readings: 0,
          latest_behaviour: null,
          alerts_count: 0,
          is_stale: false,
        }));
        setCows(fallback);
      } finally {
        setIsLoading(false);
      }
    }
    loadCows();
  }, [isDemoMode]);

  const filteredCows = cows.filter((cow) => {
    const matchesSearch =
      cow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cow.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cow.breed.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cow.tag.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'online') return cow.status === 'online';
    if (statusFilter === 'stale') return cow.status === 'stale';
    if (statusFilter === 'waiting') return cow.status === 'waiting_for_sensor_data' || cow.status === 'offline';
    return true;
  });

  const getStatusBadge = (status: string) => {
    let variant: ChipVariant = 'neutral';
    let label = 'Waiting';

    if (status === 'online') {
      variant = 'success';
      label = 'Online';
    } else if (status === 'stale') {
      variant = 'warning';
      label = 'Stale';
    } else if (status === 'offline') {
      variant = 'danger';
      label = 'Offline';
    }

    return <Chip label={label} variant={variant} dot />;
  };

  const handleSelectCow = (cowId: string) => {
    setSelectedCowId(cowId);
    navigate(`/cows/${cowId}`);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Herd Registry & Collar Status
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          Registered dairy cattle, live hardware status, and real-time activity indicators.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, breed, or tag..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-farm-border dark:border-farm-darkBorder bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {['all', 'online', 'stale', 'waiting'].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                type="button"
                className={`px-3 py-1 rounded-xl text-xs font-medium capitalize transition-colors ${
                  statusFilter === f
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Cows Grid */}
      {isLoading ? (
        <LoadingSkeleton className="h-40" rows={4} />
      ) : filteredCows.length === 0 ? (
        <Card className="py-12 text-center text-gray-500 text-xs">
          No cattle match the current search and filter criteria.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCows.map((cow) => (
            <Card
              key={cow.id}
              onClick={() => handleSelectCow(cow.id)}
              className="cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-600 transition-all hover:shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-xl">
                      🐄
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        {cow.name}
                      </h3>
                      <span className="text-xs text-gray-500 font-mono block">
                        {cow.id}
                      </span>
                    </div>
                  </div>
                  {getStatusBadge(cow.status)}
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Breed:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{cow.breed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Collar Device:</span>
                    <span className="font-mono text-gray-800 dark:text-gray-200">{cow.deviceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latest Activity:</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 capitalize">
                      {cow.latest_behaviour || 'Awaiting packets'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Received:</span>
                    <span className="font-mono text-gray-800 dark:text-gray-200">
                      {formatRelativeSeconds(cow.seconds_since_last_reading)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-farm-border dark:border-farm-darkBorder flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                <span>View Cow Details</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

