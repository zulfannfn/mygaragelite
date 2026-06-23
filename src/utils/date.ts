export function getTimestamp(): number {
  return Date.now();
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(timestamp: number): string {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return (
    d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );
}

export function formatTime(timestamp: number): string {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Durasi pengerjaan dalam format ringkas (mis. "2j 15m", "45m", "1hr 3j").
 * Dihitung dari `start` sampai `end`.
 */
export function formatDuration(start: number, end: number): string {
  let ms = end - start;
  if (!start || ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}hr ${hours}j`;
  if (hours > 0) return `${hours}j ${minutes}m`;
  return `${minutes}m`;
}

export function formatRelative(timestamp: number): string {
  if (!timestamp) return '-';
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 7) return `${days} hari lalu`;
  return formatDate(timestamp);
}

export function startOfDay(timestamp: number = Date.now()): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(timestamp: number = Date.now()): number {
  const d = new Date(timestamp);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function startOfMonth(timestamp: number = Date.now()): number {
  const d = new Date(timestamp);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfMonth(timestamp: number = Date.now()): number {
  const d = new Date(timestamp);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function addDays(timestamp: number, days: number): number {
  return timestamp + days * 86400000;
}

export function addMonths(timestamp: number, months: number): number {
  const d = new Date(timestamp);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfTargetMonth));
  return d.getTime();
}

export function daysBetween(a: number, b: number): number {
  return Math.floor((b - a) / 86400000);
}

export function startOfYear(timestamp: number = Date.now()): number {
  const d = new Date(timestamp);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfYear(timestamp: number = Date.now()): number {
  const d = new Date(timestamp);
  d.setMonth(11, 31);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
