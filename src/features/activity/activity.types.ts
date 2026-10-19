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
  nextParty: PartyCard | null;
}

export interface RarityInfo {
  id: string;
  label: string;
  color: string;
}

export interface CollectionMountain {
  id: string;
  label: string;
  altitude: string;
  elevation: number;
  countries: string[];
  flags: string[];
  rarity: string;
  lat: number | null;
  lng: number | null;
  image: string;
  thumbnail: string;
  unlockedAt: number | null;
}

export interface CollectionSummary {
  rarities: RarityInfo[];
  mountains: CollectionMountain[];
}

export type LeaderboardId = 'weekly' | 'voice' | 'messages' | 'streak' | 'mountains';
export type StatUnit = 'points' | 'seconds' | 'messages' | 'days' | 'mountains' | 'parties';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  value: number;
}

export interface Leaderboard {
  id: LeaderboardId;
  label: string;
  unit: StatUnit;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

export interface StatTotal {
  id: string;
  label: string;
  unit: StatUnit;
  value: number;
  rank: number;
}

export interface GameScore {
  id: string;
  label: string;
  emoji: string;
  wins: number;
  played: number;
}

export interface StatsSummary {
  players: number;
  totals: StatTotal[];
  days: string[];
  voice: number[];
  messages: number[];
  leaderboards: Leaderboard[];
  games: GameScore[];
}

export type PartyStatus = 'pending' | 'started' | 'ended';

export interface PartyCard {
  id: string;
  name: string;
  game: string;
  description: string | null;
  status: PartyStatus;
  startsAt: number;
  startedAt: number | null;
  endedAt: number | null;
  color: string;
  image: string | null;
  maxSlots: number;
  participants: { id: string; name: string }[];
  attended: number;
  joined: boolean;
  rewards: { money: number; xp: number; expeditions: number } | null;
}

export interface PartiesSummary {
  live: PartyCard[];
  upcoming: PartyCard[];
  past: PartyCard[];
  attendedCount: number;
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

/** `remaining` : les packs de ce type qui restent après celui-ci, pour proposer d'enchaîner. */
export type OpenPackResult = { ok: true; show: PackShow; remaining: number } | { ok: false; reason: 'no-pack' | 'draw-failed' };

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
