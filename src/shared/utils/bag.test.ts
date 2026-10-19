import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffle, createBag, pickLeastRecent } from './bag';

test('shuffle garde exactement les mêmes éléments', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const out = shuffle(src);
  assert.deepEqual([...out].sort((a, b) => a - b), src);
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'la source ne doit pas être mutée');
});

test('shuffle répartit uniformément (un sort() aléatoire, lui, est biaisé)', () => {
  const src = Array.from({ length: 12 }, (_, i) => i);
  const tirages = 20_000;
  let resteEnTete = 0;
  for (let i = 0; i < tirages; i++) if (shuffle(src)[0] === 0) resteEnTete++;

  const part = resteEnTete / tirages;
  // Uniforme = 1/12 ≈ 8,3 %. Un [...x].sort(() => Math.random() - 0.5) donne ~17 %.
  assert.ok(part > 0.06 && part < 0.11, `premier élément conservé ${(part * 100).toFixed(1)} %, attendu ~8,3 %`);
});

test('le sac épuise toutes les entrées avant de se répéter', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  const bag = createBag(items);
  const cycle = items.map(() => bag.draw());
  assert.deepEqual([...cycle].sort(), [...items].sort());
});

test('le sac se recharge au cycle suivant', () => {
  const items = ['a', 'b', 'c'];
  const bag = createBag(items);
  const deux = [...items, ...items].map(() => bag.draw());
  assert.equal(deux.length, 6);
  assert.deepEqual([...deux].sort(), ['a', 'a', 'b', 'b', 'c', 'c']);
});

test('un sac vide est une erreur de programmation, pas un crash au tirage', () => {
  assert.throws(() => createBag([]), /liste vide/);
});

test('pickLeastRecent ne ressort jamais une entrée récente tant qu\'il en reste de neuves', () => {
  const items = ['a', 'b', 'c', 'd'];
  for (let i = 0; i < 200; i++) {
    assert.equal(pickLeastRecent(items, (x) => x, ['a', 'c', 'd']), 'b');
  }
});

test('pickLeastRecent reprend la plus ancienne quand tout est déjà sorti', () => {
  const items = ['a', 'b', 'c'];
  assert.equal(pickLeastRecent(items, (x) => x, ['b', 'c', 'a', 'c']), 'b');
});

test('pickLeastRecent sur une liste vide ne renvoie rien', () => {
  assert.equal(pickLeastRecent([], (x: string) => x, []), undefined);
});
