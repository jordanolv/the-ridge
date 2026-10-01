import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTheme } from './engine/themes';
import { ProfileCardService } from './profile-card.service';
import { TABS } from './tabs';
import { SAMPLES } from './tabs/samples';

const isCardPng = (png: Buffer) =>
  png.subarray(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1500 && png.readUInt32BE(20) === 900;

for (const tab of TABS) {
  test(`l’onglet « ${tab.label} » rend un PNG 1500×900 à partir de ses données d’exemple`, async () => {
    assert.ok(SAMPLES[tab.id], `données d'exemple manquantes pour ${tab.id}`);
    assert.ok(isCardPng(await ProfileCardService.draw(tab, SAMPLES[tab.id], defaultTheme())));
  });
}

test('chaque onglet a un identifiant unique et court (il voyage dans le customId des boutons)', () => {
  const ids = TABS.map(tab => tab.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => !id.includes(':') && id.length <= 16));
});
