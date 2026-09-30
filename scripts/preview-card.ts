import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProfileCardService } from '../src/features/user/services/profile-card/profile-card.service';

/**
 * Rend la carte /me avec des données d'exemple, pour juger un thème sans lancer le bot.
 *
 *   node -r @swc-node/register scripts/preview-card.ts [themeId] [pseudo]
 */
async function main() {
  const [themeId = 'classique', pseudo = 'Pseudo'] = process.argv.slice(2);
  const activity = [3100, 4200, 5000, 7400, 1000, 2800, 4100, 2600, 3600, 4700, 5200, 6100, 1900, 800];

  const started = performance.now();
  const png = await ProfileCardService.generateCard({
    themeId,
    pseudo,
    bio: 'Une bio pour voir le rendu',
    ridgecoin: '1 250',
    level: '42',
    messages: '8 431',
    voc: '312h',
    birthday: '21/03',
    joinedAt: '12/2023',
    avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
    roles: [
      { name: 'Campeur', color: '#e67e22' },
      { name: 'Podium', color: '#f1c40f' },
      { name: 'Membre', color: '#95a5a6' },
    ],
    weeklyActivity: activity.map((time, i) => ({ date: new Date(Date.now() - (13 - i) * 86_400_000), time })),
    mountains: [
      { name: 'Everest', unlocked: true },
      { name: 'K2', unlocked: false },
      { name: 'Mont Blanc', unlocked: true },
    ],
    xp: { current: 640, required: 1000, percent: 0.64 },
  });

  const out = path.join(tmpdir(), `card-${themeId}.png`);
  writeFileSync(out, png);
  console.log(`${out} (${Math.round(performance.now() - started)} ms)`);
}

main().then(
  () => process.exit(0),
  err => {
    console.error(err);
    process.exit(1);
  },
);
