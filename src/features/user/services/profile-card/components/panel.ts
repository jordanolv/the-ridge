import { box, rgba, text, type CardNode, type Style } from '../engine/elements';
import { PANEL_RADIUS, type Rect } from '../engine/geometry';
import type { ThemeStyle } from '../engine/themes';

export const SHRINK_TO_FIT: Style = { whiteSpace: 'nowrap', textFit: 'shrink' };

export const MUTED = 'rgba(255,255,255,0.55)';
export const SOFT = 'rgba(255,255,255,0.85)';

export type Child = CardNode | null | false;

export function panel(rect: Rect, theme: ThemeStyle, style: Style, ...children: Child[]): CardNode {
  return box(
    {
      position: 'absolute',
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      borderRadius: PANEL_RADIUS,
      backgroundColor: rgba(theme.panelColor, theme.panelOpacity),
      border: '1.5px solid rgba(255,255,255,0.18)',
      ...style,
    },
    ...children,
  );
}

/** Panneau à titre : le contenu remplit ce qu'il reste sous le titre. */
export function titledPanel(rect: Rect, theme: ThemeStyle, title: string, ...children: Child[]): CardNode {
  return panel(
    rect,
    theme,
    { flexDirection: 'column', padding: '22px 28px', gap: 16 },
    text({ fontSize: 22, fontWeight: 700, color: SOFT }, title),
    box({ flexDirection: 'column', flexGrow: 1, minHeight: 0 }, ...children),
  );
}
