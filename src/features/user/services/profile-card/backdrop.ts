import { readFileSync } from 'node:fs';
import type { Node } from '@takumi-rs/core';
import type { ImageSource } from './assets';
import { box, image } from './elements';
import { CARD_HEIGHT, CARD_WIDTH, PANELS, PANEL_RADIUS } from './geometry';
import { cardRenderer } from './renderer';
import type { ProfileTheme } from './themes';

export const backdropSrc = (theme: ProfileTheme) => `backdrop:${theme.id}`;

const cache = new Map<string, Promise<ImageSource>>();

/**
 * Le fond et les cadres ne dépendent que du thème : le flou sous les panneaux, qui coûte
 * autant que tout le reste de la carte, est calculé une fois par thème puis réutilisé.
 */
async function bake(theme: ProfileTheme): Promise<ImageSource> {
  const rawSrc = `raw:${theme.id}`;
  const scene = box(
    { position: 'relative', width: CARD_WIDTH, height: CARD_HEIGHT },
    image(rawSrc, { position: 'absolute', left: 0, top: 0, width: CARD_WIDTH, height: CARD_HEIGHT, objectFit: 'cover' }),
    ...Object.values(PANELS).map(rect =>
      box({
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        borderRadius: PANEL_RADIUS,
        backdropFilter: `blur(${theme.style.blur}px)`,
      }),
    ),
  );

  const renderer = await cardRenderer();
  const data = await renderer.render(scene as Node, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    format: 'png',
    images: [{ src: rawSrc, data: readFileSync(theme.background), cache: 'none' }],
  });
  return { src: backdropSrc(theme), data };
}

export function themeBackdrop(theme: ProfileTheme): Promise<ImageSource> {
  let backdrop = cache.get(theme.id);
  if (!backdrop) {
    backdrop = bake(theme);
    backdrop.catch(() => cache.delete(theme.id));
    cache.set(theme.id, backdrop);
  }
  return backdrop;
}
