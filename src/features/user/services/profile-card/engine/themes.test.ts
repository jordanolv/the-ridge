import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STYLE, defaultTheme, getTheme, listPaidThemes, listThemes } from './themes';

test('le thème classique est toujours présent et gratuit', () => {
  assert.equal(defaultTheme().id, 'classique');
  assert.ok(listThemes().some(t => t.id === 'classique'));
  assert.ok(!listPaidThemes().some(t => t.id === 'classique'));
});

test('un thème inconnu retombe sur le classique', () => {
  assert.equal(getTheme('theme-supprime').id, 'classique');
  assert.equal(getTheme(undefined).id, 'classique');
  assert.equal(getTheme(null).id, 'classique');
});

test('le .json d’un thème surcharge le libellé et les couleurs, le reste garde les défauts', () => {
  const theme = defaultTheme();
  assert.equal(theme.label, 'Classique');
  assert.notEqual(theme.style.panelColor, DEFAULT_STYLE.panelColor);
  assert.equal(theme.style.accent, DEFAULT_STYLE.accent);
});
