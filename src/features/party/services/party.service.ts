import { BotClient } from '../../../bot/client';
import { PartyRepository } from './party.repository';
import { DiscordPartyService } from './discord.party.service';
import { ChatGamingService } from '../../chat-gaming/services/chat-gaming.service';
import { UserService } from '../../user/services/user.service';
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import { LogService } from '../../../shared/logs/logs.service';
import { NotFoundError } from './party.types';
import { PartyEvent } from '../models/party-event.model';
import UserModel from '../../user/models/user.model';
import AppConfigModel from '../../discord/models/app-config.model';
import { getGuildId } from '../../../shared/guild';
import { LevelingService } from '../../leveling/services/leveling.service';
import { awardExpeditions } from '../../peak-hunters/services/expedition.service';

export interface CreateEventInput {
  name: string;
  game: string;
  description?: string;
  dateTime: Date;
  maxSlots: number;
  color?: string;
  image?: string;
  channelId: string;
  createdBy: string;
  chatGamingGameId?: string;
}

export interface EndEventInput {
  attendedParticipants: string[];
  rewardAmount?: number;
  xpAmount?: number;
  expeditionAmount?: number;
}

export class PartyService {
  private static repo = new PartyRepository();

  static async getPartyConfig() {
    const guild = await AppConfigModel.findOne({});
    return guild?.features?.party || null;
  }

  // ─── Discord event handlers ────────────────────────────────────────────────

  static async handleReactionAdd(client: BotClient, messageId: string, userId: string): Promise<void> {
    const event = await this.repo.findByMessageId(messageId);
    if (!event || event.status === 'ended' ||
        event.participants.length >= event.eventInfo.maxSlots ||
        event.participants.includes(userId)) return;

    try {
      await DiscordPartyService.addUserToThread(client, event, userId);
      const updated = await this.repo.addParticipant(event._id.toString(), userId);
      const embed = DiscordPartyService.createEventContainer(updated, updated.discord.roleId);
      await DiscordPartyService.updateEventMessage(client, updated, embed);

      const logMessage = `**${event.eventInfo.name}** — ${event.eventInfo.game}\n` +
        `<@${userId}> a rejoint · ${updated.participants.length}/${event.eventInfo.maxSlots} places`;
      await LogService.info(logMessage, { feature: 'party', title: 'Participant ajouté' });
    } catch (err) {
      console.error('[Party] Erreur réaction add:', err);
    }
  }

  static async handleReactionRemove(client: BotClient, messageId: string, userId: string): Promise<void> {
    const event = await this.repo.findByMessageId(messageId);
    if (!event || event.status === 'ended' || !event.participants.includes(userId)) return;

    try {
      await DiscordPartyService.removeUserFromThread(client, event, userId);
      const updated = await this.repo.removeParticipant(event._id.toString(), userId);
      const embed = DiscordPartyService.createEventContainer(updated, updated.discord.roleId);
      await DiscordPartyService.updateEventMessage(client, updated, embed);

      const logMessage = `**${event.eventInfo.name}** — ${event.eventInfo.game}\n` +
        `<@${userId}> a quitté · ${updated.participants.length}/${event.eventInfo.maxSlots} places`;
      await LogService.info(logMessage, { feature: 'party', title: 'Participant retiré' });
    } catch (err) {
      console.error('[Party] Erreur réaction remove:', err);
    }
  }

