// ============================================================
// SmartLivestock AI — Hardware Architecture Specification Component
// ============================================================

import React from 'react';
import { Card } from '../common/Card';
import { HardDrive } from 'lucide-react';

interface SpecListProps {
  hasTemperatureSensor?: boolean;
}

export const SpecList: React.FC<SpecListProps> = ({ hasTemperatureSensor = false }) => {
  const specs = [
    { label: 'Microcontroller', value: 'ESP32-WROOM-32 (Dual Core 240MHz)' },
    { label: 'Inertial Sensor', value: 'MPU-6050 6-Axis IMU (Acc ±2g, Gyro ±250°/s)' },
    {
      label: 'Body Temperature',
      value: hasTemperatureSensor ? 'DS18B20 OneWire Contact Probe' : 'Not configured (MPU-6050 only)',
    },
    { label: 'Wireless Protocol', value: 'Wi-Fi 802.11 b/g/n (HTTP POST /sensor-data)' },
    { label: 'Sampling Rate', value: '10 Hz (approx. 2.0s transmission batch)' },
    { label: 'Power Source', value: '3.7V 2000mAh Rechargeable Li-Ion' },
  ];

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-2 pb-3 border-b border-farm-border dark:border-farm-darkBorder">
        <HardDrive className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          Hardware Architecture Specification
        </h3>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {specs.map((s, idx) => (
          <div key={idx} className="p-2.5 rounded-xl bg-gray-50 dark:bg-farm-darkBorder/40">
            <span className="text-xs text-gray-400 block">{s.label}</span>
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 block mt-0.5">
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

