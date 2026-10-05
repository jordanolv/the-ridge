import { Eye, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityUser, PackShow } from '../../../../src/features/activity/activity.types';
import { segmentAt, type ShowSegment } from '../../../../src/features/activity/pack-show.timeline';
import { serverNow, skip, useLive } from '../../lib/live';
import { Avatar } from '../Avatar';
import { MountainMap, type CameraShot, type LngLat, type SummitMarker } from './MountainMap';
import { FloatingReactions, ReactionBar } from './Reactions';
import { CardBack, CardFront, PackStage, SummaryStage, isPremium } from './stages';

const TICK_MS = 100;
const REVEAL_IMPACT_MS = 900;

function useServerClock(running: boolean): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(serverNow()), TICK_MS);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}

const position = (card: PackShow['cards'][number]): LngLat | null => (card.lat !== null && card.lng !== null ? [card.lng, card.lat] : null);

const segmentKey = (show: PackShow, segment: ShowSegment) => `${show.id}:${segment.kind}:${'card' in segment ? segment.card : ''}`;

function shotFor(show: PackShow, segment: ShowSegment, remaining: number): CameraShot {
  const id = segmentKey(show, segment);
  const points = show.cards.map(position).filter((p): p is LngLat => p !== null);
  const first = points[0] ?? [0, 20];

  if (segment.kind === 'intro') return { id, kind: 'globe', center: first, duration: remaining };
  if (segment.kind === 'summary') return { id, kind: 'overview', points, duration: Math.min(remaining, 3000) };

  const target = position(show.cards[segment.card]);
  if (!target) return { id, kind: 'globe', center: first, duration: remaining };
  if (segment.kind === 'reveal') return { id, kind: 'orbit', degrees: 28, duration: remaining };
  return { id, kind: 'fly', center: target, elevation: show.cards[segment.card].elevation, bearing: ((segment.card * 67) % 120) - 60, duration: remaining };
}

function revealedCount(show: PackShow, segment: ShowSegment): number {
  if (segment.kind === 'summary') return show.cards.length;
  if (segment.kind === 'reveal') return segment.card + 1;
  return segment.kind === 'flight' ? segment.card : 0;
}

function revealedMarkers(show: PackShow, segment: ShowSegment): SummitMarker[] {
  return show.cards.slice(0, revealedCount(show, segment)).flatMap((card, index) => {
    const at = position(card);
    return at ? [{ id: `${index}`, position: at, color: card.color }] : [];
  });
}

function ProgressDots({ show, segment }: { show: PackShow; segment: ShowSegment }) {
  const revealed = revealedCount(show, segment);
  return (
    <div className="flex gap-1.5">
      {show.cards.map((card, index) => (
        <span key={index} className="h-1.5 w-5 rounded-full transition-colors duration-500" style={{ backgroundColor: index < revealed ? card.color : 'rgba(255,255,255,0.18)' }} />
      ))}
    </div>
  );
}

function Theater({ show, now, me, participants, mapboxToken, onHide }: { show: PackShow; now: number; me: ActivityUser; participants: ActivityUser[]; mapboxToken: string | null; onHide: () => void }) {
  const { reactions } = useLive();
  const { segment, elapsed } = segmentAt(show, now)!;
  const key = segmentKey(show, segment);
  const remaining = segment.duration - elapsed;
  // Calculé à l'entrée du segment : un joueur qui arrive en cours de route rattrape le même plan.
  const shot = useMemo(() => shotFor(show, segment, remaining), [key]);
  const markers = useMemo(() => revealedMarkers(show, segment), [key]);

  const card = 'card' in segment ? show.cards[segment.card] : null;
  const impact = segment.kind === 'reveal' && card !== null && elapsed < REVEAL_IMPACT_MS;
  const isOpener = show.opener.id === me.id;
  const progress = Math.min(1, elapsed / segment.duration);

  return (
    <div className={`theater-enter fixed inset-0 z-50 overflow-hidden bg-night-950 ${impact && isPremium(card) ? 'screen-shake' : ''}`}>
      <div className="starfield absolute inset-0" style={{ '--tint': show.tierColor } as React.CSSProperties} />
      {mapboxToken && <MountainMap token={mapboxToken} shot={shot} markers={markers} />}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(7,8,20,0.8))]" />
      {impact && <div key={key} className="reveal-flash pointer-events-none absolute inset-0" style={{ '--tint': card.color } as React.CSSProperties} />}

      <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-night-950/90 to-transparent p-4 pb-10">
        <Avatar userId={show.opener.id} name={show.opener.displayName} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm sm:text-base">
            <span className="font-bold">{isOpener ? 'Tu ouvres' : `${show.opener.displayName} ouvre`}</span> un pack{' '}
            <span className="font-bold" style={{ color: show.tierColor }}>
              {show.tierLabel}
            </span>
          </p>
          <div className="mt-1.5">
            <ProgressDots show={show} segment={segment} />
          </div>
        </div>
        <div className="hidden -space-x-2 sm:flex">
          {participants.slice(0, 5).map(user => (
            <Avatar key={user.id} userId={user.id} name={user.displayName} size={28} />
          ))}
        </div>
        {isOpener && segment.kind !== 'summary' ? (
          <button onClick={() => skip(show)} className="rounded-xl border border-white/15 bg-night-950/40 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/10">
            Passer
          </button>
        ) : (
          <button onClick={onHide} className="rounded-xl border border-white/15 bg-night-950/40 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/10">
            {segment.kind === 'summary' ? 'Fermer' : 'Réduire'}
          </button>
        )}
      </header>

      <div className={`absolute inset-x-0 bottom-24 top-24 flex justify-center px-4 ${segment.kind === 'intro' ? 'items-center' : 'items-end'}`}>
        {segment.kind === 'intro' && <PackStage show={show} progress={progress} />}
        {segment.kind === 'flight' && card && <CardBack key={key} card={card} index={segment.card} total={show.cards.length} progress={progress} />}
        {segment.kind === 'reveal' && card && <CardFront key={key} card={card} />}
        {segment.kind === 'summary' && <SummaryStage show={show} />}
      </div>

      <FloatingReactions reactions={reactions} />
      <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center">
        <ReactionBar />
      </div>
    </div>
  );
}

