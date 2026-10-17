import { PartyPopper } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import type { PartyCard } from '../../../../src/features/activity/activity.types';
import { Avatar } from '../Avatar';

const STACK = 6;

export function PartyCover({ party, className = '' }: { party: PartyCard; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { '--tint': party.color } as CSSProperties;

  return (
    <div style={style} className={`relative overflow-hidden bg-[linear-gradient(135deg,color-mix(in_srgb,var(--tint)_55%,#0c0f24),#0c0f24)] ${className}`}>
      {party.image && !failed ? (
        <img src={party.image} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <PartyPopper size={36} className="text-white/35" />
        </div>
      )}
    </div>
  );
}

export function ParticipantStack({ party, size = 28 }: { party: PartyCard; size?: number }) {
  const shown = party.participants.slice(0, STACK);
  const hidden = party.participants.length - shown.length;
  if (shown.length === 0) return <span className="text-sm text-white/45">Personne pour l'instant</span>;

  return (
    <div className="flex items-center">
      {shown.map((participant, index) => (
        <span key={participant.id} className="rounded-full ring-2 ring-night-900" style={{ marginLeft: index === 0 ? 0 : -size / 3.2 }} title={participant.name}>
          <Avatar userId={participant.id} name={participant.name} size={size} />
        </span>
      ))}
      {hidden > 0 && (
        <span className="grid place-items-center rounded-full bg-white/10 text-xs font-semibold ring-2 ring-night-900" style={{ width: size, height: size, marginLeft: -size / 3.2 }}>
          +{hidden}
        </span>
      )}
    </div>
  );
}

export function SlotsBar({ party }: { party: PartyCard }) {
  const filled = party.participants.length;
  const full = filled >= party.maxSlots;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-white/55">
        <span>{full ? 'Complet' : `${party.maxSlots - filled} place${party.maxSlots - filled > 1 ? 's' : ''} restante${party.maxSlots - filled > 1 ? 's' : ''}`}</span>
        <span className="font-semibold tabular-nums text-white/80">
          {filled}/{party.maxSlots}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (filled / party.maxSlots) * 100)}%`, backgroundColor: party.color }} />
      </div>
    </div>
  );
}
