const number = new Intl.NumberFormat('fr-FR');

export const formatNumber = (value: number) => number.format(Math.round(value));

/** Libellé court pour un point de graphique : « 2h », « 45m », « 30s ». */
export function formatDurationShort(seconds: number): string {
  if (!seconds || seconds <= 0) return '0';
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds)}s`;
}

/** Durée lisible : « 312h », « 4h 20m », « 12m ». */
export function formatDuration(seconds: number): string {
  const total = Math.floor(seconds || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours >= 100) return `${formatNumber(hours)}h`;
  if (hours >= 1) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes >= 1) return `${minutes}m`;
  return `${total}s`;
}

export function formatDate(date?: Date | string | null): string {
  if (!date) return '-';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '-';
  return value.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });
}

export const plural = (count: number, word: string) => `${formatNumber(count)} ${word}${count > 1 ? 's' : ''}`;
