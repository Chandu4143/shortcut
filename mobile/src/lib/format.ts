export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.max(0, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export function formatShortDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.max(0, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function formatCompactDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatArrival(secondsFromNow: number): string {
  const date = new Date(Date.now() + Math.max(0, secondsFromNow) * 1000);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function shortLabel(label: string, parts = 2): string {
  return label.split(',').map((part) => part.trim()).filter(Boolean).slice(0, parts).join(', ');
}

export function formatSaved(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function coordinatesLabel(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
