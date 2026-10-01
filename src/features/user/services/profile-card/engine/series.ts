import { toParisDayYMD } from '../../../../../shared/time/day-split';

export interface DailyTotal {
  date: Date;
  total: number;
}

/** Les `days` derniers jours de Paris, du plus ancien à aujourd'hui, midi UTC. */
export function parisDays(days: number, now = new Date()): Date[] {
  const [year, month, day] = toParisDayYMD(now).split('-').map(Number);
  return Array.from({ length: days }, (_, i) => new Date(Date.UTC(year, month - 1, day - (days - 1 - i), 12)));
}

/** Somme par jour de Paris, jours vides compris : plusieurs entrées un même jour s'additionnent. */
export function dailyTotals(entries: { date: Date; amount: number }[], days: number, now = new Date()): DailyTotal[] {
  const byDay = new Map<string, number>();
  for (const entry of entries) {
    const key = toParisDayYMD(new Date(entry.date));
    byDay.set(key, (byDay.get(key) ?? 0) + entry.amount);
  }
  return parisDays(days, now).map(date => ({ date, total: byDay.get(toParisDayYMD(date)) ?? 0 }));
}

/**
 * Solde en fin de chaque jour, reconstitué à rebours depuis le solde actuel : chaque
 * mouvement postérieur à un jour est retiré du solde de ce jour-là.
 */
export function balanceHistory(balance: number, movements: { date: Date; amount: number }[], days: number, now = new Date()): number[] {
  const perDay = dailyTotals(movements, days, now);
  const result = new Array<number>(days);
  let running = balance;
  for (let i = days - 1; i >= 0; i--) {
    result[i] = running;
    running -= perDay[i].total;
  }
  return result;
}
