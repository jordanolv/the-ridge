import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { fetchAvatar } from './avatar';
import { loadEmoji } from './emoji';
import { themeBackground } from './background';
import { satoriFonts } from './fonts';
import { CARD_WIDTH, CARD_HEIGHT } from './geometry';
import { buildCard } from './layout';
import type { ProfileCardData } from './profile-card.types';
import { getTheme } from './themes';

export type { ProfileCardData };

export class ProfileCardService {
  static async generateCard(data: ProfileCardData): Promise<Buffer> {
    const theme = getTheme(data.themeId);
    const [background, avatar] = await Promise.all([themeBackground(theme), fetchAvatar(data.avatarUrl)]);

    const tree = buildCard(data, theme, background, avatar);
    const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: satoriFonts(),
      loadAdditionalAsset: async (code, segment) => (code === 'emoji' ? ((await loadEmoji(segment)) ?? '') : []),
    });

    // Satori vectorise déjà le texte : sans ça resvg rescanne les polices système à chaque carte (~300 ms).
    return new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH }, font: { loadSystemFonts: false } }).render().asPng();
  }
}
