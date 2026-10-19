import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextExpiry } from './rental-expiry';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-09-19T12:00:00Z');

test('une première location part de maintenant', () => {
  assert.equal(nextExpiry(null, now, 30).getTime(), now.getTime() + 30 * DAY);
});

test('une location en cours cumule le temps restant', () => {
  const current = new Date(now.getTime() + 10 * DAY);
  assert.equal(nextExpiry(current, now, 30).getTime(), now.getTime() + 40 * DAY);
});

test('une location périmée ne recule pas la date', () => {
  const expired = new Date(now.getTime() - 5 * DAY);
  assert.equal(nextExpiry(expired, now, 30).getTime(), now.getTime() + 30 * DAY);
});
