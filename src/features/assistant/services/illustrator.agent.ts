import { uploadBuffer } from '../../../shared/cloudinary';
import { ASSISTANT_MODEL, claude, textOf } from './claude.client';
import { ImageGenerationService } from './image-generation.service';
import { renderPoster } from './poster.renderer';
import type { Attachment } from './assistant.types';

const CLOUDINARY_FOLDER = 'the-ridge/assistant';

const SYSTEM = `
Tu es l'illustrateur de la communauté Discord The Ridge (univers montagne, soirées gaming entre potes).
Tu reçois un brief en français et tu écris le prompt envoyé à un modèle de génération d'image.

Règles du prompt :
- En anglais, 60 à 120 mots, une seule scène décrite concrètement (sujet, décor, lumière, palette, cadrage).
- Format paysage 16:9, pensé comme une bannière : sujet lisible, zone basse plus calme pour accueillir un titre.
- Aucun texte, lettre, chiffre ni logo dans l'image.
- Style par défaut : illustration numérique soignée, couleurs vives, ambiance chaleureuse — sauf si le brief impose autre chose.
- Pour une retouche d'image existante, décris uniquement la modification à apporter en gardant le reste.

Réponds uniquement avec le prompt.
`.trim();

export interface IllustrationRequest {
  brief: string;
  title?: string;
  subtitle?: string;
  sourceImageUrl?: string;
}

export class IllustratorAgent {
  static async illustrate(request: IllustrationRequest): Promise<Attachment[]> {
    const source = request.sourceImageUrl ? await ImageGenerationService.download(request.sourceImageUrl) : undefined;
    const prompt = await this.writePrompt(request.brief, Boolean(source));
    const background = await ImageGenerationService.generate(prompt, source);

    const backgroundUrl = await uploadBuffer(background.data, background.mimeType, CLOUDINARY_FOLDER);
    const attachments: Attachment[] = [{ kind: 'image', label: 'Visuel sans texte', url: backgroundUrl }];

    if (request.title) {
      const poster = await renderPoster(background.data, request.title, request.subtitle);
      attachments.unshift({ kind: 'image', label: 'Visuel avec titre', url: await uploadBuffer(poster, 'image/png', CLOUDINARY_FOLDER) });
    }
    return attachments;
  }

  private static async writePrompt(brief: string, isEdit: boolean): Promise<string> {
    const response = await claude().messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: isEdit ? `Retouche d'une image existante.\n\n${brief}` : brief }],
    });
    const prompt = textOf(response);
    if (!prompt) throw new Error('L\'illustrateur n\'a pas écrit de prompt');
    return prompt;
  }
}
