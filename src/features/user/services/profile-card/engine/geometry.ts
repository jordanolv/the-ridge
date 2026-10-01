export const CARD_WIDTH = 1500;
export const CARD_HEIGHT = 900;
export const PANEL_RADIUS = 12;
export const MARGIN = 28;
export const GUTTER = 22;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
