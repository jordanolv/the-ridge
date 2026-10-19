import type {
  CollectionMountain,
  CollectionSummary,
  ExpeditionTierName,
  FeedEntry,
  HomeSummary,
  PackShow,
  PackTierInfo,
  PartiesSummary,
  PartyCard,
  ShowCard,
  StatsSummary,
} from '../../../src/features/activity/activity.types';

/** Données d'aperçu, quand l'Activity est ouverte hors de Discord (navigateur, développement). */
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
    speed: 1,
    paceAnchor: null,
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

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type SampleMountain = [id: string, label: string, elevation: number, countries: string[], flags: string[], rarity: string, lat: number, lng: number];

const SAMPLE_MOUNTAINS: SampleMountain[] = [
  ["Everest", "Everest", 8849, ["Népal", "République populaire de Chine"], ["🇳🇵", "🇨🇳"], "legendary", 27.9881, 86.925],
  ["K2", "K2", 8611, ["Pakistan"], ["🇵🇰"], "legendary", 35.8811, 76.5133],
  ["Cervin", "Cervin", 4478, ["Suisse", "Italie"], ["🇨🇭", "🇮🇹"], "epic", 45.9764, 7.6586],
  ["Mauna_Kea", "Mauna Kea", 4207, ["États-Unis"], ["🇺🇸"], "rare", 19.8206, -155.4681],
  ["Mont_Saint_Helens", "Mont Saint Helens", 2549, ["États-Unis"], ["🇺🇸"], "common", 46.2003, -122.1894],
  ["Puncak_Jaya", "Puncak Jaya", 4884, ["Indonésie"], ["🇮🇩"], "epic", -4.0833, 137.1833],
  ["Tambora", "Tambora", 2850, ["Indonésie"], ["🇮🇩"], "common", -8.2453, 117.9928],
  ["Mont_Rainier", "Mont Rainier", 4389, ["États-Unis"], ["🇺🇸"], "epic", 46.8517, -121.7603],
  ["Mayon", "Mayon", 2462, ["Philippines"], ["🇵🇭"], "common", 13.2567, 123.685],
  ["Khan_Tengri", "Khan Tengri", 7010, ["Kirghizistan", "Kazakhstan", "République populaire de Chine"], ["🇰🇬", "🇰🇿", "🇨🇳"], "legendary", 42.2108, 80.175],
  ["Klioutchevsko%C3%AF", "Klioutchevskoï", 4800, ["Russie"], ["🇷🇺"], "epic", 56.0667, 160.6333],
  ["Agung", "Agung", 3142, ["Indonésie"], ["🇮🇩"], "rare", -8.3419, 115.5078],
  ["Paricut%C3%ADn", "Paricutín", 2800, ["Mexique"], ["🇲🇽"], "common", 19.493, -102.251],
  ["Grandes_Jorasses", "Grandes Jorasses", 4208, ["France"], ["🇫🇷"], "rare", 45.8681, 6.9889],
  ["Vignemale", "Vignemale", 3299, ["France"], ["🇫🇷"], "rare", 42.7739, -0.1475],
  ["Grand_Ballon", "Grand Ballon", 1424, ["France"], ["🇫🇷"], "common", 47.9008, 7.0981],
  ["Mont_Pani%C3%A9", "Mont Panié", 1629, ["France"], ["🇫🇷"], "common", -20.5883, 164.7706],
  ["Mont_Agel", "Mont Agel", 1148, ["France"], ["🇫🇷"], "common", 43.7753, 7.4264],
  ["Table_des_Trois_Rois", "Table des Trois Rois", 2446, ["France"], ["🇫🇷"], "common", 42.9194, -0.7275],
  ["Aiguille_de_Bionnassay", "Aiguille de Bionnassay", 4052, ["France"], ["🇫🇷"], "rare", 45.8358, 6.8181],
  ["Mont_Aigoual", "Mont Aigoual", 1567, ["France"], ["🇫🇷"], "common", 44.1168, 3.5834],
  ["L%27Ailefroide", "L'Ailefroide", 3954, ["France"], ["🇫🇷"], "rare", 44.885, 6.3561],
  ["Pic_du_Marbor%C3%A9", "Pic du Marboré", 3248, ["France"], ["🇫🇷"], "rare", 42.6928, 0.0117],
  ["Grand_Colombier_(Ain)", "Grand Colombier", 1534, ["France"], ["🇫🇷"], "common", 45.8992, 5.7611],
  ["Le_Sal%C3%A8ve", "Salève", 1379, ["France"], ["🇫🇷"], "common", 46.0942, 6.1403],
  ["Kebnekaise", "Kebnekaise", 2097, ["Suède"], ["🇸🇪"], "common", 67.8833, 18.55],
  ["Chkhara", "Chkhara", 5193, ["Russie", "Géorgie", "Union soviétique", "Empire russe"], ["🇷🇺", "🇬🇪", "🇷🇺", "🇷🇺"], "epic", 42.9994, 43.1117],
  ["Yu_Shan", "Yu Shan", 3952, ["Taïwan"], ["🇹🇼"], "rare", 23.47, 120.9573],
  ["Volc%C3%A1n_de_Fuego", "Volcán de Fuego", 3765, ["Guatemala"], ["🇬🇹"], "rare", 14.4747, -90.8808],
  ["Mont_Lu", "Mont Lu", 1474, ["République populaire de Chine"], ["🇨🇳"], "common", 29.5725, 115.9733],
  ["Pico_Bol%C3%ADvar", "Pico Bolívar", 4978, ["Venezuela"], ["🇻🇪"], "epic", 8.5409, -71.0465],
  ["Galeras_(volcan)", "Galeras", 4276, ["Colombie"], ["🇨🇴"], "epic", 1.2167, -77.3667],
  ["Hoher_Dachstein", "Hoher Dachstein", 2995, ["Autriche"], ["🇦🇹"], "common", 47.4752, 13.6057],
  ["Mont_Narodna%C3%AFa", "Mont Narodnaïa", 1894, ["Russie"], ["🇷🇺"], "common", 65.0333, 60.1167],
  ["Cerro_de_Monserrate", "Cerro de Monserrate", 3152, ["Colombie"], ["🇨🇴"], "rare", 4.6058, -74.0564],
  ["Cerro_de_Guadalupe", "Cerro de Guadalupe", 3260, ["Colombie"], ["🇨🇴"], "rare", 4.5919, -74.0544],
  ["Gspaltenhorn", "Gspaltenhorn", 3436, ["Suisse"], ["🇨🇭"], "rare", 46.5114, 7.8278],
  ["Grand_Combin", "Grand Combin", 4309, ["Suisse"], ["🇨🇭"], "epic", 45.9375, 7.2992],
  ["Fronalpstock_(Glaris)", "Fronalpstock", 2124, ["Suisse"], ["🇨🇭"], "common", 47.0683, 9.1078],
  ["Grassen_(sommet)", "Grassen", 2946, ["Suisse"], ["🇨🇭"], "common", 46.7634, 8.4483],
  ["Piz_Zup%C3%B2", "Piz Zupò", 3995, ["Italie"], ["🇮🇹"], "rare", 46.3683, 9.9311],
  ["Gefrorene-Wand-Spitzen", "Gefrorene-Wand-Spitzen", 3288, ["Autriche"], ["🇦🇹"], "rare", 47.0653, 11.6792],
  ["B%C3%B6s_Fulen", "Bös Fulen", 2801, ["Suisse"], ["🇨🇭"], "common", 46.9672, 8.9458],
  ["Auyan_Tepuy", "Auyán Tepuy", 2500, ["Venezuela"], ["🇻🇪"], "common", 5.9009, -62.55],
  ["Niesen", "Niesen", 2362, ["Suisse"], ["🇨🇭"], "common", 46.6461, 7.6525],
  ["Blauen_(Badenweiler)", "Hochblauen", 1165, ["Allemagne"], ["🇩🇪"], "common", 47.7775, 7.7011],
  ["Mount_Snow", "Mount Snow", 1093, ["États-Unis"], ["🇺🇸"], "common", 42.959, -72.9237],
  ["Sorikmarapi", "Sorikmarapi", 2145, ["Indonésie"], ["🇮🇩"], "common", 0.686, 99.539],
];

