import { Renderer } from '@takumi-rs/core';
import { fontFiles } from './fonts';

let renderer: Promise<Renderer> | null = null;

async function create(): Promise<Renderer> {
  const instance = new Renderer();
  for (const font of fontFiles()) await instance.registerFont(font);
  return instance;
}

export function cardRenderer(): Promise<Renderer> {
  if (!renderer) {
    renderer = create();
    renderer.catch(() => (renderer = null));
  }
  return renderer;
}
