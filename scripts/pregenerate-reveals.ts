import 'dotenv/config';
import { MountainService } from '../src/features/peak-hunters/services/mountain.service';
import { ensureRevealAnimation } from '../src/features/peak-hunters/services/reveal-animation.service';

/**
 * Génère et met en cache l'animation de révélation de chaque montagne, pour qu'aucun
 * joueur n'essuie la première génération. Relançable : les animations déjà sur
 * Cloudinary sont réutilisées, pas régénérées.
 *
 *   node -r @swc-node/register scripts/pregenerate-reveals.ts [slug]
 */
async function main() {
  MountainService.loadMountains();

  const only = process.argv[2];
  const mountains = only ? [MountainService.getById(only)].filter(m => m !== undefined) : MountainService.getAll();
  if (mountains.length === 0) throw new Error(`Aucune montagne à traiter${only ? ` pour « ${only} »` : ''}`);

  let done = 0;
  let failed = 0;

  for (const mountain of mountains) {
    const url = await ensureRevealAnimation(mountain, MountainService.getRarity(mountain));
    if (url) done++;
    else failed++;
    process.stdout.write(`\r${done + failed}/${mountains.length}  ✅ ${done}  ❌ ${failed}   `);
  }

  console.log(`\n${done} animations prêtes${failed > 0 ? `, ${failed} en échec` : ''}.`);
}

main().then(() => process.exit(0));
