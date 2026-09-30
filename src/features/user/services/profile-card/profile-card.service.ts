import type { Node } from '@takumi-rs/core';
import { iconImages } from './assets';
import { fetchAvatar } from './avatar';
import { themeBackdrop } from './backdrop';
import { withEmojis } from './emoji';
import { CARD_HEIGHT, CARD_WIDTH } from './geometry';
import { buildCard } from './layout';
import type { ProfileCardData } from './profile-card.types';
import { cardRenderer } from './renderer';
import { getTheme, listThemes } from './themes';

export type { ProfileCardData };

export class ProfileCardService {
  static async generateCard(data: ProfileCardData): Promise<Buffer> {
    const theme = getTheme(data.themeId);
    const [renderer, backdrop, avatar] = await Promise.all([cardRenderer(), themeBackdrop(theme), fetchAvatar(data.avatarUrl)]);
    const card = await withEmojis(buildCard(data, theme, avatar));

    return renderer.render(card as Node, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      format: 'png',
      images: [backdrop, ...iconImages()],
    });
  }

  /** Prépare polices, icônes et fonds de tous les thèmes, pour qu'aucun /me ne les paie. */
  static async warmUp(): Promise<void> {
    iconImages();
    await Promise.all(listThemes().map(themeBackdrop));
  }
}
