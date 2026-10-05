import Anthropic from '@anthropic-ai/sdk';

export const ASSISTANT_MODEL = 'claude-opus-5-5';

/**
 * Créé au premier appel, jamais à l'import : `dotenv.config()` tourne dans le corps
 * de `src/index.ts`, après l'évaluation du graphe d'imports statiques.
 */
let client: Anthropic | null = null;
export const claude = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n')
    .trim();
}
