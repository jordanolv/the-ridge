import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Renderer, type Node } from '@takumi-rs/core';

const WIDTH = 1280;
const HEIGHT = 720;
const FONT_FAMILY = 'Roboto';
const FONTS = [
  { weight: 700, file: 'Roboto-Bold.ttf' },
  { weight: 900, file: 'Roboto-Black.ttf' },
];

let renderer: Promise<Renderer> | null = null;

async function create(): Promise<Renderer> {
  const instance = new Renderer();
  for (const { weight, file } of FONTS) {
    await instance.registerFont({ name: FONT_FAMILY, weight, data: readFileSync(path.join(process.cwd(), 'assets/fonts', file)) });
  }
  return instance;
}

function posterRenderer(): Promise<Renderer> {
  if (!renderer) {
    renderer = create();
    renderer.catch(() => (renderer = null));
  }
  return renderer;
}

type Style = Record<string, string | number>;
const box = (style: Style, ...children: Node[]) => ({ type: 'container', style: { display: 'flex', ...style }, children }) as Node;
const text = (style: Style, content: string) => ({ type: 'text', text: content, style }) as Node;

export function titleSize(title: string): number {
  return Math.max(56, Math.min(112, Math.floor(1900 / Math.max(title.length, 1))));
}

/** Pose le titre en Roboto par-dessus le fond : les modèles d'image écrivent mal, surtout en français. */
export async function renderPoster(background: Buffer, title: string, subtitle?: string): Promise<Buffer> {
  const scene = box(
    { position: 'relative', width: WIDTH, height: HEIGHT, fontFamily: FONT_FAMILY, color: '#ffffff' },
    { type: 'image', src: 'background', style: { position: 'absolute', left: 0, top: 0, width: WIDTH, height: HEIGHT, objectFit: 'cover' } } as Node,
    box({
      position: 'absolute', left: 0, top: 0, width: WIDTH, height: HEIGHT,
      backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.85) 100%)',
    }),
    box(
      { position: 'absolute', left: 64, top: 48 },
      text({ fontSize: 24, fontWeight: 900, letterSpacing: 6, opacity: 0.9 }, 'THE RIDGE'),
    ),
    box(
      { position: 'absolute', left: 64, right: 64, bottom: 56, flexDirection: 'column', gap: 12 },
      ...(subtitle ? [text({ fontSize: 30, fontWeight: 700, letterSpacing: 2, opacity: 0.9 }, subtitle.toUpperCase())] : []),
      text({ fontSize: titleSize(title), fontWeight: 900, lineHeight: 1.05 }, title),
    ),
  );

  return (await posterRenderer()).render(scene, {
    width: WIDTH,
    height: HEIGHT,
    format: 'png',
    images: [{ src: 'background', data: background }],
  });
}
