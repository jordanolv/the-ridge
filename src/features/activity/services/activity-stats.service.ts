import { UserMountainsRepository } from '../../peak-hunters/repositories/user-mountains.repository';
import { dailyTotals, parisDays } from '../../user/services/profile-card/engine/series';
import { UserRepository, type RankedField } from '../../user/services/user.repository';
import { UserService } from '../../user/services/user.service';
import { toParisDayYMD } from '../../../shared/time/day-split';
import type { GameScore, Leaderboard, LeaderboardEntry, LeaderboardId, StatTotal, StatUnit, StatsSummary } from '../activity.types';

const DAYS = 30;
const TOP = 10;
const users = new UserRepository();

type Account = NonNullable<Awaited<ReturnType<typeof UserService.getUserByDiscordId>>>;
type ArcadeKey = keyof Account['stats']['arcade'];

interface RankedStat {
  id: string;
  label: string;
  unit: StatUnit;
  field: RankedField;
  read: (stats: Account['stats'] | undefined) => number;
}

const TOTALS: RankedStat[] = [
  { id: 'messages', label: 'Messages', unit: 'messages', field: 'stats.totalMsg', read: s => s?.totalMsg ?? 0 },
  { id: 'voice', label: 'En vocal', unit: 'seconds', field: 'stats.voiceTime', read: s => s?.voiceTime ?? 0 },
  { id: 'streak', label: 'Série', unit: 'days', field: 'stats.dailyStreak', read: s => s?.dailyStreak ?? 0 },
  { id: 'parties', label: 'Soirées', unit: 'parties', field: 'stats.partyParticipated', read: s => s?.partyParticipated ?? 0 },
];

const LEADERBOARDS: (RankedStat & { id: LeaderboardId })[] = [
  { id: 'weekly', label: 'Semaine', unit: 'points', field: 'stats.activityPoints', read: s => s?.activityPoints ?? 0 },
  { id: 'voice', label: 'Vocal', unit: 'seconds', field: 'stats.voiceTime', read: s => s?.voiceTime ?? 0 },
  { id: 'messages', label: 'Messages', unit: 'messages', field: 'stats.totalMsg', read: s => s?.totalMsg ?? 0 },
  { id: 'streak', label: 'Série', unit: 'days', field: 'stats.dailyStreak', read: s => s?.dailyStreak ?? 0 },
];

const DUELS: { id: ArcadeKey; label: string; emoji: string }[] = [
  { id: 'shifumi', label: 'Shifumi', emoji: '✊' },
  { id: 'puissance4', label: 'Puissance 4', emoji: '🔴' },
  { id: 'morpion', label: 'Morpion', emoji: '⭕' },
  { id: 'battle', label: 'Battle', emoji: '⚔️' },
];

const SERVER_GAMES: { id: ArcadeKey; label: string; emoji: string }[] = [
  { id: 'bingo', label: 'Bingo', emoji: '🎯' },
  { id: 'justePrix', label: 'Juste Prix', emoji: '💰' },
  { id: 'avalanche', label: 'Avalanche', emoji: '🏔️' },
  { id: 'enigme', label: 'Énigme', emoji: '🧩' },
];

function games(arcade: Account['stats']['arcade'] | undefined): GameScore[] {
  const duels = DUELS.map(game => {
    const score = arcade?.[game.id];
    return { ...game, wins: score?.wins ?? 0, played: (score?.wins ?? 0) + (score?.losses ?? 0) };
  });
  const servers = SERVER_GAMES.map(game => {
    const score = arcade?.[game.id];
    return { ...game, wins: score?.wins ?? 0, played: score?.attempts ?? 0 };
  });
  return [...duels, ...servers];
}

/** Les ex æquo partagent un rang, comme `rankBy` : 1 + le nombre de joueurs strictement devant. */
function ranked(rows: { userId: string; name: string; value: number }[]): LeaderboardEntry[] {
  return rows.map((row, index) => ({ ...row, rank: 1 + rows.slice(0, index).filter(other => other.value > row.value).length }));
}

async function leaderboard(stat: RankedStat & { id: LeaderboardId }, userId: string, name: string, mine: number): Promise<Leaderboard> {
  const [top, rank] = await Promise.all([users.topBy(stat.field, TOP), users.rankBy(stat.field, mine)]);
  const entries = ranked(top.map(u => ({ userId: u.discordId, name: u.name, value: u.value })));
  return { id: stat.id, label: stat.label, unit: stat.unit, entries, me: mine > 0 ? { rank, userId, name, value: mine } : null };
}

async function mountainsLeaderboard(userId: string, name: string): Promise<Leaderboard> {
  const sizes = await UserMountainsRepository.collectionSizes();
  const names = await users.namesOf(sizes.slice(0, TOP).map(s => s.userId));
  const mine = sizes.find(s => s.userId === userId)?.total ?? 0;

  return {
    id: 'mountains',
    label: 'Peak Hunters',
    unit: 'mountains',
    entries: ranked(sizes.slice(0, TOP).map(s => ({ userId: s.userId, name: names.get(s.userId) ?? 'Joueur', value: s.total }))),
    me: mine > 0 ? { rank: 1 + sizes.filter(s => s.total > mine).length, userId, name, value: mine } : null,
  };
}

export class ActivityStatsService {
  static async summary(userId: string, fallbackName: string): Promise<StatsSummary> {
    const account = await UserService.getUserByDiscordId(userId);
    const stats = account?.stats;
    const name = account?.name ?? fallbackName;

    const [players, totals, boards, mountains] = await Promise.all([
      users.countUsers(),
      Promise.all(TOTALS.map(async (stat): Promise<StatTotal> => {
        const value = stat.read(stats);
        return { id: stat.id, label: stat.label, unit: stat.unit, value, rank: await users.rankBy(stat.field, value) };
      })),
      Promise.all(LEADERBOARDS.map(stat => leaderboard(stat, userId, name, stat.read(stats)))),
      mountainsLeaderboard(userId, name),
    ]);

    return {
      players,
      totals,
      days: parisDays(DAYS).map(day => toParisDayYMD(day)),
      voice: dailyTotals((stats?.voiceHistory ?? []).map(v => ({ date: v.date, amount: v.time })), DAYS).map(d => d.total),
      messages: dailyTotals((stats?.messageHistory ?? []).map(m => ({ date: m.date, amount: m.count })), DAYS).map(d => d.total),
      leaderboards: [...boards, mountains],
      games: games(stats?.arcade),
    };
  }
}
