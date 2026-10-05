import { AssistantConversationRepository } from '../repositories/assistant-conversation.repository';
import type { AssistantMessage, IAssistantConversation } from '../models/assistant-conversation.model';
import { ManagerService } from './manager.service';
import type { AssistantContext } from './assistant.types';

const TITLE_LENGTH = 60;

function titleFrom(text: string): string {
  const line = text.trim().split('\n')[0] || 'Nouvelle demande';
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line;
}

export class AssistantService {
  static async send(
    conversationId: string | null,
    text: string,
    imageUrls: string[],
    context: AssistantContext,
  ): Promise<IAssistantConversation> {
    const conversation = conversationId
      ? await AssistantConversationRepository.findById(conversationId)
      : await AssistantConversationRepository.create(titleFrom(text));
    if (!conversation) throw new Error('Conversation introuvable');

    const request: AssistantMessage = {
      role: 'user',
      text,
      attachments: imageUrls.map((url, i) => ({ kind: 'image', label: `Image jointe ${i + 1}`, url })),
      createdAt: new Date(),
    };
    const id = String(conversation._id);
    await AssistantConversationRepository.append(id, request);

    let reply: AssistantMessage;
    try {
      const { text: answer, attachments } = await ManagerService.reply([...conversation.messages, request], context);
      reply = { role: 'assistant', text: answer, attachments, createdAt: new Date() };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reply = { role: 'assistant', text: `Je n'ai pas pu traiter la demande : ${reason}`, attachments: [], createdAt: new Date() };
    }

    const updated = await AssistantConversationRepository.append(id, reply);
    if (!updated) throw new Error('Conversation introuvable');
    return updated;
  }
}
