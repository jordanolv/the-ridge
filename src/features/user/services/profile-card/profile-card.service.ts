import type { Node } from '@takumi-rs/core';
import { iconImages } from './engine/assets';
import { backdrop } from './engine/backdrop';
import { withEmojis } from './engine/emoji';
import { CARD_HEIGHT, CARD_WIDTH } from './engine/geometry';
import { cardRenderer } from './engine/renderer';
import { getTheme, listThemes, type ProfileTheme } from './engine/themes';
import { TABS, type TabTarget } from './tabs';
import type { ProfileTab } from './tabs/tab';

export class ProfileCardService {
  static async render<Data>(tab: ProfileTab<Data>, target: TabTarget): Promise<Buffer> {
    const theme = getTheme(target.account.profil?.cardTheme);
    const [data] = await Promise.all([tab.load(target), backdrop(theme, tab.layout)]);
    return this.draw(tab, data, theme);
  }

  /** Le rendu seul, à partir de données déjà chargées : c'est ce que testent les onglets. */
  static async draw<Data>(tab: ProfileTab<Data>, data: Data, theme: ProfileTheme): Promise<Buffer> {
    const [renderer, background] = await Promise.all([cardRenderer(), backdrop(theme, tab.layout)]);
    const node = await withEmojis(tab.build(data, theme));

    return renderer.render(node as Node, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      format: 'png',
      images: [background, ...iconImages()],
    });
  }

  /** Prépare polices, icônes et fonds de chaque thème × onglet, pour qu'aucun /me ne les paie. */
  static async warmUp(): Promise<void> {
    iconImages();
    await Promise.all([
      ...listThemes().flatMap(theme => TABS.map(tab => backdrop(theme, tab.layout))),
      ...TABS.map(tab => tab.prepare?.()),
    ]);
  }
}
