import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildTextBasedChannel,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  MessageFlags,
  ButtonInteraction,
} from 'discord.js';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { BotClient } from '../../../bot/client';
import { QuizConfigRepository } from '../repositories/quiz-config.repository';
import { PeakHuntersConfigRepository } from '../../peak-hunters/repositories/peak-hunters-config.repository';
import { QuizQuestionBankService } from './quiz-question-bank.service';
import { LogService } from '../../../shared/logs/logs.service';
import { awardExpeditions } from '../../peak-hunters/services/expedition.service';
import { IQuizConfigDoc } from '../models/quiz-config.model';
import { AppConfigService } from '../../discord/services/app-config.service';
import { GamesForumService } from '../../discord/services/games-forum.service';
import UserModel from '../../user/models/user.model';

export interface QuizQuestion {
  id: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string | null;
  image?: string | null;
  theme?: string;
  subtheme?: string;
}

export const QUIZ_BUTTON_PREFIX = 'quiz:answer';
export const QUIZ_THEME_PREFIX = 'quiz:theme';
const REVEAL_HOUR = 19;
const TZ = 'Europe/Paris';
const CHOICE_EMOJIS = ['🅰️', '🅱️', '🅲', '🅳'];

function getTodayRevealDate(): Date {
  const nowParis = toZonedTime(new Date(), TZ);
  const naive = new Date(nowParis.getFullYear(), nowParis.getMonth(), nowParis.getDate(), REVEAL_HOUR, 0, 0);
  return fromZonedTime(naive, TZ);
}

export class QuizService {
  /** Post forum dédié (config.channels.quiz) prioritaire, sinon channel de spawn Peak Hunters. */
  private static async getChannel(client: BotClient): Promise<GuildTextBasedChannel | null> {
    const appConfig = await AppConfigService.getOrCreateConfig();
    const mountainConfig = await PeakHuntersConfigRepository.get();
    const channelId = appConfig.config.channels?.quiz || mountainConfig?.spawnChannelId;
    if (!channelId) return null;
    const guild = client.guilds.cache.get(process.env.GUILD_ID!);
    const channel = await guild?.channels.fetch(channelId).catch(() => null) ?? null;
    return channel?.isTextBased() ? (channel as GuildTextBasedChannel) : null;
  }

  /** Message principal : le choix de thème du jour. */
  private static buildChooser(config: IQuizConfigDoc) {
    const questions = config.activeQuestions ?? [];
    const picks = Object.values(config.activeThemeChoices ?? {});
    const answered = Object.keys(config.activeAnswers ?? {}).length;

    const lines = [
      '## 🌍 Question du jour',
      '-# Choisis ton thème — premier clic verrouillé, une seule question par jour !',
      '',
    ];
    questions.forEach((q) => {
      const count = picks.filter((id) => id === q.id).length;
      lines.push(`**${q.theme}** — ${count} participant${count > 1 ? 's' : ''}`);
    });
    if (answered > 0) {
      lines.push('', `👥 **${answered}** réponse${answered > 1 ? 's' : ''} enregistrée${answered > 1 ? 's' : ''} — récap à 22h`);
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...questions.map((q) =>
        new ButtonBuilder()
          .setCustomId(`${QUIZ_THEME_PREFIX}:${q.id}`)
          .setLabel(q.theme ?? 'Thème')
          .setStyle(ButtonStyle.Primary),
      ),
    );

    return { container, row };
  }

