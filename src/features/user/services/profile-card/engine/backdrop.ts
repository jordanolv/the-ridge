import { readFileSync } from 'node:fs';
import type { Node } from '@takumi-rs/core';
import type { ImageSource } from './assets';
import { box, image } from './elements';
import { CARD_HEIGHT, CARD_WIDTH, PANEL_RADIUS, type Rect } from './geometry';
import { cardRenderer } from './renderer';
import type { ProfileTheme } from './themes';

export interface Layout {
  id: string;
  panels: Rect[];
}

export const backdropSrc = (theme: ProfileTheme, layout: Layout) => `backdrop:${theme.id}:${layout.id}`;

const cache = new Map<string, Promise<ImageSource>>();

/**
 * Le fond et les cadres ne dépendent que du thème et de l'onglet : le flou sous les
 * panneaux, qui coûte autant que tout le reste de la carte, est calculé une fois puis réutilisé.
 */
async function bake(theme: ProfileTheme, layout: Layout): Promise<ImageSource> {
  const rawSrc = `raw:${theme.id}`;
  const scene = box(
    { position: 'relative', width: CARD_WIDTH, height: CARD_HEIGHT },
    image(rawSrc, { position: 'absolute', left: 0, top: 0, width: CARD_WIDTH, height: CARD_HEIGHT, objectFit: 'cover' }),
    ...layout.panels.map(panel =>
      box({
        position: 'absolute',
        left: panel.x,
        top: panel.y,
        width: panel.width,
        height: panel.height,
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
  return { src: backdropSrc(theme, layout), data };
}

export function backdrop(theme: ProfileTheme, layout: Layout): Promise<ImageSource> {
  const key = backdropSrc(theme, layout);
  let baked = cache.get(key);
  if (!baked) {
    baked = bake(theme, layout);
    baked.catch(() => cache.delete(key));
    cache.set(key, baked);
  }
  return baked;
}
