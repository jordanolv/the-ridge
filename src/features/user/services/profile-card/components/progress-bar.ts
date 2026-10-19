import { box, text, type CardNode } from '../engine/elements';

const clamp = (ratio: number) => Math.min(1, Math.max(0, ratio));

export function progressBar(label: string, value: string, ratio: number, caption: string, gradient: string): CardNode {
  const percent = clamp(ratio);
  return box(
    { flexDirection: 'column', flex: 1, gap: 12 },
    box(
      { justifyContent: 'space-between', fontSize: 18 },
      text({ color: 'rgba(255,255,255,0.55)' }, label),
      text({ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }, value),
    ),
    box(
      {
        position: 'relative',
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
      },
      percent > 0 && box({ position: 'absolute', left: -1, top: -1, bottom: -1, width: `${percent * 100}%`, minWidth: 28, borderRadius: 14, backgroundImage: gradient }),
      text({ fontSize: 15, fontWeight: 700, color: 'white' }, caption),
    ),
  );
}

/** Jauge fine sans texte, pour les listes (raretés, taux de victoire…). */
export function meter(ratio: number, color: string, height = 10): CardNode {
  const percent = clamp(ratio);
  return box(
    { height, borderRadius: height / 2, backgroundColor: 'rgba(255,255,255,0.1)', flexGrow: 1 },
    percent > 0 && box({ width: `${percent * 100}%`, minWidth: height, borderRadius: height / 2, backgroundColor: color }),
  );
}
