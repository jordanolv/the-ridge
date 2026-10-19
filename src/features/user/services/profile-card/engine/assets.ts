import { readFileSync } from 'node:fs';
import path from 'node:path';

export type IconName = 'ridgecoin' | 'level' | 'messages' | 'voice' | 'birthday' | 'joined' | 'chart' | 'logo';

const ICONS: IconName[] = ['ridgecoin', 'level', 'messages', 'voice', 'birthday', 'joined', 'chart', 'logo'];

export interface ImageSource {
  src: string;
  data: Buffer;
  cache?: 'auto' | 'none';
}

export const iconSrc = (name: IconName) => `icon:${name}`;

let icons: ImageSource[] | null = null;

/**
 * Référencées par clé plutôt qu'embarquées dans l'arbre : le renderer garde leur version
 * décodée d'un rendu à l'autre.
 */
export function iconImages(): ImageSource[] {
  icons ??= ICONS.map(name => ({
    src: iconSrc(name),
    data: readFileSync(path.join(process.cwd(), 'assets/profile-card', `${name}.png`)),
  }));
  return icons;
}
