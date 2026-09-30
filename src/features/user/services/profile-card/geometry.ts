export const CARD_WIDTH = 1500;
export const CARD_HEIGHT = 900;
export const PANEL_RADIUS = 12;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STAT_ROWS = [381, 512, 643, 773];
const STAT_HEIGHT = 104;

export const PANELS = {
  overview: { x: 28, y: 28, width: 888, height: 332 },
  activity: { x: 28, y: 381, width: 888, height: 496 },
  profile: { x: 946, y: 28, width: 530, height: 332 },
  ridgecoin: { x: 946, y: STAT_ROWS[0], width: 240, height: STAT_HEIGHT },
  level: { x: 946, y: STAT_ROWS[1], width: 240, height: STAT_HEIGHT },
  messages: { x: 946, y: STAT_ROWS[2], width: 240, height: STAT_HEIGHT },
  voice: { x: 946, y: STAT_ROWS[3], width: 240, height: STAT_HEIGHT },
  birthday: { x: 1216, y: STAT_ROWS[0], width: 260, height: STAT_HEIGHT },
  joined: { x: 1216, y: STAT_ROWS[1], width: 260, height: STAT_HEIGHT },
  logo: { x: 1216, y: STAT_ROWS[2], width: 260, height: STAT_ROWS[3] + STAT_HEIGHT - STAT_ROWS[2] },
} satisfies Record<string, Rect>;

export type PanelName = keyof typeof PANELS;
