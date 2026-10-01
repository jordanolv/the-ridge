export interface ThemeStyle {
  panelColor: string;
  panelOpacity: number;
  blur: number;
  accent: string;
}

export interface ThemeConfig {
  label?: string;
  style: Partial<ThemeStyle>;
  problems: string[];
}

const isHexColor = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const isNumberIn = (min: number, max: number) => (value: unknown) => typeof value === 'number' && value >= min && value <= max;

const RULES: Record<keyof ThemeStyle, { valid: (value: unknown) => boolean; expected: string }> = {
  panelColor: { valid: isHexColor, expected: 'une couleur #rrggbb' },
  panelOpacity: { valid: isNumberIn(0, 1), expected: 'un nombre entre 0 et 1' },
  blur: { valid: isNumberIn(0, 50), expected: 'un nombre entre 0 et 50' },
  accent: { valid: isHexColor, expected: 'une couleur #rrggbb' },
};

/** Une valeur invalide est ignorée et signalée : un thème mal réglé ne doit jamais casser /me. */
export function parseThemeConfig(raw: string): ThemeConfig {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return { style: {}, problems: [`JSON illisible (${(error as Error).message})`] };
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { style: {}, problems: ['le fichier doit contenir un objet'] };
  }

  const config: ThemeConfig = { style: {}, problems: [] };
  for (const [key, value] of Object.entries(json)) {
    if (key === 'label') {
      if (typeof value === 'string' && value.trim()) config.label = value.trim();
      else config.problems.push('« label » doit être un texte non vide');
      continue;
    }
    const rule = RULES[key as keyof ThemeStyle];
    if (!rule) config.problems.push(`clé inconnue « ${key} »`);
    else if (!rule.valid(value)) config.problems.push(`« ${key} » doit être ${rule.expected}`);
    else (config.style as Record<string, unknown>)[key] = value;
  }
  return config;
}
