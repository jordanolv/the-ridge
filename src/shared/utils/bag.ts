/**
 * Tirage sans répétition : on vide le sac avant de le remplir à nouveau.
 * Le sac vit en RAM, un redémarrage le remélange.
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createBag<T>(items: readonly T[]) {
  if (items.length === 0) throw new Error('createBag: liste vide');
  let remaining: T[] = [];
  return {
    draw(): T {
      if (remaining.length === 0) remaining = shuffle(items);
      return remaining.pop()!;
    },
  };
}

/**
 * Tirage parmi les entrées absentes de `recent` (les clés déjà sorties, de la plus ancienne à la
 * plus récente). Quand tout est déjà sorti, on reprend celle qui est sortie il y a le plus longtemps.
 */
export function pickLeastRecent<T>(items: readonly T[], keyOf: (item: T) => string, recent: readonly string[]): T | undefined {
  if (items.length === 0) return undefined;
  const seen = new Set(recent);
  const fresh = items.filter((item) => !seen.has(keyOf(item)));
  if (fresh.length > 0) return fresh[Math.floor(Math.random() * fresh.length)];

  const lastSeenAt = new Map<string, number>();
  recent.forEach((key, i) => lastSeenAt.set(key, i));
  return items.reduce((oldest, item) =>
    (lastSeenAt.get(keyOf(item)) ?? -1) < (lastSeenAt.get(keyOf(oldest)) ?? -1) ? item : oldest,
  );
}
