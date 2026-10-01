/** Contrat entre le serveur et l'Activity Discord (`activity/`), qui importe ces types tels quels. */

export interface ActivityConfig {
  clientId: string;
  mapboxToken: string | null;
}

export interface ActivityUser {
  id: string;
  username: string;
  displayName: string;
}

export type ExpeditionTierName = 'sentier' | 'falaise' | 'sommet';

export interface RarityProgress {
  id: string;
  label: string;
  color: string;
  owned: number;
  total: number;
}

export interface HomeSummary {
  user: ActivityUser;
  profile: {
    level: number;
    xp: { current: number; required: number };
    money: number;
    streak: number;
    weeklyPoints: number;
    lastWeekPoints: number;
  } | null;
  peakHunters: {
    owned: number;
    total: number;
    byRarity: RarityProgress[];
    packs: Record<ExpeditionTierName, number>;
    expeditions: Record<ExpeditionTierName, number>;
    fragments: number;
    fragmentsPerExpedition: number;
  };
}

export interface PackTierInfo {
  id: ExpeditionTierName;
  label: string;
  description: string;
  color: string;
  cards: number;
  owned: number;
}

export interface ShowCard {
  id: string;
  label: string;
  countries: string[];
  altitude: string;
  elevation: number;
  rarity: string;
  rarityLabel: string;
  color: string;
  image: string;
  lat: number | null;
  lng: number | null;
  isDuplicate: boolean;
  fragmentsGained: number;
  expeditionsAwarded: number;
}

/** Une ouverture de pack jouée en même temps chez tous les joueurs de l'Activity. */
export interface PackShow {
  id: string;
  opener: ActivityUser;
  tier: ExpeditionTierName;
  tierLabel: string;
  tierColor: string;
  cards: ShowCard[];
  startsAt: number;
  skippedAt: number | null;
}

export type OpenPackResult = { ok: true; show: PackShow } | { ok: false; reason: 'no-pack' | 'draw-failed' };

export interface FeedEntry {
  id: string;
  at: number;
  user: ActivityUser;
  tierLabel: string;
  tierColor: string;
  best: { label: string; rarityLabel: string; color: string };
  fresh: number;
  cards: number;
}

export const REACTIONS = ['🔥', '😱', '😭', '👏', '🤯'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

export interface LiveReaction {
  id: string;
  user: ActivityUser;
  emoji: ReactionEmoji;
}

export type LiveServerMessage =
  | { type: 'welcome'; serverNow: number; participants: ActivityUser[]; shows: PackShow[]; feed: FeedEntry[] }
  | { type: 'participants'; participants: ActivityUser[] }
  | { type: 'shows'; shows: PackShow[] }
  | { type: 'reaction'; reaction: LiveReaction }
  | { type: 'feed'; entry: FeedEntry };

export type LiveClientMessage =
  | { type: 'join'; token: string; instanceId: string }
  | { type: 'react'; emoji: ReactionEmoji }
  | { type: 'skip'; showId: string };
