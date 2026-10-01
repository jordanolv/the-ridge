import { parisDays } from '../engine/series';
import type { ActivityData } from './activity.tab';
import type { GamesData } from './games.tab';
import type { PeakHuntersData } from './peak-hunters.tab';
import type { ProfileData } from './profile.tab';

/**
 * Données d'exemple de chaque onglet, sans base ni Discord : de quoi tester le rendu
 * et prévisualiser un thème (`scripts/preview-card.ts`).
 */
const wave = (length: number, scale: number) => Array.from({ length }, (_, i) => Math.max(0, Math.round(scale * (0.55 + 0.45 * Math.sin(i / 2.3)))));

const AVATAR = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#5865F2"/><circle cx="128" cy="105" r="52" fill="#fff"/><ellipse cx="128" cy="225" rx="78" ry="55" fill="#fff"/></svg>',
);

const days14 = parisDays(14);
const days30 = parisDays(30);

const profile: ProfileData = {
  pseudo: 'Pseudo',
  bio: 'Une bio pour voir le rendu',
  avatar: AVATAR,
  ridgecoin: '1 250',
  level: '42',
  messages: '8 431',
  voice: '312h',
  birthday: '21/03/1998',
  joinedAt: '12/09/2023',
  roles: [
    { name: 'Campeur', color: '#e67e22' },
    { name: 'Podium', color: '#f1c40f' },
    { name: 'Membre', color: '#95a5a6' },
  ],
  voiceFortnight: days14.map((date, i) => ({ date, total: wave(14, 5400)[i] })),
  mountains: { unlocked: 142, total: 289 },
  xp: { current: 640, required: 1000, percent: 0.64 },
};

const activity: ActivityData = {
  days: days30,
  messages: wave(30, 90),
  voice: wave(30, 7200),
  totalMessages: 8431,
  totalVoice: 1_123_200,
  streak: 12,
  dailies: 87,
  balance: Array.from({ length: 30 }, (_, i) => 900 + i * 12 + (i % 5) * 20),
  players: 214,
  ranks: [
    { label: '💬 Messages', rank: 12 },
    { label: '🔊 Vocal', rank: 4 },
    { label: '🔥 Série', rank: 27 },
    { label: '⚡ Activité de la semaine', rank: 3, detail: '48 300 pts' },
  ],
  salary: { points: 48300, rank: 3, qualified: 40, estimate: 185 },
};

const games: GamesData = {
  duels: {
    shifumi: { wins: 34, losses: 21, attempts: 0 },
    puissance4: { wins: 12, losses: 15, attempts: 0 },
    morpion: { wins: 8, losses: 3, attempts: 0 },
    battle: { wins: 51, losses: 40, attempts: 0 },
  },
  servers: {
    bingo: { wins: 6, losses: 0, attempts: 142, lastWin: new Date('2026-09-20T18:00:00Z') },
    justePrix: { wins: 9, losses: 0, attempts: 40, lastWin: new Date('2026-09-27T18:00:00Z') },
    avalanche: { wins: 2, losses: 0, attempts: 17, lastWin: null },
    enigme: { wins: 4, losses: 0, attempts: 25, lastWin: new Date('2026-09-29T15:00:00Z') },
  },
  quiz: { correct: 312, answered: 420, streak: 5, bestStreak: 23, weekly: 18 },
  parties: 14,
  personalityTests: 3,
};

const peakHunters: PeakHuntersData = {
  owned: 142,
  total: 289,
  byRarity: [
    { rarity: 'legendary', owned: 5, total: 18, icon: null },
    { rarity: 'epic', owned: 19, total: 44, icon: null },
    { rarity: 'rare', owned: 41, total: 83, icon: null },
    { rarity: 'common', owned: 77, total: 144, icon: null },
  ],
  showcase: ['Everest', 'K2', 'Lhotse', 'Aconcagua', 'Denali', 'Mont Blanc'].map((label, i) => ({
    photo: null,
    label,
    caption: i < 2 ? 'Légendaire' : 'Épique',
    color: i < 2 ? '#f1c40f' : '#9b59b6',
  })),
  missing: ['Annapurna', 'Kilimandjaro', 'Cervin', 'Puy de Dôme'].map((label, i) => ({
    photo: null,
    label,
    caption: ['Légendaire', 'Épique', 'Rare', 'Commune'][i],
    color: ['#f1c40f', '#9b59b6', '#3498db', '#95a5a6'][i],
    hidden: true,
  })),
  ranking: {
    rank: 3,
    players: 57,
    rows: [
      { rank: 1, name: 'alpiniste_du_dimanche', value: '201', highlighted: false },
      { rank: 2, name: 'sherpa', value: '188', highlighted: false },
      { rank: 3, name: 'Pseudo', value: '142', highlighted: true },
      { rank: 4, name: 'randonneuse', value: '139', highlighted: false },
      { rank: 5, name: 'yeti', value: '120', highlighted: false },
    ],
  },
  tiers: [
    { tier: 'sentier', icon: null, tickets: 3, packs: 1, opened: 61 },
    { tier: 'falaise', icon: null, tickets: 1, packs: 0, opened: 14 },
    { tier: 'sommet', icon: null, tickets: 0, packs: 2, opened: 5 },
  ],
  fragments: 12,
};

export const SAMPLES: Record<string, unknown> = {
  profil: profile,
  activite: activity,
  jeux: games,
  'peak-hunters': peakHunters,
};
