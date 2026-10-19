import type { Solver } from '../models/enigme-state.model';
import { ENIGME_PODIUM_REWARDS } from '../constants/enigme.constants';

/**
 * Une énigme lancée avant le passage au chrono personnel n'a pas de durationMs :
 * on retombe sur l'ordre d'arrivée pour ne pas la classer au hasard.
 */
export function rankSolvers(solvers: Solver[], startedAt?: Date): Solver[] {
  const start = startedAt?.getTime() ?? 0;
  const duration = (s: Solver) => s.durationMs ?? new Date(s.at).getTime() - start;
  return [...solvers].sort((a, b) => duration(a) - duration(b));
}

/** Prendre l'indice sort du podium : seuls les chronos secs sont classés. */
export function podiumSolvers(solvers: Solver[], startedAt?: Date): Solver[] {
  return rankSolvers(solvers, startedAt)
    .filter((s) => !s.usedHint)
    .slice(0, ENIGME_PODIUM_REWARDS.length);
}
