import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, formatDurationShort, formatNumber, plural } from './format';

test('formatDurationShort arrondit à l’unité la plus grande', () => {
  assert.equal(formatDurationShort(0), '0');
  assert.equal(formatDurationShort(45), '45s');
  assert.equal(formatDurationShort(125), '2m');
  assert.equal(formatDurationShort(7300), '2h');
});

test('formatDuration reste lisible de la minute aux centaines d’heures', () => {
  assert.equal(formatDuration(30), '30s');
  assert.equal(formatDuration(720), '12m');
  assert.equal(formatDuration(4 * 3600 + 20 * 60), '4h 20m');
  assert.equal(formatDuration(1_123_200), '312h');
});

test('formatNumber et plural suivent l’usage français', () => {
  assert.equal(formatNumber(1234567).replace(/\s/g, ' '), '1 234 567');
  assert.equal(plural(1, 'soirée'), '1 soirée');
  assert.equal(plural(3, 'soirée'), '3 soirées');
});
