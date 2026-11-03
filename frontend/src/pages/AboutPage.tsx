// ============================================================
// SmartLivestock AI — System Architecture & About Page (/about)
// ============================================================

import React from 'react';
import { Card } from '../components/common/Card';
import { SectionHeader } from '../components/common/SectionHeader';
import { Cpu, HardDrive, Brain, Activity, ShieldCheck, Radio } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#263238] dark:text-white tracking-tight">
          About GouNandi Dairy Farm
        </h1>
        <p className="text-xs sm:text-sm text-[#607067] dark:text-gray-400 mt-1">
          Architectural overview of the genuine IoT collar pipeline and five-module AI inference system.
        </p>
      </div>

      {/* Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hardware Collar */}
        <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-[#E8F5E9] dark:bg-emerald-950/60 text-[#2E7D32] dark:text-emerald-300 border border-[#C8E6C9]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#263238] dark:text-white">
                ESP32 IoT Smart Collar
              </h3>
              <p className="text-xs text-[#607067]">Inertial Sensor Node</p>
            </div>
          </div>
          <p className="text-xs text-[#607067] dark:text-gray-400 leading-relaxed">
            Equipped with an MPU-6050 6-axis IMU capturing tri-axial acceleration and angular velocity at 10 Hz. Readings are packed into JSON packets and transmitted wirelessly over local Wi-Fi directly to the FastAPI backend.
          </p>
        </Card>

        {/* Backend & Ingestion */}
        <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-[#E3F2FD] dark:bg-blue-950/60 text-[#1976D2] dark:text-blue-300 border border-[#BBDEFB]">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#263238] dark:text-white">
                Python 3.12 FastAPI Server
              </h3>
              <p className="text-xs text-[#607067]">Telemetry Ingestion Engine</p>
            </div>
          </div>
          <p className="text-xs text-[#607067] dark:text-gray-400 leading-relaxed">
            Validates incoming packets, logs telemetry to durable local JSONL storage, maintains per-cow rolling buffers, and computes connection freshness using server received_at timestamps.
          </p>
        </Card>

        {/* Five AI Modules */}
        <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-[#F3E5F5] dark:bg-purple-950/60 text-[#7B1FA2] dark:text-purple-300 border border-[#E1BEE7]">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#263238] dark:text-white">
                Five-Module Scikit-Learn Engine
              </h3>
              <p className="text-xs text-[#607067]">Multi-Task Health Screening</p>
            </div>
          </div>
          <ul className="text-xs text-[#607067] dark:text-gray-400 space-y-1 list-disc list-inside">
            <li><strong>Behaviour:</strong> Random Forest classifying grazing, resting, walking.</li>
            <li><strong>Anomaly:</strong> Isolation Forest baseline monitoring.</li>
            <li><strong>Rumination:</strong> Chewing pattern and cud cadence classifier.</li>
            <li><strong>Estrus:</strong> Mounting event and activity surge detection.</li>
            <li><strong>Lameness:</strong> Locomotion scoring via gait jerk asymmetry.</li>
          </ul>
        </Card>

        {/* Minimalist Dashboard */}
        <Card className="p-5 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-[#FFF8E1] dark:bg-amber-950/60 text-[#B7791F] dark:text-amber-300 border border-[#FFE082]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#263238] dark:text-white">
                React 18 & TypeScript UI
              </h3>
              <p className="text-xs text-[#607067]">Real-Time Operational Cockpit</p>
            </div>
          </div>
          <p className="text-xs text-[#607067] dark:text-gray-400 leading-relaxed">
            Atomic non-overlapping polling against <code>/dashboard/api/live</code>, pure Recharts waveform plotting, full light/dark theme persistence, responsive mobile drawer, and robust offline/demo state separation.
          </p>
        </Card>
      </div>
    </div>
  );
};

