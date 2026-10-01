import { box, image, text, type CardNode } from '../engine/elements';
import { formatDurationShort } from '../engine/format';
import type { DailyTotal } from '../engine/series';

interface DayActivity {
  date: Date;
  time: number;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS = 7;

interface Point {
  x: number;
  y: number;
}

function smoothPath(points: Point[], step: number): string {
  return points
    .map((p, i) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const prev = points[i - 1];
      return `C${prev.x + step * 0.4},${prev.y} ${p.x - step * 0.4},${p.y} ${p.x},${p.y}`;
    })
    .join(' ');
}

/** Temps vocal des 7 derniers jours, sur fond de la semaine d'avant. `fortnight` : 14 jours, du plus ancien. */
export function activityChart(fortnight: DailyTotal[], width: number, height: number, accent: string): CardNode {
  const previous = fortnight.slice(0, DAYS).map(d => ({ date: d.date, time: d.total }));
  const current = fortnight.slice(DAYS).map(d => ({ date: d.date, time: d.total }));

  const left = width * 0.04;
  const top = height * 0.15;
  const chartWidth = width - left * 2;
  const baseline = height * 0.82;
  const chartHeight = baseline - top;
  const step = chartWidth / (DAYS - 1);
  const max = Math.max(...current.map(d => d.time), ...previous.map(d => d.time), 1);

  const toPoints = (week: DayActivity[]) => week.map((d, i) => ({ x: left + i * step, y: baseline - (d.time / max) * chartHeight }));
  const currentPoints = toPoints(current);
  const previousPoints = toPoints(previous);

  const area = (points: Point[]) =>
    `${smoothPath(points, step)} L${points[points.length - 1].x},${baseline} L${points[0].x},${baseline} Z`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="current" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${accent}" stop-opacity="0.35"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <path d="${area(previousPoints)}" fill="rgba(255,255,255,0.05)"/>
    <path d="${smoothPath(previousPoints, step)}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <path d="${area(currentPoints)}" fill="url(#current)"/>
    <path d="${smoothPath(currentPoints, step)}" fill="none" stroke="${accent}" stroke-width="2.5"/>
    ${currentPoints.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${accent}"/>`).join('')}
  </svg>`;

  const centeredAt = (x: number, y: number, style: Record<string, string | number>, content: string) =>
    box({ position: 'absolute', left: x - 60, top: y, width: 120, justifyContent: 'center' }, text(style, content));

  return box(
    { position: 'relative', width, height },
    image(Buffer.from(svg), { position: 'absolute', left: 0, top: 0, width, height }),
    ...current.flatMap((d, i) => [
      d.time > 0 && centeredAt(currentPoints[i].x, currentPoints[i].y - 50, { fontSize: 26, fontWeight: 700, color: 'white' }, formatDurationShort(d.time)),
      centeredAt(currentPoints[i].x, baseline + 14, { fontSize: 23, color: 'rgba(255,255,255,0.5)' }, DAY_NAMES[(d.date.getUTCDay() + 6) % 7]),
    ]),
    box(
      { position: 'absolute', left, bottom: 4, width: chartWidth, justifyContent: 'space-between', fontSize: 24, fontWeight: 700 },
      text({ color: accent }, '● Cette semaine'),
      text({ color: 'rgba(255,255,255,0.4)' }, '● Semaine précédente'),
    ),
  );
}
