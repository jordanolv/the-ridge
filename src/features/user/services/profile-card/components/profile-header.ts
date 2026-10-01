import { box, image, text, type CardNode } from '../engine/elements';
import { sanitizeText, truncateToWidth } from '../engine/text';
import { SHRINK_TO_FIT } from './panel';

export function profileHeader(avatar: Buffer, pseudo: string, bio: string, width: number): CardNode {
  return box(
    { flexDirection: 'column', alignItems: 'center', width },
    image(avatar, { width: 204, height: 200, borderRadius: '50%', objectFit: 'cover' }),
    text(
      { width, marginTop: 14, height: 48, fontSize: 40, fontWeight: 700, color: 'white', textAlign: 'center', ...SHRINK_TO_FIT },
      sanitizeText(pseudo),
    ),
    text({ width, fontSize: 20, fontWeight: 700, color: 'white', textAlign: 'center', whiteSpace: 'nowrap' }, truncateToWidth(sanitizeText(bio), width, 20, 700)),
  );
}
