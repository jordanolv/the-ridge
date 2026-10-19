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

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  if (hours >= 100 || minutes === 0) return `${formatNumber(hours)} h`;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

export const formatCompact = (value: number) => compact.format(value);

const UNIT_WORDS = { points: 'pt', messages: 'message', days: 'jour', mountains: 'sommet', parties: 'soirée' } as const;

export function formatStat(value: number, unit: keyof typeof UNIT_WORDS | 'seconds'): string {
  if (unit === 'seconds') return formatDuration(value);
  return plural(value, UNIT_WORDS[unit]);
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const hourFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const formatDay = (date: Date) => dayFormat.format(date);
export const formatDate = (timestamp: number) => dateFormat.format(timestamp);

const startOfDay = (timestamp: number) => new Date(timestamp).setHours(0, 0, 0, 0);

/** « ce soir · 21:00 », « demain · 18:30 », « samedi 24 oct. · 20:00 ». */
export function formatPartyDate(timestamp: number, now = Date.now()): string {
  const days = Math.round((startOfDay(timestamp) - startOfDay(now)) / 86_400_000);
  const hour = hourFormat.format(timestamp);
  if (days === 0) return `${new Date(timestamp).getHours() >= 18 ? 'Ce soir' : "Aujourd'hui"} · ${hour}`;
  if (days === 1) return `Demain · ${hour}`;
  if (days === -1) return `Hier · ${hour}`;
  return `${dayFormat.format(timestamp)} · ${hour}`;
}

export function timeUntil(timestamp: number, now = Date.now()): string {
  const minutes = Math.round((timestamp - now) / 60_000);
  if (minutes <= 0) return 'maintenant';
  if (minutes < 60) return relative.format(minutes, 'minute');
  if (minutes < 48 * 60) return relative.format(Math.round(minutes / 60), 'hour');
  return relative.format(Math.round(minutes / 1440), 'day');
}

export function elapsedSince(timestamp: number, now = Date.now()): string {
  return formatDuration(Math.max(0, (now - timestamp) / 1000));
}
