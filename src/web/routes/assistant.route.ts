import express, { Router, Request, Response } from 'express';
import { ChannelType } from 'discord.js';
import { requireAdmin } from '../auth';
import { BotClient } from '../../bot/client';
import { LogService } from '../../shared/logs/logs.service';
import { uploadBuffer } from '../../shared/cloudinary';
import { PartyService } from '../../features/party/services/party.service';
import { AssistantService } from '../../features/assistant/services/assistant.service';
import { AssistantConversationRepository } from '../../features/assistant/repositories/assistant-conversation.repository';
import type { AssistantContext } from '../../features/assistant/services/assistant.types';

const DISCORD_MESSAGE_LIMIT = 2000;
const UPLOAD_LIMIT = '12mb';
const json = express.json();
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/;

const isCloudinaryUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('https://res.cloudinary.com/');

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

const context: AssistantContext = {
  async upcomingParties() {
    const events = await PartyService.getActiveEvents();
    return events.map(e => ({
      id: String(e._id),
      name: e.eventInfo.name,
      game: e.eventInfo.game,
      description: e.eventInfo.description,
      dateTime: e.eventInfo.dateTime,
      maxSlots: e.eventInfo.maxSlots,
      participants: e.participants.length,
      status: e.status,
      image: e.eventInfo.image,
    }));
  },
};

export default function assistantRoute(client: BotClient): Router {
  const router = Router();

  router.get('/api/admin/assistant/conversations', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const conversations = await AssistantConversationRepository.list();
    res.json(conversations.map(c => ({ id: String(c._id), title: c.title, updatedAt: (c as { updatedAt?: Date }).updatedAt })));
  });

  router.get('/api/admin/assistant/conversations/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const conversation = await AssistantConversationRepository.findById(String(req.params.id));
    if (!conversation) { res.status(404).json({ error: 'Conversation introuvable' }); return; }
    res.json({ id: String(conversation._id), title: conversation.title, messages: conversation.messages });
  });

  router.delete('/api/admin/assistant/conversations/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    await AssistantConversationRepository.delete(String(req.params.id));
    res.json({ ok: true });
  });

  router.post('/api/admin/assistant/messages', requireAdmin, json, async (req: Request, res: Response): Promise<void> => {
    const text = String(req.body?.text ?? '').trim();
    const imageUrls = Array.isArray(req.body?.imageUrls) ? req.body.imageUrls.filter(isCloudinaryUrl) : [];
    if (!text) { res.status(400).json({ error: 'Message vide' }); return; }

    try {
      const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : null;
      const conversation = await AssistantService.send(conversationId, text, imageUrls, context);
      res.json({ id: String(conversation._id), title: conversation.title, messages: conversation.messages });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err, 'Demande impossible') });
    }
  });

  router.post(
    '/api/admin/assistant/upload',
    requireAdmin,
    express.json({ limit: UPLOAD_LIMIT }),
    async (req: Request, res: Response): Promise<void> => {
      const match = IMAGE_DATA_URL.exec(String(req.body?.dataUrl ?? ''));
      if (!match) { res.status(400).json({ error: 'Image invalide (png, jpeg, webp ou gif)' }); return; }
      try {
        const url = await uploadBuffer(Buffer.from(match[2], 'base64'), match[1], 'the-ridge/assistant/uploads');
        res.json({ url });
      } catch (err) {
        res.status(500).json({ error: errorMessage(err, 'Upload impossible') });
      }
    },
  );

  router.post('/api/admin/assistant/publish', requireAdmin, json, async (req: Request, res: Response): Promise<void> => {
    const channelId = String(req.body?.channelId ?? '');
    const content = String(req.body?.content ?? '').trim();
    const imageUrl = isCloudinaryUrl(req.body?.imageUrl) ? req.body.imageUrl : null;
    if (!content && !imageUrl) { res.status(400).json({ error: 'Rien à publier' }); return; }
    if (content.length > DISCORD_MESSAGE_LIMIT) {
      res.status(400).json({ error: `Message trop long (${content.length}/${DISCORD_MESSAGE_LIMIT} caractères)` }); return;
    }

    const channel = client.guilds.cache.get(process.env.GUILD_ID!)?.channels.cache.get(channelId);
    if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
      res.status(400).json({ error: 'Salon introuvable' }); return;
    }

    try {
      await channel.send({ content: content || undefined, files: imageUrl ? [imageUrl] : [] });
      await LogService.info(`Message publié dans <#${channel.id}> depuis l'assistant`, { feature: 'assistant', title: 'Publication' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err, 'Publication impossible') });
    }
  });

  return router;
}
