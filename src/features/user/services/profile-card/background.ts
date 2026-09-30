import { readFileSync } from 'node:fs';
import { createCanvas, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import { CARD_HEIGHT, CARD_WIDTH, PANELS, PANEL_RADIUS } from './geometry';
import { dataUrl } from './elements';
import type { ProfileTheme } from './themes';

const cache = new Map<string, Promise<string>>();

function drawCover(ctx: SKRSContext2D, img: Image): void {
  const ratio = Math.max(CARD_WIDTH / img.width, CARD_HEIGHT / img.height);
  const width = img.width * ratio;
  const height = img.height * ratio;
  ctx.drawImage(img, (CARD_WIDTH - width) / 2, (CARD_HEIGHT - height) / 2, width, height);
}

/** Satori ne sait pas faire de `backdrop-filter` : le flou sous les panneaux est cuit dans le fond. */
async function bake(theme: ProfileTheme): Promise<string> {
  const img = await loadImage(readFileSync(theme.background));
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');
  drawCover(ctx, img);

  if (theme.style.blur > 0) {
    for (const panel of Object.values(PANELS)) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(panel.x, panel.y, panel.width, panel.height, PANEL_RADIUS);
      ctx.clip();
      ctx.filter = `blur(${theme.style.blur}px)`;
      drawCover(ctx, img);
      ctx.restore();
    }
  }

  return dataUrl(canvas.toBuffer('image/jpeg', 90), 'image/jpeg');
}

export function themeBackground(theme: ProfileTheme): Promise<string> {
  let background = cache.get(theme.id);
  if (!background) {
    background = bake(theme);
    background.catch(() => cache.delete(theme.id));
    cache.set(theme.id, background);
  }
  return background;
}