const altitude = (elevation: number) => `${new Intl.NumberFormat('fr-FR').format(elevation)} m`;

export const SAMPLE_COLLECTION: CollectionSummary = {
  rarities: Object.entries(RARITY).reverse().map(([id, r]) => ({ id, label: r.rarityLabel, color: r.color })),
  mountains: SAMPLE_MOUNTAINS.map(([id, label, elevation, countries, flags, rarity, lat, lng], index): CollectionMountain => {
    const path = `/api/activity/mountains/${encodeURIComponent(id)}/image`;
    return {
      id,
      label,
      altitude: altitude(elevation),
      elevation,
      countries,
      flags,
      rarity,
      lat,
      lng,
      image: path,
      thumbnail: `${path}?size=thumb`,
      unlockedAt: index % 3 === 2 ? null : Date.now() - index * 2.5 * DAY,
    };
  }),
};

const series = (length: number, scale: number, seed: number) =>
  Array.from({ length }, (_, i) => {
    const wave = Math.sin(i / 2.3 + seed) * 0.5 + 0.5;
    const weekend = [5, 6].includes((i + 4) % 7) ? 1.6 : 1;
    return i % 9 === 4 ? 0 : Math.round(wave * weekend * scale);
  });

const sampleDays = () =>
  Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * DAY).toISOString().slice(0, 10));

const PLAYERS = ['Lucas', 'Emma', 'Grimpeur', 'Nina', 'Hugo', 'Léa', 'Tom', 'Jade', 'Noah', 'Chloé', 'Sacha'];

