import { iconSrc, type IconName } from './assets';
import { box, image, rgba, text, type CardNode, type Style } from './elements';
import { measureText } from './fonts';
import { PANEL_RADIUS, type Rect } from './geometry';
import { cleanRoleName, sanitizeText, truncateToWidth } from './text';
import type { ThemeStyle } from './themes';

const SHRINK_TO_FIT: Style = { whiteSpace: 'nowrap', textFit: 'shrink' };

export function panel(rect: Rect, theme: ThemeStyle, style: Style, ...children: (CardNode | null | false)[]): CardNode {
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

export function progressBar(label: string, value: string, ratio: number, caption: string, gradient: string): CardNode {
  const percent = Math.min(1, Math.max(0, ratio));
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

const BADGE = { height: 33, fontSize: 16, gap: 8, rowGap: 8, dot: 12, paddingX: 12 };

/** Répartit les rôles en lignes comme le fera flex-wrap, pour savoir combien tiennent. */
function fitRoles(names: string[], maxWidth: number, maxRows: number): number {
  let rows = 1;
  let rowWidth = 0;
  for (let i = 0; i < names.length; i++) {
    const width = BADGE.paddingX * 2 + BADGE.dot + 8 + measureText(names[i], BADGE.fontSize);
    if (rowWidth > 0 && rowWidth + BADGE.gap + width > maxWidth) {
      if (++rows > maxRows) return i;
      rowWidth = 0;
    }
    rowWidth += (rowWidth > 0 ? BADGE.gap : 0) + width;
  }
  return names.length;
}

export function roleBadges(roles: { name: string; color: string }[], width: number, height: number): CardNode {
  const named = roles.map(r => ({ ...r, name: cleanRoleName(r.name) })).filter(r => r.name);
  const maxRows = Math.floor((height - 20) / (BADGE.height + BADGE.rowGap));
  const shown = named.slice(0, fitRoles(named.map(r => r.name), width, maxRows));
  const hidden = named.length - shown.length;

  return box(
    { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, width, height },
    box(
      { flexWrap: 'wrap', justifyContent: 'center', gap: BADGE.gap, rowGap: BADGE.rowGap },
      ...shown.map(role =>
        box(
          {
            alignItems: 'center',
            gap: 8,
            height: BADGE.height,
            padding: `0 ${BADGE.paddingX}px`,
            borderRadius: BADGE.height / 2,
            backgroundColor: 'rgba(255,255,255,0.07)',
            border: '1.5px solid rgba(255,255,255,0.15)',
          },
          box({ width: BADGE.dot, height: BADGE.dot, borderRadius: BADGE.dot / 2, backgroundColor: role.color === '#000000' ? '#5865F2' : role.color }),
          text({ fontSize: BADGE.fontSize, color: 'rgba(255,255,255,0.85)' }, role.name),
        ),
      ),
    ),
    hidden > 0 && text({ fontSize: 15, color: '#8892b0' }, `+${hidden} autre${hidden > 1 ? 's' : ''}`),
  );
}

export function profileHeader(avatar: Buffer, pseudo: string, bio: string, width: number): CardNode {
  return box(
    { flexDirection: 'column', alignItems: 'center', width },
    image(avatar, { width: 204, height: 200, borderRadius: '50%', objectFit: 'cover' }),
    text(
      { width, marginTop: 14, height: 48, fontSize: 40, fontWeight: 700, color: 'white', textAlign: 'center', ...SHRINK_TO_FIT },
      sanitizeText(pseudo),
    ),
    text({ width, fontSize: 20, fontWeight: 700, color: 'white', textAlign: 'center', whiteSpace: 'nowrap' }, truncateToWidth(sanitizeText(bio), width, 20, 700)),
  );
}
