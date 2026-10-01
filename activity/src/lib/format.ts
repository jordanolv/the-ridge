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
