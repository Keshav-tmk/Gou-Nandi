// ============================================================
// SmartLivestock AI — Live IMU Waveform Chart (Recharts)
// ============================================================

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card } from '../common/Card';
import { TelemetryPoint } from '../../types/telemetry';
import { EmptyState } from '../common/EmptyState';
import { Activity } from 'lucide-react';

interface WaveformChartProps {
  data: TelemetryPoint[];
  cowId: string;
}

export const WaveformChart: React.FC<WaveformChartProps> = ({ data, cowId }) => {
  const hasData = data && data.length > 0;

  return (
    <Card className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-farm-border dark:border-farm-darkBorder">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            Live IMU Collar Motion Waveform
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Real-time tri-axial accelerometer streams (±2.0g) • Showing last {data.length} readings for {cowId}
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="py-12">
          <EmptyState
            icon={<Activity className="w-8 h-8" />}
            title="Waiting for Live Sensor Readings"
            description={`No acceleration readings received yet for ${cowId}. When the ESP32 transmits, genuine waveform points will plot automatically.`}
          />
        </div>
      ) : (
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eae2" opacity={0.6} />
              <XAxis
                dataKey="timeFormatted"
                stroke="#888888"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                domain={[-2.5, 2.5]}
                stroke="#888888"
                fontSize={11}
                tickLine={false}
                unit="g"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '0.75rem',
                  border: '1px solid #e5eae2',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                iconType="circle"
              />
              <Line
                type="monotone"
                dataKey="accel_x"
                name="Lateral (Accel X)"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981' }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="accel_y"
                name="Dorso-Ventral (Accel Y)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: '#3b82f6' }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="accel_z"
                name="Cranio-Caudal (Accel Z)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f59e0b' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};

