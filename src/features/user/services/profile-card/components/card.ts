import { backdropSrc, type Layout } from '../engine/backdrop';
import { box, image, type CardNode } from '../engine/elements';
import { FONT_FAMILY } from '../engine/fonts';
import { CARD_HEIGHT, CARD_WIDTH } from '../engine/geometry';
import type { ProfileTheme } from '../engine/themes';
import type { Child } from './panel';

/** La carte : fond du thème déjà flouté sous les cadres de l'onglet, puis ses panneaux. */
export function card(theme: ProfileTheme, layout: Layout, ...panels: Child[]): CardNode {
  return box(
    { position: 'relative', width: CARD_WIDTH, height: CARD_HEIGHT, fontFamily: FONT_FAMILY, color: 'white' },
    image(backdropSrc(theme, layout), { position: 'absolute', left: 0, top: 0, width: CARD_WIDTH, height: CARD_HEIGHT }),
    ...panels,
  );
}
