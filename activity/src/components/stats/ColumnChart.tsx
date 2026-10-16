import { useState } from 'react';
import { formatDay } from '../../lib/format';

interface ColumnChartProps {
  days: string[];
  values: number[];
  color: string;
  formatTick: (value: number) => string;
  describe: (index: number) => string;
}

/**
 * Le plus petit 1, 2, 5 ou 10 × 10ⁿ au-dessus du maximum, découpé pour que le pas tombe
 * rond : 2 en quatre (0,5), les autres en cinq (0,2 · 1 · 2).
 */
function niceScale(max: number): { ceiling: number; ticks: number[] } {
  const magnitude = max > 0 ? 10 ** Math.floor(Math.log10(max)) : 1;
  const leading = [1, 2, 5, 10].find(step => step * magnitude >= max) ?? 10;
  const ceiling = leading * magnitude;
  const count = leading === 2 ? 4 : 5;
  return { ceiling, ticks: Array.from({ length: count + 1 }, (_, i) => (ceiling / count) * i) };
}

/** Au-delà, la bulle d'une barre haute déborderait au-dessus du graphique. */
const TOOLTIP_CEILING = 0.7;

const dayDate = (day: string) => new Date(`${day}T12:00:00`);

export function ColumnChart({ days, values, color, formatTick, describe }: ColumnChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const { ceiling, ticks } = niceScale(Math.max(...values));
  const middle = Math.floor(days.length / 2);

  return (
    <div className="flex gap-2">
      <div className="relative h-44 w-10 shrink-0 text-right text-[11px] tabular-nums text-white/40">
        {ticks.map(tick => (
          <span key={tick} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${(tick / ceiling) * 100}%` }}>
            {formatTick(tick)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-44">
          {ticks.map(tick => (
            <div key={tick} className="absolute inset-x-0 border-t border-white/[0.07]" style={{ bottom: `${(tick / ceiling) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setHovered(null)}>
            {values.map((value, index) => (
              <div key={days[index]} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHovered(index)}>
                <div
                  className="w-full max-w-6 rounded-t-[4px] transition-opacity"
                  style={{
                    height: `${(value / ceiling) * 100}%`,
                    minHeight: value > 0 ? 2 : 0,
                    backgroundColor: color,
                    opacity: hovered === null || hovered === index ? 1 : 0.45,
                  }}
                />
                {hovered === index && (
                  <div
                    className={`pointer-events-none absolute z-10 mb-2 whitespace-nowrap rounded-lg border border-white/10 bg-night-900/95 px-2.5 py-1.5 text-xs shadow-xl ${
                      index < 4 ? 'left-0' : index > values.length - 5 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                    }`}
                    style={{ bottom: `${Math.min(TOOLTIP_CEILING, value / ceiling) * 100}%` }}
                  >
                    <p className="text-white/55 first-letter:uppercase">{formatDay(dayDate(days[index]))}</p>
                    <p className="font-semibold">{describe(index)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-2 h-4 text-[11px] text-white/40">
          <span className="absolute left-0">{formatDay(dayDate(days[0]))}</span>
          <span className="absolute left-1/2 -translate-x-1/2">{formatDay(dayDate(days[middle]))}</span>
          <span className="absolute right-0">Aujourd'hui</span>
        </div>
      </div>
    </div>
  );
}
