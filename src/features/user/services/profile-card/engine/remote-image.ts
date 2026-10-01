const MAX_ENTRIES = 500;
const TIMEOUT_MS = 4000;

const cache = new Map<string, Promise<Buffer | null>>();

async function download(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/**
 * Photos de montagnes, avatars, emojis : téléchargés une fois puis gardés en mémoire
 * (les plus anciens sortent au-delà de MAX_ENTRIES). Un échec n'est pas mémorisé.
 */
export function fetchImage(url: string): Promise<Buffer | null> {
  const cached = cache.get(url);
  if (cached) {
    cache.delete(url);
    cache.set(url, cached);
    return cached;
  }

  const image = download(url);
  image.then(result => result === null && cache.delete(url));
  cache.set(url, image);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return image;
}
