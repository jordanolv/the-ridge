import { box, text, type CardNode } from '../engine/elements';
import { sanitizeText, truncateToWidth } from '../engine/text';
import { MUTED, SOFT } from './panel';

export interface RankingRow {
  rank: number;
  name: string;
  value: string;
  highlighted: boolean;
}

const MEDALS: Record<number, string> = { 1: '#f1c40f', 2: '#bdc3c7', 3: '#cd7f32' };

export function ranking(rows: RankingRow[], width: number, accent: string): CardNode {
  const nameWidth = width - 190;
  return box(
    { flexDirection: 'column', gap: 6, width },
    ...rows.map(row =>
      box(
        {
          alignItems: 'center',
          height: 40,
          padding: '0 14px',
          gap: 14,
          borderRadius: 10,
          backgroundColor: row.highlighted ? `${accent}33` : 'rgba(255,255,255,0.04)',
          border: row.highlighted ? `1.5px solid ${accent}` : '1.5px solid transparent',
        },
        text({ width: 56, fontSize: 18, fontWeight: 900, color: MEDALS[row.rank] ?? MUTED }, `#${row.rank}`),
        text({ flexGrow: 1, fontSize: 18, fontWeight: row.highlighted ? 700 : 400, color: SOFT, whiteSpace: 'nowrap' }, truncateToWidth(sanitizeText(row.name), nameWidth, 18, row.highlighted ? 700 : 400)),
        text({ fontSize: 18, fontWeight: 700, color: 'white' }, row.value),
      ),
    ),
  );
}

/** « #12 sur 340 » : la position d'un joueur dans un classement. */
export function rankLine(label: string, rank: number | null, total: number, detail?: string): CardNode {
  return box(
    { alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
    text({ fontSize: 19, color: SOFT }, label),
    box(
      { alignItems: 'baseline', gap: 8 },
      detail !== undefined && text({ fontSize: 16, color: MUTED }, detail),
      text({ fontSize: 22, fontWeight: 900, color: 'white' }, rank === null ? '—' : `#${rank}`),
      text({ fontSize: 16, color: MUTED }, `/ ${total}`),
    ),
  );
}
