import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Solver } from '../models/enigme-state.model';
import { podiumSolvers, rankSolvers } from './enigme-ranking';

const solver = (userId: string, durationMs: number, usedHint = false): Solver =>
  ({ userId, at: new Date(), durationMs, usedHint });

test('le classement suit le chrono personnel, pas l\'ordre d\'arrivée', () => {
  const solvers = [solver('tardif', 30_000), solver('rapide', 5_000), solver('moyen', 12_000)];
  assert.deepEqual(rankSolvers(solvers).map((s) => s.userId), ['rapide', 'moyen', 'tardif']);
});

test('prendre l\'indice sort du podium, même avec le meilleur chrono', () => {
  const solvers = [solver('triche', 1_000, true), solver('a', 9_000), solver('b', 20_000)];
  assert.deepEqual(podiumSolvers(solvers).map((s) => s.userId), ['a', 'b']);
});

test('le podium ne dépasse jamais trois places', () => {
  const solvers = [1, 2, 3, 4, 5].map((n) => solver(`u${n}`, n * 1_000));
  assert.deepEqual(podiumSolvers(solvers).map((s) => s.userId), ['u1', 'u2', 'u3']);
});

test('si tout le monde a pris l\'indice, le podium est vide', () => {
  const solvers = [solver('a', 1_000, true), solver('b', 2_000, true)];
  assert.deepEqual(podiumSolvers(solvers), []);
});

test('une énigme d\'avant le chrono personnel retombe sur l\'ordre d\'arrivée', () => {
  const startedAt = new Date('2026-09-18T12:00:00Z');
  const legacy = (userId: string, minutes: number) =>
    ({ userId, at: new Date(startedAt.getTime() + minutes * 60_000) }) as Solver;
  const solvers = [legacy('second', 20), legacy('premier', 3)];
  assert.deepEqual(rankSolvers(solvers, startedAt).map((s) => s.userId), ['premier', 'second']);
});
