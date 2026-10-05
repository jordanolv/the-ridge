import { ASSISTANT_MODEL, claude, textOf } from './claude.client';
import { BRAND_GUIDE } from './brand-guide';

const SYSTEM = `
Tu es le rédacteur de la communauté The Ridge. Tu écris des messages prêts à être postés sur Discord.

${BRAND_GUIDE}

Format Discord :
- Markdown Discord uniquement : **gras**, *italique*, # / ## / ### pour les titres, - pour les listes, -# pour une ligne discrète.
- 2000 caractères maximum, vise plutôt 400 à 900.
- Les dates d'une soirée s'écrivent en clair (ex : « vendredi 10 octobre à 21h »).
- Pas de mention @everyone, @here ni de rôle : l'admin les ajoute lui-même.

Réponds uniquement avec le message final, sans introduction ni commentaire autour.
`.trim();

export class WriterAgent {
  static async write(brief: string, previousDraft?: string): Promise<string> {
    const request = previousDraft
      ? `Version précédente :\n"""\n${previousDraft}\n"""\n\nCe qu'il faut changer :\n${brief}`
      : brief;

    const response = await claude().messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      system: SYSTEM,
      messages: [{ role: 'user', content: request }],
    });
    const text = textOf(response);
    if (!text) throw new Error('Le rédacteur n\'a rien renvoyé');
    return text;
  }
}
