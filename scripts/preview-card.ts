import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MountainService } from '../src/features/peak-hunters/services/mountain.service';
import { fetchImage } from '../src/features/user/services/profile-card/engine/remote-image';
import { getTheme } from '../src/features/user/services/profile-card/engine/themes';
import { ProfileCardService } from '../src/features/user/services/profile-card/profile-card.service';
import { findTab, TABS } from '../src/features/user/services/profile-card/tabs';
import type { PeakHuntersData } from '../src/features/user/services/profile-card/tabs/peak-hunters.tab';
import { SAMPLES } from '../src/features/user/services/profile-card/tabs/samples';

/**
 * Rend un onglet de /me avec ses données d'exemple, pour juger un thème ou une mise en
 * page sans lancer le bot.
 *
 *   node -r @swc-node/register scripts/preview-card.ts [onglet|all] [thème]
 */
async function withRealPhotos(sample: PeakHuntersData): Promise<PeakHuntersData> {
  MountainService.loadMountains();
  const photoOf = async (label: string) => {
    const mountain = MountainService.getAll().find(m => m.mountainLabel.toLowerCase().includes(label.toLowerCase()));
    return mountain ? fetchImage(mountain.image.replace('/upload/', '/upload/c_fill,w_320,h_200,q_auto/')) : null;
  };
  const enrich = (thumbnails: PeakHuntersData['showcase']) => Promise.all(thumbnails.map(async t => ({ ...t, photo: await photoOf(t.label) })));
  return { ...sample, showcase: await enrich(sample.showcase), missing: await enrich(sample.missing) };
}

async function main() {
  const [tabId = 'all', themeId = 'classique'] = process.argv.slice(2);
  const tabs = tabId === 'all' ? TABS : [findTab(tabId)].filter(t => t !== undefined);
  if (tabs.length === 0) throw new Error(`Onglet inconnu « ${tabId} » : ${TABS.map(t => t.id).join(', ')}`);
  const theme = getTheme(themeId);

  for (const tab of tabs) {
    const sample = tab.id === 'peak-hunters' ? await withRealPhotos(SAMPLES[tab.id] as PeakHuntersData) : SAMPLES[tab.id];
    const started = performance.now();
    const png = await ProfileCardService.draw(tab, sample, theme);
    const out = path.join(tmpdir(), `card-${tab.id}-${theme.id}.png`);
    writeFileSync(out, png);
    console.log(`${out} (${Math.round(performance.now() - started)} ms)`);
  }
}

main().then(
  () => process.exit(0),
  err => {
    console.error(err);
    process.exit(1);
  },
);
