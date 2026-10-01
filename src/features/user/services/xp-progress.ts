const xpForLevel = (level: number) => 5 * level ** 2 + 110 * level + 100;

/** Où en est un joueur dans son niveau actuel : l'XP est cumulée, le palier précédent est retiré. */
export function xpProgress(level: number, experience: number): { current: number; required: number; percent: number } {
  const floor = level > 1 ? xpForLevel(level - 1) : 0;
  const current = Math.max(0, experience - floor);
  const required = Math.max(1, xpForLevel(level) - floor);
  return { current, required, percent: Math.min(1, current / required) };
}
