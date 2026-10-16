import { CalendarCheck, ChevronLeft, ChevronRight, Globe2, Lock, MoveUp, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { CollectionMountain, RarityInfo } from '../../../../src/features/activity/activity.types';
import { formatDate } from '../../lib/format';

interface MountainDetailProps {
  mountain: CollectionMountain;
  rarity: RarityInfo;
  position: { index: number; total: number };
  onClose: () => void;
  onStep: (offset: -1 | 1) => void;
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-3.5 py-3">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
        {icon}
        {label}
      </p>
      <div className="font-semibold">{children}</div>
    </div>
  );
}

function StepButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? 'Sommet précédent' : 'Sommet suivant'}
      className={`absolute top-1/2 hidden -translate-y-1/2 rounded-full bg-night-950/60 p-2 text-white/80 backdrop-blur transition hover:bg-night-950/85 hover:text-white sm:block ${side === 'left' ? 'left-3' : 'right-3'}`}
    >
      <Icon size={22} />
    </button>
  );
}

export function MountainDetail({ mountain, rarity, position, onClose, onStep }: MountainDetailProps) {
  const owned = mountain.unlockedAt !== null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onStep(-1);
      if (event.key === 'ArrowRight') onStep(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onStep]);

  return (
    <div className="theater-enter fixed inset-0 z-40 grid place-items-center bg-night-950/75 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-label={mountain.label}
        onClick={event => event.stopPropagation()}
        className="glass animate-rise relative w-full max-w-3xl overflow-hidden"
        style={{ boxShadow: owned ? `0 0 80px color-mix(in srgb, ${rarity.color} 30%, transparent)` : undefined }}
      >
        <div className="relative aspect-[16/9] max-h-[52vh] w-full overflow-hidden bg-night-800">
          <img key={mountain.id} src={mountain.image} alt="" className={`h-full w-full object-cover ${owned ? '' : 'blur-sm brightness-[0.3] grayscale'}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/30 to-transparent" />
          {!owned && (
            <div className="absolute inset-0 grid place-items-center">
              <Lock size={40} className="text-white/40" />
            </div>
          )}
          <StepButton side="left" onClick={() => onStep(-1)} />
          <StepButton side="right" onClick={() => onStep(1)} />
          <span className="absolute left-3 top-3 rounded-full bg-night-950/60 px-2.5 py-1 text-xs font-semibold tabular-nums text-white/70 backdrop-blur">
            {position.index + 1} / {position.total}
          </span>
          <button onClick={onClose} aria-label="Fermer" className="absolute right-3 top-3 rounded-full bg-night-950/60 p-2 text-white/80 backdrop-blur transition hover:text-white">
            <X size={18} />
          </button>
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5">
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-night-950/70 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rarity.color }} />
              {rarity.label}
            </span>
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">
              {mountain.label} <span className="text-2xl">{mountain.flags.join(' ')}</span>
            </h2>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <Fact icon={<MoveUp size={13} />} label="Altitude">
            {mountain.altitude}
          </Fact>
          <Fact icon={<Globe2 size={13} />} label="Pays">
            <span className="line-clamp-2">{mountain.countries.join(', ')}</span>
          </Fact>
          <Fact icon={<CalendarCheck size={13} />} label="Découverte">
            {owned ? formatDate(mountain.unlockedAt!) : <span className="text-white/50">Pas encore</span>}
          </Fact>
        </div>

        {!owned && <p className="px-5 pb-5 text-sm text-white/50">Ce sommet se cache encore : ouvre des packs ou pars en expédition pour le débloquer.</p>}
      </div>
    </div>
  );
}
