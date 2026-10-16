export type MountainRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type ExpeditionTier = 'sentier' | 'falaise' | 'sommet';

export interface RarityConfig {
  label: string;
  emoji: string;
  nameEmoji: string;
  color: number;
  /** Fragments donnés si la montagne est déjà débloquée (doublon) */
  fragmentsOnDuplicate: number;
  /** Poids pour le tirage d'expédition standard (total = 100) */
  expeditionWeight: number;
}

export interface ExpeditionTierConfig {
  label: string;
  emoji: string;
  color: number;
  description: string;
}

export interface RaidRarityConfig {
  hpMultiplier: number;
  durationDaysMin: number;
  durationDaysMax: number;
  baseXp: number;
  baseCoins: number;
}

export interface PackOpenedEvent {
  userId: string;
  tier: ExpeditionTier;
  cards: { mountain: { id: string; mountainLabel: string }; rarity: MountainRarity; isDuplicate: boolean }[];
}

declare module '../../../shared/events/bot-event-bus' {
  interface BotEventMap {
    'peak-hunters:pack:opened': PackOpenedEvent;
  }
}
