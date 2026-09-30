import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureText } from './fonts';
import { cleanRoleName, ellipsize, fitFontSize, sanitizeText } from './text';

test('sanitizeText retire les caractères invisibles des pseudos', () => {
  assert.equal(sanitizeText(`${String.fromCharCode(0x3164)}Jo${String.fromCharCode(0x200b)}rdan `), 'Jordan');
});

test('cleanRoleName retire emotes custom et emojis', () => {
  assert.equal(cleanRoleName('<:ridge:123456> Campeur 🏕️'), 'Campeur');
});

test('fitFontSize garde la taille max quand le texte tient', () => {
  assert.equal(fitFontSize('Jo', 400, 40, 26, 700), 40);
});

test('fitFontSize réduit un texte long sans descendre sous le minimum', () => {
  const long = 'Le Grand Explorateur des Sommets Enneigés';
  const size = fitFontSize(long, 480, 40, 26, 700);
  assert.ok(size < 40 && size >= 26);
  assert.ok(size === 26 || measureText(long, size, 700) <= 480);
});

test('ellipsize coupe avec « … » et tient dans la largeur', () => {
  const cut = ellipsize('Une bio beaucoup trop longue pour la carte', 150, 20, 700);
  assert.ok(cut.endsWith('…'));
  assert.ok(measureText(cut, 20, 700) <= 150);
  assert.equal(ellipsize('Court', 150, 20, 700), 'Court');
});
