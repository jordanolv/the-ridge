import { EXPEDITION_TIER_CONFIG, FRAGMENTS_PER_EXPEDITION, RARITY_CONFIG } from '../../../../peak-hunters/constants/peak-hunters.constants';
import { UserMountainsRepository } from '../../../../peak-hunters/repositories/user-mountains.repository';
import { MountainService, type MountainInfo } from '../../../../peak-hunters/services/mountain.service';
import type { ExpeditionTier, MountainRarity } from '../../../../peak-hunters/types/peak-hunters.types';
import { UserRepository } from '../../user.repository';
import { card } from '../components/card';
import { MUTED, SHRINK_TO_FIT, SOFT, titledPanel } from '../components/panel';
import { meter } from '../components/progress-bar';
import { ranking, type RankingRow } from '../components/ranking';
import { thumbnail, type ThumbnailProps } from '../components/thumbnail';
import { box, image, text, type CardNode } from '../engine/elements';
import { discordEmojiUrl } from '../engine/emoji';
import { formatNumber, plural } from '../engine/format';
import { rect } from '../engine/geometry';
import { fetchImage } from '../engine/remote-image';
import { defineTab } from './tab';

const PANELS = {
  collection: rect(28, 28, 560, 420),
  ranking: rect(28, 470, 560, 402),
  showcase: rect(610, 28, 862, 420),
  missing: rect(610, 470, 500, 402),
  inventory: rect(1132, 470, 340, 402),
};

const LAYOUT = { id: 'peak-hunters', panels: Object.values(PANELS) };

const RARITIES: MountainRarity[] = ['legendary', 'epic', 'rare', 'common'];
const TIERS: ExpeditionTier[] = ['sentier', 'falaise', 'sommet'];
const SHOWCASE_SIZE = 6;
const NEIGHBOURS = 2;

const repository = new UserRepository();
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const rarityRank = (rarity: MountainRarity) => RARITIES.indexOf(rarity);
const byPrestige = (a: MountainInfo, b: MountainInfo) =>
  rarityRank(MountainService.getRarity(a)) - rarityRank(MountainService.getRarity(b)) || parseFloat(b.elevation) - parseFloat(a.elevation);

/** Vignette légère servie par Cloudinary plutôt que la photo pleine taille. */
const thumbnailUrl = (url: string) => url.replace('/upload/', '/upload/c_fill,w_320,h_200,q_auto/');

async function loadIcon(markup: string): Promise<Buffer | null> {
  const url = discordEmojiUrl(markup);
  return url ? fetchImage(url) : null;
}

export interface PeakHuntersData {
  owned: number;
  total: number;
  byRarity: { rarity: MountainRarity; owned: number; total: number; icon: Buffer | null }[];
  showcase: ThumbnailProps[];
  missing: ThumbnailProps[];
  ranking: { rank: number | null; players: number; rows: RankingRow[] };
  tiers: { tier: ExpeditionTier; icon: Buffer | null; tickets: number; packs: number; opened: number }[];
  fragments: number;
}

async function toThumbnail(mountain: MountainInfo, hidden: boolean): Promise<ThumbnailProps> {
  const rarity = MountainService.getRarity(mountain);
  return {
    photo: await fetchImage(thumbnailUrl(mountain.image)),
    label: mountain.mountainLabel,
    caption: hidden ? RARITY_CONFIG[rarity].label : `${RARITY_CONFIG[rarity].label} · ${MountainService.getAltitude(mountain)}`,
    color: hex(RARITY_CONFIG[rarity].color),
    hidden,
  };
}

async function loadRanking(userId: string, owned: number): Promise<PeakHuntersData['ranking']> {
  const sizes = await UserMountainsRepository.collectionSizes();
  const index = sizes.findIndex(s => s.userId === userId);
  if (index === -1) return { rank: null, players: sizes.length, rows: [] };

  const window = sizes.slice(Math.max(0, index - NEIGHBOURS), index + NEIGHBOURS + 1);
  const names = await repository.namesOf(window.map(s => s.userId));
  const rankOf = (total: number) => 1 + sizes.filter(s => s.total > total).length;

  return {
    rank: rankOf(owned),
    players: sizes.length,
    rows: window.map(s => ({
      rank: rankOf(s.total),
      name: names.get(s.userId) ?? 'Grimpeur inconnu',
      value: formatNumber(s.total),
      highlighted: s.userId === userId,
    })),
  };
}

