import mountains from '../src/features/peak-hunters/data/mountains.json';
import { EXPEDITION_TIER_RARITY_WEIGHTS, packTiers } from '../src/features/peak-hunters/constants/peak-hunters.constants';
import type { ExpeditionTier, MountainRarity } from '../src/features/peak-hunters/types/peak-hunters.types';
import { findItem } from '../src/features/shop/catalog';

/**
 * Rejoue la grille des packs de `docs/shop.md` §4 avec les prix et les tables du code :
 * ce qu'un même budget donne dans chaque pack, et le coût d'une collection complète.
 *
 *   node -r @swc-node/register scripts/simulate-packs.ts [budget] [runs]
 */
const budget = Number(process.argv[2] ?? 450);
const runs = Number(process.argv[3] ?? 300);

const TIERS: ExpeditionTier[] = ['sentier', 'falaise', 'sommet'];
const RARITIES: MountainRarity[] = ['common', 'rare', 'epic', 'legendary'];

const poolSize = Object.fromEntries(
  RARITIES.map(r => [r, (mountains as { rarity: MountainRarity }[]).filter(m => m.rarity === r).length]),
) as Record<MountainRarity, number>;
const collectionSize = RARITIES.reduce((sum, r) => sum + poolSize[r], 0);

const priceOf = (tier: ExpeditionTier) => findItem(`pack-${tier}`)!.price;

function rollRarity(tier: ExpeditionTier): MountainRarity {
  const weights = EXPEDITION_TIER_RARITY_WEIGHTS[tier];
  let roll = Math.random() * RARITIES.reduce((sum, r) => sum + weights[r], 0);
  for (const r of RARITIES) {
    roll -= weights[r];
    if (roll <= 0) return r;
  }
  return 'common';
}

function cardsForBudget(tier: ExpeditionTier): Record<MountainRarity, number> {
  const packs = Math.floor(budget / priceOf(tier));
  const totals = Object.fromEntries(RARITIES.map(r => [r, 0])) as Record<MountainRarity, number>;
  for (let run = 0; run < runs * 10; run++) {
    for (let p = 0; p < packs; p++) for (const slot of packTiers(tier)) totals[rollRarity(slot)]++;
  }
  for (const r of RARITIES) totals[r] /= runs * 10;
  return totals;
}

function costToComplete(tier: ExpeditionTier): number {
  let spent = 0;
  for (let run = 0; run < runs; run++) {
    const owned = Object.fromEntries(RARITIES.map(r => [r, new Set<number>()])) as Record<MountainRarity, Set<number>>;
    let count = 0;
    while (count < collectionSize) {
      spent += priceOf(tier);
      for (const slot of packTiers(tier)) {
        const rarity = rollRarity(slot);
        const id = Math.floor(Math.random() * poolSize[rarity]);
        if (!owned[rarity].has(id)) {
          owned[rarity].add(id);
          count++;
        }
      }
    }
  }
  return Math.round(spent / runs);
}

const fmt = (n: number) => n.toFixed(1).padStart(8);

console.log(`${collectionSize} montagnes · ${JSON.stringify(poolSize)}\n`);
console.log(`Pour ${budget} RC`.padEnd(22) + RARITIES.map(r => r.padStart(10)).join('') + '   collection complète');
for (const tier of TIERS) {
  const cards = cardsForBudget(tier);
  const label = `${tier} (${priceOf(tier)})`.padEnd(22);
  console.log(label + RARITIES.map(r => `  ${fmt(cards[r])}`).join('') + `   ~${costToComplete(tier).toLocaleString('fr-FR')} RC`);
}
