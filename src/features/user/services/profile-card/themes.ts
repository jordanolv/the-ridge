import * as fs from 'fs';
import * as path from 'path';
import { parseThemeConfig, type ThemeStyle } from './theme-config';

export type { ThemeStyle };

export interface ProfileTheme {
  id: string;
  label: string;
  background: string;
  style: ThemeStyle;
}

const THEMES_DIR = path.join(process.cwd(), 'assets/cards');
const BACKGROUND_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
const DEFAULT_THEME_ID = 'classique';

export const DEFAULT_STYLE: ThemeStyle = {
  panelColor: '#1e2837',
  panelOpacity: 0.55,
  blur: 14,
  accent: '#6EA9C3',
};

function prettify(slug: string): string {
  const words = slug.replace(/[-_]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function loadTheme(file: string): ProfileTheme {
  const id = path.basename(file, path.extname(file));
  const configFile = path.join(THEMES_DIR, `${id}.json`);
  const { label, style, problems } = fs.existsSync(configFile)
    ? parseThemeConfig(fs.readFileSync(configFile, 'utf-8'))
    : { label: undefined, style: {}, problems: [] };

  for (const problem of problems) console.warn(`[ProfileCard] assets/cards/${id}.json : ${problem} — valeur ignorée`);

  return { id, label: label ?? prettify(id), background: path.join(THEMES_DIR, file), style: { ...DEFAULT_STYLE, ...style } };
}

let cache: ProfileTheme[] | null = null;

/**
 * Un thème est une image de fond : tout fichier déposé dans `assets/cards/` en devient
 * un au redémarrage, avec un `<id>.json` facultatif pour le libellé et les couleurs.
 */
export function listThemes(): ProfileTheme[] {
  if (cache) return cache;

  const themes = fs.existsSync(THEMES_DIR)
    ? fs
        .readdirSync(THEMES_DIR)
        .filter(f => BACKGROUND_EXTENSIONS.has(path.extname(f).toLowerCase()))
        .map(loadTheme)
    : [];

  const fallback = themes.find(t => t.id === DEFAULT_THEME_ID);
  if (!fallback) throw new Error(`Thème par défaut introuvable : assets/cards/${DEFAULT_THEME_ID}.*`);

  cache = [fallback, ...themes.filter(t => t !== fallback)];
  return cache;
}

export function defaultTheme(): ProfileTheme {
  return listThemes()[0];
}

/** Thèmes payants : tout sauf celui que tout le monde a déjà. */
export function listPaidThemes(): ProfileTheme[] {
  return listThemes().slice(1);
}

export function getTheme(id?: string | null): ProfileTheme {
  if (!id) return defaultTheme();
  return listThemes().find(t => t.id === id) ?? defaultTheme();
}
