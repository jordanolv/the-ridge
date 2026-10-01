import { box, image, text, type CardNode } from '../engine/elements';
import { MUTED } from './panel';

export interface AxisLabel {
  index: number;
  text: string;
}

const AXIS_HEIGHT = 26;

const svgImage = (svg: string, width: number, height: number) =>
  image(Buffer.from(svg), { position: 'absolute', left: 0, top: 0, width, height });

function axis(labels: AxisLabel[], count: number, width: number, top: number): CardNode[] {
  const step = width / count;
  return labels.map(label =>
    box(
      { position: 'absolute', top, left: Math.min(width - 80, Math.max(0, (label.index + 0.5) * step - 40)), width: 80, justifyContent: 'center' },
      text({ fontSize: 15, color: MUTED }, label.text),
    ),
  );
}

/** Histogramme d'une série quotidienne : la dernière barre (aujourd'hui) est mise en avant. */
export function barChart(values: number[], width: number, height: number, color: string, labels: AxisLabel[] = []): CardNode {
  const plotHeight = height - AXIS_HEIGHT;
  const max = Math.max(...values, 1);
  const step = width / values.length;
  const barWidth = Math.max(2, step * 0.62);

  const bars = values
    .map((value, i) => {
      const barHeight = value > 0 ? Math.max(3, (value / max) * (plotHeight - 4)) : 0;
      const x = i * step + (step - barWidth) / 2;
      const opacity = i === values.length - 1 ? 1 : 0.7;
      return `<rect x="${x.toFixed(1)}" y="${(plotHeight - barHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="${Math.min(3, barWidth / 2).toFixed(1)}" fill="${color}" fill-opacity="${opacity}"/>`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${plotHeight}" viewBox="0 0 ${width} ${plotHeight}">
    <line x1="0" y1="${plotHeight - 0.5}" x2="${width}" y2="${plotHeight - 0.5}" stroke="rgba(255,255,255,0.15)"/>
    ${bars}
  </svg>`;

  return box({ position: 'relative', width, height }, svgImage(svg, width, plotHeight), ...axis(labels, values.length, width, plotHeight + 6));
}

/** Courbe d'une série (ex. solde quotidien), aire dégradée sous la ligne. */
export function lineChart(values: number[], width: number, height: number, color: string, labels: AxisLabel[] = []): CardNode {
  const plotHeight = height - AXIS_HEIGHT;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / values.length;
  const points = values.map((value, i) => ({
    x: (i + 0.5) * step,
    y: 6 + (1 - (value - min) / span) * (plotHeight - 12),
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${plotHeight} L${points[0].x.toFixed(1)},${plotHeight} Z`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${plotHeight}" viewBox="0 0 ${width} ${plotHeight}">
    <defs>
      <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#area)"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="${points[points.length - 1].x.toFixed(1)}" cy="${points[points.length - 1].y.toFixed(1)}" r="4" fill="${color}"/>
  </svg>`;

  return box({ position: 'relative', width, height }, svgImage(svg, width, plotHeight), ...axis(labels, values.length, width, plotHeight + 6));
}
