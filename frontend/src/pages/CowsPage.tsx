// ============================================================
// GouNandi — Herd Monitoring & Registry Page (/cows)
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
import {
  Search,
  Plus,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Radio,
  X,
  Tag,
  Scale,
  Calendar,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { DEMO_COW_PROFILES } from '../data/cows';

export const CowsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSelectedCowId, isDemoMode } = useAppStore();

  const [cows, setCows] = useState<CowSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newCow, setNewCow] = useState({
    name: '',
    tag: '',
    breed: 'Gir',
    weight_kg: 420,
    deviceId: 'COLLAR-ESP32-009',
  });

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
        const fallback: CowSummary[] = DEMO_COW_PROFILES.map((p, idx) => ({
          ...p,
          status: idx === 0 ? 'online' : 'waiting_for_sensor_data',
          has_live_telemetry: idx === 0,
          last_received_at: null,
          seconds_since_last_reading: idx === 0 ? 1 : null,
          total_readings: idx === 0 ? 120 : 0,
          latest_behaviour: idx === 0 ? 'grazing' : idx % 2 === 0 ? 'resting' : 'ruminating',
          alerts_count: idx === 2 ? 1 : 0,
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
    if (statusFilter === 'healthy') return cow.alerts_count === 0 && cow.status !== 'offline';
    if (statusFilter === 'attention') return cow.alerts_count > 0 || cow.status === 'stale';
    if (statusFilter === 'critical') return cow.alerts_count > 1;
    if (statusFilter === 'online') return cow.status === 'online';
    return true;
  });

  const handleSelectCow = (cowId: string) => {
    setSelectedCowId(cowId);
    navigate(`/cows/${cowId}`);
  };

  const handleAddAnimalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCow.name.trim()) return;

    try {
      const res = await cowsService.addCow({
        name: newCow.name.trim(),
        tag: newCow.tag.trim() || `TAG-${100 + cows.length + 1}`,
        breed: newCow.breed,
        weight_kg: Number(newCow.weight_kg) || 420,
        deviceId: newCow.deviceId.trim() || `ESP32_${Date.now() % 1000}`,
      });
      if (res && res.cow) {
        setCows([res.cow, ...cows]);
      }
    } catch {
      const nextId = `COW-${String(cows.length + 1).padStart(3, '0')}`;
      const created: CowSummary = {
        id: nextId,
        name: newCow.name,
        tag: newCow.tag || `TAG-${100 + cows.length + 1}`,
        breed: newCow.breed,
        deviceId: newCow.deviceId,
        date_of_birth: new Date().toISOString().split('T')[0],
        lactation_stage: 'Mid-lactation',
        weight_kg: Number(newCow.weight_kg) || 420,
        status: 'waiting_for_sensor_data',
        has_live_telemetry: false,
        last_received_at: null,
        seconds_since_last_reading: null,
        total_readings: 0,
        latest_behaviour: 'resting',
        alerts_count: 0,
        is_stale: false,
      };
      setCows([created, ...cows]);
    }
    setIsAddModalOpen(false);
    setNewCow({
      name: '',
      tag: '',
      breed: 'Gir',
      weight_kg: 420,
      deviceId: `COLLAR-ESP32-00${cows.length + 2}`,
    });
  };

  const getAgeDisplay = (dob?: string) => {
    if (!dob) return '3.0 yrs';
    try {
      const birth = new Date(dob);
      const diffMonths = (Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
      const yrs = (diffMonths / 12).toFixed(1);
      return `${yrs} yrs`;
    } catch {
      return '3.0 yrs';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Add Animal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#263238] dark:text-white tracking-tight">
            Herd Monitoring & Cattle Registry
          </h1>
          <p className="text-xs sm:text-sm text-[#607067] dark:text-gray-400 mt-0.5">
            Real-time livestock registry, physiological state, and wireless collar telemetry
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-bold shadow-xs transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add New Animal
        </button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3 sm:p-4 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-[#607067] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, breed, or tag..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-farm-darkBorder bg-[#F7F9F4] dark:bg-gray-800/50 text-[#263238] dark:text-white placeholder-[#607067] focus:outline-hidden focus:ring-1 focus:ring-[#2E7D32]"
            />
          </div>

          {/* Compact Filter Chips */}
          <div className="flex items-center gap-1.5 self-start md:self-auto flex-wrap">
            {[
              { id: 'all', label: 'All Animals' },
              { id: 'healthy', label: 'Healthy' },
              { id: 'attention', label: 'Needs Attention' },
              { id: 'critical', label: 'Critical' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                type="button"
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-xs'
                    : 'bg-[#F7F9F4] hover:bg-[#E8F5E9] text-[#607067] hover:text-[#2E7D32] border-[#E3E9E2] dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Compact Horizontal Cow Rows */}
      {isLoading ? (
        <LoadingSkeleton className="h-20" rows={6} />
      ) : filteredCows.length === 0 ? (
        <Card className="py-12 text-center text-[#607067] text-xs border border-[#E3E9E2]">
          No cattle match the current search and filter criteria.
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredCows.map((cow) => {
            const hasAlerts = cow.alerts_count > 0;
            const isOnline = cow.status === 'online';
            const isStale = cow.status === 'stale';

            return (
              <div
                key={cow.id}
                onClick={() => handleSelectCow(cow.id)}
                className="group cursor-pointer p-3.5 sm:p-4 rounded-xl border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard hover:border-[#2E7D32] hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                {/* Left Section: Avatar + Name + Tag + Breed */}
                <div className="flex items-center gap-3.5 min-w-[240px]">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-2xl bg-[#E8F5E9] dark:bg-emerald-950/40 flex items-center justify-center text-xl border border-[#C8E6C9] dark:border-emerald-800 shrink-0 select-none">
                      🐄
                    </div>
                    {/* Live status dot */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${
                        isOnline ? 'bg-[#2E7D32]' : isStale ? 'bg-[#F9A825]' : 'bg-[#607067]'
                      }`}
                      title={isOnline ? 'Sensor Online' : isStale ? 'Stale' : 'Waiting for telemetry'}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#263238] dark:text-white group-hover:text-[#2E7D32] transition-colors">
                        {cow.name}
                      </h3>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#F7F9F4] dark:bg-gray-800 text-[#607067] font-mono border border-[#E3E9E2] dark:border-gray-700">
                        {cow.id}
                      </span>
                    </div>
                    <div className="text-xs text-[#607067] dark:text-gray-400 flex items-center gap-2 mt-0.5">
                      <span>{cow.breed}</span>
                      <span>•</span>
                      <span className="font-mono">{cow.tag}</span>
                    </div>
                  </div>
                </div>

                {/* Middle Section: Metrics (Age, Weight, Activity) */}
                <div className="grid grid-cols-3 sm:flex sm:items-center gap-4 sm:gap-6 text-xs text-[#607067] dark:text-gray-400">
                  <div>
                    <span className="block text-[10px] text-[#607067]">Age</span>
                    <span className="font-semibold text-[#263238] dark:text-gray-200">
                      {getAgeDisplay(cow.date_of_birth)}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] text-[#607067]">Weight</span>
                    <span className="font-semibold text-[#263238] dark:text-gray-200">
                      {cow.weight_kg ? `${cow.weight_kg} kg` : '420 kg'}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] text-[#607067]">Current Behaviour</span>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                      {cow.latest_behaviour || 'Grazing'}
                    </span>
                  </div>
                </div>

                {/* Right Section: Health Status Badge + Arrow */}
                <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-[#E3E9E2]/60">
                  <div>
                    {hasAlerts ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#F9A825]/15 text-[#F9A825] border border-[#F9A825]/30">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Needs Attention
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Healthy
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-xs font-semibold text-[#607067] group-hover:text-[#2E7D32] transition-colors">
                    <span className="hidden sm:inline mr-1 text-[11px]">Profile</span>
                    <ChevronRight className="w-4 h-4 text-[#607067] group-hover:text-[#2E7D32] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Animal Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md p-6 bg-white dark:bg-farm-darkCard border border-[#E3E9E2] dark:border-farm-darkBorder shadow-xl rounded-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#E3E9E2] dark:border-farm-darkBorder">
              <h2 className="text-base font-bold text-[#263238] dark:text-white">
                Add New Livestock Animal
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                type="button"
                className="p-1 rounded-lg text-[#607067] hover:bg-[#F7F9F4] dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAnimalSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[#607067] font-semibold mb-1">Animal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Radhika"
                  value={newCow.name}
                  onChange={(e) => setNewCow({ ...newCow, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#607067] font-semibold mb-1">Tag ID</label>
                  <input
                    type="text"
                    placeholder="e.g. TAG-109"
                    value={newCow.tag}
                    onChange={(e) => setNewCow({ ...newCow, tag: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#607067] font-semibold mb-1">Breed</label>
                  <select
                    value={newCow.breed}
                    onChange={(e) => setNewCow({ ...newCow, breed: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                  >
                    <option value="Gir">Gir</option>
                    <option value="Sahiwal">Sahiwal</option>
                    <option value="Red Sindhi">Red Sindhi</option>
                    <option value="Tharparkar">Tharparkar</option>
                    <option value="Kankrej">Kankrej</option>
                    <option value="Rathi">Rathi</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#607067] font-semibold mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={newCow.weight_kg}
                    onChange={(e) => setNewCow({ ...newCow, weight_kg: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#607067] font-semibold mb-1">Collar Device ID</label>
                  <input
                    type="text"
                    value={newCow.deviceId}
                    onChange={(e) => setNewCow({ ...newCow, deviceId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E3E9E2] dark:border-gray-700 text-[#607067] font-semibold hover:bg-[#F7F9F4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold shadow-xs"
                >
                  Save Animal
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};


