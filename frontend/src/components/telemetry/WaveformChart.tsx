// ============================================================
// GouNandi — Live IMU Collar Motion Reader (6-DOF Telemetry)
// ============================================================

import React, { useState } from 'react';
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
import { Activity, Radio, Cpu, Rotate3d, Compass } from 'lucide-react';

interface WaveformChartProps {
  data: TelemetryPoint[];
  cowId: string;
  isLive?: boolean;
}

type ViewMode = 'accel' | 'gyro' | 'dual';

export const WaveformChart: React.FC<WaveformChartProps> = ({ data, cowId, isLive }) => {
  const [mode, setMode] = useState<ViewMode>('accel');
  const hasData = data && data.length > 0;

  const latest = hasData ? data[data.length - 1] : null;

  // Calculate magnitudes if latest reading exists
  const accelMag = latest
    ? Math.sqrt(latest.accel_x ** 2 + latest.accel_y ** 2 + latest.accel_z ** 2).toFixed(2)
    : '--';
  const gyroMag =
    latest && latest.gyro_x !== undefined && latest.gyro_y !== undefined && latest.gyro_z !== undefined
      ? Math.sqrt(latest.gyro_x ** 2 + latest.gyro_y ** 2 + latest.gyro_z ** 2).toFixed(1)
      : '--';

  return (
    <Card className="mb-6 border border-[#E3E9E2] dark:border-farm-darkBorder bg-white dark:bg-farm-darkCard shadow-xs">
      {/* Header bar with Mode Selector and Live Stream Indicator */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4 pb-4 border-b border-[#E3E9E2] dark:border-farm-darkBorder">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-extrabold text-[#263238] dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2E7D32]" />
              Live IMU Collar Motion Reader
            </h3>
            {hasData && isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E7D32] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2E7D32]"></span>
                </span>
                ESP32 STREAMING LIVE
              </span>
            ) : hasData ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FFF8E1] text-[#B7791F] border border-[#FFE082] dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                BUFFERED TELEMETRY (IDLE)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F1F5F0] text-[#607067] border border-[#E3E9E2] dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                AWAITING SENSOR TELEMETRY
              </span>
            )}
          </div>
          <p className="text-xs text-[#607067] dark:text-gray-400 mt-1">
            Real-time 6-axis inertial motion telemetry (MPU-6050 @ 10 Hz) • Showing last {data.length} buffered points for{' '}
            <span className="font-semibold text-[#2E7D32]">{cowId}</span>
          </p>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center gap-1 bg-[#F7F9F4] dark:bg-gray-800/60 p-1 rounded-xl border border-[#E3E9E2] dark:border-gray-700 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setMode('accel')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'accel'
                ? 'bg-white dark:bg-farm-darkCard text-[#2E7D32] shadow-xs'
                : 'text-[#607067] dark:text-gray-400 hover:text-[#263238] dark:hover:text-white'
            }`}
          >
            Accelerometer (±2g)
          </button>
          <button
            type="button"
            onClick={() => setMode('gyro')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'gyro'
                ? 'bg-white dark:bg-farm-darkCard text-[#1976D2] shadow-xs'
                : 'text-[#607067] dark:text-gray-400 hover:text-[#263238] dark:hover:text-white'
            }`}
          >
            Gyroscope (°/s)
          </button>
          <button
            type="button"
            onClick={() => setMode('dual')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'dual'
                ? 'bg-white dark:bg-farm-darkCard text-[#7B1FA2] shadow-xs'
                : 'text-[#607067] dark:text-gray-400 hover:text-[#263238] dark:hover:text-white'
            }`}
          >
            6-DOF Combined
          </button>
        </div>
      </div>

      {/* Live Value Pill Readouts */}
      {hasData && latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
          <div className="p-2 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40 border border-[#E3E9E2] dark:border-gray-700">
            <span className="text-[10px] font-bold text-[#607067] dark:text-gray-400 block uppercase">Accel X</span>
            <span className="text-xs font-extrabold text-[#2E7D32]">
              {latest.accel_x >= 0 ? `+${latest.accel_x.toFixed(3)}` : latest.accel_x.toFixed(3)} g
            </span>
          </div>
          <div className="p-2 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40 border border-[#E3E9E2] dark:border-gray-700">
            <span className="text-[10px] font-bold text-[#607067] dark:text-gray-400 block uppercase">Accel Y</span>
            <span className="text-xs font-extrabold text-[#1976D2]">
              {latest.accel_y >= 0 ? `+${latest.accel_y.toFixed(3)}` : latest.accel_y.toFixed(3)} g
            </span>
          </div>
          <div className="p-2 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40 border border-[#E3E9E2] dark:border-gray-700">
            <span className="text-[10px] font-bold text-[#607067] dark:text-gray-400 block uppercase">Accel Z</span>
            <span className="text-xs font-extrabold text-[#F9A825]">
              {latest.accel_z >= 0 ? `+${latest.accel_z.toFixed(3)}` : latest.accel_z.toFixed(3)} g
            </span>
          </div>
          <div className="p-2 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40 border border-[#E3E9E2] dark:border-gray-700">
            <span className="text-[10px] font-bold text-[#607067] dark:text-gray-400 block uppercase">|Accel| Mag</span>
            <span className="text-xs font-extrabold text-[#263238] dark:text-white">
              {accelMag} g
            </span>
          </div>
          <div className="p-2 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40 border border-[#E3E9E2] dark:border-gray-700">
            <span className="text-[10px] font-bold text-[#607067] dark:text-gray-400 block uppercase">Gyro X (Pitch)</span>
            <span className="text-xs font-extrabold text-[#7B1FA2]">
              {latest.gyro_x !== undefined ? `${latest.gyro_x.toFixed(1)}°/s` : '--'}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40 border border-[#E3E9E2] dark:border-gray-700">
            <span className="text-[10px] font-bold text-[#607067] dark:text-gray-400 block uppercase">Gyro Y (Roll)</span>
            <span className="text-xs font-extrabold text-[#00897B]">
              {latest.gyro_y !== undefined ? `${latest.gyro_y.toFixed(1)}°/s` : '--'}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40 border border-[#E3E9E2] dark:border-gray-700">
            <span className="text-[10px] font-bold text-[#607067] dark:text-gray-400 block uppercase">Gyro Z (Yaw)</span>
            <span className="text-xs font-extrabold text-[#D84343]">
              {latest.gyro_z !== undefined ? `${latest.gyro_z.toFixed(1)}°/s` : '--'}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40 border border-[#E3E9E2] dark:border-gray-700">
            <span className="text-[10px] font-bold text-[#607067] dark:text-gray-400 block uppercase">|Gyro| Mag</span>
            <span className="text-xs font-extrabold text-[#263238] dark:text-white">
              {gyroMag} °/s
            </span>
          </div>
        </div>
      )}

      {/* Main Graph Area or Empty State */}
      {!hasData ? (
        <div className="py-10 px-4 text-center">
          <EmptyState
            icon={<Activity className="w-10 h-10 text-[#2E7D32]" />}
            title="Waiting for ESP32 Collar Sensor Telemetry"
            description={`No IMU telemetry points buffered yet for ${cowId}. When the ESP32 transmits, genuine waveform points will plot automatically.`}
          />
          <div className="mt-5 max-w-lg mx-auto p-4 rounded-xl bg-[#F7F9F4] dark:bg-gray-800/40 border border-[#E3E9E2] dark:border-gray-700 text-left text-xs text-[#607067] dark:text-gray-400">
            <p className="font-bold text-[#263238] dark:text-white mb-1.5 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#2E7D32]" />
              How to connect your ESP32 collar to this reader:
            </p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                <span className="font-semibold text-[#263238] dark:text-gray-200">Via USB Serial Cable:</span> Close Arduino Serial Monitor and run:{' '}
                <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[11px] text-[#2E7D32]">
                  python iot/serial_bridge.py
                </code>
              </li>
              <li>
                <span className="font-semibold text-[#263238] dark:text-gray-200">Via Wi-Fi HTTP:</span> POST JSON packets to:{' '}
                <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[11px] text-[#1976D2]">
                  http://&lt;PC_IP&gt;:8000/sensor-data
                </code>
              </li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E9E2" opacity={0.6} />
              <XAxis dataKey="timeFormatted" stroke="#607067" fontSize={11} tickLine={false} />

              {/* Y-Axes based on selected mode */}
              {mode === 'accel' && (
                <YAxis domain={[-2.5, 2.5]} stroke="#607067" fontSize={11} tickLine={false} unit="g" />
              )}
              {mode === 'gyro' && (
                <YAxis domain={['auto', 'auto']} stroke="#607067" fontSize={11} tickLine={false} unit="°/s" />
              )}
              {mode === 'dual' && (
                <>
                  <YAxis yAxisId="left" domain={[-2.5, 2.5]} stroke="#2E7D32" fontSize={11} tickLine={false} unit="g" />
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#1976D2" fontSize={11} tickLine={false} unit="°/s" />
                </>
              )}

              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '0.75rem',
                  border: '1px solid #E3E9E2',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />

              {/* Accelerometer Traces */}
              {(mode === 'accel' || mode === 'dual') && (
                <>
                  <Line
                    yAxisId={mode === 'dual' ? 'left' : undefined}
                    type="monotone"
                    dataKey="accel_x"
                    name="Lateral (Accel X)"
                    stroke="#2E7D32"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#2E7D32' }}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId={mode === 'dual' ? 'left' : undefined}
                    type="monotone"
                    dataKey="accel_y"
                    name="Dorso-Ventral (Accel Y)"
                    stroke="#1976D2"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#1976D2' }}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId={mode === 'dual' ? 'left' : undefined}
                    type="monotone"
                    dataKey="accel_z"
                    name="Cranio-Caudal (Accel Z)"
                    stroke="#F9A825"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: '#F9A825' }}
                    isAnimationActive={false}
                  />
                </>
              )}

              {/* Gyroscope Traces */}
              {(mode === 'gyro' || mode === 'dual') && (
                <>
                  <Line
                    yAxisId={mode === 'dual' ? 'right' : undefined}
                    type="monotone"
                    dataKey="gyro_x"
                    name="Pitch Rate (Gyro X)"
                    stroke="#7B1FA2"
                    strokeWidth={mode === 'dual' ? 1.5 : 2}
                    strokeDasharray={mode === 'dual' ? '4 4' : undefined}
                    dot={{ r: 2.5, fill: '#7B1FA2' }}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId={mode === 'dual' ? 'right' : undefined}
                    type="monotone"
                    dataKey="gyro_y"
                    name="Roll Rate (Gyro Y)"
                    stroke="#00897B"
                    strokeWidth={mode === 'dual' ? 1.5 : 2}
                    strokeDasharray={mode === 'dual' ? '4 4' : undefined}
                    dot={{ r: 2.5, fill: '#00897B' }}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId={mode === 'dual' ? 'right' : undefined}
                    type="monotone"
                    dataKey="gyro_z"
                    name="Yaw Rate (Gyro Z)"
                    stroke="#D84343"
                    strokeWidth={mode === 'dual' ? 1.5 : 2}
                    strokeDasharray={mode === 'dual' ? '4 4' : undefined}
                    dot={{ r: 2.5, fill: '#D84343' }}
                    isAnimationActive={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
