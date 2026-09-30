import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureText } from './fonts';
import { cleanRoleName, sanitizeText, truncateToWidth } from './text';

test('sanitizeText retire les caractères invisibles des pseudos', () => {
  assert.equal(sanitizeText(`${String.fromCharCode(0x3164)}Jo${String.fromCharCode(0x200b)}rdan `), 'Jordan');
});

test('cleanRoleName retire emotes custom et emojis', () => {
  assert.equal(cleanRoleName('<:ridge:123456> Campeur 🏕️'), 'Campeur');
});

test('truncateToWidth laisse un texte court intact et coupe un long avec « … »', () => {
  assert.equal(truncateToWidth('Court', 400, 20, 700), 'Court');
  const cut = truncateToWidth('Une bio beaucoup trop longue pour tenir dans la carte du profil', 200, 20, 700);
  assert.ok(cut.endsWith('…'));
  assert.ok(measureText(cut, 20, 700) <= 200);
});

test('truncateToWidth garde les emojis entiers', () => {
  const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
  const cut = truncateToWidth(`${family} `.repeat(40), 100, 20, 700);
  assert.ok(cut.endsWith('…'));
  assert.ok(cut.includes(family));
  assert.ok(!cut.replaceAll(family, '').replace(/[ …]/g, ''));
});