const board = (id: StatsSummary['leaderboards'][number]['id'], label: string, unit: StatsSummary['leaderboards'][number]['unit'], top: number): StatsSummary['leaderboards'][number] => {
  const entries = PLAYERS.slice(0, 10).map((name, index) => ({
    rank: index + 1,
    userId: name === 'Grimpeur' ? '0' : String(index + 1),
    name,
    value: Math.round(top * (1 - index * 0.085)),
  }));
  return { id, label, unit, entries, me: entries.find(e => e.userId === '0') ?? null };
};

export const SAMPLE_STATS: StatsSummary = {
  players: 64,
  totals: [
    { id: 'messages', label: 'Messages', unit: 'messages', value: 18432, rank: 4 },
    { id: 'voice', label: 'En vocal', unit: 'seconds', value: 1_026_000, rank: 2 },
    { id: 'streak', label: 'Série', unit: 'days', value: 12, rank: 7 },
    { id: 'parties', label: 'Soirées', unit: 'parties', value: 23, rank: 3 },
  ],
  days: sampleDays(),
  voice: series(30, 9000, 0),
  messages: series(30, 120, 1.7),
  leaderboards: [
    board('weekly', 'Semaine', 'points', 61200),
    board('voice', 'Vocal', 'seconds', 1_480_000),
    board('messages', 'Messages', 'messages', 26100),
    board('streak', 'Série', 'days', 48),
    board('mountains', 'Peak Hunters', 'mountains', 203),
  ],
  games: [
    { id: 'shifumi', label: 'Shifumi', emoji: '✊', wins: 34, played: 61 },
    { id: 'puissance4', label: 'Puissance 4', emoji: '🔴', wins: 12, played: 19 },
    { id: 'morpion', label: 'Morpion', emoji: '⭕', wins: 8, played: 21 },
    { id: 'battle', label: 'Battle', emoji: '⚔️', wins: 0, played: 0 },
    { id: 'bingo', label: 'Bingo', emoji: '🎯', wins: 3, played: 140 },
    { id: 'justePrix', label: 'Juste Prix', emoji: '💰', wins: 6, played: 38 },
    { id: 'avalanche', label: 'Avalanche', emoji: '🏔️', wins: 2, played: 9 },
    { id: 'enigme', label: 'Énigme', emoji: '🧩', wins: 1, played: 14 },
  ],
};

const participants = (count: number) => PLAYERS.slice(0, count).map((name, index) => ({ id: name === 'Grimpeur' ? '0' : String(index + 1), name }));

const party = (overrides: Partial<PartyCard> & Pick<PartyCard, 'id' | 'name' | 'game' | 'status' | 'startsAt'>): PartyCard => ({
  description: null,
  startedAt: null,
  endedAt: null,
  color: '#a78bfa',
  image: null,
  maxSlots: 10,
  participants: participants(6),
  attended: 0,
  joined: true,
  rewards: null,
  ...overrides,
});

const LIVE_PARTY = party({
  id: 'p-live',
  name: 'Tournoi Mario Kart',
  game: 'Mario Kart 8 Deluxe',
  description: 'Coupe 150cc, 4 grands prix. Le podium repart avec des RidgeCoins.',
  status: 'started',
  startsAt: Date.now() - 50 * 60_000,
  startedAt: Date.now() - 38 * 60_000,
  color: '#f472b6',
  maxSlots: 12,
  participants: participants(9),
});

export const SAMPLE_PARTIES: PartiesSummary = {
  live: [LIVE_PARTY],
  upcoming: [
    party({ id: 'p-1', name: 'Soirée Among Us', game: 'Among Us', status: 'pending', startsAt: Date.now() + 5 * HOUR, color: '#67e8f9', participants: participants(7), maxSlots: 10 }),
    party({ id: 'p-2', name: 'Lethal Company entre potes', game: 'Lethal Company', description: 'On vise le quota, ou pas.', status: 'pending', startsAt: Date.now() + 2 * DAY + 3 * HOUR, color: '#f59e0b', participants: participants(3), maxSlots: 4, joined: false }),
    party({ id: 'p-3', name: 'Quiz musical', game: 'Blind test', status: 'pending', startsAt: Date.now() + 6 * DAY, color: '#a78bfa', participants: participants(2), maxSlots: 20, joined: false }),
  ],
  past: [
    party({ id: 'p-4', name: 'Nuit Minecraft', game: 'Minecraft', status: 'ended', startsAt: Date.now() - 3 * DAY, endedAt: Date.now() - 3 * DAY + 4 * HOUR, color: '#34d399', attended: 8, rewards: { money: 150, xp: 300, expeditions: 1 } }),
    party({ id: 'p-5', name: 'Rocket League 3v3', game: 'Rocket League', status: 'ended', startsAt: Date.now() - 9 * DAY, endedAt: Date.now() - 9 * DAY + 2 * HOUR, color: '#60a5fa', attended: 6, joined: false, rewards: { money: 100, xp: 200, expeditions: 0 } }),
  ],
  attendedCount: 23,
};

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
  nextParty: LIVE_PARTY,
};
