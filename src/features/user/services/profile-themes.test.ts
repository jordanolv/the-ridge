import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTheme, listThemes, listPaidThemes, DEFAULT_THEME } from './profile-themes';

test('le thème classique est toujours présent et gratuit', () => {
  assert.ok(listThemes().some(t => t.id === DEFAULT_THEME.id));
  assert.ok(!listPaidThemes().some(t => t.id === DEFAULT_THEME.id));
});

test('un thème inconnu retombe sur le classique', () => {
  assert.equal(getTheme('theme-supprime').id, DEFAULT_THEME.id);
  assert.equal(getTheme(undefined).id, DEFAULT_THEME.id);
  assert.equal(getTheme(null).id, DEFAULT_THEME.id);
});