  /** Question individuelle envoyée en éphémère après le choix du thème. */
  private static buildQuestion(question: QuizQuestion, note?: string) {
    const container = new ContainerBuilder();

    const header = [`## ${question.theme ?? 'Question du jour'}`];
    if (question.subtheme) header.push(`-# ${question.subtheme}`);
    header.push('', `**${question.question}**`);
    if (note) header.unshift(`-# ${note}`);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header.join('\n')));

    if (question.image) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(question.image)),
      );
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        question.choices.map((choice, i) => `${CHOICE_EMOJIS[i]}  ${choice}`).join('\n'),
      ),
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...question.choices.map((_, i) =>
        new ButtonBuilder()
          .setCustomId(`${QUIZ_BUTTON_PREFIX}:${question.id}:${i}`)
          .setLabel(CHOICE_EMOJIS[i]!)
          .setStyle(ButtonStyle.Secondary),
      ),
    );

    return { container, row };
  }

  private static async buildRecapExtras(): Promise<{ streakLines: string[]; weeklyLines: string[]; isSunday: boolean }> {
    const isSunday = toZonedTime(new Date(), TZ).getDay() === 0;

    const topStreaks = await UserModel.find({ 'stats.quiz.streak': { $gt: 1 } })
      .sort({ 'stats.quiz.streak': -1 }).limit(3).select('discordId stats.quiz.streak').lean();
    const streakLines = topStreaks.map((u: any, i: number) =>
      `${['🥇', '🥈', '🥉'][i]} <@${u.discordId}> — série de **${u.stats.quiz.streak}**`);

    let weeklyLines: string[] = [];
    if (isSunday) {
      const topWeekly = await UserModel.find({ 'stats.quiz.weeklyCorrect': { $gt: 0 } })
        .sort({ 'stats.quiz.weeklyCorrect': -1 }).limit(3).select('discordId stats.quiz.weeklyCorrect').lean();
      weeklyLines = topWeekly.map((u: any, i: number) =>
        `${['🥇', '🥈', '🥉'][i]} <@${u.discordId}> — **${u.stats.quiz.weeklyCorrect}** bonne${u.stats.quiz.weeklyCorrect > 1 ? 's' : ''} réponse${u.stats.quiz.weeklyCorrect > 1 ? 's' : ''}`);
    }

    return { streakLines, weeklyLines, isSunday };
  }

  /** Récap de fin de journée : chaque question, sa réponse et les scores. */
  private static buildReveal(config: IQuizConfigDoc, extras?: { streakLines: string[]; weeklyLines: string[] }): ContainerBuilder {
    const questions = config.activeQuestions ?? [];
    const choices = config.activeThemeChoices ?? {};
    const answers = config.activeAnswers ?? {};

    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🌍 Question du jour — récap'));

    questions.forEach((q, idx) => {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(idx === 0));

      const players = Object.entries(choices).filter(([, id]) => id === q.id);
      const correct = players.filter(([userId]) => answers[userId] === q.answer).length;
      const answered = players.filter(([userId]) => answers[userId] !== undefined).length;

      const lines = [
        `### ${q.theme}${q.subtheme ? ` — ${q.subtheme}` : ''}`,
        `**${q.question}**`,
        `✅ **${q.choices[q.answer]}**`,
      ];
      if (q.explanation) lines.push(`> 💡 ${q.explanation}`);
      lines.push(`👥 ${answered} réponse${answered > 1 ? 's' : ''} — ${correct} bonne${correct > 1 ? 's' : ''}`);

      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      if (q.image) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(q.image)),
        );
      }
    });

    if (extras?.streakLines.length) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        ['### 🔥 Séries en cours', ...extras.streakLines].join('\n'),
      ));
    }
    if (extras?.weeklyLines.length) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        ['### 🏆 Champions de la semaine', ...extras.weeklyLines, '', '-# Compteur hebdo remis à zéro — nouvelle course dès demain !'].join('\n'),
      ));
    }

    return container;
  }

  static async post(client: BotClient): Promise<void> {
    const channel = await this.getChannel(client);
    if (!channel) return;

    // Un thread lock grise les boutons pour les non-modos — on s'assure qu'il est ouvert.
    if (channel.isThread() && channel.locked) {
      await GamesForumService.setThreadLocked(client, channel.id, false);
    }

    const existing = await QuizConfigRepository.getOrCreate();
    if (existing.enabled === false || existing.activeMessageId) return;

    const special = QuizQuestionBankService.todaySpecial();
    const questions = special ? [special] : QuizQuestionBankService.generateSet(existing.recentQuestionTexts ?? [], 4);
    if (questions.length === 0) return;

    await QuizConfigRepository.setActiveQuestions('pending', questions, getTodayRevealDate());
    const config = await QuizConfigRepository.getOrCreate();
    const { container, row } = this.buildChooser(config);

    const message = await channel.send({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2,
    });

    config.activeMessageId = message.id;
    await config.save();

    if (channel.isThread()) {
      await GamesForumService.pingInThread(channel, 'quiz', 'La question du jour est là — choisis ton thème !');
    }
    const announceId = await GamesForumService.announce(
      client,
      `❓ **La question du jour est en ligne !** Choisis ton thème → <#${channel.id}>`,
    );
    await QuizConfigRepository.setAnnounceMessage(announceId);
  }

  /** Supprime la question active (message compris) et en poste une nouvelle immédiatement. */
  static async repost(client: BotClient): Promise<boolean> {
    const channel = await this.getChannel(client);
    if (!channel) return false;

    const config = await QuizConfigRepository.getOrCreate();
    if (config.activeMessageId && config.activeMessageId !== 'pending') {
      const message = await channel.messages.fetch(config.activeMessageId).catch(() => null);
      await message?.delete().catch(() => {});
    }
    await GamesForumService.deleteAnnounce(client, config.announceMessageId);
    await QuizConfigRepository.setAnnounceMessage(null);
    await QuizConfigRepository.clearActiveQuestion();
    await this.post(client);
    return true;
  }

  static async rehydrate(client: BotClient): Promise<void> {
    const config = await QuizConfigRepository.getOrCreate();
    if (!config.activeMessageId || !config.activeQuestions?.length || !config.activeUntil) return;

    const remaining = new Date(config.activeUntil).getTime() - Date.now();
    if (remaining <= 0) {
      await this.reveal(client);
    }
  }

  static async revealActive(client: BotClient): Promise<void> {
    const config = await QuizConfigRepository.getOrCreate();
    if (!config.activeMessageId || !config.activeQuestions?.length) return;
    await this.reveal(client);
  }

  static async reveal(client: BotClient): Promise<void> {
    const channel = await this.getChannel(client);
    if (!channel) return;

    const config = await QuizConfigRepository.getOrCreate();
    if (!config.activeMessageId) return;

    const message = await channel.messages.fetch(config.activeMessageId).catch(() => null);
    if (message) {
      const extras = await this.buildRecapExtras();
      await message.edit({
        components: [this.buildReveal(config, extras)],
        flags: MessageFlags.IsComponentsV2,
      });
      if (extras.isSunday) {
        await UserModel.updateMany({}, { $set: { 'stats.quiz.weeklyCorrect': 0 } });
      }
    }

    await GamesForumService.deleteAnnounce(client, config.announceMessageId);
    await QuizConfigRepository.setAnnounceMessage(null);
    await QuizConfigRepository.clearActiveQuestion();
  }

  private static async refreshChooser(client: BotClient): Promise<void> {
    const channel = await this.getChannel(client);
    const config = await QuizConfigRepository.getOrCreate();
    if (!channel || !config.activeMessageId) return;

    const message = await channel.messages.fetch(config.activeMessageId).catch(() => null);
    if (!message) return;

    const { container, row } = this.buildChooser(config);
    await message.edit({ components: [container, row], flags: MessageFlags.IsComponentsV2 });
  }

  static async handleThemePick(client: BotClient, interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const pickedId = interaction.customId.split(':').slice(2).join(':');
    const userId = interaction.user.id;

    const config = await QuizConfigRepository.getOrCreate();
    const questions = config.activeQuestions ?? [];
    if (questions.length === 0) {
      await interaction.editReply({ content: 'La question du jour est terminée.' });
      return;
    }

    if (config.activeAnswers?.[userId] !== undefined) {
      await interaction.editReply({ content: 'Tu as déjà répondu à ta question du jour. Rendez-vous au récap !' });
      return;
    }

    const lockedId = config.activeThemeChoices?.[userId];
    const question = questions.find((q) => q.id === (lockedId ?? pickedId));
    if (!question) {
      await interaction.editReply({ content: 'Ce thème ne fait pas partie de la question du jour.' });
      return;
    }

    if (!lockedId) {
      await QuizConfigRepository.saveThemeChoice(userId, question.id);
      await this.refreshChooser(client);
    }

    const note = lockedId && lockedId !== pickedId ? '⚠️ Ton thème est déjà verrouillé, voici ta question :' : undefined;
    const { container, row } = this.buildQuestion(question, note);
    await interaction.editReply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  static async handleAnswer(client: BotClient, interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const parts = interaction.customId.split(':');
    const choiceIndex = parseInt(parts[parts.length - 1]!, 10);
    const questionId = parts.slice(2, -1).join(':');
    const userId = interaction.user.id;

    const config = await QuizConfigRepository.getOrCreate();
    const question = config.activeQuestions?.find((q) => q.id === questionId);

    if (!question) {
      await interaction.editReply({ content: 'Cette question est déjà terminée.' });
      return;
    }

    if (config.activeAnswers?.[userId] !== undefined) {
      await interaction.editReply({ content: 'Tu as déjà répondu à ta question du jour.' });
      return;
    }

    if (config.activeThemeChoices?.[userId] !== questionId) {
      await interaction.editReply({ content: 'Ce n\'est pas le thème que tu as choisi.' });
      return;
    }

    const isCorrect = choiceIndex === question.answer;
    const isFirst = isCorrect && !config.firstCorrectByQuestion?.[questionId];

    await QuizConfigRepository.saveAnswer(userId, choiceIndex, questionId, isFirst);
    const streak = await this.updateQuizStats(userId, isCorrect);

    if (isCorrect) {
      const streakBonus = streak > 0 && streak % 5 === 0 ? 1 : 0;
      const packs = (isFirst ? 3 : 2) + streakBonus;
      const { summary } = await awardExpeditions(userId, packs);
      await LogService.info(`<@${userId}> a remporté **${packs} expédition${packs > 1 ? 's' : ''}** ${summary}${isFirst ? ` (premier sur ${question.theme})` : ''}${streakBonus ? ` (série de ${streak})` : ''}`, { feature: 'Quiz', title: '🗺️ Expéditions gagnées' });

      const parts = [
        isFirst
          ? `✅ Bonne réponse ! Premier sur ce thème — tu remportes **${packs} expéditions** ${summary}`
          : `✅ Bonne réponse ! Tu remportes **${packs} expédition${packs > 1 ? 's' : ''}** ${summary}`,
      ];
      if (streak > 1) parts.push(streakBonus ? `🔥 Série de **${streak}** — expédition bonus !` : `🔥 Série en cours : **${streak}**`);
      if (streak > 1 && !streakBonus) {
        const next = Math.ceil(streak / 5) * 5;
        parts.push(`-# Encore ${next - streak} bonne${next - streak > 1 ? 's' : ''} réponse${next - streak > 1 ? 's' : ''} pour l'expédition bonus.`);
      }
      await interaction.editReply({ content: parts.join('\n') });
    } else {
      await interaction.editReply({
        content: '❌ Mauvaise réponse. La bonne réponse au récap !' +
          (streak > 1 ? `\n💔 Ta série de **${streak}** s'arrête là.` : ''),
      });
    }

    await this.refreshChooser(client);
  }

  /**
   * Met à jour streak/compteurs quiz du joueur.
   * Retourne la série en cours (bonne réponse) ou la série qui vient d'être perdue (mauvaise).
   */
  private static async updateQuizStats(userId: string, isCorrect: boolean): Promise<number> {
    const user = await UserModel.findOne({ discordId: userId });
    if (!user) return 0;

    const quiz = user.stats.quiz ?? (user.stats.quiz = {} as any);
    quiz.totalAnswered = (quiz.totalAnswered ?? 0) + 1;
    let result: number;

    if (isCorrect) {
      const dayKey = (d: Date) => toZonedTime(d, TZ).toDateString();
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
      const continues = quiz.lastCorrectAt && dayKey(new Date(quiz.lastCorrectAt)) === dayKey(yesterday);
      quiz.streak = continues ? (quiz.streak ?? 0) + 1 : 1;
      quiz.bestStreak = Math.max(quiz.bestStreak ?? 0, quiz.streak);
      quiz.totalCorrect = (quiz.totalCorrect ?? 0) + 1;
      quiz.weeklyCorrect = (quiz.weeklyCorrect ?? 0) + 1;
      quiz.lastCorrectAt = new Date();
      result = quiz.streak;
    } else {
      result = quiz.streak ?? 0;
      quiz.streak = 0;
    }

    user.markModified('stats.quiz');
    await user.save();
    return result;
  }
}
