import { iconSrc, type IconName } from '../engine/assets';
import { box, image, text, type CardNode } from '../engine/elements';
import type { Rect } from '../engine/geometry';
import type { ThemeStyle } from '../engine/themes';
import { MUTED, panel, SHRINK_TO_FIT } from './panel';

export function statCard(rect: Rect, theme: ThemeStyle, icon: IconName, label: string, value: string, valueSize: number): CardNode {
  return panel(
    rect,
    theme,
    { alignItems: 'center', padding: '0 20px 0 36px', gap: 20 },
    box({ width: 50, flexShrink: 0, justifyContent: 'center' }, image(iconSrc(icon), { maxWidth: 50, maxHeight: 50 })),
    box(
      { flexDirection: 'column', minWidth: 0, flexGrow: 1 },
      text({ fontSize: 21, color: 'white' }, label),
      text({ fontSize: valueSize, fontWeight: 900, color: 'white', ...SHRINK_TO_FIT }, value),
    ),
  );
}

/** Chiffre clé : libellé discret, grande valeur, précision en dessous. */
export function kpi(rect: Rect, theme: ThemeStyle, label: string, value: string, detail?: string): CardNode {
  return panel(
    rect,
    theme,
    { flexDirection: 'column', justifyContent: 'center', padding: '0 26px', gap: 4 },
    text({ fontSize: 19, color: MUTED }, label),
    text({ fontSize: 40, fontWeight: 900, color: 'white', ...SHRINK_TO_FIT }, value),
    detail !== undefined && text({ fontSize: 17, color: MUTED, ...SHRINK_TO_FIT }, detail),
  );
}
