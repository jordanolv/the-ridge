const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Date d'expiration après un achat : le temps restant sur une location en cours
 * s'ajoute, une location périmée repart de maintenant.
 */
export function nextExpiry(current: Date | null | undefined, now: Date, days: number): Date {
  const from = current && current > now ? current : now;
  return new Date(from.getTime() + days * DAY_MS);
}
