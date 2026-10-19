import { toParisDayYMD } from './day-split';

export function parisWeekKey(date: Date): string {
  const [y, m, d] = toParisDayYMD(date).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d));
  // ISO 8601 : la semaine appartient à l'année de son jeudi.
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7));
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
