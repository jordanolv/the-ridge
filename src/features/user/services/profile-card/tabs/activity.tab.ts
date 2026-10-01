import { estimateWeeklySalary, type SalaryEstimate } from '../../../../../shared/economy/salary-estimate';
import { LogService } from '../../../../../shared/logs/logs.service';
import { UserRepository } from '../../user.repository';
import { card } from '../components/card';
import { barChart, lineChart, type AxisLabel } from '../components/charts';
import { MUTED, titledPanel } from '../components/panel';
import { rankLine } from '../components/ranking';
import { kpi } from '../components/stat-card';
import { box, text } from '../engine/elements';
import { formatDuration, formatNumber, plural } from '../engine/format';
import { rect } from '../engine/geometry';
import { balanceHistory, dailyTotals, parisDays } from '../engine/series';
import { defineTab } from './tab';

const DAYS = 30;
const KPI_WIDTH = 344;

const PANELS = {
  kpis: [0, 1, 2, 3].map(i => rect(28 + i * (KPI_WIDTH + 22), 28, KPI_WIDTH, 150)),
  voice: rect(28, 200, 900, 325),
  messages: rect(28, 547, 900, 325),
  ranks: rect(950, 200, 522, 325),
  economy: rect(950, 547, 522, 325),
};

const LAYOUT = { id: 'activite', panels: [...PANELS.kpis, PANELS.voice, PANELS.messages, PANELS.ranks, PANELS.economy] };

const repository = new UserRepository();

interface Rank {
  label: string;
  rank: number;
  detail?: string;
}

export interface ActivityData {
  days: Date[];
  messages: number[];
  voice: number[];
  totalMessages: number;
  totalVoice: number;
  streak: number;
  dailies: number;
  parties: number;
  personalityTests: number;
  balance: number[];
  players: number;
  ranks: Rank[];
  salary: SalaryEstimate | null;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const lastWeek = (values: number[]) => sum(values.slice(-7));
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value))}`;

function axisLabels(days: Date[]): AxisLabel[] {
  const short = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' });
  return [
    { index: 0, text: short(days[0]) },
    { index: Math.floor(days.length / 2), text: short(days[Math.floor(days.length / 2)]) },
    { index: days.length - 1, text: "Aujourd'hui" },
  ];
}

export const activityTab = defineTab<ActivityData>({
  id: 'activite',
  label: 'Activité',
  emoji: '📊',
  layout: LAYOUT,

  async load({ user, account }) {
    const stats = account.stats;
    const since = parisDays(DAYS)[0];
    since.setUTCHours(0, 0, 0, 0);

    const [movements, players, messagesRank, voiceRank, streakRank, weeklyRank, salary] = await Promise.all([
      LogService.economyMovements(user.id, since),
      repository.countUsers(),
      repository.rankBy('stats.totalMsg', stats?.totalMsg ?? 0),
      repository.rankBy('stats.voiceTime', stats?.voiceTime ?? 0),
      repository.rankBy('stats.dailyStreak', stats?.dailyStreak ?? 0),
      repository.rankBy('stats.activityPoints', stats?.activityPoints ?? 0),
      estimateWeeklySalary(user.id),
    ]);

    return {
      days: parisDays(DAYS),
      messages: dailyTotals((stats?.messageHistory ?? []).map(m => ({ date: m.date, amount: m.count })), DAYS).map(d => d.total),
      voice: dailyTotals((stats?.voiceHistory ?? []).map(v => ({ date: v.date, amount: v.time })), DAYS).map(d => d.total),
      totalMessages: stats?.totalMsg ?? 0,
      totalVoice: stats?.voiceTime ?? 0,
      streak: stats?.dailyStreak ?? 0,
      dailies: stats?.totalDailies ?? 0,
      parties: stats?.partyParticipated ?? 0,
      personalityTests: stats?.personalityTestsCount ?? 0,
      balance: balanceHistory(account.profil?.money ?? 0, movements, DAYS),
      players,
      ranks: [
        { label: '💬 Messages', rank: messagesRank },
        { label: '🔊 Vocal', rank: voiceRank },
        { label: '🔥 Série', rank: streakRank },
        { label: '⚡ Activité de la semaine', rank: weeklyRank, detail: `${formatNumber(stats?.activityPoints ?? 0)} pts` },
      ],
      salary,
    };
  },

  build(data, theme) {
    const { style } = theme;
    const balanceNow = data.balance[data.balance.length - 1];
    const balanceDelta = balanceNow - data.balance[0];
    const chartWidth = PANELS.voice.width - 56;
    const chartHeight = PANELS.voice.height - 100;

    return card(
      theme,
      LAYOUT,
      kpi(PANELS.kpis[0], style, '💬 Messages', formatNumber(data.totalMessages), `+${formatNumber(lastWeek(data.messages))} ces 7 derniers jours`),
      kpi(PANELS.kpis[1], style, '🔊 Temps vocal', formatDuration(data.totalVoice), `+${formatDuration(lastWeek(data.voice))} ces 7 derniers jours`),
      kpi(PANELS.kpis[2], style, '🔥 Série active', plural(data.streak, 'jour'), `${plural(data.dailies, 'daily')} réclamé${data.dailies > 1 ? 's' : ''}`),
      kpi(PANELS.kpis[3], style, '🎉 Soirées vocales', formatNumber(data.parties), `${plural(data.personalityTests, 'test')} de personnalité`),

      titledPanel(PANELS.voice, style, '🔊 Vocal par jour — 30 jours', barChart(data.voice.map(s => s / 3600), chartWidth, chartHeight, style.accent, axisLabels(data.days))),
      titledPanel(PANELS.messages, style, '💬 Messages par jour — 30 jours', barChart(data.messages, chartWidth, chartHeight, '#9b8cff', axisLabels(data.days))),

      titledPanel(
        PANELS.ranks,
        style,
        '🏆 Classements',
        box(
          { flexDirection: 'column', justifyContent: 'space-around', flexGrow: 1 },
          ...data.ranks.map(r => rankLine(r.label, r.rank, data.players, r.detail)),
        ),
      ),

      titledPanel(
        PANELS.economy,
        style,
        '💰 Économie',
        box(
          { alignItems: 'baseline', gap: 12 },
          text({ fontSize: 30, fontWeight: 900, color: 'white' }, `${formatNumber(balanceNow)} RC`),
          text({ fontSize: 17, color: MUTED }, `${signed(balanceDelta)} RC sur 30 jours`),
        ),
        lineChart(data.balance, PANELS.economy.width - 56, 130, '#f5c542', axisLabels(data.days)),
        box(
          { marginTop: 'auto', justifyContent: 'space-between', alignItems: 'baseline' },
          text({ fontSize: 18, color: MUTED }, 'Salaire estimé cette semaine'),
          text(
            { fontSize: 22, fontWeight: 900, color: 'white' },
            data.salary ? `≈ ${formatNumber(data.salary.estimate)} RC` : 'Non éligible',
          ),
        ),
      ),
    );
  },
});