  static async isPartyChannel(channelId: string): Promise<{ isParty: boolean; event?: PartyEvent }> {
    const event = await this.repo.findByChannel(channelId);
    return { isParty: !!event, event: event || undefined };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  static async createEvent(client: BotClient, data: CreateEventInput): Promise<PartyEvent> {
    const eventData = {
      eventInfo: {
        name: data.name,
        game: data.game,
        description: data.description,
        dateTime: data.dateTime,
        maxSlots: data.maxSlots,
        color: data.color || '#FF6B6B',
        image: data.image,
      },
      discord: { channelId: data.channelId },
      participants: [],
      createdBy: data.createdBy,
      chatGamingGameId: data.chatGamingGameId,
      status: 'pending' as const,
    };

    const event = await this.repo.create(eventData);

    let roleId: string | undefined;
    if (event.chatGamingGameId) {
      const chatGame = await ChatGamingService.getGameById(event.chatGamingGameId);
      roleId = chatGame?.roleId;
    } else {
      const partyConfig = await this.getPartyConfig();
      roleId = partyConfig?.defaultRoleId;
    }

    const { channel } = await DiscordPartyService.getGuildAndChannel(client, event.discord.channelId);
    const embed = DiscordPartyService.createEventContainer(event, roleId);
    const { messageId, threadId } = await DiscordPartyService.publishEventMessage(channel as any, event, embed);
    const updated = await this.repo.updateDiscordInfo(event._id.toString(), messageId, threadId, roleId);

    const logMessage = `**${updated.eventInfo.name}** — ${updated.eventInfo.game}\n` +
      `👤 <@${data.createdBy}> · 📅 <t:${Math.floor(data.dateTime.getTime() / 1000)}:F> · 👥 ${data.maxSlots} places`;
    await LogService.success(logMessage, { feature: 'party', title: 'Soirée créée' });

    return updated;
  }

  static async updateEventImage(client: BotClient, eventId: string, imageUrl: string): Promise<PartyEvent> {
    const event = await this.repo.findById(eventId);
    if (!event) throw new NotFoundError('Événement non trouvé');

    const updated = await this.repo.update(eventId, { 'eventInfo.image': imageUrl } as any);
    const embed = DiscordPartyService.createEventContainer(updated, updated.discord.roleId);
    await DiscordPartyService.updateEventMessage(client, updated, embed);

    return updated;
  }

  static async startEvent(client: BotClient, eventId: string): Promise<PartyEvent> {
    const event = await this.repo.findById(eventId);
    if (!event) throw new NotFoundError('Événement non trouvé');

    if (event.eventInfo.image) {
      try {
        const appConfig = await AppConfigModel.findOne({});
        if (appConfig) {
          appConfig.config.originalBannerUrl = await DiscordPartyService.getGuildBannerUrl(client) ?? undefined;
          await appConfig.save();
        }
        await DiscordPartyService.setGuildBanner(client, event.eventInfo.image);
      } catch (err) {
        console.error('[Party] Erreur changement banner:', err);
      }
    }

    const updated = await this.repo.update(eventId, {
      status: 'started',
      startedAt: new Date(),
    });

    const logMessage = `**${event.eventInfo.name}** — ${event.eventInfo.game}\n` +
      `🟢 Soirée démarrée · ${event.participants.length} inscrits`;
    await LogService.success(logMessage, { feature: 'party', title: 'Soirée démarrée' });

    return updated;
  }

  static async getActiveEvents(): Promise<PartyEvent[]> {
    return this.repo.findActiveEvents();
  }

  static async getEventById(eventId: string): Promise<PartyEvent | null> {
    return this.repo.findById(eventId);
  }

  static async deleteEvent(client: BotClient, eventId: string): Promise<void> {
    const event = await this.repo.findById(eventId);
    if (!event) throw new NotFoundError('Événement non trouvé');
    await Promise.all([
      DiscordPartyService.deleteThread(client, event),
      AppConfigModel.findOne({}).then(async appConfig => {
        if (appConfig?.config.originalBannerUrl !== undefined) {
          await DiscordPartyService.restoreGuildBanner(client, appConfig.config.originalBannerUrl ?? null);
          appConfig.config.originalBannerUrl = undefined;
          await appConfig.save();
        }
      }).catch(err => console.error('[Party] Erreur restauration banner:', err)),
    ]);
    await this.repo.delete(eventId);

    const logMessage = `**${event.eventInfo.name}** — ${event.eventInfo.game}\n` +
      `👥 ${event.participants.length} participant(s) inscrit(s)`;
    await LogService.error(logMessage, { feature: 'party', title: 'Soirée supprimée' });
  }

  static async endEvent(client: BotClient, eventId: string, data: EndEventInput): Promise<PartyEvent> {
    const event = await this.repo.findById(eventId);
    if (!event) throw new NotFoundError('Événement non trouvé');

    const updated = await this.repo.update(eventId, {
      status: 'ended',
      endedAt: new Date(),
      attendedParticipants: data.attendedParticipants,
      rewardAmount: data.rewardAmount ?? 0,
      xpAmount: data.xpAmount ?? 0,
      expeditionAmount: data.expeditionAmount ?? 0,
    });

    if (data.attendedParticipants.length > 0) {
      await this.distributeRewards(client, updated, data.attendedParticipants, data.rewardAmount ?? 0, data.xpAmount ?? 0, data.expeditionAmount ?? 0);
    }

    try {
      const appConfig = await AppConfigModel.findOne({});
      if (appConfig?.config.originalBannerUrl !== undefined) {
        await DiscordPartyService.restoreGuildBanner(client, appConfig.config.originalBannerUrl ?? null);
        appConfig.config.originalBannerUrl = undefined;
        await appConfig.save();
      }
    } catch (err) {
      console.error('[Party] Erreur restauration banner:', err);
    }

    await DiscordPartyService.removeAllReactions(client, updated);
    await DiscordPartyService.archiveThread(client, updated);

    const attendedList = data.attendedParticipants.length > 0
      ? data.attendedParticipants.map(id => `<@${id}>`).join(', ')
      : '*aucun*';
    const rewardLine = [
      data.rewardAmount ? `💰 ${data.rewardAmount}/pers` : null,
      data.xpAmount ? `⭐ ${data.xpAmount} XP/pers` : null,
      data.expeditionAmount ? `🏔️ ${data.expeditionAmount} expédition(s)/pers` : null,
    ].filter(Boolean).join(' · ') || 'Aucune récompense';
    const logMessage = `**${event.eventInfo.name}** — ${event.eventInfo.game}\n` +
      `👥 Présents : ${attendedList}\n${rewardLine}`;
    await LogService.info(logMessage, { feature: 'party', title: 'Soirée terminée' });

    return updated;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private static async distributeRewards(
    client: BotClient,
    event: PartyEvent,
    attendedParticipants: string[],
    rewardAmount: number,
    xpAmount: number,
    expeditionAmount: number,
  ): Promise<void> {
    await Promise.all(attendedParticipants.map(async participantId => {
      try {
        let user = await UserModel.findOne({ discordId: participantId });
        if (!user) {
          const guild = await client.guilds.fetch(getGuildId());
          const discordUser = await client.users.fetch(participantId);
          user = await UserService.createUser(discordUser, guild);
        }

        await UserModel.findOneAndUpdate(
          { discordId: participantId },
          {
            ...(rewardAmount > 0 && { $inc: { 'profil.money': rewardAmount } }),
            $inc: { 'stats.partyParticipated': 1 },
          },
        );

        if (rewardAmount > 0) {
          await LogService.economy(participantId, rewardAmount, `Soirée : ${event.eventInfo.name}`, 'party');
        }

        if (xpAmount > 0) {
          await LevelingService.giveXpDirectly(client, participantId, xpAmount);
        }

        if (expeditionAmount > 0) {
          await awardExpeditions(participantId, expeditionAmount);
        }
      } catch (err) {
        console.error(`[Party] Erreur distribution ${participantId}:`, err);
      }
    }));

    await this.sendRewardsEmbed(client, event, attendedParticipants, rewardAmount, xpAmount, expeditionAmount);
  }

  private static async sendRewardsEmbed(
    client: BotClient,
    event: PartyEvent,
    attendedParticipants: string[],
    moneyPerParticipant: number,
    xpPerParticipant: number,
    expeditionsPerParticipant: number,
  ): Promise<void> {
    try {
      if (!event.discord.threadId) return;
      const thread = await client.channels.fetch(event.discord.threadId);
      if (!thread?.isThread()) return;

      const color = event.eventInfo.color
        ? parseInt(event.eventInfo.color.replace('#', ''), 16)
        : 0xFF6B6B;

      const participantList = attendedParticipants.length > 0
        ? attendedParticipants.map(id => `<@${id}>`).join(', ')
        : '*Aucun*';

      const rewardParts: string[] = [];
      if (moneyPerParticipant > 0) rewardParts.push(`💰 **${moneyPerParticipant}** / personne`);
      if (xpPerParticipant > 0) rewardParts.push(`⭐ **${xpPerParticipant} XP** / personne`);
      if (expeditionsPerParticipant > 0) rewardParts.push(`🏔️ **${expeditionsPerParticipant}** expédition${expeditionsPerParticipant > 1 ? 's' : ''} / personne`);

      const container = new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`# 🎉 Merci d'avoir participé !\nLa soirée **${event.eventInfo.name}** est terminée !`),
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### 👥 Présents\n${participantList}`),
        );

      if (rewardParts.length > 0) {
        container
          .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(rewardParts.join('　·　')),
          );
      }

      await thread.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      } as any);
    } catch (err) {
      console.error('[Party] Erreur embed rewards:', err);
    }
  }
}