/** Un autre joueur ouvre un pack : on le signale sans interrompre, libre à chacun de venir regarder. */
function LiveBanner({ show, segment, onWatch, onDismiss }: { show: PackShow; segment: ShowSegment; onWatch: () => void; onDismiss: () => void }) {
  const revealed = revealedCount(show, segment);
  const latest = revealed > 0 ? show.cards[revealed - 1] : null;
  return (
    <div className="glass animate-rise fixed bottom-24 right-3 z-40 flex w-[min(22rem,calc(100%-1.5rem))] items-center gap-3 p-3 md:bottom-4">
      <Avatar userId={show.opener.id} name={show.opener.displayName} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-bold">{show.opener.displayName}</span> ouvre un pack{' '}
          <span className="font-bold" style={{ color: show.tierColor }}>
            {show.tierLabel}
          </span>
        </p>
        {latest ? (
          <p className="truncate text-xs text-white/60">
            vient d'avoir{' '}
            <span className="font-bold" style={{ color: latest.color }}>
              {latest.label}
            </span>
          </p>
        ) : (
          <div className="mt-1.5">
            <ProgressDots show={show} segment={segment} />
          </div>
        )}
      </div>
      <button onClick={onWatch} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-night-950 transition hover:brightness-90">
        <Eye size={15} /> Regarder
      </button>
      <button onClick={onDismiss} aria-label="Ignorer" className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white">
        <X size={16} />
      </button>
    </div>
  );
}

const withId = (set: ReadonlySet<string>, id: string) => new Set(set).add(id);
const withoutId = (set: ReadonlySet<string>, id: string) => new Set([...set].filter(other => other !== id));

/**
 * Les ouvertures de pack de la salle, calées sur la même horloge chez tout le monde. Celui
 * qui ouvre la voit en plein écran ; les autres ont un bandeau et la rejoignent s'ils veulent.
 */
export function PackTheater({ me, mapboxToken, onOwnShowEnd }: { me: ActivityUser; mapboxToken: string | null; onOwnShowEnd: () => void }) {
  const { shows, participants } = useLive();
  const [watching, setWatching] = useState<ReadonlySet<string>>(new Set());
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const now = useServerClock(shows.length > 0);
  const current = shows.find(show => !dismissed.has(show.id) && segmentAt(show, now) !== null) ?? null;

  const ownShowId = current && current.opener.id === me.id ? current.id : null;
  const previousOwnShow = useRef<string | null>(null);
  useEffect(() => {
    if (previousOwnShow.current && previousOwnShow.current !== ownShowId) onOwnShowEnd();
    previousOwnShow.current = ownShowId;
  }, [ownShowId, onOwnShowEnd]);

  if (!current) return null;

  const isOpener = current.opener.id === me.id;
  if (!isOpener && !watching.has(current.id)) {
    return (
      <LiveBanner
        show={current}
        segment={segmentAt(current, now)!.segment}
        onWatch={() => setWatching(withId(watching, current.id))}
        onDismiss={() => setDismissed(withId(dismissed, current.id))}
      />
    );
  }

  return (
    <Theater
      key={current.id}
      show={current}
      now={now}
      me={me}
      participants={participants}
      mapboxToken={mapboxToken}
      onHide={() => {
        const closing = isOpener || segmentAt(current, serverNow())?.segment.kind === 'summary';
        if (closing) setDismissed(withId(dismissed, current.id));
        else setWatching(withoutId(watching, current.id));
      }}
    />
  );
}
