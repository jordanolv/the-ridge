import { readFileSync } from 'node:fs';
import path from 'node:path';
import { box, dataUrl, image, rgba, text, type CardChild, type CardNode } from './elements';
import { measureText } from './fonts';
import { PANEL_RADIUS, type Rect } from './geometry';
import { cleanRoleName, ellipsize, fitFontSize, sanitizeText } from './text';
import type { ThemeStyle } from './themes';

const iconCache = new Map<string, string>();

export function icon(name: string): string {
  let url = iconCache.get(name);
  if (!url) {
    url = dataUrl(readFileSync(path.join(process.cwd(), 'assets/profile-card', `${name}.png`)), 'image/png');
    iconCache.set(name, url);
  }
  return url;
}

export function panel(rect: Rect, theme: ThemeStyle, style: Record<string, string | number>, ...children: (CardChild | null | false)[]): CardNode {
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

export function statCard(rect: Rect, theme: ThemeStyle, iconName: string, label: string, value: string, valueSize: number): CardNode {
  return panel(
    rect,
    theme,
    { alignItems: 'center', paddingLeft: 36, gap: 20 },
    box({ width: 50, justifyContent: 'center' }, image(icon(iconName), { maxWidth: 50, maxHeight: 50 })),
    box(
      { flexDirection: 'column' },
      text({ fontSize: 21, color: 'white' }, label),
      text({ fontSize: valueSize, fontWeight: 900, color: 'white' }, ellipsize(value, rect.width - 130, valueSize, 900)),
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

export function profileHeader(avatar: string, pseudo: string, bio: string, width: number): CardNode {
  const name = sanitizeText(pseudo);
  const nameSize = fitFontSize(name, width, 40, 26, 700);
  return box(
    { flexDirection: 'column', alignItems: 'center', width },
    image(avatar, { width: 204, height: 200, borderRadius: '50%', objectFit: 'cover' }),
    text({ marginTop: 14, height: 48, alignItems: 'center', fontSize: nameSize, fontWeight: 700, color: 'white' }, ellipsize(name, width, nameSize, 700)),
    text({ fontSize: 20, fontWeight: 700, color: 'white' }, ellipsize(sanitizeText(bio), width, 20, 700)),
  );
}
