import Anthropic from '@anthropic-ai/sdk';

/**
 * Créé au premier appel, jamais à l'import : `dotenv.config()` tourne dans le corps
 * de `src/index.ts`, après l'évaluation du graphe d'imports statiques.
 */
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const PROMPT = (name: string, money: number, xp: number, packs: number) => `
Une phrase absurde et drôle pour un bot Discord. Le personnage s'appelle "${name}" et reçoit ${money} pièces, ${xp} XP et ${packs} expédition${packs > 1 ? 's' : ''}.
Montants faibles = journée catastrophique, élevés = coup de chance insolent. Situation ridicule et concrète. Pas d'emoji, pas de guillemets. Une seule phrase courte (max 35 mots), complète, jamais coupée.
`.trim();

export class DailyStoryService {
  static async generate(name: string, money: number, xp: number, packs: number): Promise<string | null> {
    try {
      const response = await getClient().messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        temperature: 1,
        messages: [{ role: 'user', content: PROMPT(name, money, xp, packs) }],
      });
      return (response.content[0] as { type: string; text: string }).text.trim();
    } catch {
      return null;
    }
  }
}
