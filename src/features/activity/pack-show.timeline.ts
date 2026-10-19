import type { PackShow, ShowSpeed } from './activity.types';

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

type ShowClock = Pick<PackShow, 'startsAt' | 'skippedAt' | 'speed' | 'paceAnchor'> & { cards: unknown[] };

const anchorOf = (show: ShowClock) => show.paceAnchor ?? { at: show.startsAt, t: 0 };

const showTime = (show: ShowClock, now: number) => {
  const anchor = anchorOf(show);
  return anchor.t + (now - anchor.at) * show.speed;
};

const summarySegment = (show: ShowClock) => showSegments(show.cards.length).at(-1)!;

/** Le récap se joue toujours à vitesse normale, pour laisser le temps de le lire. */
export function summaryStart(show: ShowClock): number {
  if (show.skippedAt !== null) return show.skippedAt;
  const anchor = anchorOf(show);
  return anchor.at + (summarySegment(show).start - anchor.t) / show.speed;
}

export function showEnd(show: ShowClock): number {
  return summaryStart(show) + SHOW_TIMING.summary;
}

/**
 * Le segment joué à l'instant `now`, le temps écoulé dedans (à l'échelle de l'ouverture) et la
 * vitesse à laquelle il défile ; `null` avant le début ou après la fin.
 */
export function segmentAt(show: ShowClock, now: number): { segment: ShowSegment; elapsed: number; speed: number } | null {
  if (now < show.startsAt || now >= showEnd(show)) return null;

  const summaryAt = summaryStart(show);
  if (now >= summaryAt) return { segment: summarySegment(show), elapsed: now - summaryAt, speed: 1 };

  const t = showTime(show, now);
  const segments = showSegments(show.cards.length);
  const segment = segments.find(s => t < s.start + s.duration) ?? segments[segments.length - 1];
  return { segment, elapsed: t - segment.start, speed: show.speed };
}

/** Change la vitesse à l'instant `now` sans faire sauter l'ouverture : la position actuelle devient le nouveau point de départ. */
export function withSpeed(show: ShowClock, speed: ShowSpeed, now: number): Pick<PackShow, 'speed' | 'paceAnchor'> {
  return { speed, paceAnchor: { at: now, t: showTime(show, now) } };
}
