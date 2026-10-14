import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { EXPEDITION_TIER_CONFIG, FRAGMENTS_PER_EXPEDITION, PACK_CARDS } from '../../../../peak-hunters/constants/peak-hunters.constants';
import { UserMountainsRepository } from '../../../../peak-hunters/repositories/user-mountains.repository';
import { packStartId } from '../../../../peak-hunters/services/pack.service';
import type { ExpeditionTier } from '../../../../peak-hunters/types/peak-hunters.types';
import { findItem, findVariant, formatHex } from '../../../../shop/catalog';
import { ShopRentalRepository } from '../../../../shop/repositories/shop-rental.repository';
import { card } from '../components/card';
import { MUTED, panel, SHRINK_TO_FIT, SOFT, titledPanel } from '../components/panel';
import { meter } from '../components/progress-bar';
import { box, image, text, type CardNode } from '../engine/elements';
import { fetchDiscordEmoji } from '../engine/emoji';
import { formatDate, formatNumber, plural } from '../engine/format';
import { rect } from '../engine/geometry';
import type { ThemeStyle } from '../engine/themes';
import { defineTab } from './tab';

const PACK_WIDTH = 466;

const PANELS = {
  packs: [0, 1, 2].map(i => rect(28 + i * (PACK_WIDTH + 23), 28, PACK_WIDTH, 420)),
  expeditions: rect(28, 470, 710, 402),
  rentals: rect(760, 470, 712, 402),
};

const LAYOUT = { id: 'inventaire', panels: [...PANELS.packs, PANELS.expeditions, PANELS.rentals] };

const TIERS: ExpeditionTier[] = ['sentier', 'falaise', 'sommet'];
const MAX_RENTALS = 4;
const DAY_MS = 86_400_000;

export interface InventoryData {
  tiers: { tier: ExpeditionTier; icon: Buffer | null; packs: number; tickets: number }[];
  fragments: number;
  rentals: { emoji: string; label: string; variant: string | null; swatch: string | null; expiresAt: string; daysLeft: number }[];
}

const loadTierIcons = () => Promise.all(TIERS.map(tier => fetchDiscordEmoji(EXPEDITION_TIER_CONFIG[tier].emoji)));

async function loadRentals(userId: string): Promise<InventoryData['rentals']> {
  const now = Date.now();
  const rentals = await ShopRentalRepository.activeOf(userId);
  return rentals.flatMap(rental => {
    const item = findItem(rental.itemId);
    if (!item) return [];
    const variant = rental.variantId ? findVariant(item, rental.variantId) : undefined;
    const swatch = variant
      ? variant.secondaryColor === undefined
        ? formatHex(variant.color)
        : `linear-gradient(90deg, ${formatHex(variant.color)}, ${formatHex(variant.secondaryColor)})`
      : null;
    return [
      {
        emoji: item.emoji,
        label: item.label,
        // La police de la carte n'a pas de glyphe pour la flèche des dégradés.
        variant: variant ? variant.label.replace('→', '–') : null,
        swatch: item.colorPicker ? swatch : null,
        expiresAt: formatDate(rental.expiresAt),
        daysLeft: Math.max(0, Math.ceil((rental.expiresAt.getTime() - now) / DAY_MS)),
      },
    ];
  });
}

const tierIcon = (icon: Buffer | null, size: number) => (icon ? image(icon, { width: size, height: size }) : box({ width: size }));

