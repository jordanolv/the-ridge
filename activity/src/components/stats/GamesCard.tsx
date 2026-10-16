import { Gamepad2 } from 'lucide-react';
import type { GameScore } from '../../../../src/features/activity/activity.types';
import { formatNumber, plural } from '../../lib/format';
import { Card, CardTitle } from '../ui';

export function GamesCard({ games, delay }: { games: GameScore[]; delay: number }) {
  const played = games.filter(g => g.played > 0).sort((a, b) => b.wins - a.wins || b.played - a.played);
  const wins = games.reduce((total, g) => total + g.wins, 0);

  return (
    <Card delay={delay} className="flex flex-col">
      <CardTitle icon={<Gamepad2 size={16} />} aside={wins > 0 && <span className="text-sm text-white/55">{plural(wins, 'victoire')}</span>}>
        Jeux
      </CardTitle>
      {played.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <Gamepad2 size={32} className="text-white/25" />
          <p className="font-semibold">Aucune partie pour l'instant</p>
          <p className="text-sm text-white/50">Shifumi, Puissance 4, Bingo… tes scores s'afficheront ici.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {played.map(game => {
            const rate = Math.round((game.wins / game.played) * 100);
            return (
              <li key={game.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">
                    <span className="mr-1.5">{game.emoji}</span>
                    {game.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-white/55">
                    <span className="font-semibold text-white/90">{formatNumber(game.wins)}</span> / {formatNumber(game.played)} · {rate} %
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-glow-cyan/15">
                  <div className="h-full rounded-full bg-glow-cyan" style={{ width: `${rate}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {played.length > 0 && <p className="mt-4 text-xs text-white/40">Victoires / parties jouées, et taux de victoire.</p>}
    </Card>
  );
}
