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

export function fitFontSize(content: string, maxWidth: number, max: number, min: number, weight: FontWeight): number {
  for (let size = max; size > min; size--) {
    if (measureText(content, size, weight) <= maxWidth) return size;
  }
  return min;
}

export function ellipsize(content: string, maxWidth: number, size: number, weight: FontWeight): string {
  if (measureText(content, size, weight) <= maxWidth) return content;
  let end = content.length;
  while (end > 1 && measureText(`${content.slice(0, end).trimEnd()}…`, size, weight) > maxWidth) end--;
  return `${content.slice(0, end).trimEnd()}…`;
}
