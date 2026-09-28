import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampQuantity, quantityLabel, findItem, MAX_QUANTITY, SHOP_ITEMS } from './catalog';

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
