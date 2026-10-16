import { Trophy } from 'lucide-react';
import { useState } from 'react';
import type { Leaderboard, LeaderboardEntry, LeaderboardId } from '../../../../src/features/activity/activity.types';
import { formatStat } from '../../lib/format';
import { Avatar } from '../Avatar';
import { Card, CardTitle, Segmented } from '../ui';

const MEDALS = ['🥇', '🥈', '🥉'];

const SUBTITLES: Partial<Record<LeaderboardId, string>> = {
  weekly: 'Points de la semaine, remis à zéro chaque lundi',
  mountains: 'Sommets différents découverts',
};

function Row({ entry, board, mine }: { entry: LeaderboardEntry; board: Leaderboard; mine: boolean }) {
  return (
    <li className={`flex items-center gap-3 rounded-xl px-3 py-2 ${mine ? 'bg-glow-violet/15 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)]' : 'bg-white/[0.03]'}`}>
      <span className="w-7 text-center text-sm font-bold tabular-nums text-white/60">{MEDALS[entry.rank - 1] ?? entry.rank}</span>
      <Avatar userId={entry.userId} name={entry.name} size={30} />
      <span className="min-w-0 flex-1 truncate font-medium">
        {entry.name}
        {mine && <span className="ml-2 text-xs font-semibold text-glow-violet">toi</span>}
      </span>
      <span className="text-sm font-semibold tabular-nums text-white/85">{formatStat(entry.value, board.unit)}</span>
    </li>
  );
}

export function LeaderboardCard({ boards, myId, delay }: { boards: Leaderboard[]; myId: string; delay: number }) {
  const [active, setActive] = useState<LeaderboardId>(boards[0].id);
  const board = boards.find(b => b.id === active) ?? boards[0];
  const meOutside = board.me && !board.entries.some(e => e.userId === myId) ? board.me : null;

  return (
    <Card delay={delay} className="flex flex-col">
      <CardTitle icon={<Trophy size={16} />}>Classements</CardTitle>
      <div className="-mx-1 mb-1 overflow-x-auto px-1 pb-1">
        <Segmented<LeaderboardId> value={board.id} onChange={setActive} options={boards.map(b => ({ id: b.id, label: b.label }))} />
      </div>
      <p className="mb-3 text-xs text-white/45">{SUBTITLES[board.id] ?? 'Depuis toujours'}</p>
      {board.entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/50">Personne au classement pour l'instant.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {board.entries.map(entry => (
            <Row key={entry.userId} entry={entry} board={board} mine={entry.userId === myId} />
          ))}
          {meOutside && (
            <>
              <li aria-hidden className="text-center text-white/30">⋯</li>
              <Row entry={meOutside} board={board} mine />
            </>
          )}
        </ol>
      )}
    </Card>
  );
}
