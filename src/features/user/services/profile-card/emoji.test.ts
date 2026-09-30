import { test } from 'node:test';
import assert from 'node:assert/strict';
import { twemojiCode } from './emoji';
import { sanitizeText } from './text';

test('twemojiCode retire le sélecteur de variante d’un emoji simple', () => {
  assert.equal(twemojiCode(String.fromCodePoint(0x1f3d4, 0xfe0f)), '1f3d4');
});

test('twemojiCode garde toute une séquence ZWJ', () => {
  const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
  assert.equal(twemojiCode(family), '1f468-200d-1f469-200d-1f467');
});

test('sanitizeText ne casse pas les emojis composés', () => {
  const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
  assert.equal(sanitizeText(family), family);
});
