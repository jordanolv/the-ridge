const number = new Intl.NumberFormat('fr-FR');

export const formatNumber = (value: number) => number.format(Math.round(value));

export const plural = (count: number, word: string) => `${formatNumber(count)} ${word}${count > 1 ? 's' : ''}`;

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 6 || hour >= 18) return 'Bonsoir';
  return 'Bonjour';
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

const relative = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });

export function timeAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.round((timestamp - now) / 60_000);
  if (minutes > -1) return "à l'instant";
  if (minutes > -60) return relative.format(minutes, 'minute');
  return relative.format(Math.round(minutes / 60), 'hour');
}
