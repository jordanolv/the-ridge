import type { MountainRarity, RarityConfig, RaidRarityConfig, ExpeditionTier, ExpeditionTierConfig } from '../types/peak-hunters.types';

export const FRAGMENTS_PER_EXPEDITION = 20;
export const MOUNTAIN_UNLOCK_SECONDS = 3600;
export const FRAGMENTS_PER_HOUR = 4;

export const SPAWN_MAX_PER_DAY = 2;
export const SPAWN_HOUR_START = 7;
export const SPAWN_HOUR_END = 23;

export const RARITY_CONFIG: Record<MountainRarity, RarityConfig> = {
  common:    { label: 'Commune',    emoji: '<:iconcommon:1493913972590510170>', nameEmoji: '⬜', color: 0x95a5a6, fragmentsOnDuplicate: 1,  expeditionWeight: 60 },
  rare:      { label: 'Rare',       emoji: '<:iconrare:1493913954622378075>', nameEmoji: '🟦', color: 0x3498db, fragmentsOnDuplicate: 3,  expeditionWeight: 25 },
  epic:      { label: 'Épique',     emoji: '<:iconepic:1493913951346491512>', nameEmoji: '🟪', color: 0x9b59b6, fragmentsOnDuplicate: 8,  expeditionWeight: 12 },
  legendary: { label: 'Légendaire', emoji: '<:iconleg:1493913953254903909>', nameEmoji: '⭐', color: 0xf1c40f, fragmentsOnDuplicate: 20, expeditionWeight: 3  },
};

// ─── Tiers d'expédition ───────────────────────────────────────────────────────

export const EXPEDITION_TIER_CONFIG: Record<ExpeditionTier, ExpeditionTierConfig> = {
  sentier:  { label: 'Sentier',  emoji: '<:sentierTier:1493914305824034907>', color: 0xe67e22, description: 'Probabilités normales' },
  falaise:  { label: 'Falaise',  emoji: '<:falaiseTier:1493914310282448916>',  color: 0x3498db, description: 'Meilleures chances de rare et épique' },
  sommet:   { label: 'Sommet',   emoji: '<:sommetTier:1493914307698884608>', color: 0x9b59b6, description: 'Garantit une montagne Épique ou Légendaire' },
};

/** Poids de rareté par tier d'expédition */
export const EXPEDITION_TIER_RARITY_WEIGHTS: Record<ExpeditionTier, Record<MountainRarity, number>> = {
  sentier:  { common: 60, rare: 25, epic: 12, legendary: 3  },
  falaise:  { common: 40, rare: 35, epic: 20, legendary: 5  },
  sommet:   { common: 0,  rare: 10, epic: 65, legendary: 25 },
};

/** Nombre de cartes par pack acheté en boutique (`shop.md` §4). */
export const PACK_CARDS: Record<ExpeditionTier, number> = { sentier: 3, falaise: 5, sommet: 5 };

/** Un pack = N−1 cartes au tirage Sentier, la dernière au tirage de son propre tier. */
export function packTiers(tier: ExpeditionTier): ExpeditionTier[] {
  return [...Array<ExpeditionTier>(PACK_CARDS[tier] - 1).fill('sentier'), tier];
}

/** Probabilités de tier pour tout gain d'expédition (vocal, daily, quiz, raids) */
export const EXPEDITION_TIER_CHANCES: { tier: ExpeditionTier; weight: number }[] = [
  { tier: 'sentier', weight: 80 },
  { tier: 'falaise', weight: 18 },
  { tier: 'sommet',  weight: 2  },
];

/** Tire un tier au hasard selon les poids donnés */
export function rollExpeditionTier(chances: { tier: ExpeditionTier; weight: number }[]): ExpeditionTier {
  const total = chances.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  for (const { tier, weight } of chances) {
    roll -= weight;
    if (roll <= 0) return tier;
  }
  return chances[0].tier;
}

// ─── Raid ─────────────────────────────────────────────────────────────────────

export const RAID_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export const RAID_AVG_POINTS_FLOOR = 800;
export const RAID_MIN_CONTRIBUTION_RATIO = 0.3;
export const RAID_HP_BAR_LENGTH = 20;
export const RAID_SPAWN_CHANCE_PER_HOUR = 0.15;

export const RAID_RARITY_CONFIG: Record<Exclude<MountainRarity, 'common'>, RaidRarityConfig> = {
  rare:      { hpMultiplier: 3,  durationDaysMin: 4, durationDaysMax: 5, baseXp: 300,  baseCoins: 20  },
  epic:      { hpMultiplier: 7,  durationDaysMin: 5, durationDaysMax: 6, baseXp: 700,  baseCoins: 50  },
  legendary: { hpMultiplier: 15, durationDaysMin: 6, durationDaysMax: 7, baseXp: 1500, baseCoins: 100 },
};
