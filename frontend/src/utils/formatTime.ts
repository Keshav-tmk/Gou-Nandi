// ============================================================
// SmartLivestock AI — Time Formatting Utilities
// ============================================================

export function formatTimeOnly(isoString?: string | null): string {
  if (!isoString) return '--:--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '--:--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return '--:--:--';
  }
}

export function formatRelativeSeconds(seconds?: number | null): string {
  if (seconds === null || seconds === undefined) return '--';
  if (seconds < 1.0) return 'Just now';
  if (seconds < 60) return `${seconds.toFixed(1)}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '--';
  }
}

