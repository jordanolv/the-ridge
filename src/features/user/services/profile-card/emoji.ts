import { dataUrl } from './elements';

const TWEMOJI_URL = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg';
const ZERO_WIDTH_JOINER = 0x200d;
const VARIATION_SELECTOR = 0xfe0f;

const cache = new Map<string, Promise<string | undefined>>();

/** Nom de fichier Twemoji : les codepoints en hexa, sans le sélecteur de variante hors séquence ZWJ. */
export function twemojiCode(emoji: string): string {
  const codepoints = [...emoji].map(c => c.codePointAt(0)!);
  const kept = codepoints.includes(ZERO_WIDTH_JOINER) ? codepoints : codepoints.filter(c => c !== VARIATION_SELECTOR);
  return kept.map(c => c.toString(16)).join('-');
}

async function download(code: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${TWEMOJI_URL}/${code}.svg`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return undefined;
    return dataUrl(Buffer.from(await response.arrayBuffer()), 'image/svg+xml');
  } catch {
    return undefined;
  }
}

export function loadEmoji(emoji: string): Promise<string | undefined> {
  const code = twemojiCode(emoji);
  let image = cache.get(code);
  if (!image) {
    image = download(code);
    image.then(result => result === undefined && cache.delete(code));
    cache.set(code, image);
  }
  return image;
}
