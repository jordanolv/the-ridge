import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampQuantity,
  colorVariantId,
  COLOR_PRESETS,
  findItem,
  findVariant,
  MAX_QUANTITY,
  parseColorVariant,
  parseHex,
  quantityLabel,
  SHOP_ITEMS,
} from './catalog';

test('la quantité reste entre 1 et le plafond', () => {
  assert.equal(clampQuantity(0), 1);
  assert.equal(clampQuantity(-3), 1);
  assert.equal(clampQuantity(MAX_QUANTITY + 5), MAX_QUANTITY);
  assert.equal(clampQuantity(NaN), 1);
});

test('une location se compte en mois, un consommable en unités', () => {
  const rental = findItem('role-color')!;
  const consumable = findItem('pack-sentier')!;
  assert.equal(quantityLabel(rental, 1), '1 mois');
  assert.equal(quantityLabel(rental, 3), '3 mois');
  assert.equal(quantityLabel(consumable, 3), '×3');
});

test('tout article à variantes a une couleur et un emoji par variante', () => {
  for (const item of SHOP_ITEMS.filter(i => i.variants)) {
    for (const v of item.variants!) {
      assert.ok(v.emoji, `${item.id}/${v.id} sans emoji`);
      assert.ok(Number.isInteger(v.color), `${item.id}/${v.id} sans couleur`);
    }
  }
});

test('un article à variantes sans aucune variante est marqué bientôt', () => {
  for (const item of SHOP_ITEMS) {
    if (item.variants && item.variants.length === 0) {
      assert.equal(item.soon, true, `${item.id} vendable sans variante achetable`);
    }
  }
});

test('un code couleur se lit avec ou sans #, en court ou en long', () => {
  assert.equal(parseHex('#ff8800'), 0xff8800);
  assert.equal(parseHex('FF8800'), 0xff8800);
  assert.equal(parseHex(' #f80 '), 0xff8800);
  assert.equal(parseHex('#ff88'), undefined);
  assert.equal(parseHex('rouge'), undefined);
});

test('le noir pur reste une couleur', () => {
  assert.equal(parseHex('#000000'), 0x010101);
});

test('une couleur choisie fait l\'aller-retour par le customId', () => {
  const solid = parseColorVariant(colorVariantId(0xff8800))!;
  assert.equal(solid.color, 0xff8800);
  assert.equal(solid.secondaryColor, undefined);
  assert.equal(solid.label, '#FF8800');

  const gradient = parseColorVariant(colorVariantId(0xff8800, 0x3498db))!;
  assert.equal(gradient.secondaryColor, 0x3498db);
  assert.equal(gradient.label, '#FF8800 → #3498DB');

  assert.equal(parseColorVariant('nimporte'), undefined);
  assert.equal(parseColorVariant('ff8800-zz'), undefined);
});

test('une couleur toute prête garde son nom', () => {
  const preset = COLOR_PRESETS[0];
  assert.equal(parseColorVariant(colorVariantId(preset.color))!.label, preset.label);
});

test('le rôle coloré accepte n\'importe quelle couleur', () => {
  const item = findItem('role-color')!;
  assert.equal(findVariant(item, 'abcdef')!.color, 0xabcdef);
});
