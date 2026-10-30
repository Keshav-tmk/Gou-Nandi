// ============================================================
// SmartLivestock AI — Utility Helpers (Plain JS)
// ============================================================

import { Colors } from '../styles/theme';

/** Format ISO timestamp to human-readable relative time */
export function timeAgo(isoString) {
  if (!isoString) return 'Never';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return isoString;
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString();
}

/** Format ISO timestamp to short time string (HH:MM:SS) */
export function formatTime(isoString) {
  if (!isoString) return '--:--:--';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Format ISO timestamp to date string (MMM D) */
export function formatDate(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

/** Format date string (YYYY-MM-DD) to short weekday label */
export function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString([], { weekday: 'short' });
}

/** Get user-friendly behaviour label */
export function getBehaviourDisplayName(b) {
  const map = {
    grazing: 'Grazing',
    walking: 'Walking',
    resting: 'Resting',
    head_nodding: 'Head Nodding',
    active_mounting: 'Active Mounting',
    standing: 'Standing',
    unknown: 'Unknown',
  };
  return map[b] || b || 'Unknown';
}

/** Get emoji for behaviour */
export function getBehaviourEmoji(b) {
  const map = {
    grazing: '🌾',
    walking: '🚶',
    resting: '😴',
    head_nodding: '🔄',
    active_mounting: '⚡',
    standing: '🧍',
    unknown: '❓',
  };
  return map[b] || '❓';
}

/** Get Lucide icon name for behaviour */
export function getBehaviourIcon(b) {
  const map = {
    grazing: 'Sprout',
    walking: 'Footprints',
    resting: 'Moon',
    head_nodding: 'RotateCw',
    active_mounting: 'Zap',
    standing: 'Activity',
    unknown: 'HelpCircle',
  };
  return map[b] || 'Activity';
}

/** Get color for behaviour */
export function getBehaviourColor(b) {
  const map = {
    grazing: '#2E7D32',
    walking: '#1976D2',
    resting: '#7B1FA2',
    head_nodding: '#F57C00',
    active_mounting: '#D84343',
    standing: '#0284C7',
    unknown: '#90A4AE',
  };
  return map[b] || '#90A4AE';
}

/** Get health status color */
export function getHealthStatusColor(status) {
  switch (status) {
    case 'healthy':
      return Colors.successGreen;
    case 'sick':
    case 'lame':
      return Colors.errorRed;
    case 'in_heat':
      return Colors.accentGold;
    case 'monitor':
      return Colors.warningAmber;
    default:
      return Colors.textLight;
  }
}

/** Get health status badge background */
export function getHealthStatusBg(status) {
  switch (status) {
    case 'healthy':
      return Colors.softGreenBg;
    case 'sick':
    case 'lame':
      return Colors.errorRedBg;
    case 'in_heat':
      return Colors.accentGoldBg;
    case 'monitor':
      return Colors.warningAmberBg;
    default:
      return Colors.divider;
  }
}

/** Get health status human readable label */
export function getHealthStatusLabel(status) {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'sick':
      return 'Sick';
    case 'lame':
      return 'Lame';
    case 'in_heat':
      return 'In Heat';
    case 'monitor':
      return 'Monitor';
    default:
      return 'Unknown';
  }
}

/** Severity colors */
export function getSeverityColor(sev) {
  switch (sev) {
    case 'critical':
      return Colors.errorRed;
    case 'high':
      return '#E65100';
    case 'medium':
      return Colors.warningAmber;
    case 'low':
      return Colors.infoBlue;
    default:
      return Colors.textSecondary;
  }
}

export function getSeverityBgColor(sev) {
  switch (sev) {
    case 'critical':
      return Colors.errorRedBg;
    case 'high':
      return '#FFF3E0';
    case 'medium':
      return Colors.warningAmberBg;
    case 'low':
      return Colors.infoBlueBg;
    default:
      return '#F5F5F5';
  }
}

export function getSeverityLabel(sev) {
  switch (sev) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High Risk';
    case 'medium':
      return 'Warning';
    case 'low':
      return 'Info';
    default:
      return 'Notice';
  }
}

/** Temperature format */
export function formatTemperature(celsius) {
  if (celsius === null || celsius === undefined || isNaN(celsius)) return '--';
  return `${Number(celsius).toFixed(1)}°C`;
}

/** Safe acceleration magnitude sqrt(ax^2 + ay^2 + az^2) */
export function calcAccelMagnitude(ax = 0, ay = 0, az = 0) {
  return Math.sqrt(ax * ax + ay * ay + az * az);
}
