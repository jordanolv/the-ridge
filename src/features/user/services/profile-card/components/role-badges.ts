import { box, text, type CardNode } from '../engine/elements';
import { measureText } from '../engine/fonts';
import { cleanRoleName } from '../engine/text';

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
