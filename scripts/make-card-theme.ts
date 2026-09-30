import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D, type Image } from '@napi-rs/canvas';
import { ProfileCardService } from '../src/features/user/services/profileCard.service';

/**
 * Fabrique un thème de carte /me à partir d'une simple image de fond (générée par IA,
 * photo…) : les panneaux, libellés, icônes et le logo sont reposés par-dessus aux
 * positions du gabarit, donc aucun texte n'est à placer à la main.
 *
 *   node -r @swc-node/register scripts/make-card-theme.ts <image> <nom> [--tint #1e2837] [--opacity 0.55] [--blur 14]
 *
 * Écrit assets/cards/<nom>.svg et un aperçu PNG rendu par le vrai moteur de /me.
 */

const W = 1500;
const H = 900;
const TEMPLATE = path.join(process.cwd(), 'assets/bg-me.svg');
const KIT = path.join(process.cwd(), 'assets/card-kit');
const OUT_DIR = path.join(process.cwd(), 'assets/cards');

interface Panel { x: number; y: number; w: number; h: number }

const PANELS: Panel[] = [
  { x: 28, y: 28, w: 887, h: 331 },
  { x: 27, y: 381, w: 890, h: 496 },
  { x: 946, y: 26, w: 531, h: 335 },
  { x: 947, y: 381, w: 238, h: 104 },
  { x: 947, y: 512, w: 238, h: 104 },
  { x: 947, y: 643, w: 238, h: 104 },
  { x: 947, y: 773, w: 238, h: 104 },
  { x: 1217, y: 381, w: 260, h: 104 },
  { x: 1217, y: 512, w: 260, h: 104 },
  { x: 1216, y: 636, w: 261, h: 241 },
];

const LABELS = [
  { text: 'RidgeCoin', x: 1050, y: 424 },
  { text: 'Anniversaire', x: 1330, y: 424 },
  { text: 'Niveaux', x: 1050, y: 555 },
  { text: 'Ici depuis', x: 1330, y: 555 },
  { text: 'Messages', x: 1050, y: 686 },
  { text: 'Temps Voc', x: 1050, y: 816 },
];

const ICONS = [
  { file: 'ridgecoin.png', x: 984, y: 410 },
  { file: 'birthday.png', x: 1262, y: 412 },
  { file: 'level.png', x: 983, y: 541 },
  { file: 'joined.png', x: 1258, y: 540 },
  { file: 'messages.png', x: 985, y: 674 },
  { file: 'voice.png', x: 984, y: 804 },
  { file: 'logo.png', x: 1264, y: 672 },
];

const RADIUS = 12;

interface Style { tint: string; opacity: number; blur: number }

function drawCover(ctx: SKRSContext2D, img: Image): void {
  const ratio = Math.max(W / img.width, H / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function panelPath(ctx: SKRSContext2D, p: Panel): void {
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, p.h, RADIUS);
}

async function renderBackground(imagePath: string, style: Style): Promise<Buffer> {
  GlobalFonts.registerFromPath(path.join(process.cwd(), 'assets/fonts/Roboto-Regular.ttf'), 'CardLabel');

  const img = await loadImage(readFileSync(imagePath));
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  drawCover(ctx, img);

  for (const panel of PANELS) {
    ctx.save();
    panelPath(ctx, panel);
    ctx.clip();
    ctx.filter = `blur(${style.blur}px)`;
    drawCover(ctx, img);
    ctx.restore();

    ctx.save();
    panelPath(ctx, panel);
    ctx.globalAlpha = style.opacity;
    ctx.fillStyle = style.tint;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '21px CardLabel';
  for (const label of LABELS) ctx.fillText(label.text, label.x, label.y);

  for (const icon of ICONS) ctx.drawImage(await loadImage(path.join(KIT, icon.file)), icon.x, icon.y);

  return canvas.toBuffer('image/jpeg', 88);
}

function buildSvg(jpeg: Buffer): string {
  const template = readFileSync(TEMPLATE, 'utf-8');
  const background = new RegExp(`(<image[^>]*width="${W}" height="${H}"[^>]*href=")data:image/[a-z]+;base64,[^"]+"`);
  if (!background.test(template)) throw new Error(`Image de fond ${W}×${H} introuvable dans ${TEMPLATE}`);
  return template.replace(background, `$1data:image/jpeg;base64,${jpeg.toString('base64')}"`);
}

async function renderPreview(themeId: string): Promise<Buffer> {
  const days = Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86_400_000),
    time: [3100, 4200, 5000, 7400, 1000, 2800, 4100, 2600, 3600, 4700, 5200, 6100, 1900, 800][i],
  }));
  return ProfileCardService.generateCard({
    themeId,
    pseudo: 'Pseudo',
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
    weeklyActivity: days,
    mountains: [
      { name: 'Everest', unlocked: true },
      { name: 'K2', unlocked: false },
      { name: 'Mont Blanc', unlocked: true },
    ],
    xp: { current: 640, required: 1000, percent: 0.64 },
  });
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      tint: { type: 'string', default: '#1e2837' },
      opacity: { type: 'string', default: '0.55' },
      blur: { type: 'string', default: '14' },
    },
  });

  const [imagePath, name] = positionals;
  if (!imagePath || !name) throw new Error('Usage : make-card-theme.ts <image> <nom> [--tint #hex] [--opacity 0-1] [--blur px]');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`Nom « ${name} » invalide : minuscules, chiffres et tirets (il devient l'id du thème)`);

  const style: Style = { tint: values.tint!, opacity: Number(values.opacity), blur: Number(values.blur) };
  const svg = buildSvg(await renderBackground(imagePath, style));

  mkdirSync(OUT_DIR, { recursive: true });
  const svgPath = path.join(OUT_DIR, `${name}.svg`);
  writeFileSync(svgPath, svg);

  const previewPath = path.join(tmpdir(), `card-theme-${name}.png`);
  writeFileSync(previewPath, await renderPreview(name));

  console.log(`Thème : ${path.relative(process.cwd(), svgPath)} (${Math.round(svg.length / 1024)} Ko)`);
  console.log(`Aperçu : ${previewPath}`);
}

main().then(
  () => process.exit(0),
  err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
