import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseThemeConfig } from './theme-config';

test('une config valide est reprise telle quelle', () => {
  const config = parseThemeConfig('{ "label": "Aurore", "panelColor": "#102030", "panelOpacity": 0.4, "blur": 10, "accent": "#ABCDEF" }');
  assert.equal(config.label, 'Aurore');
  assert.deepEqual(config.style, { panelColor: '#102030', panelOpacity: 0.4, blur: 10, accent: '#ABCDEF' });
  assert.deepEqual(config.problems, []);
});

test('les valeurs invalides sont ignorées et signalées, les autres gardées', () => {
  const config = parseThemeConfig('{ "panelColor": "rouge", "panelOpacity": 2, "blur": 12, "couleur": "#fff" }');
  assert.deepEqual(config.style, { blur: 12 });
  assert.equal(config.problems.length, 3);
});

test('un JSON illisible ne lève pas d’exception', () => {
  const config = parseThemeConfig('{ "label": "Aurore", }');
  assert.deepEqual(config.style, {});
  assert.equal(config.problems.length, 1);
});
