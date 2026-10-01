import { GameResultRepository } from '../../../../arcade/results/repositories/game-result.repository';
import type { ResultGame } from '../../../../arcade/results/models/game-result.model';
import { card } from '../components/card';
import { MUTED, SHRINK_TO_FIT, SOFT, titledPanel, type Child } from '../components/panel';
import { meter } from '../components/progress-bar';
import { box, text, type CardNode } from '../engine/elements';
import { formatDate, formatNumber } from '../engine/format';
import { rect, type Rect } from '../engine/geometry';
import type { ThemeStyle } from '../engine/themes';
import { defineTab } from './tab';

const COLUMN_WIDTH = 344;
const column = (i: number) => 28 + i * (COLUMN_WIDTH + 22);

const PANELS = {
  duels: [0, 1, 2, 3].map(i => rect(column(i), 28, COLUMN_WIDTH, 200)),
  servers: [0, 1, 2, 3].map(i => rect(column(i), 250, COLUMN_WIDTH, 200)),
  quiz: rect(28, 472, 710, 400),
  record: rect(760, 472, 345, 400),
  community: rect(1127, 472, 345, 400),
};

const LAYOUT = { id: 'jeux', panels: [...PANELS.duels, ...PANELS.servers, PANELS.quiz, PANELS.record, PANELS.community] };

const DUELS = [
  { key: 'shifumi', title: '✊ Shifumi' },
  { key: 'puissance4', title: '🔴 Puissance 4' },
  { key: 'morpion', title: '⭕ Morpion' },
  { key: 'battle', title: '⚔️ Battle' },
] as const;

const SERVER_GAMES: { key: ResultGame; title: string; wins: string; attempts: string }[] = [
  { key: 'bingo', title: '🎯 Bingo', wins: 'victoires', attempts: 'coups joués' },
  { key: 'justePrix', title: '💰 Juste Prix', wins: 'victoires', attempts: 'manches jouées' },
  { key: 'avalanche', title: '🏔️ Avalanche', wins: 'victoires', attempts: 'parties jouées' },
  { key: 'enigme', title: '🧩 Énigme', wins: 'podiums en or', attempts: 'énigmes tentées' },
];

interface Score {
  wins: number;
  losses: number;
  attempts: number;
}

export interface GamesData {
  duels: Record<(typeof DUELS)[number]['key'], Score>;
  servers: Record<ResultGame, Score & { lastWin: Date | null }>;
  quiz: { correct: number; answered: number; streak: number; bestStreak: number; weekly: number };
  parties: number;
  personalityTests: number;
  dailies: number;
}

const score = (stats?: Partial<Score>): Score => ({ wins: stats?.wins ?? 0, losses: stats?.losses ?? 0, attempts: stats?.attempts ?? 0 });
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function headline(value: string, label: string): CardNode {
  return box(
    { alignItems: 'baseline', gap: 10 },
    text({ fontSize: 46, fontWeight: 900, color: 'white', ...SHRINK_TO_FIT }, value),
    text({ fontSize: 18, color: MUTED }, label),
  );
}

function detail(label: string, value: string): CardNode {
  return box(
    { justifyContent: 'space-between', fontSize: 17 },
    text({ color: MUTED }, label),
    text({ color: SOFT, fontWeight: 700 }, value),
  );
}

function duelPanel(r: Rect, theme: ThemeStyle, title: string, s: Score): CardNode {
  const played = s.wins + s.losses;
  return titledPanel(
    r,
    theme,
    title,
    headline(formatNumber(s.wins), s.wins > 1 ? 'victoires' : 'victoire'),
    box(
      { flexDirection: 'column', gap: 8, marginTop: 'auto' },
      box({ alignItems: 'center', gap: 12 }, meter(played > 0 ? s.wins / played : 0, theme.accent), text({ fontSize: 17, fontWeight: 700, color: SOFT }, `${percent(s.wins, played)} %`)),
      detail('Défaites', formatNumber(s.losses)),
    ),
  );
}

function serverGamePanel(r: Rect, theme: ThemeStyle, game: (typeof SERVER_GAMES)[number], s: GamesData['servers'][ResultGame]): Child {
  return titledPanel(
    r,
    theme,
    game.title,
    headline(formatNumber(s.wins), game.wins),
    box(
      { flexDirection: 'column', gap: 6, marginTop: 'auto' },
      detail(game.attempts[0].toUpperCase() + game.attempts.slice(1), formatNumber(s.attempts)),
      detail('Dernière victoire', s.lastWin ? formatDate(s.lastWin) : '—'),
    ),
  );
}

