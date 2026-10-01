import { REACTIONS, type LiveReaction } from '../../../../src/features/activity/activity.types';
import { react } from '../../lib/live';

/** Position horizontale stable pour une réaction : tous les rendus la placent au même endroit. */
function lane(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return 12 + (Math.abs(hash) % 76);
}

export function ReactionBar() {
  return (
    <div className="glass flex gap-1 p-1.5">
      {REACTIONS.map(emoji => (
        <button key={emoji} onClick={() => react(emoji)} className="grid h-11 w-11 place-items-center rounded-xl text-2xl transition hover:scale-110 hover:bg-white/10 active:scale-95">
          {emoji}
        </button>
      ))}
    </div>
  );
}

export function FloatingReactions({ reactions }: { reactions: LiveReaction[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {reactions.map(reaction => (
        <div key={reaction.id} className="reaction-float absolute bottom-24 flex flex-col items-center" style={{ left: `${lane(reaction.id)}%` }}>
          <span className="text-4xl drop-shadow-lg">{reaction.emoji}</span>
          <span className="rounded-full bg-night-950/70 px-2 py-0.5 text-[10px] font-semibold text-white/80">{reaction.user.displayName}</span>
        </div>
      ))}
    </div>
  );
}
