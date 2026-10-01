export type Style = Record<string, string | number>;

export type CardNode =
  | { type: 'container'; style: Style; children: CardNode[] }
  | { type: 'text'; text: string; style: Style }
  | { type: 'image'; src: string | Buffer; style: Style };

export function box(style: Style, ...children: (CardNode | null | false)[]): CardNode {
  return {
    type: 'container',
    style: { display: 'flex', ...style },
    children: children.filter((c): c is CardNode => c !== null && c !== false),
  };
}

export function text(style: Style, content: string): CardNode {
  return { type: 'text', text: content, style };
}

export function image(src: string | Buffer, style: Style): CardNode {
  return { type: 'image', src, style };
}

export function rgba(hex: string, alpha: number): string {
  const value = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
