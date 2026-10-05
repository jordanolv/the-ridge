import type { ExpeditionTierName, FeedEntry, HomeSummary, PackShow, PackTierInfo, ShowCard } from '../../../src/features/activity/activity.types';

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

export const SAMPLE_PACKS: PackTierInfo[] = [
  { id: 'sentier', label: 'Sentier', description: 'Probabilités normales', color: '#e67e22', cards: 3, owned: 2 },
  { id: 'falaise', label: 'Falaise', description: 'Meilleures chances de rare et épique', color: '#3498db', cards: 5, owned: 1 },
  { id: 'sommet', label: 'Sommet', description: 'Garantit une montagne Épique ou Légendaire', color: '#9b59b6', cards: 5, owned: 1 },
];

const RARITY = {
  common: { rarityLabel: 'Commune', color: '#95a5a6' },
  rare: { rarityLabel: 'Rare', color: '#3498db' },
  epic: { rarityLabel: 'Épique', color: '#9b59b6' },
  legendary: { rarityLabel: 'Légendaire', color: '#f1c40f' },
};

const card = (id: string, label: string, altitude: string, countries: string[], rarity: keyof typeof RARITY, lat: number, lng: number, isDuplicate = false): ShowCard => ({
  id,
  label,
  countries,
  altitude,
  elevation: Number.parseInt(altitude.replace(/\D/g, ''), 10),
  rarity,
  ...RARITY[rarity],
  image: `/api/activity/mountains/${encodeURIComponent(id)}/image`,
  lat,
  lng,
  isDuplicate,
  fragmentsGained: isDuplicate ? 3 : 0,
  expeditionsAwarded: 0,
});

const SAMPLE_CARDS: ShowCard[] = [
  card('V%C3%A9suve', 'Vésuve', '1 281 m', ['Italie'], 'common', 40.82261, 14.42919),
  card('Mont_Fuji', 'Mont Fuji', '3 777 m', ['Japon'], 'rare', 35.360555555, 138.7275, true),
  card('Cervin', 'Cervin', '4 478 m', ['Suisse', 'Italie'], 'epic', 45.976388888, 7.658611111),
  card('Aconcagua', 'Aconcagua', '6 962 m', ['Argentine'], 'epic', -32.653055555, -70.011666666),
  card('Everest', 'Everest', '8 849 m', ['Népal', 'République populaire de Chine'], 'legendary', 27.988055555, 86.925),
];

export function samplePackShow(tier: ExpeditionTierName): PackShow {
  const pack = SAMPLE_PACKS.find(p => p.id === tier)!;
  return {
    id: crypto.randomUUID(),
    opener: SAMPLE_HOME.user,
    tier,
    tierLabel: pack.label,
    tierColor: pack.color,
    cards: SAMPLE_CARDS.slice(SAMPLE_CARDS.length - pack.cards),
    startsAt: Date.now() + 300,
    skippedAt: null,
  };
}

export const SAMPLE_FEED: FeedEntry[] = [
  {
    id: 'feed-1',
    at: Date.now() - 4 * 60_000,
    user: { id: '1', username: 'lucas', displayName: 'Lucas' },
    tierLabel: 'Sommet',
    tierColor: '#9b59b6',
    best: { label: 'K2', rarityLabel: 'Légendaire', color: '#f1c40f' },
    fresh: 3,
    cards: 5,
  },
  {
    id: 'feed-2',
    at: Date.now() - 26 * 60_000,
    user: { id: '2', username: 'emma', displayName: 'Emma' },
    tierLabel: 'Sentier',
    tierColor: '#e67e22',
    best: { label: 'Mont Blanc', rarityLabel: 'Épique', color: '#9b59b6' },
    fresh: 1,
    cards: 3,
  },
];