function rarityRow(row: PeakHuntersData['byRarity'][number]): CardNode {
  const { label, color } = RARITY_CONFIG[row.rarity];
  return box(
    { alignItems: 'center', gap: 14 },
    row.icon ? image(row.icon, { width: 28, height: 28 }) : box({ width: 28 }),
    text({ width: 110, fontSize: 18, color: SOFT }, label),
    meter(row.total > 0 ? row.owned / row.total : 0, hex(color), 12),
    text({ width: 82, fontSize: 18, fontWeight: 700, color: 'white', textAlign: 'right' }, `${row.owned}/${row.total}`),
  );
}

function grid(items: CardNode[], columns: number, gap: number): CardNode {
  const rows: CardNode[] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(box({ gap }, ...items.slice(i, i + columns)));
  return box({ flexDirection: 'column', gap }, ...rows);
}

export const peakHuntersTab = defineTab<PeakHuntersData>({
  id: 'peak-hunters',
  label: 'Peak Hunters',
  emoji: '⛰️',
  layout: LAYOUT,

  async prepare() {
    await Promise.all([...RARITIES.map(r => loadIcon(RARITY_CONFIG[r].emoji)), ...TIERS.map(t => loadIcon(EXPEDITION_TIER_CONFIG[t].emoji))]);
  },

  async load({ user }) {
    const doc = await UserMountainsRepository.getByUserId(user.id);
    const ownedIds = new Set((doc?.unlockedMountains ?? []).map(m => m.mountainId));
    const all = MountainService.getAll();
    const owned = all.filter(m => ownedIds.has(m.id)).sort(byPrestige);
    const missing = all.filter(m => !ownedIds.has(m.id));
    const nextTargets = RARITIES.map(r => missing.filter(m => MountainService.getRarity(m) === r).sort(byPrestige)[0]).filter(Boolean);

    const [byRarity, showcase, missingThumbnails, rankingData, tierIcons] = await Promise.all([
      Promise.all(
        RARITIES.map(async rarity => ({
          rarity,
          owned: owned.filter(m => MountainService.getRarity(m) === rarity).length,
          total: all.filter(m => MountainService.getRarity(m) === rarity).length,
          icon: await loadIcon(RARITY_CONFIG[rarity].emoji),
        })),
      ),
      Promise.all(owned.slice(0, SHOWCASE_SIZE).map(m => toThumbnail(m, false))),
      Promise.all(nextTargets.map(m => toThumbnail(m, true))),
      loadRanking(user.id, ownedIds.size),
      Promise.all(TIERS.map(tier => loadIcon(EXPEDITION_TIER_CONFIG[tier].emoji))),
    ]);

    return {
      owned: ownedIds.size,
      total: all.length,
      byRarity,
      showcase,
      missing: missingThumbnails,
      ranking: rankingData,
      tiers: TIERS.map((tier, i) => ({
        tier,
        icon: tierIcons[i],
        tickets: doc?.[`${tier}Tickets`] ?? 0,
        packs: doc?.[`${tier}Packs`] ?? 0,
        opened: doc?.[`${tier}Opened`] ?? 0,
      })),
      fragments: doc?.fragments ?? 0,
    };
  },

  build(data, theme) {
    const { style } = theme;
    const progress = data.total > 0 ? data.owned / data.total : 0;
    const showcaseWidth = (PANELS.showcase.width - 56 - 2 * 16) / 3;
    const missingWidth = (PANELS.missing.width - 56 - 16) / 2;
    const opened = data.tiers.reduce((total, t) => total + t.opened, 0);
    const missingCount = data.byRarity.map(r => ({ ...r, left: r.total - r.owned })).filter(r => r.left > 0);

    return card(
      theme,
      LAYOUT,
      titledPanel(
        PANELS.collection,
        style,
        '⛰️ Collection',
        box(
          { alignItems: 'baseline', gap: 12 },
          text({ fontSize: 64, fontWeight: 900, color: 'white' }, formatNumber(data.owned)),
          text({ fontSize: 26, color: MUTED }, `/ ${data.total}`),
          text({ marginLeft: 'auto', fontSize: 30, fontWeight: 900, color: style.accent }, `${Math.round(progress * 100)} %`),
        ),
        box({ flexDirection: 'column', gap: 18, marginTop: 'auto', marginBottom: 'auto' }, ...data.byRarity.map(rarityRow)),
      ),

      titledPanel(
        PANELS.ranking,
        style,
        '🏆 Classement des grimpeurs',
        data.ranking.rank === null
          ? text({ fontSize: 19, color: MUTED }, 'Pas encore classé : débloque ta première montagne.')
          : box(
              { flexDirection: 'column', gap: 14 },
              text({ fontSize: 19, color: MUTED }, `#${data.ranking.rank} sur ${plural(data.ranking.players, 'grimpeur')}`),
              ranking(data.ranking.rows, PANELS.ranking.width - 56, style.accent),
            ),
      ),

      titledPanel(
        PANELS.showcase,
        style,
        '✨ Vitrine — tes plus beaux sommets',
        data.showcase.length === 0
          ? text({ fontSize: 19, color: MUTED }, 'Aucune montagne pour l’instant : lance une expédition avec /peak-hunters.')
          : grid(data.showcase.map(t => thumbnail(t, showcaseWidth, 150)), 3, 16),
      ),

      titledPanel(
        PANELS.missing,
        style,
        '🔭 À découvrir',
        grid(data.missing.map(t => thumbnail(t, missingWidth, 110)), 2, 16),
        text(
          { marginTop: 'auto', fontSize: 16, color: MUTED, ...SHRINK_TO_FIT },
          missingCount.length === 0 ? 'Collection complète, chapeau !' : `Il te manque ${missingCount.map(r => `${r.left} ${RARITY_CONFIG[r.rarity].label.toLowerCase()}${r.left > 1 ? 's' : ''}`).join(', ')}`,
        ),
      ),

      titledPanel(
        PANELS.inventory,
        style,
        '🎒 Inventaire',
        box(
          { flexDirection: 'column', gap: 12 },
          box(
            { fontSize: 14, color: MUTED },
            box({ flexGrow: 1 }),
            text({ width: 90, textAlign: 'right' }, 'Expéditions'),
            text({ width: 60, textAlign: 'right' }, 'Packs'),
          ),
          ...data.tiers.map(t =>
            box(
              { alignItems: 'center', gap: 10 },
              t.icon ? image(t.icon, { width: 26, height: 26 }) : box({ width: 26 }),
              text({ fontSize: 18, color: SOFT, flexGrow: 1 }, EXPEDITION_TIER_CONFIG[t.tier].label),
              text({ width: 90, textAlign: 'right', fontSize: 18, fontWeight: 700, color: 'white' }, formatNumber(t.tickets)),
              text({ width: 60, textAlign: 'right', fontSize: 18, fontWeight: 700, color: 'white' }, formatNumber(t.packs)),
            ),
          ),
        ),
        box(
          { flexDirection: 'column', gap: 8, marginTop: 'auto' },
          box(
            { justifyContent: 'space-between', fontSize: 16 },
            text({ color: MUTED }, '🧩 Fragments'),
            text({ color: SOFT, fontWeight: 700 }, `${data.fragments} / ${FRAGMENTS_PER_EXPEDITION}`),
          ),
          meter(data.fragments / FRAGMENTS_PER_EXPEDITION, style.accent, 10),
          text({ fontSize: 16, color: MUTED }, `${plural(opened, 'expédition')} ouverte${opened > 1 ? 's' : ''}`),
        ),
      ),
    );
  },
});
