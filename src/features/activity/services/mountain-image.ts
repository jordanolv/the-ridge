export type MountainImageSize = 'full' | 'thumb';

export const isMountainImageSize = (value: unknown): value is MountainImageSize => value === 'full' || value === 'thumb';

export const mountainImagePath = (mountainId: string, size: MountainImageSize = 'full') =>
  `/api/activity/mountains/${encodeURIComponent(mountainId)}/image${size === 'thumb' ? '?size=thumb' : ''}`;

/** Cloudinary redimensionne à la volée : la miniature de la grille pèse ~3× moins que la photo. */
export function mountainImageSource(url: string, size: MountainImageSize): string {
  if (size === 'full') return url;
  return url.replace('/image/upload/', '/image/upload/c_fill,w_480,h_270,q_auto,f_jpg/');
}
