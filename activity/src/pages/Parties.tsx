import { CalendarClock, CheckCircle2, Coins, History, Map as MapIcon, PartyPopper, Radio, Sparkles } from 'lucide-react';
import { useCallback } from 'react';
import type { PartiesSummary, PartyCard } from '../../../src/features/activity/activity.types';
import { ParticipantStack, PartyCover, SlotsBar } from '../components/parties/PartyParts';
import { Badge, Card, CardTitle, LoadFailure, PageHeader, Skeleton } from '../components/ui';
import { fetchParties } from '../lib/api';
import { elapsedSince, formatDate, formatNumber, formatPartyDate, plural, timeUntil } from '../lib/format';
import type { Session } from '../lib/session';
import { useResource } from '../lib/use-resource';

function JoinedBadge({ joined }: { joined: boolean }) {
  if (!joined) return null;
  return (
    <Badge className="border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
      <CheckCircle2 size={12} /> Inscrit
    </Badge>
  );
}

function LiveParty({ party, delay }: { party: PartyCard; delay: number }) {
  return (
    <Card delay={delay} flush className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-5">
      <PartyCover party={party} className="h-48 md:h-full md:min-h-64" />
      <div className="flex flex-col gap-4 p-5 md:pl-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-rose-400/40 bg-rose-500/15 text-rose-200">
            <Radio size={12} className="animate-pulse" /> En cours
          </Badge>
          <JoinedBadge joined={party.joined} />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">{party.name}</h2>
          <p className="text-white/60">
            {party.game} · depuis {elapsedSince(party.startedAt ?? party.startsAt)}
          </p>
        </div>
        {party.description && <p className="line-clamp-3 text-sm text-white/65">{party.description}</p>}
        <div className="mt-auto flex flex-col gap-3">
          <ParticipantStack party={party} size={34} />
          <SlotsBar party={party} />
        </div>
      </div>
    </Card>
  );
}

function UpcomingParty({ party, delay }: { party: PartyCard; delay: number }) {
  return (
    <Card delay={delay} flush className="flex flex-col gap-4">
      <div className="relative">
        <PartyCover party={party} className="h-32" />
        <span className="absolute bottom-2 left-2 rounded-full bg-night-950/75 px-2.5 py-1 text-xs font-semibold backdrop-blur">{timeUntil(party.startsAt)}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold leading-tight">{party.name}</h3>
            <JoinedBadge joined={party.joined} />
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/55">
            <CalendarClock size={14} /> {formatPartyDate(party.startsAt)} · {party.game}
          </p>
        </div>
        {party.description && <p className="line-clamp-2 text-sm text-white/60">{party.description}</p>}
        <div className="mt-auto flex flex-col gap-3">
          <ParticipantStack party={party} />
          <SlotsBar party={party} />
        </div>
      </div>
    </Card>
  );
}

function PastParty({ party }: { party: PartyCard }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: party.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{party.name}</p>
        <p className="truncate text-xs text-white/50">
          {formatDate(party.endedAt ?? party.startsAt)} · {party.game} · {plural(party.attended, 'présent')}
        </p>
      </div>
      {party.rewards && (
        <div className="hidden shrink-0 items-center gap-3 text-xs text-white/60 sm:flex">
          {party.rewards.money > 0 && (
            <span className="flex items-center gap-1">
              <Coins size={13} /> {formatNumber(party.rewards.money)}
            </span>
          )}
          {party.rewards.xp > 0 && (
            <span className="flex items-center gap-1">
              <Sparkles size={13} /> {formatNumber(party.rewards.xp)} XP
            </span>
          )}
          {party.rewards.expeditions > 0 && (
            <span className="flex items-center gap-1">
              <MapIcon size={13} /> {party.rewards.expeditions}
            </span>
          )}
        </div>
      )}
      <JoinedBadge joined={party.joined} />
    </li>
  );
}

function PartiesContent({ parties }: { parties: PartiesSummary }) {
  const empty = parties.live.length === 0 && parties.upcoming.length === 0;

  return (
    <>
      {parties.live.map((party, index) => (
        <LiveParty key={party.id} party={party} delay={60 + index * 60} />
      ))}

      {empty ? (
        <Card delay={60} className="flex flex-col items-center gap-2 py-12 text-center">
          <PartyPopper size={36} className="text-glow-pink/60" />
          <p className="text-lg font-semibold">Aucune soirée prévue</p>
          <p className="max-w-sm text-sm text-white/55">Dès qu'une soirée est annoncée sur le serveur, elle apparaît ici avec ses places et ses inscrits.</p>
        </Card>
      ) : (
        parties.upcoming.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/60">
              <CalendarClock size={16} /> À venir
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {parties.upcoming.map((party, index) => (
                <UpcomingParty key={party.id} party={party} delay={120 + index * 60} />
              ))}
            </div>
            <p className="text-xs text-white/45">Pour t'inscrire, réagis au message de la soirée sur le serveur : ta place apparaît ici aussitôt.</p>
          </section>
        )
      )}

      {parties.past.length > 0 && (
        <Card delay={300}>
          <CardTitle icon={<History size={16} />}>Dernières soirées</CardTitle>
          <ul className="flex flex-col gap-2">
            {parties.past.map(party => (
              <PastParty key={party.id} party={party} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

export function Parties({ session }: { session: Session }) {
  const load = useCallback(() => fetchParties(session), [session]);
  const { resource, reload } = useResource(load);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Soirées"
        subtitle="Les soirées du serveur : celle en cours, les prochaines et les dernières."
        aside={resource.status === 'ready' && resource.data.attendedCount > 0 && <Badge className="text-glow-pink">Tu as participé à {plural(resource.data.attendedCount, 'soirée')}</Badge>}
      />
      {resource.status === 'loading' && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      )}
      {resource.status === 'error' && <LoadFailure onRetry={reload} />}
      {resource.status === 'ready' && <PartiesContent parties={resource.data} />}
    </div>
  );
}