export const gamesTab = defineTab<GamesData>({
  id: 'jeux',
  label: 'Jeux',
  emoji: '🎮',
  layout: LAYOUT,

  async load({ user, account }) {
    const arcade = account.stats?.arcade;
    const quiz = account.stats?.quiz;
    const lastWins = await GameResultRepository.lastWinsOf(user.id);

    return {
      duels: {
        shifumi: score(arcade?.shifumi),
        puissance4: score(arcade?.puissance4),
        morpion: score(arcade?.morpion),
        battle: score(arcade?.battle),
      },
      servers: Object.fromEntries(
        SERVER_GAMES.map(({ key }) => [key, { ...score(arcade?.[key]), lastWin: lastWins[key] ?? null }]),
      ) as GamesData['servers'],
      quiz: {
        correct: quiz?.totalCorrect ?? 0,
        answered: quiz?.totalAnswered ?? 0,
        streak: quiz?.streak ?? 0,
        bestStreak: quiz?.bestStreak ?? 0,
        weekly: quiz?.weeklyCorrect ?? 0,
      },
      parties: account.stats?.partyParticipated ?? 0,
      personalityTests: account.stats?.personalityTestsCount ?? 0,
      dailies: account.stats?.totalDailies ?? 0,
    };
  },

  build(data, theme) {
    const { style } = theme;
    const { quiz } = data;
    const duelWins = DUELS.reduce((total, d) => total + data.duels[d.key].wins, 0);
    const serverWins = SERVER_GAMES.reduce((total, g) => total + data.servers[g.key].wins, 0);
    const favourite = [...DUELS.map(d => ({ title: d.title, wins: data.duels[d.key].wins })), ...SERVER_GAMES.map(g => ({ title: g.title, wins: data.servers[g.key].wins }))]
      .sort((a, b) => b.wins - a.wins)[0];

    return card(
      theme,
      LAYOUT,
      ...DUELS.map((duel, i) => duelPanel(PANELS.duels[i], style, duel.title, data.duels[duel.key])),
      ...SERVER_GAMES.map((game, i) => serverGamePanel(PANELS.servers[i], style, game, data.servers[game.key])),

      titledPanel(
        PANELS.quiz,
        style,
        '🧠 Quiz',
        box(
          { flexDirection: 'column', justifyContent: 'space-around', flexGrow: 1 },
          headline(formatNumber(quiz.correct), quiz.correct > 1 ? 'bonnes réponses' : 'bonne réponse'),
          box({ alignItems: 'center', gap: 12 }, meter(quiz.answered > 0 ? quiz.correct / quiz.answered : 0, style.accent, 14), text({ fontSize: 18, fontWeight: 700, color: SOFT }, `${percent(quiz.correct, quiz.answered)} % de réussite`)),
          detail('Questions répondues', formatNumber(quiz.answered)),
          detail('Bonnes réponses cette semaine', formatNumber(quiz.weekly)),
          detail('Série en cours', formatNumber(quiz.streak)),
          detail('Meilleure série', formatNumber(quiz.bestStreak)),
        ),
      ),

      titledPanel(
        PANELS.record,
        style,
        '🏅 Palmarès',
        box(
          { flexDirection: 'column', justifyContent: 'space-around', flexGrow: 1 },
          headline(formatNumber(duelWins + serverWins), duelWins + serverWins > 1 ? 'victoires' : 'victoire'),
          detail('⚔️ En duel', formatNumber(duelWins)),
          detail('🎯 Aux jeux du serveur', formatNumber(serverWins)),
          detail('Jeu fétiche', favourite.wins > 0 ? favourite.title : '—'),
        ),
      ),

      titledPanel(
        PANELS.community,
        style,
        '🎉 Vie du serveur',
        box(
          { flexDirection: 'column', justifyContent: 'space-around', flexGrow: 1 },
          headline(formatNumber(data.parties), data.parties > 1 ? 'soirées vocales' : 'soirée vocale'),
          detail('🔮 Tests de personnalité', formatNumber(data.personalityTests)),
          detail('🎁 Dailies réclamés', formatNumber(data.dailies)),
        ),
      ),
    );
  },
});
