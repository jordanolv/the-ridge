import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D, type Image } from '@napi-rs/canvas';
import ffmpeg from 'ffmpeg-static';
import { RARITY_CONFIG } from '../constants/peak-hunters.constants';
import { findAsset, uploadFile } from '../../../shared/cloudinary';
import type { MountainInfo } from './mountain.service';
import type { MountainRarity } from '../types/peak-hunters.types';

const run = promisify(execFile);

const W = 480;
const H = 270;
const FPS = 12;
const FRAMES = 24;
const HOLD_FRAMES = 10;
const BAND = Math.round(H * 0.09);

/** Durée réelle du média, pour savoir combien de temps le laisser à l'écran. */
export const REVEAL_ANIMATION_MS = Math.round(((FRAMES + HOLD_FRAMES) / FPS) * 1000);

const CLOUDINARY_FOLDER = 'the-ridge/mountains/reveal';

GlobalFonts.registerFromPath(path.join(process.cwd(), 'assets/fonts/Roboto-Black.ttf'), 'RevealBlack');
GlobalFonts.registerFromPath(path.join(process.cwd(), 'assets/fonts/Roboto-Regular.ttf'), 'RevealRegular');

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function drawCover(ctx: SKRSContext2D, img: Image, scale: number): void {
  const ratio = Math.max(W / img.width, H / img.height) * scale;
  const w = img.width * ratio;
  const h = img.height * ratio;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function drawShine(ctx: SKRSContext2D, progress: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(-W * 0.4 + progress * (W * 1.8), 0);
  ctx.rotate(-0.32);
  const gradient = ctx.createLinearGradient(-80, 0, 80, 0);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.34)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(-80, -H, 160, H * 3);
  ctx.restore();
}

function drawFrame(ctx: SKRSContext2D, img: Image, frame: number, mountain: MountainInfo, rarity: MountainRarity): void {
  const blurT = clamp01(1 - frame / 13);
  const blur = easeOut(blurT) * 26;
  const color = `#${RARITY_CONFIG[rarity].color.toString(16).padStart(6, '0')}`;

  ctx.clearRect(0, 0, W, H);
  ctx.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
  drawCover(ctx, img, 1 + 0.12 * easeOut(blurT));
  ctx.filter = 'none';

  const shineT = (frame - 9) / 11;
  if (shineT > 0 && shineT < 1) drawShine(ctx, shineT);

  const textT = clamp01((frame - 13) / 7);
  if (textT > 0) {
    const scrim = ctx.createLinearGradient(0, H * 0.55, 0, H);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(1, `rgba(0,0,0,${0.85 * textT})`);
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);

    ctx.globalAlpha = textT;
    ctx.fillStyle = '#ffffff';
    ctx.font = '27px RevealBlack';
    ctx.fillText(mountain.mountainLabel.toUpperCase(), 18, H - BAND - 36);
    ctx.fillStyle = rarity === 'common' ? '#ffffff' : color;
    ctx.font = '14px RevealRegular';
    const meters = Math.round(Number(mountain.elevation)).toLocaleString('fr-FR');
    ctx.fillText(`${RARITY_CONFIG[rarity].label}  ·  ${meters} m  ·  ${mountain.countries.join(' · ')}`.toUpperCase(), 18, H - BAND - 14);
    ctx.globalAlpha = 1;
  }

  const pulse = blurT > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(frame * 0.5)) : 1;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = color;
  ctx.fillRect(0, H - BAND, W, BAND);
  ctx.globalAlpha = 1;
}

async function render(mountain: MountainInfo, rarity: MountainRarity): Promise<string> {
  const img = await loadImage(mountain.image);
  const dir = await mkdtemp(path.join(tmpdir(), 'reveal-'));
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  try {
    for (let i = 0; i < FRAMES + HOLD_FRAMES; i++) {
      drawFrame(ctx, img, Math.min(i, FRAMES - 1), mountain, rarity);
      await writeFile(path.join(dir, `${String(i).padStart(3, '0')}.png`), canvas.toBuffer('image/png'));
    }

    const out = `${dir}.webp`;
    await run(ffmpeg as unknown as string, [
      '-y', '-framerate', String(FPS), '-i', path.join(dir, '%03d.png'),
      '-c:v', 'libwebp_anim', '-q:v', '72', '-loop', '1', out,
    ]);
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const inFlight = new Map<string, Promise<string | null>>();

/**
 * Un échec reste en cache un moment : sans ça le préchauffage et la révélation
 * regénèrent chacun l'animation dans la même ouverture, pour rien.
 */
const FAILURE_RETRY_MS = 10 * 60 * 1000;

async function buildAndUpload(mountain: MountainInfo, rarity: MountainRarity): Promise<string | null> {
  const existing = await findAsset(`${CLOUDINARY_FOLDER}/${mountain.id}`);
  if (existing) return existing;

  const file = await render(mountain, rarity);
  try {
    return await uploadFile(file, CLOUDINARY_FOLDER, mountain.id);
  } finally {
    await rm(file, { force: true });
  }
}

/**
 * URL de l'animation de révélation, générée une fois par montagne puis servie par
 * Cloudinary. Retourne null si la génération échoue — l'appelant doit pouvoir s'en
 * passer, une animation ratée ne doit jamais coûter la carte au joueur.
 */
export function ensureRevealAnimation(mountain: MountainInfo, rarity: MountainRarity): Promise<string | null> {
  const cached = inFlight.get(mountain.id);
  if (cached) return cached;

  const task = buildAndUpload(mountain, rarity).catch(err => {
    console.error(`[Peak Hunters] animation de révélation indisponible pour ${mountain.id}:`, err);
    setTimeout(() => inFlight.delete(mountain.id), FAILURE_RETRY_MS).unref();
    return null;
  });

  inFlight.set(mountain.id, task);
  return task;
}
