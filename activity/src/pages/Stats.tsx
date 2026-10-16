import { Flame, Headphones, MessageSquare, PartyPopper } from 'lucide-react';
import { useCallback, type ReactNode } from 'react';
import type { StatTotal, StatsSummary } from '../../../src/features/activity/activity.types';
import { ColumnChart } from '../components/stats/ColumnChart';
import { GamesCard } from '../components/stats/GamesCard';
import { LeaderboardCard } from '../components/stats/LeaderboardCard';
import { Card, CardTitle, Kpi, LoadFailure, PageHeader, Skeleton } from '../components/ui';
import { fetchStats } from '../lib/api';
import { formatCompact, formatDuration, formatNumber, formatStat, plural } from '../lib/format';
import type { Session } from '../lib/session';
import { useResource } from '../lib/use-resource';

const TOTAL_ICONS: Record<string, ReactNode> = {
  messages: <MessageSquare size={14} />,
  voice: <Headphones size={14} />,
  streak: <Flame size={14} />,
  parties: <PartyPopper size={14} />,
};

const VOICE_COLOR = '#67e8f9';
const MESSAGES_COLOR = '#a78bfa';

/** Le libellé dit déjà quoi : seules les durées et les jours gardent leur unité. */
const kpiValue = (total: StatTotal) => (total.unit === 'seconds' || total.unit === 'days' ? formatStat(total.value, total.unit) : formatNumber(total.value));

function rankLabel(total: StatTotal, players: number): ReactNode {
  if (total.value === 0) return 'Pas encore classé';
  return (
    <span>
      <span className="font-semibold text-white/85">{total.rank === 1 ? '1er' : `${total.rank}e`}</span> sur {formatNumber(players)} membres
    </span>
  );
}

function ActivityChart({ title, icon, delay, children, total, average }: { title: string; icon: ReactNode; delay: number; children: ReactNode; total: string; average: string }) {
  return (
    <Card delay={delay}>
      <CardTitle icon={icon} aside={<span className="text-xs text-white/45">30 derniers jours</span>}>
        {title}
      </CardTitle>
      <div className="mb-4 flex items-baseline gap-4">
        <p className="text-3xl font-black tracking-tight">{total}</p>
        <p className="text-sm text-white/50">{average} par jour en moyenne</p>
      </div>
      {children}
    </Card>
  );
}

function StatsContent({ stats, myId }: { stats: StatsSummary; myId: string }) {
  const voiceTotal = stats.voice.reduce((sum, v) => sum + v, 0);
  const messagesTotal = stats.messages.reduce((sum, v) => sum + v, 0);
  const hours = stats.voice.map(seconds => seconds / 3600);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.totals.map((total, index) => (
          <Kpi key={total.id} delay={60 + index * 60} icon={TOTAL_ICONS[total.id]} label={total.label} value={kpiValue(total)} detail={rankLabel(total, stats.players)} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityChart title="Vocal" icon={<Headphones size={16} />} delay={300} total={formatDuration(voiceTotal)} average={formatDuration(voiceTotal / stats.voice.length)}>
          <ColumnChart days={stats.days} values={hours} color={VOICE_COLOR} formatTick={h => `${formatCompact(h)} h`} describe={i => formatDuration(stats.voice[i])} />
        </ActivityChart>
        <ActivityChart title="Messages" icon={<MessageSquare size={16} />} delay={360} total={formatNumber(messagesTotal)} average={formatNumber(messagesTotal / stats.messages.length)}>
          <ColumnChart days={stats.days} values={stats.messages} color={MESSAGES_COLOR} formatTick={formatCompact} describe={i => plural(stats.messages[i], 'message')} />
        </ActivityChart>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <LeaderboardCard boards={stats.leaderboards} myId={myId} delay={420} />
        <GamesCard games={stats.games} delay={480} />
      </div>
    </>
  );
}

export function Stats({ session, myId }: { session: Session; myId: string }) {
  const load = useCallback(() => fetchStats(session), [session]);
  const { resource, reload } = useResource(load);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Stats" subtitle="Ton activité, tes classements et tes jeux." />
      {resource.status === 'loading' && (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </>
      )}
      {resource.status === 'error' && <LoadFailure onRetry={reload} />}
      {resource.status === 'ready' && <StatsContent stats={resource.data} myId={myId} />}
    </div>
  );
}
