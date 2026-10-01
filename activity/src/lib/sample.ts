import type { HomeSummary } from '../../../src/features/activity/activity.types';

/** Données d'aperçu, quand l'Activity est ouverte hors de Discord (navigateur, développement). */
export const SAMPLE_HOME: HomeSummary = {
  user: { id: '0', username: 'apercu', displayName: 'Grimpeur' },
  profile: {
    level: 42,
    xp: { current: 640, required: 1000 },
    money: 1328,
    streak: 12,
    weeklyPoints: 48300,
    lastWeekPoints: 41200,
  },
  peakHunters: {
    owned: 142,
    total: 289,
    byRarity: [
      { id: 'legendary', label: 'Légendaire', color: '#f1c40f', owned: 5, total: 18 },
      { id: 'epic', label: 'Épique', color: '#9b59b6', owned: 19, total: 44 },
      { id: 'rare', label: 'Rare', color: '#3498db', owned: 41, total: 83 },
      { id: 'common', label: 'Commune', color: '#95a5a6', owned: 77, total: 144 },
    ],
    packs: { sentier: 2, falaise: 1, sommet: 1 },
    expeditions: { sentier: 3, falaise: 1, sommet: 0 },
    fragments: 12,
    fragmentsPerExpedition: 20,
  },
};
