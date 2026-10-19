import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePayroll, ActivityScore } from './payroll.service';
import { parisWeekKey } from '../../../shared/time/week-key';

const PARAMS = { budgetPerActive: 250, smicPercent: 40, qualificationThreshold: 1800 };

const reels: ActivityScore[] = [
  { userId: 'kass', points: 156_150 },
  { userId: 'lyn', points: 54_450 },
  { userId: 'pixel', points: 16_200 },
  { userId: 'elio', points: 6_750 },
];

test('la masse versée correspond au budget par qualifié', () => {
  const slips = computePayroll(reels, PARAMS);
  const total = slips.reduce((sum, s) => sum + s.total, 0);
  assert.equal(slips.length, 4);
  assert.ok(Math.abs(total - 4 * 250) <= slips.length, `masse ${total} hors budget`);
});

test('le SMIC compresse l écart de revenu sous l écart de points', () => {
  const slips = computePayroll(reels, PARAMS);
  const ecartPoints = reels[0].points / reels[reels.length - 1].points;
  const ecartPaie = slips[0].total / slips[slips.length - 1].total;
  assert.ok(ecartPaie < ecartPoints / 2, `paie ${ecartPaie} vs points ${ecartPoints}`);
  assert.ok(slips.every(s => s.base === 100));
});

test('la paie reste proportionnelle aux points', () => {
  const slips = computePayroll(reels, PARAMS);
  for (let i = 1; i < slips.length; i++) {
    assert.ok(slips[i - 1].total > slips[i].total);
  }
});

test('doubler ses points augmente sa paie quand les autres stagnent', () => {
  const avant = computePayroll(reels, PARAMS).find(s => s.userId === 'elio')!;
  const apres = computePayroll(
    reels.map(s => (s.userId === 'elio' ? { ...s, points: s.points * 2 } : s)),
    PARAMS,
  ).find(s => s.userId === 'elio')!;
  assert.ok(apres.total > avant.total);
});

test('les comptes sous le seuil ne sont pas payés et ne gonflent pas la masse', () => {
  const fantomes: ActivityScore[] = Array.from({ length: 200 }, (_, i) => ({
    userId: `fantome-${i}`,
    points: 450,
  }));
  const slips = computePayroll([...reels, ...fantomes], PARAMS);
  const total = slips.reduce((sum, s) => sum + s.total, 0);

  assert.equal(slips.length, 4);
  assert.ok(!slips.some(s => s.userId.startsWith('fantome')));
  assert.ok(Math.abs(total - 4 * 250) <= slips.length, `emission gonflee a ${total}`);
});

test('aucun qualifié ne produit aucune fiche de paie', () => {
  assert.deepEqual(computePayroll([{ userId: 'a', points: 1799 }], PARAMS), []);
});

test('la clé de semaine suit la semaine ISO parisienne', () => {
  assert.equal(parisWeekKey(new Date('2026-09-18T12:00:00Z')), '2026-W38');
  // Lundi 00:05 Paris = dimanche 22:05 UTC : la semaine doit être la nouvelle.
  assert.equal(parisWeekKey(new Date('2026-09-20T22:05:00Z')), '2026-W39');
});
