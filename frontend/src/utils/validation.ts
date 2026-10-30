// ============================================================
// SmartLivestock AI — Validation and Normalization Utilities
// ============================================================

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeCowId(cowId?: string | null): string {
  if (!cowId) return 'COW-001';
  const clean = cowId.trim().toUpperCase();
  if (clean.startsWith('COW') && !clean.startsWith('COW-')) {
    return 'COW-' + clean.substring(3);
  }
  return clean;
}

export function isFiniteNumber(val: any): boolean {
  return typeof val === 'number' && Number.isFinite(val);
}

