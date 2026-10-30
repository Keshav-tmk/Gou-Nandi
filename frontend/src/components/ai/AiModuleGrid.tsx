// ============================================================
// SmartLivestock AI — Five-Module AI Grid Component
// ============================================================

import React from 'react';
import { AllAiModulesState } from '../../types/ai';
import { AiModuleCard } from './AiModuleCard';

interface AiModuleGridProps {
  modules: AllAiModulesState;
  cowId: string;
}

export const AiModuleGrid: React.FC<AiModuleGridProps> = ({ modules }) => {
  const { behaviour, anomaly, rumination, estrus, lameness } = modules;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
      {/* 1. Behaviour */}
      <AiModuleCard
        moduleIndex={1}
        title="Behaviour"
        icon="🐄"
        result={behaviour}
        primaryValue={behaviour.label}
        modelVersion={behaviour.modelVersion}
        detailRows={
          behaviour.probabilities
            ? Object.entries(behaviour.probabilities).map(([k, v]) => ({
                label: k.charAt(0).toUpperCase() + k.slice(1),
                value: `${(v * 100).toFixed(1)}%`,
              }))
            : []
        }
      />

      {/* 2. Anomaly */}
      <AiModuleCard
        moduleIndex={2}
        title="Anomaly Engine"
        icon="🛡️"
        result={anomaly}
        primaryValue={anomaly.detected ? 'Unusual Activity' : 'Baseline Normal'}
        note={anomaly.interpretation}
        modelVersion={anomaly.modelVersion}
        detailRows={[
          { label: 'Decision Score', value: anomaly.score !== null ? anomaly.score?.toFixed(5) : '--' },
          { label: 'Baseline', value: 'Grazing distribution' },
        ]}
      />

      {/* 3. Rumination */}
      <AiModuleCard
        moduleIndex={3}
        title="Rumination"
        icon="🌾"
        result={rumination}
        primaryValue={rumination.isRuminating ? 'Active Chewing' : 'Not Ruminating'}
        note={rumination.interpretation}
        modelVersion={rumination.modelVersion}
        detailRows={[
          {
            label: 'Chewing Rhythm',
            value: rumination.chewingRhythmScore !== null ? (rumination.chewingRhythmScore * 100).toFixed(0) + '%' : '--',
          },
          {
            label: 'Probability',
            value: rumination.probability !== null ? (rumination.probability * 100).toFixed(1) + '%' : '--',
          },
        ]}
      />

      {/* 4. Estrus */}
      <AiModuleCard
        moduleIndex={4}
        title="Estrus / Heat"
        icon="🔍"
        result={estrus}
        primaryValue={estrus.riskLevel !== 'UNKNOWN' ? `${estrus.riskLevel} RISK` : '--'}
        note={estrus.interpretation}
        modelVersion={estrus.modelVersion}
        detailRows={[
          { label: 'Mounting Status', value: estrus.mountDetected ? 'Active Mount Detected' : 'No mounts' },
          { label: 'Surge Factor', value: estrus.activitySurge !== null ? estrus.activitySurge?.toFixed(3) : '--' },
        ]}
      />

      {/* 5. Lameness & Thermal */}
      <AiModuleCard
        moduleIndex={5}
        title="Locomotion"
        icon="🦵"
        result={lameness}
        primaryValue={lameness.locomotionScore !== null ? `Score ${lameness.locomotionScore} / 5.0` : '--'}
        note={lameness.interpretation}
        modelVersion={lameness.modelVersion}
        detailRows={[
          {
            label: 'Skin Temperature',
            value: lameness.contactTemperatureC !== null ? `${lameness.contactTemperatureC}°C` : 'Not configured',
          },
          {
            label: 'Gait Asymmetry',
            value: lameness.gaitAsymmetryIndex !== null ? lameness.gaitAsymmetryIndex.toFixed(3) : '--',
          },
        ]}
      />
    </div>
  );
};

