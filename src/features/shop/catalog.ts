import { listPaidThemes } from '../user/services/profile-card/engine/themes';

export interface ShopVariant {
  id: string;
  label: string;
  color: number;
  secondaryColor?: number;
  emoji: string;
}

const THEME_SWATCHES = [0xe67e22, 0x9b59b6, 0x1abc9c, 0xe74c3c, 0x3498db, 0xf1c40f];

export interface ShopItem {
  id: string;
  label: string;
  emoji: string;
  description: string;
  price: number;
  /** Absent = consommable : rien à révoquer, rien à faire expirer. */
  durationDays?: number;
  variants?: ShopVariant[];
  /** La variante est une couleur libre choisie par le joueur, encodée `RRGGBB` ou `RRGGBB-RRGGBB`. */
  colorPicker?: boolean;
  soon?: boolean;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'role-color',
    label: 'Rôle coloré',
    emoji: '🎨',
    description: 'Ton rôle perso, à la couleur de ton choix.',
    price: 40,
    durationDays: 30,
    colorPicker: true,
  },
  {
    id: 'pack-sentier',
    label: 'Pack Sentier',
    emoji: '<:sentierTier:1493914305824034907>',
    description: '3 cartes au tirage normal.',
    price: 150,
  },
  {
    id: 'pack-falaise',
    label: 'Pack Falaise',
    emoji: '<:falaiseTier:1493914310282448916>',
    description: '5 cartes, la dernière Rare ou mieux.',
    price: 300,
  },
  {
    id: 'pack-sommet',
    label: 'Pack Sommet',
    emoji: '<:sommetTier:1493914307698884608>',
    description: '5 cartes, la dernière Épique ou Légendaire garantie.',
    price: 600,
  },
  {
    id: 'profile-theme',
    label: 'Design de carte',
    emoji: '🪪',
    description: 'Un autre design pour ta carte /me, visible par tout le salon.',
    price: 50,
    durationDays: 30,
    variants: themeVariants(),
    soon: themeVariants().length === 0,
  },
];

/** Les designs disponibles sont les images d'`assets/cards/` — voir `profile-card/engine/themes.ts`. */
function themeVariants(): ShopVariant[] {
  return listPaidThemes().map((theme, i) => ({
    id: theme.id,
    label: theme.label,
    color: THEME_SWATCHES[i % THEME_SWATCHES.length],
    emoji: '🪪',
  }));
}

/** `pack-falaise` → `falaise`, sinon undefined. */
export function packTierOf(item: ShopItem): string | undefined {
  return item.id.startsWith('pack-') ? item.id.slice('pack-'.length) : undefined;
}

export function findItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find(i => i.id === id);
}

export function findVariant(item: ShopItem, id: string): ShopVariant | undefined {
  if (item.colorPicker) return parseColorVariant(id);
  return item.variants?.find(v => v.id === id);
}

export const COLOR_PRESETS: { label: string; emoji: string; color: number }[] = [
  { label: 'Écarlate',  emoji: '🔴', color: 0xe74c3c },
  { label: 'Ambre',     emoji: '🟠', color: 0xf39c12 },
  { label: 'Soleil',    emoji: '🟡', color: 0xf1c40f },
  { label: 'Émeraude',  emoji: '🟢', color: 0x2ecc71 },
  { label: 'Océan',     emoji: '🔵', color: 0x3498db },
  { label: 'Améthyste', emoji: '🟣', color: 0x9b59b6 },
  { label: 'Rose',      emoji: '🌸', color: 0xff6fb5 },
  { label: 'Neige',     emoji: '⚪', color: 0xf5f6fa },
];

/** `#f80`, `F80`, `#ff8800` → 0xff8800. Le noir pur devient 0x010101 : pour Discord, 0 veut dire « sans couleur ». */
export function parseHex(input: string): number | undefined {
  const hex = input.trim().replace(/^#/, '');
  const full = /^[0-9a-f]{3}$/i.test(hex) ? [...hex].map(c => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return undefined;
  return parseInt(full, 16) || 0x010101;
}

export function formatHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
}

export function colorVariantId(primary: number, secondary?: number): string {
  const part = (c: number) => c.toString(16).padStart(6, '0');
  return secondary === undefined ? part(primary) : `${part(primary)}-${part(secondary)}`;
}

export function parseColorVariant(id: string): ShopVariant | undefined {
  const [rawPrimary, rawSecondary, ...rest] = id.split('-');
  if (rest.length > 0) return undefined;
  const color = parseHex(rawPrimary);
  if (color === undefined) return undefined;
  const secondaryColor = rawSecondary === undefined ? undefined : parseHex(rawSecondary);
  if (rawSecondary !== undefined && secondaryColor === undefined) return undefined;

  const preset = secondaryColor === undefined ? COLOR_PRESETS.find(p => p.color === color) : undefined;
  return {
    id: colorVariantId(color, secondaryColor),
    label: preset?.label ?? (secondaryColor === undefined ? formatHex(color) : `${formatHex(color)} → ${formatHex(secondaryColor)}`),
    color,
    secondaryColor,
    emoji: preset?.emoji ?? '🎨',
  };
}

export const MAX_QUANTITY = 6;

export function clampQuantity(qty: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(qty)));
}

/** « 3 mois » pour une location, « ×3 » pour un consommable. */
export function quantityLabel(item: ShopItem, qty: number): string {
  if (!item.durationDays) return `×${qty}`;
  const months = (item.durationDays * qty) / 30;
  return months === 1 ? '1 mois' : `${months} mois`;
}