function packPanel(row: InventoryData['tiers'][number], index: number, style: ThemeStyle): CardNode {
  const { label, color } = EXPEDITION_TIER_CONFIG[row.tier];
  const item = findItem(`pack-${row.tier}`);
  const hasStock = row.packs > 0;

  return panel(
    PANELS.packs[index],
    style,
    { flexDirection: 'column', padding: '24px 28px', gap: 16, overflow: 'hidden' },
    box(
      { alignItems: 'center', gap: 16 },
      tierIcon(row.icon, 56),
      box(
        { flexDirection: 'column', minWidth: 0 },
        text({ fontSize: 28, fontWeight: 800, color: 'white', ...SHRINK_TO_FIT }, `Pack ${label}`),
        text({ fontSize: 17, color: MUTED }, `${PACK_CARDS[row.tier]} cartes`),
      ),
    ),
    box(
      { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
      text({ fontSize: 110, fontWeight: 900, color: hasStock ? 'white' : MUTED, lineHeight: 1 }, formatNumber(row.packs)),
      text({ fontSize: 19, color: MUTED }, hasStock ? 'prêt à ouvrir' : 'aucun en stock'),
    ),
    text({ fontSize: 16, color: SOFT, textAlign: 'center' }, item?.description ?? ''),
    text({ fontSize: 15, color: MUTED, textAlign: 'center' }, item ? `En vente dans /shop · ${formatNumber(item.price)} RC` : ''),
    box({ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, backgroundColor: formatHex(color) }),
  );
}

function rentalRow(rental: InventoryData['rentals'][number]): CardNode {
  return box(
    { alignItems: 'center', gap: 14 },
    rental.swatch
      ? box({
          width: 26,
          height: 26,
          borderRadius: 13,
          flexShrink: 0,
          border: '1.5px solid rgba(255,255,255,0.4)',
          ...(rental.swatch.startsWith('#') ? { backgroundColor: rental.swatch } : { backgroundImage: rental.swatch }),
        })
      : text({ width: 26, fontSize: 22 }, rental.emoji),
    box(
      { flexDirection: 'column', flexGrow: 1, minWidth: 0 },
      text({ fontSize: 19, fontWeight: 700, color: 'white', ...SHRINK_TO_FIT }, rental.label),
      rental.variant !== null && text({ fontSize: 15, color: MUTED, ...SHRINK_TO_FIT }, rental.variant),
    ),
    box(
      { flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 },
      text({ fontSize: 17, fontWeight: 700, color: SOFT }, `jusqu'au ${rental.expiresAt}`),
      text({ fontSize: 15, color: MUTED }, rental.daysLeft > 1 ? `encore ${plural(rental.daysLeft, 'jour')}` : 'dernier jour'),
    ),
  );
}

export const inventoryTab = defineTab<InventoryData>({
  id: 'inventaire',
  label: 'Inventaire',
  emoji: '🎒',
  layout: LAYOUT,

  async prepare() {
    await loadTierIcons();
  },

  async load({ user }) {
    const [doc, icons, rentals] = await Promise.all([UserMountainsRepository.getByUserId(user.id), loadTierIcons(), loadRentals(user.id)]);
    return {
      tiers: TIERS.map((tier, i) => ({
        tier,
        icon: icons[i],
        packs: doc ? UserMountainsRepository.packsOf(doc, tier) : 0,
        tickets: doc?.[`${tier}Tickets`] ?? 0,
      })),
      fragments: doc?.fragments ?? 0,
      rentals,
    };
  },

  build(data, theme) {
    const { style } = theme;
    const shown = data.rentals.slice(0, MAX_RENTALS);
    const hidden = data.rentals.length - shown.length;

    return card(
      theme,
      LAYOUT,
      ...data.tiers.map((row, i) => packPanel(row, i, style)),

      titledPanel(
        PANELS.expeditions,
        style,
        '🗺️ Expéditions',
        box(
          { flexDirection: 'column', gap: 18 },
          ...data.tiers.map(row =>
            box(
              { alignItems: 'center', gap: 14 },
              tierIcon(row.icon, 30),
              text({ fontSize: 20, color: SOFT, flexGrow: 1 }, EXPEDITION_TIER_CONFIG[row.tier].label),
              text({ fontSize: 26, fontWeight: 800, color: row.tickets > 0 ? 'white' : MUTED }, formatNumber(row.tickets)),
            ),
          ),
        ),
        box(
          { flexDirection: 'column', gap: 8, marginTop: 'auto' },
          box(
            { justifyContent: 'space-between', fontSize: 17 },
            text({ color: MUTED }, '🧩 Fragments avant la prochaine'),
            text({ color: SOFT, fontWeight: 700 }, `${data.fragments} / ${FRAGMENTS_PER_EXPEDITION}`),
          ),
          meter(data.fragments / FRAGMENTS_PER_EXPEDITION, style.accent, 10),
          text({ fontSize: 15, color: MUTED }, 'Les expéditions se lancent depuis /peak-hunters.'),
        ),
      ),

      titledPanel(
        PANELS.rentals,
        style,
        '🛍️ Achats en cours',
        shown.length === 0
          ? text({ fontSize: 19, color: MUTED }, 'Rien en location pour l’instant : rôle coloré et designs de carte sont dans /shop.')
          : box({ flexDirection: 'column', gap: 20 }, ...shown.map(rentalRow)),
        hidden > 0 && text({ marginTop: 'auto', fontSize: 15, color: MUTED }, `+ ${plural(hidden, 'autre achat')}`),
      ),
    );
  },

  actions(data, userId) {
    const stocked = data.tiers.filter(row => row.packs > 0);
    if (stocked.length === 0) return [];
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        stocked.map(row =>
          new ButtonBuilder()
            .setCustomId(packStartId(row.tier, userId))
            .setLabel(`Ouvrir un pack ${EXPEDITION_TIER_CONFIG[row.tier].label} (${row.packs})`)
            .setEmoji(EXPEDITION_TIER_CONFIG[row.tier].emoji)
            .setStyle(ButtonStyle.Success),
        ),
      ),
    ];
  },
});
