import * as fs from 'fs';
import * as path from 'path';

export interface ProfileTheme {
  id: string;
  label: string;
  file: string;
}

const THEMES_DIR = path.join(process.cwd(), 'assets/cards');
const DEFAULT_FILE = path.join(process.cwd(), 'assets/bg-me.svg');

export const DEFAULT_THEME: ProfileTheme = {
  id: 'classique',
  label: 'Classique',
  file: DEFAULT_FILE,
};

function prettify(slug: string): string {
  const words = slug.replace(/[-_]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

let cache: ProfileTheme[] | null = null;

/**
 * Un thème est un fichier : tout `.svg` déposé dans `assets/cards/` en devient un.
 * Les positions sont relues dans le SVG (ids Figma `{{LEVELBOX}}`, `{{AVATAR}}`…),
 * donc une carte redessinée n'oblige à toucher aucun code.
 */
export function listThemes(): ProfileTheme[] {
  if (cache) return cache;

  const extra = fs.existsSync(THEMES_DIR)
    ? fs
        .readdirSync(THEMES_DIR)
        .filter(f => f.toLowerCase().endsWith('.svg'))
        .map(f => {
          const id = path.basename(f, path.extname(f));
          return { id, label: prettify(id), file: path.join(THEMES_DIR, f) };
        })
    : [];

  cache = [DEFAULT_THEME, ...extra.filter(t => t.id !== DEFAULT_THEME.id)];
  return cache;
}

/** Thèmes payants : tout sauf celui que tout le monde a déjà. */
export function listPaidThemes(): ProfileTheme[] {
  return listThemes().filter(t => t.id !== DEFAULT_THEME.id);
}

export function getTheme(id?: string | null): ProfileTheme {
  if (!id) return DEFAULT_THEME;
  return listThemes().find(t => t.id === id) ?? DEFAULT_THEME;
}
