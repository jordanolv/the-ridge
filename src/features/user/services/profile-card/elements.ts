export type Style = Record<string, string | number>;

export interface CardNode {
  type: string;
  props: { style: Style; children?: CardChild | CardChild[]; src?: string };
}

export type CardChild = CardNode | string;

/** Satori refuse un bloc à plusieurs enfants sans `display` explicite : flex par défaut. */
export function box(style: Style, ...children: (CardChild | null | false)[]): CardNode {
  const kept = children.filter((c): c is CardChild => c !== null && c !== false);
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: kept.length === 1 ? kept[0] : kept } };
}

export function text(style: Style, content: string): CardNode {
  return box(style, content);
}

export function image(src: string, style: Style): CardNode {
  return { type: 'img', props: { src, style } };
}

export function rgba(hex: string, alpha: number): string {
  const value = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export function dataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}
