import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeks, formatDuration } from './activity-chart';

const NOW = new Date('2026-09-30T10:00:00Z');
const day = (iso: string, time: number) => ({ date: new Date(`${iso}T12:00:00Z`), time });

test('les deux semaines font 7 jours et finissent aujourd’hui', () => {
  const { current, previous } = buildWeeks([], NOW);
  assert.equal(current.length, 7);
  assert.equal(previous.length, 7);
  assert.equal(current[6].date.toISOString().slice(0, 10), '2026-09-30');
  assert.equal(current[0].date.toISOString().slice(0, 10), '2026-09-24');
  assert.equal(previous[6].date.toISOString().slice(0, 10), '2026-09-23');
});

test('chaque jour reçoit son activité, les jours vides valent 0', () => {
  const { current, previous } = buildWeeks([day('2026-09-30', 3600), day('2026-09-20', 120)], NOW);
  assert.equal(current[6].time, 3600);
  assert.equal(current[5].time, 0);
  assert.equal(previous[3].time, 120);
});

test('le jour est celui de Paris, pas celui d’UTC', () => {
  const lateEvening = { date: new Date('2026-09-29T22:30:00Z'), time: 60 };
  const { current } = buildWeeks([lateEvening], NOW);
  assert.equal(current[6].time, 60);
});

test('formatDuration arrondit à l’unité la plus grande', () => {
  assert.equal(formatDuration(0), '0');
  assert.equal(formatDuration(45), '45s');
  assert.equal(formatDuration(125), '2m');
  assert.equal(formatDuration(7300), '2h');
});
