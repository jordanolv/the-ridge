import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';

export const FONT_FAMILY = 'Roboto';

export type FontWeight = 400 | 700 | 900;

const FONTS: { weight: FontWeight; file: string }[] = [
  { weight: 400, file: 'Roboto-Regular.ttf' },
  { weight: 700, file: 'Roboto-Bold.ttf' },
  { weight: 900, file: 'Roboto-Black.ttf' },
];

const fontPath = (file: string) => path.join(process.cwd(), 'assets/fonts', file);

export function fontFiles(): { name: string; weight: FontWeight; data: Buffer }[] {
  return FONTS.map(({ weight, file }) => ({ name: FONT_FAMILY, weight, data: readFileSync(fontPath(file)) }));
}

let measureContext: SKRSContext2D | null = null;

/** Mêmes fichiers que le rendu, pour que la mesure lui corresponde. */
export function measureText(content: string, size: number, weight: FontWeight = 400): number {
  if (!measureContext) {
    for (const { file } of FONTS) GlobalFonts.registerFromPath(fontPath(file), FONT_FAMILY);
    measureContext = createCanvas(1, 1).getContext('2d');
  }
  measureContext.font = `${weight} ${size}px ${FONT_FAMILY}`;
  return measureContext.measureText(content).width;
}
