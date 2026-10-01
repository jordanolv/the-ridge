import { listPaidThemes } from '../user/services/profile-card/engine/themes';

export interface ShopVariant {
  id: string;
  label: string;
  color: number;
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
  soon?: boolean;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'role-color',
    label: 'Rôle coloré',
    emoji: '🎨',
    description: 'Ta couleur à toi dans la liste des membres.',
    price: 40,
    durationDays: 30,
    variants: [
      { id: 'ecarlate',  label: 'Écarlate',  color: 0xe74c3c, emoji: '🔴' },
      { id: 'ambre',     label: 'Ambre',     color: 0xf39c12, emoji: '🟠' },
      { id: 'emeraude',  label: 'Émeraude',  color: 0x2ecc71, emoji: '🟢' },
      { id: 'ocean',     label: 'Océan',     color: 0x3498db, emoji: '🔵' },
      { id: 'amethyste', label: 'Améthyste', color: 0x9b59b6, emoji: '🟣' },
    ],
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
  return item.variants?.find(v => v.id === id);
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
