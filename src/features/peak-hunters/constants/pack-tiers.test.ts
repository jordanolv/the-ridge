import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACK_CARDS, packTiers } from './peak-hunters.constants';

test('un pack a le bon nombre de cartes', () => {
  assert.equal(packTiers('sentier').length, PACK_CARDS.sentier);
  assert.equal(packTiers('falaise').length, PACK_CARDS.falaise);
  assert.equal(packTiers('sommet').length, PACK_CARDS.sommet);
});

test('seule la dernière carte porte le tier du pack', () => {
  const tiers = packTiers('sommet');
  assert.deepEqual(tiers.slice(0, -1), ['sentier', 'sentier', 'sentier', 'sentier']);
  assert.equal(tiers.at(-1), 'sommet');
});

test('le pack Sentier ne tire que du sentier', () => {
  assert.deepEqual(packTiers('sentier'), ['sentier', 'sentier', 'sentier']);
});
