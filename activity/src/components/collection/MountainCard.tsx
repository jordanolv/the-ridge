import { Lock } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { CollectionMountain, RarityInfo } from '../../../../src/features/activity/activity.types';

const FRESH_MS = 48 * 3_600_000;

export const isFresh = (mountain: CollectionMountain, now = Date.now()) => mountain.unlockedAt !== null && now - mountain.unlockedAt < FRESH_MS;

export function MountainCard({ mountain, rarity, onSelect }: { mountain: CollectionMountain; rarity: RarityInfo; onSelect: () => void }) {
  const owned = mountain.unlockedAt !== null;

  return (
    <button
      onClick={onSelect}
      style={{ '--tint': rarity.color } as CSSProperties}
      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition duration-300 hover:-translate-y-0.5 ${
        owned
          ? 'border-[color-mix(in_srgb,var(--tint)_45%,transparent)] bg-white/[0.05] hover:shadow-[0_0_28px_color-mix(in_srgb,var(--tint)_35%,transparent)]'
          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'
      }`}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-night-800">
        <img
          src={mountain.thumbnail}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${owned ? '' : 'blur-[2px] brightness-[0.35] grayscale'}`}
        />
        {!owned && (
          <span className="absolute inset-0 grid place-items-center">
            <Lock size={20} className="text-white/45" />
          </span>
        )}
        <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-night-950/70 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rarity.color }} />
          {rarity.label}
        </span>
        {isFresh(mountain) && <span className="absolute right-2 top-2 rounded-full bg-glow-cyan px-2 py-0.5 text-[11px] font-bold text-night-950">Nouveau</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
        <p className={`truncate font-semibold ${owned ? '' : 'text-white/45'}`}>{mountain.label}</p>
        <p className="truncate text-xs text-white/45">
          {mountain.altitude} · {mountain.flags.join(' ')}
        </p>
      </div>
    </button>
  );
}
