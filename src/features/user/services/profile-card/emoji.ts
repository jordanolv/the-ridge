import { image, text, type CardNode } from './elements';

const TWEMOJI_URL = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg';
const ZERO_WIDTH_JOINER = 0x200d;
const EMOJI_PRESENTATION = 0xfe0f;
const TEXT_PRESENTATION = 0xfe0e;

const PICTOGRAPHIC = /^\p{Extended_Pictographic}/u;
const PRESENTATION_BY_DEFAULT = /^\p{Emoji_Presentation}/u;
const MODIFIED = /^\p{Emoji_Modifier_Base}\p{Emoji_Modifier}/u;
const FLAG = /^\p{Regional_Indicator}{1,2}$/u;
const KEYCAP = /^[#*0-9].?\u20E3$/u;

const segmenter = new Intl.Segmenter('fr', { granularity: 'grapheme' });
const cache = new Map<string, Promise<Buffer | undefined>>();

/** Nom de fichier Twemoji : les codepoints en hexa, sans le sélecteur de variante hors séquence ZWJ. */
export function twemojiCode(emoji: string): string {
  const codepoints = [...emoji].map(c => c.codePointAt(0)!);
  const kept = codepoints.includes(ZERO_WIDTH_JOINER) ? codepoints : codepoints.filter(c => c !== EMOJI_PRESENTATION);
  return kept.map(c => c.toString(16)).join('-');
}

export function isEmoji(grapheme: string): boolean {
  const codepoints = [...grapheme].map(c => c.codePointAt(0)!);
  if (codepoints.includes(TEXT_PRESENTATION)) return false;
  if (FLAG.test(grapheme) || KEYCAP.test(grapheme)) return true;
  return (
    PICTOGRAPHIC.test(grapheme) &&
    (codepoints.includes(EMOJI_PRESENTATION) ||
      codepoints.includes(ZERO_WIDTH_JOINER) ||
      PRESENTATION_BY_DEFAULT.test(grapheme) ||
      MODIFIED.test(grapheme))
  );
}

async function download(code: string): Promise<Buffer | undefined> {
  try {
    const response = await fetch(`${TWEMOJI_URL}/${code}.svg`, { signal: AbortSignal.timeout(3000) });
    return response.ok ? Buffer.from(await response.arrayBuffer()) : undefined;
  } catch {
    return undefined;
  }
}

function loadEmoji(emoji: string): Promise<Buffer | undefined> {
  const code = twemojiCode(emoji);
  let svg = cache.get(code);
  if (!svg) {
    svg = download(code);
    svg.then(result => result === undefined && cache.delete(code));
    cache.set(code, svg);
  }
  return svg;
}

const EMOJI_STYLE = { width: '1em', height: '1em', margin: '0 0.05em 0 0.1em', verticalAlign: '-0.1em' };

/** Un emoji que le CDN ne sert pas est omis plutôt que de bloquer ou casser la carte. */
async function expandText(node: Extract<CardNode, { type: 'text' }>): Promise<CardNode> {
  const graphemes = [...segmenter.segment(node.text)].map(s => s.segment);
  if (!graphemes.some(isEmoji)) return node;

  const children: CardNode[] = [];
  let run = '';
  for (const grapheme of graphemes) {
    if (!isEmoji(grapheme)) {
      run += grapheme;
      continue;
    }
    if (run) children.push(text({}, run));
    run = '';
    const svg = await loadEmoji(grapheme);
    if (svg) children.push(image(svg, EMOJI_STYLE));
  }
  if (run) children.push(text({}, run));

  return { type: 'container', style: { ...node.style, display: 'block' }, children };
}

export async function withEmojis(node: CardNode): Promise<CardNode> {
  if (node.type === 'text') return expandText(node);
  if (node.type === 'container') return { ...node, children: await Promise.all(node.children.map(withEmojis)) };
  return node;
}
