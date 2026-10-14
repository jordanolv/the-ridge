import path from 'node:path';
import { createCanvas, loadImage, GlobalFonts, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import { RARITY_CONFIG } from '../constants/peak-hunters.constants';
import type { CardDraw } from './mountain.service';

const CARD_W = 210;
const CARD_H = 290;
const GAP = 14;
const PAD = 16;
const BORDER = 6;
const RADIUS = 14;

GlobalFonts.registerFromPath(path.join(process.cwd(), 'assets/fonts/Roboto-Black.ttf'), 'StripBlack');
GlobalFonts.registerFromPath(path.join(process.cwd(), 'assets/fonts/Roboto-Bold.ttf'), 'StripBold');

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function roundedRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawCover(ctx: SKRSContext2D, img: Image, x: number, y: number, w: number, h: number): void {
  const ratio = Math.max(w / img.width, h / img.height);
  const sw = w / ratio;
  const sh = h / ratio;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Les noms longs rétrécissent, puis passent sur deux lignes. */
function fitName(ctx: SKRSContext2D, name: string, maxWidth: number): { lines: string[]; size: number } {
  const text = name.toUpperCase();
  for (let size = 24; size >= 15; size--) {
    ctx.font = `${size}px StripBlack`;
    if (ctx.measureText(text).width <= maxWidth) return { lines: [text], size };
  }

  const size = 18;
  ctx.font = `${size}px StripBlack`;
  const words = text.split(' ');
  for (let cut = words.length - 1; cut > 0; cut--) {
    const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
    if (lines.every(l => ctx.measureText(l).width <= maxWidth)) return { lines, size };
  }
  return { lines: [text], size: 15 };
}

function drawBadge(ctx: SKRSContext2D, label: string, color: string, right: number, top: number): void {
  ctx.font = '13px StripBold';
  const w = ctx.measureText(label).width + 16;
  roundedRect(ctx, right - w, top, w, 22, 11);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, right - w + 8, top + 16);
}

function drawCard(ctx: SKRSContext2D, card: CardDraw, img: Image | null, x: number, y: number): void {
  const { color, label } = RARITY_CONFIG[card.rarity];
  const rarityColor = hex(color);

  roundedRect(ctx, x, y, CARD_W, CARD_H, RADIUS);
  ctx.fillStyle = rarityColor;
  ctx.fill();

  const ix = x + BORDER;
  const iy = y + BORDER;
  const iw = CARD_W - BORDER * 2;
  const ih = CARD_H - BORDER * 2;

  ctx.save();
  roundedRect(ctx, ix, iy, iw, ih, RADIUS - BORDER / 2);
  ctx.clip();
  ctx.fillStyle = '#1e1f22';
  ctx.fillRect(ix, iy, iw, ih);
  if (img) drawCover(ctx, img, ix, iy, iw, ih);

  const scrim = ctx.createLinearGradient(0, iy + ih * 0.45, 0, iy + ih);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = scrim;
  ctx.fillRect(ix, iy + ih * 0.45, iw, ih * 0.55);
  ctx.restore();

  const textX = ix + 10;
  const { lines, size } = fitName(ctx, card.mountain.mountainLabel, iw - 20);
  const rarityY = iy + ih - 12;
  let nameY = rarityY - 22 - (lines.length - 1) * (size + 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${size}px StripBlack`;
  for (const line of lines) {
    ctx.fillText(line, textX, nameY);
    nameY += size + 2;
  }

  ctx.font = '14px StripBold';
  ctx.fillStyle = card.rarity === 'common' ? '#d0d3d6' : rarityColor;
  ctx.fillText(label.toUpperCase(), textX, rarityY);

  if (card.isDuplicate) drawBadge(ctx, `DOUBLE +${card.fragmentsGained}`, 'rgba(30,31,34,0.85)', ix + iw - 8, iy + 8);
  else drawBadge(ctx, 'NOUVELLE', '#2ecc71', ix + iw - 8, iy + 8);
}

/** Les cartes du pack côte à côte, dans l'ordre de révélation. */
export async function renderPackStrip(cards: CardDraw[]): Promise<Buffer> {
  const images = await Promise.all(cards.map(c => loadImage(c.mountain.image).catch(() => null)));
  const canvas = createCanvas(PAD * 2 + cards.length * CARD_W + (cards.length - 1) * GAP, PAD * 2 + CARD_H);
  const ctx = canvas.getContext('2d');

  cards.forEach((card, i) => drawCard(ctx, card, images[i], PAD + i * (CARD_W + GAP), PAD));
  return canvas.toBuffer('image/webp', 90);
}
