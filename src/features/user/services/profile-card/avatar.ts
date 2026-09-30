const PLACEHOLDER = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="#36393f"/>
    <circle cx="128" cy="100" r="50" fill="#5865F2"/>
    <ellipse cx="128" cy="220" rx="70" ry="50" fill="#5865F2"/>
  </svg>`,
);

export async function fetchAvatar(url: string): Promise<Buffer> {
  if (!url?.startsWith('http')) return PLACEHOLDER;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return PLACEHOLDER;
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.warn('[ProfileCard] avatar indisponible, placeholder utilisé :', error);
    return PLACEHOLDER;
  }
}
