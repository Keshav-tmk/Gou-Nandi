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
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          About SmartLivestock Dairy Farm
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          Architectural overview of the genuine IoT collar pipeline and five-module AI inference system.
        </p>
      </div>

      {/* Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hardware Collar */}
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                ESP32 IoT Smart Collar
              </h3>
              <p className="text-xs text-gray-500">Inertial Sensor Node</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            Equipped with an MPU-6050 6-axis IMU capturing tri-axial acceleration and angular velocity at 10 Hz. Readings are packed into JSON packets and transmitted wirelessly over local Wi-Fi directly to the FastAPI backend.
          </p>
        </Card>

        {/* Backend & Ingestion */}
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Python 3.12 FastAPI Server
              </h3>
              <p className="text-xs text-gray-500">Telemetry Ingestion Engine</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            Validates incoming packets, logs telemetry to durable local JSONL storage, maintains per-cow rolling buffers, and computes connection freshness using server received_at timestamps.
          </p>
        </Card>

        {/* Five AI Modules */}
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Five-Module Scikit-Learn Engine
              </h3>
              <p className="text-xs text-gray-500">Multi-Task Health Screening</p>
            </div>
          </div>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
            <li><strong>Behaviour:</strong> Random Forest classifying grazing, resting, walking.</li>
            <li><strong>Anomaly:</strong> Isolation Forest baseline monitoring.</li>
            <li><strong>Rumination:</strong> Chewing pattern and cud cadence classifier.</li>
            <li><strong>Estrus:</strong> Mounting event and activity surge detection.</li>
            <li><strong>Lameness:</strong> Locomotion scoring via gait jerk asymmetry.</li>
          </ul>
        </Card>

        {/* Minimalist Dashboard */}
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                React 18 & TypeScript UI
              </h3>
              <p className="text-xs text-gray-500">Real-Time Operational Cockpit</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            Atomic non-overlapping polling against <code>/dashboard/api/live</code>, pure Recharts waveform plotting, full light/dark theme persistence, responsive mobile drawer, and robust offline/demo state separation.
          </p>
        </Card>
      </div>
    </div>
  );
};

