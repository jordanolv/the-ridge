import type { PackShow } from './activity.types';

/** Durées de l'ouverture partagée, en ms. Le serveur s'en sert pour enchaîner les ouvertures. */
export const SHOW_TIMING = {
  intro: 2800,
  flight: 3600,
  finalFlight: 6000,
  reveal: 3200,
  finalReveal: 4800,
  summary: 9000,
};

export type ShowSegment =
  | { kind: 'intro'; start: number; duration: number }
  | { kind: 'flight' | 'reveal'; card: number; start: number; duration: number }
  | { kind: 'summary'; start: number; duration: number };

export function showSegments(cardCount: number): ShowSegment[] {
  const segments: ShowSegment[] = [{ kind: 'intro', start: 0, duration: SHOW_TIMING.intro }];
  let cursor = SHOW_TIMING.intro;

  for (let card = 0; card < cardCount; card++) {
    const final = card === cardCount - 1;
    const flight = final ? SHOW_TIMING.finalFlight : SHOW_TIMING.flight;
    const reveal = final ? SHOW_TIMING.finalReveal : SHOW_TIMING.reveal;
    segments.push({ kind: 'flight', card, start: cursor, duration: flight }, { kind: 'reveal', card, start: cursor + flight, duration: reveal });
    cursor += flight + reveal;
  }

  segments.push({ kind: 'summary', start: cursor, duration: SHOW_TIMING.summary });
  return segments;
}

type ShowClock = Pick<PackShow, 'startsAt' | 'skippedAt'> & { cards: unknown[] };

export function showEnd(show: ShowClock): number {
  if (show.skippedAt !== null) return show.skippedAt + SHOW_TIMING.summary;
  const segments = showSegments(show.cards.length);
  const last = segments[segments.length - 1];
  return show.startsAt + last.start + last.duration;
}

/** Le segment joué à l'instant `now`, et le temps écoulé dedans ; `null` avant le début ou après la fin. */
export function segmentAt(show: ShowClock, now: number): { segment: ShowSegment; elapsed: number } | null {
  if (now < show.startsAt || now >= showEnd(show)) return null;

  const segments = showSegments(show.cards.length);
  if (show.skippedAt !== null && now >= show.skippedAt) {
    return { segment: segments[segments.length - 1], elapsed: now - show.skippedAt };
  }

  const t = now - show.startsAt;
  const segment = segments.find(s => t < s.start + s.duration) ?? segments[segments.length - 1];
  return { segment, elapsed: t - segment.start };
}
