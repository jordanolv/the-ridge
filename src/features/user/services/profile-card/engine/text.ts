import { isEmoji } from './emoji';
import { measureText, type FontWeight } from './fonts';

const INVISIBLE_CHARS = /[\u3164\uFFA0\u115F\u1160\u200B\u200C\u200E\u200F\u2060\uFEFF\u00AD\u034F\u17B4\u17B5\u2028\u2029\u2800\u180E\u061C\u2066-\u2069]/g;
const CUSTOM_EMOTES = /<a?:[^:]+:\d+>/g;
const EMOJIS = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

/** Les pseudos Discord regorgent de caractères invisibles qui s'affichent en carrés vides. */
export function sanitizeText(value: string): string {
  return value.replace(INVISIBLE_CHARS, '').trim();
}

export function cleanRoleName(name: string): string {
  return sanitizeText(name).replace(CUSTOM_EMOTES, '').replace(EMOJIS, '').trim();
}

const EMOJI_WIDTH_EM = 1.15;
const ELLIPSIS = '…';

/** Coupe avant le rendu : l'ellipse CSS de Takumi s'arrête au premier emoji d'une ligne. */
export function truncateToWidth(content: string, maxWidth: number, size: number, weight: FontWeight): string {
  const graphemes = [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(content)].map(s => s.segment);
  const widthOf = (g: string) => (isEmoji(g) ? size * EMOJI_WIDTH_EM : measureText(g, size, weight));

  const total = graphemes.reduce((sum, g) => sum + widthOf(g), 0);
  if (total <= maxWidth) return content;

  const budget = maxWidth - measureText(ELLIPSIS, size, weight);
  let width = 0;
  let kept = '';
  for (const g of graphemes) {
    width += widthOf(g);
    if (width > budget) break;
    kept += g;
  }
  return kept.trimEnd() + ELLIPSIS;
}
