import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOW_TIMING, segmentAt, showEnd, showSegments, summaryStart, withSpeed } from './pack-show.timeline';

const show = (cards: number, skippedAt: number | null = null) => ({ startsAt: 1000, skippedAt, speed: 1 as const, paceAnchor: null, cards: Array(cards).fill(null) });

test('une ouverture enchaîne intro, vol et révélation de chaque carte, puis le récap', () => {
  const kinds = showSegments(3).map(s => ('card' in s ? `${s.kind}${s.card}` : s.kind));
  assert.deepEqual(kinds, ['intro', 'flight0', 'reveal0', 'flight1', 'reveal1', 'flight2', 'reveal2', 'summary']);
});

test('la dernière carte a droit à un vol et une révélation plus longs', () => {
  const segments = showSegments(3);
  const final = segments.filter(s => 'card' in s && s.card === 2);
  assert.deepEqual(final.map(s => s.duration), [SHOW_TIMING.finalFlight, SHOW_TIMING.finalReveal]);
});

test('les segments se suivent sans trou', () => {
  const segments = showSegments(5);
  segments.slice(1).forEach((segment, i) => assert.equal(segment.start, segments[i].start + segments[i].duration));
});

test("un joueur qui arrive en cours d'ouverture tombe sur le bon segment", () => {
  const position = segmentAt(show(3), 1000 + SHOW_TIMING.intro + 500);
  assert.equal(position?.segment.kind, 'flight');
  assert.equal(position?.elapsed, 500);
});

test("rien n'est joué avant le début ni après la fin", () => {
  assert.equal(segmentAt(show(3), 999), null);
  assert.equal(segmentAt(show(3), showEnd(show(3))), null);
});

test("passer l'ouverture saute au récap et avance la fin", () => {
  const skipped = show(5, 5000);
  assert.equal(segmentAt(skipped, 5200)?.segment.kind, 'summary');
  assert.equal(showEnd(skipped), 5000 + SHOW_TIMING.summary);
});

test("accélérer garde la position actuelle et fait défiler la suite plus vite", () => {
  const normal = show(3);
  const at = 1000 + SHOW_TIMING.intro + 1000;
  const fast = { ...normal, ...withSpeed(normal, 2, at) };
  assert.equal(segmentAt(fast, at)?.elapsed, 1000);
  assert.equal(segmentAt(fast, at + 500)?.elapsed, 2000);
  assert.equal(summaryStart(fast), at + (summaryStart(normal) - at) / 2);
});

test('le récap reste à vitesse normale', () => {
  const fast = { ...show(3), speed: 4 as const };
  assert.equal(showEnd(fast) - summaryStart(fast), SHOW_TIMING.summary);
  assert.equal(segmentAt(fast, summaryStart(fast) + 100)?.speed, 1);
});

test('revenir à la vitesse normale reprend là où on en était', () => {
  const fast = { ...show(3), speed: 4 as const };
  const at = 3000;
  const back = { ...fast, ...withSpeed(fast, 1, at) };
  assert.deepEqual(segmentAt(back, at)?.segment, segmentAt(fast, at)?.segment);
  assert.equal(segmentAt(back, at)?.elapsed, segmentAt(fast, at)?.elapsed);
});
