import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceHistory, dailyTotals, parisDays } from './series';

const NOW = new Date('2026-09-30T10:00:00Z');
const at = (iso: string, amount: number) => ({ date: new Date(iso), amount });
const ymd = (d: Date) => d.toISOString().slice(0, 10);

test('parisDays va du plus ancien à aujourd’hui', () => {
  const days = parisDays(7, NOW);
  assert.equal(days.length, 7);
  assert.equal(ymd(days[0]), '2026-09-24');
  assert.equal(ymd(days[6]), '2026-09-30');
});

test('dailyTotals additionne les entrées d’un même jour et remplit les jours vides', () => {
  const totals = dailyTotals([at('2026-09-30T08:00:00Z', 60), at('2026-09-30T15:00:00Z', 40), at('2026-09-28T12:00:00Z', 5)], 3, NOW);
  assert.deepEqual(totals.map(t => t.total), [5, 0, 100]);
});

test('dailyTotals range une entrée tardive dans le jour de Paris', () => {
  const totals = dailyTotals([at('2026-09-29T22:30:00Z', 1)], 2, NOW);
  assert.deepEqual(totals.map(t => t.total), [0, 1]);
});

test('dailyTotals ignore ce qui sort de la fenêtre', () => {
  const totals = dailyTotals([at('2026-08-01T12:00:00Z', 999)], 7, NOW);
  assert.ok(totals.every(t => t.total === 0));
});

test('balanceHistory reconstitue le solde de fin de journée à rebours', () => {
  const movements = [at('2026-09-30T09:00:00Z', 100), at('2026-09-29T12:00:00Z', -50)];
  assert.deepEqual(balanceHistory(1000, movements, 3, NOW), [950, 900, 1000]);
});
