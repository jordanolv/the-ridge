import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProgressBar, buildRarityTally, highestRarity, type RenderableCard } from './card-render';

const card = (rarity: RenderableCard['rarity']): RenderableCard =>
  ({ rarity, isDuplicate: false, fragmentsGained: 0, mountain: {} as RenderableCard['mountain'] });

test('la barre de progression suit les cartes révélées', () => {
  assert.equal(buildProgressBar(0, 5), '▯▯▯▯▯');
  assert.equal(buildProgressBar(2, 5), '▮▮▯▯▯');
  assert.equal(buildProgressBar(5, 5), '▮▮▮▮▮');
});

test('le tableau de chasse compte par rareté et masque les zéros', () => {
  assert.equal(buildRarityTally([card('common'), card('common'), card('epic')]), '⬜×2  🟪×1');
});

test('le tableau de chasse est vide sans carte', () => {
  assert.equal(buildRarityTally([]), '');
});

test('la rareté la plus haute pilote la couleur du bilan', () => {
  assert.equal(highestRarity([card('common'), card('legendary'), card('rare')]), 'legendary');
  assert.equal(highestRarity([card('common')]), 'common');
});
