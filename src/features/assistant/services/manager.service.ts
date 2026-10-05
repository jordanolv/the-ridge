import type Anthropic from '@anthropic-ai/sdk';
import type { AssistantMessage } from '../models/assistant-conversation.model';
import { ASSISTANT_MODEL, claude, textOf } from './claude.client';
import { WriterAgent } from './writer.agent';
import { IllustratorAgent } from './illustrator.agent';
import type { AssistantContext, Attachment, PartyBrief } from './assistant.types';

const MAX_STEPS = 8;
const TIMEZONE = 'Europe/Paris';

const SYSTEM = `
Tu es le manager de l'équipe contenu de The Ridge, une communauté Discord de joueurs.
Tu parles avec l'admin du serveur, en français, et tu fais produire ce qu'il demande par ton équipe :
- le rédacteur (outil ask_writer) écrit les messages Discord : annonces de soirée, rappels, messages custom ;
- l'illustrateur (outil ask_illustrator) crée ou retouche les visuels.

Ta façon de travailler :
- Quand une demande concerne une soirée, consulte d'abord list_upcoming_parties pour avoir le nom, le jeu et la date exacts.
- Donne à chaque membre de l'équipe un brief complet : il ne voit pas la conversation, seulement ton brief.
- Pour modifier un message déjà proposé, passe sa version actuelle dans previous_draft.
- Pour retoucher une image, passe l'URL de la version « Visuel sans texte » dans source_image_url.
- Ne pose une question que si une information indispensable manque et ne se devine pas ; sinon, fais un choix raisonnable et dis-le.
- Tes productions s'affichent sous ta réponse, avec des boutons pour les publier : ne recopie jamais le message ni les URL.
  Réponds en une à trois phrases : ce qui a été fait, les choix pris, ce que l'admin peut demander ensuite.
- Tu ne publies rien toi-même sur Discord : c'est l'admin qui valide et publie.
`.trim();

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_upcoming_parties',
    description: 'Liste les soirées prévues ou en cours sur le serveur, avec leur nom, jeu, date, places et visuel actuel.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'ask_writer',
    description: 'Demande au rédacteur un message Discord prêt à poster. Renvoie le texte du message.',
    input_schema: {
      type: 'object',
      properties: {
        brief: { type: 'string', description: 'Objectif du message, faits à inclure (nom, jeu, date en clair, places), ton et longueur voulus.' },
        previous_draft: { type: 'string', description: 'Version actuelle du message quand il s\'agit de le modifier.' },
      },
      required: ['brief'],
      additionalProperties: false,
    },
  },
  {
    name: 'ask_illustrator',
    description: 'Demande à l\'illustrateur un visuel 16:9. Avec un titre, il produit aussi une version où le titre est posé proprement par-dessus.',
    input_schema: {
      type: 'object',
      properties: {
        brief: { type: 'string', description: 'Scène voulue : jeu, ambiance, éléments visuels, style. Pour une retouche, la modification à faire.' },
        title: { type: 'string', description: 'Titre à poser sur le visuel, sans emoji (ex : le nom de la soirée).' },
        subtitle: { type: 'string', description: 'Ligne au-dessus du titre, sans emoji (ex : « Vendredi 10 octobre · 21h »).' },
        source_image_url: { type: 'string', description: 'URL de l\'image à retoucher.' },
      },
      required: ['brief'],
      additionalProperties: false,
    },
  },
];

type ToolInput = Record<string, string | undefined>;

function formatDate(date: Date): string {
  return date.toLocaleString('fr-FR', { timeZone: TIMEZONE, dateStyle: 'full', timeStyle: 'short' });
}

function describeParty(party: PartyBrief): string {
  return [
    `- ${party.name} (${party.status === 'started' ? 'en cours' : 'prévue'})`,
    `  jeu : ${party.game} · ${formatDate(party.dateTime)} · ${party.participants}/${party.maxSlots} inscrits`,
    party.description ? `  description : ${party.description}` : null,
    party.image ? `  visuel actuel : ${party.image}` : null,
  ].filter(Boolean).join('\n');
}

function describeAttachment(attachment: Attachment): string {
  return attachment.kind === 'message'
    ? `[${attachment.label}]\n${attachment.content}`
    : `[${attachment.label} : ${attachment.url}]`;
}

/** La conversation stockée, réécrite en texte : le manager y retrouve les messages et images déjà produits. */
export function toClaudeHistory(messages: AssistantMessage[]): Anthropic.MessageParam[] {
  return messages.map(message => ({
    role: message.role,
    content: [message.text, ...message.attachments.map(a => describeAttachment(a as Attachment))].filter(Boolean).join('\n\n') || '…',
  }));
}

export interface ManagerReply {
  text: string;
  attachments: Attachment[];
}

export class ManagerService {
  static async reply(history: AssistantMessage[], context: AssistantContext): Promise<ManagerReply> {
    const messages = toClaudeHistory(history);
    const attachments: Attachment[] = [];
    let draftCount = history.flatMap(m => m.attachments).filter(a => a.kind === 'message').length;

    const runTool = async (name: string, input: ToolInput): Promise<string> => {
      if (name === 'list_upcoming_parties') {
        const parties = await context.upcomingParties();
        return parties.length ? parties.map(describeParty).join('\n') : 'Aucune soirée prévue.';
      }
      if (name === 'ask_writer') {
        const content = await WriterAgent.write(input.brief ?? '', input.previous_draft);
        const draft: Attachment = { kind: 'message', label: `Message #${++draftCount}`, content };
        attachments.push(draft);
        return describeAttachment(draft);
      }
      if (name === 'ask_illustrator') {
        const images = await IllustratorAgent.illustrate({
          brief: input.brief ?? '',
          title: input.title,
          subtitle: input.subtitle,
          sourceImageUrl: input.source_image_url,
        });
        attachments.push(...images);
        return images.map(describeAttachment).join('\n');
      }
      throw new Error(`Outil inconnu : ${name}`);
    };

    const system = `${SYSTEM}\n\nNous sommes le ${formatDate(new Date())} (heure de Paris).`;

    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await claude().messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: 16000,
        output_config: { effort: 'low' },
        system,
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === 'refusal') return { text: 'Je ne peux pas traiter cette demande.', attachments };
      if (response.stop_reason !== 'tool_use') return { text: textOf(response), attachments };

      messages.push({ role: 'assistant', content: response.content });
      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      const results = await Promise.all(toolUses.map(async (use): Promise<Anthropic.ToolResultBlockParam> => {
        try {
          return { type: 'tool_result', tool_use_id: use.id, content: await runTool(use.name, use.input as ToolInput) };
        } catch (err) {
          return { type: 'tool_result', tool_use_id: use.id, is_error: true, content: err instanceof Error ? err.message : String(err) };
        }
      }));
      messages.push({ role: 'user', content: results });
    }

    return { text: 'J\'ai atteint ma limite d\'étapes pour cette demande. Dis-moi si je continue.', attachments };
  }
}
