import { Layers, Package, Radio, Users } from 'lucide-react';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { ExpeditionTierName, PackTierInfo } from '../../../src/features/activity/activity.types';
import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { Badge, Card, CardTitle } from '../components/ui';
import { fetchPacks, openPack } from '../lib/api';
import { formatNumber, timeAgo } from '../lib/format';
import { addShow, useLive } from '../lib/live';
import type { Session } from '../lib/session';

const FAILURES = {
  'no-pack': "Tu n'as plus de pack de ce type : passe par la boutique (/shop).",
  'draw-failed': "Le tirage a échoué, ton pack t'a été rendu.",
};

function PackTier({ tier, delay, busy, onOpen }: { tier: PackTierInfo; delay: number; busy: boolean; onOpen: () => void }) {
  const empty = tier.owned === 0;
  return (
    <Card delay={delay} className="flex flex-col items-center gap-4 text-center">
      <div className="relative" style={{ '--tint': tier.color } as CSSProperties}>
        <div className={`pack grid h-40 w-28 place-items-center rounded-2xl transition ${empty ? 'opacity-35 grayscale' : 'animate-float'}`}>
          <div className="flex flex-col items-center gap-2">
            <Logo size={38} />
            <p className="text-sm font-black">{tier.label}</p>
          </div>
        </div>
        {!empty && <span className="absolute -right-3 -top-3 grid h-8 min-w-8 place-items-center rounded-full bg-white px-2 text-sm font-black text-night-950 shadow-lg">{formatNumber(tier.owned)}</span>}
      </div>
      <div>
        <p className="text-xl font-black tracking-tight">Pack {tier.label}</p>
        <p className="text-sm text-white/55">{tier.description}</p>
      </div>
      <Badge className="text-white/70">
        <Layers size={12} /> {tier.cards} cartes
      </Badge>
      <button
        onClick={onOpen}
        disabled={empty || busy}
        className="mt-auto w-full rounded-xl py-2.5 font-semibold text-night-950 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
        style={empty || busy ? undefined : { background: `linear-gradient(90deg, ${tier.color}, #67e8f9)` }}
      >
        {empty ? 'Aucun pack' : busy ? 'Ouverture…' : 'Ouvrir'}
      </button>
    </Card>
  );
}

function CampPresence() {
  const { participants, status } = useLive();
  const live = status === 'online' || status === 'preview';
  return (
    <Card delay={260}>
      <CardTitle
        icon={<Users size={16} />}
        aside={
          <Badge className={live ? 'text-emerald-300' : 'text-white/50'}>
            <Radio size={12} /> {live ? 'En direct' : 'Reconnexion…'}
          </Badge>
        }
      >
        Au camp
      </CardTitle>
      <div className="flex flex-wrap gap-3">
        {participants.map(user => (
          <div key={user.id} className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3">
            <Avatar userId={user.id} name={user.displayName} size={28} />
            <span className="text-sm font-medium">{user.displayName}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-white/45">Quand quelqu'un ouvre un pack, tout le camp le regarde en direct.</p>
    </Card>
  );
}

function CampFeed() {
  const { feed } = useLive();
  return (
    <Card delay={320}>
      <CardTitle icon={<Package size={16} />}>Fil du camp</CardTitle>
      {feed.length === 0 ? (
        <p className="text-sm text-white/50">Aucune ouverture pour l'instant.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {feed.map(entry => (
            <li key={entry.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
              <Avatar userId={entry.user.id} name={entry.user.displayName} size={32} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate">
                  <span className="font-semibold">{entry.user.displayName}</span> a eu{' '}
                  <span className="font-bold" style={{ color: entry.best.color }}>
                    {entry.best.label}
                  </span>
                </p>
                <p className="truncate text-xs text-white/45">
                  Pack <span style={{ color: entry.tierColor }}>{entry.tierLabel}</span> · {entry.fresh} nouvelle{entry.fresh > 1 ? 's' : ''} sur {entry.cards} · {timeAgo(entry.at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Packs({ session }: { session: Session }) {
  const [tiers, setTiers] = useState<PackTierInfo[] | null>(null);
  const [opening, setOpening] = useState<ExpeditionTierName | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const refresh = useCallback(() => fetchPacks(session).then(setTiers), [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = async (tier: ExpeditionTierName) => {
    setOpening(tier);
    setFailure(null);
    try {
      const result = await openPack(session, tier);
      if (result.ok) addShow(result.show);
      else setFailure(FAILURES[result.reason]);
      await refresh();
    } catch {
      setFailure("L'ouverture a échoué. Réessaie dans un instant.");
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="animate-rise">
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Packs</h1>
        <p className="text-white/55">Ouvre tes packs : chaque sommet s'affiche en direct chez tout le camp.</p>
      </header>

      {failure && <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-sm text-rose-200">{failure}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {(tiers ?? []).map((tier, index) => (
          <PackTier key={tier.id} tier={tier} delay={60 + index * 60} busy={opening !== null} onOpen={() => void open(tier.id)} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CampPresence />
        <CampFeed />
      </div>
    </div>
  );
}
