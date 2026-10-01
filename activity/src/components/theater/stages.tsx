import { Gem, Puzzle, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { PackShow, ShowCard } from '../../../../src/features/activity/activity.types';
import { Logo } from '../Logo';

const PREMIUM = new Set(['epic', 'legendary']);

export const isPremium = (card: ShowCard) => PREMIUM.has(card.rarity);

const tint = (color: string) => ({ '--tint': color }) as CSSProperties;

export function PackStage({ show, progress }: { show: PackShow; progress: number }) {
  const bursting = progress > 0.86;
  return (
    <div className="flex flex-col items-center gap-6" style={tint(show.tierColor)}>
      <div className="relative">
        <div className="pack-rays absolute -inset-24 opacity-60" />
        <div
          className={`pack relative grid h-64 w-44 place-items-center overflow-hidden rounded-3xl ${bursting ? 'pack-burst' : 'pack-shake'}`}
          style={{ animationDuration: `${Math.max(0.12, 0.6 - progress * 0.5)}s` }}
        >
          <div className="pack-shine absolute inset-0" />
          <div className="flex flex-col items-center gap-3">
            <Logo size={64} />
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/80">Pack</p>
            <p className="text-2xl font-black tracking-tight">{show.tierLabel}</p>
          </div>
        </div>
      </div>
      <p className="text-center text-sm font-semibold text-white/75">{show.cards.length} sommets à découvrir…</p>
    </div>
  );
}

export function CardBack({ card, index, total, progress }: { card: ShowCard; index: number; total: number; progress: number }) {
  const hint = Math.max(0, (progress - 0.5) / 0.5);
  const trembling = isPremium(card) && progress > 0.72;
  return (
    <div className="flex flex-col items-center gap-4" style={tint(card.color)}>
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">
          Carte {index + 1} / {total}
        </p>
        <p className="mt-1 text-lg font-bold drop-shadow">Cap sur {card.countries.join(' · ')}</p>
      </div>
      <div
        className={`card-back grid h-52 w-36 place-items-center rounded-2xl ${trembling ? 'pack-shake' : 'animate-float'}`}
        style={{ boxShadow: `0 0 ${20 + hint * 60}px ${hint * 18}px color-mix(in srgb, ${card.color} ${Math.round(hint * 85)}%, transparent)` }}
      >
        <Logo size={44} />
      </div>
    </div>
  );
}

export function CardFront({ card }: { card: ShowCard }) {
  return (
    <div className="card-flip w-64 sm:w-72" style={tint(card.color)}>
      <div className="card-front overflow-hidden rounded-2xl">
        <div className="relative h-36 sm:h-40">
          <img src={card.image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/10 to-transparent" />
          <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-night-950" style={{ backgroundColor: card.color }}>
            {card.rarityLabel}
          </span>
        </div>
        <div className="flex flex-col gap-1 px-4 pb-4 pt-1">
          <p className="text-2xl font-black leading-tight tracking-tight">{card.label}</p>
          <p className="text-sm text-white/65">
            {card.altitude} · {card.countries.join(' · ')}
          </p>
          <div className="mt-2">
            <CardStatus card={card} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CardStatus({ card }: { card: ShowCard }) {
  if (!card.isDuplicate) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-300">
        <Sparkles size={13} /> Nouvelle montagne
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white/75">
      <Puzzle size={13} /> Double · +{card.fragmentsGained} fragments
      {card.expeditionsAwarded > 0 && ` · +${card.expeditionsAwarded} expédition`}
    </span>
  );
}

export function SummaryStage({ show }: { show: PackShow }) {
  const fresh = show.cards.filter(card => !card.isDuplicate).length;
  const fragments = show.cards.reduce((sum, card) => sum + card.fragmentsGained, 0);
  return (
    <div className="glass animate-rise w-full max-w-3xl p-5" style={tint(show.tierColor)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xl font-black tracking-tight">
          Pack <span style={{ color: show.tierColor }}>{show.tierLabel}</span> de {show.opener.displayName}
        </p>
        <p className="flex items-center gap-3 text-sm text-white/65">
          <span className="flex items-center gap-1">
            <Gem size={14} className="text-emerald-300" /> {fresh} nouvelle{fresh > 1 ? 's' : ''}
          </span>
          {fragments > 0 && (
            <span className="flex items-center gap-1">
              <Puzzle size={14} /> +{fragments} fragments
            </span>
          )}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {show.cards.map((card, index) => (
          <div key={index} className="animate-rise overflow-hidden rounded-xl bg-night-900/80" style={{ animationDelay: `${index * 90}ms`, boxShadow: `inset 0 0 0 1.5px ${card.color}` }}>
            <img src={card.image} alt="" className="h-16 w-full object-cover sm:h-20" />
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-bold">{card.label}</p>
              <p className="truncate text-[10px] font-semibold" style={{ color: card.color }}>
                {card.isDuplicate ? `Double · +${card.fragmentsGained}` : 'Nouvelle'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
