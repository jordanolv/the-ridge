import {
  Message,
  TextChannel,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  ThreadChannel,
} from 'discord.js';
import { BotClient } from '../../../../bot/client';
import { getGuildId } from '../../../../shared/guild';
import { AppConfigService } from '../../../discord/services/app-config.service';
import { GamesForumService } from '../../../discord/services/games-forum.service';
import { ArcadeStatsService } from '../../services/arcade-stats.service';
import { UserService } from '../../../user/services/user.service';
import { LevelingService } from '../../../leveling/services/leveling.service';
import { awardExpeditions } from '../../../peak-hunters/services/expedition.service';
import { ArcadeScheduleService } from '../../schedule/services/arcade-schedule.service';
import { LogService } from '../../../../shared/logs/logs.service';
import { toParisDayYMD, todayAtParis } from '../../../../shared/time/day-split';
import { GameResultRepository } from '../../results/repositories/game-result.repository';
import { BingoRepository } from '../repositories/bingo.repository';
import type { IBingoStateDoc } from '../models/bingo-state.model';
import {
  BINGO_SPAWN_HOUR,
  BINGO_ACCENT_COLOR,
  BINGO_BONUS_COUNT,
  BINGO_BONUS_EXPEDITIONS,
  BINGO_PARTICIPATION_FRAGMENTS,
  BINGO_FINISHED_ACCENT_COLOR,
  BINGO_NUMBER_MAX,
  BINGO_NUMBER_MIN,
  BINGO_RECAP_EVERY,
  BINGO_REWARD,
  BINGO_THREAD_AUTO_ARCHIVE_MINUTES,
  BINGO_THREAD_SLOWMODE_SECONDS,
} from '../constants/bingo.constants';
import { addFragmentsAndAward } from '../../../peak-hunters/services/expedition.service';
import { rc } from '../../../../shared/economy/currency';

const LOG_FEATURE = '🎯 Bingo';

export class BingoService {
  private static buildSpawnContainer(): ContainerBuilder {
    return new ContainerBuilder()
      .setAccentColor(BINGO_ACCENT_COLOR)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# 🎯 C\'EST L\'HEURE DU BINGO !'),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `Devinez le nombre entre **${BINGO_NUMBER_MIN}** et **${BINGO_NUMBER_MAX}** dans le fil ci-dessous !`,
        ),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            '**Règles :**',
            `• Réponds avec un nombre entre ${BINGO_NUMBER_MIN} et ${BINGO_NUMBER_MAX} dans le fil`,
            '• Pas deux réponses d\'affilée (attends qu\'un autre joueur tente)',
            `• Cooldown de ${Math.floor(BINGO_THREAD_SLOWMODE_SECONDS / 60)} minutes entre chaque réponse`,
          ].join('\n'),
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `🏆 Numéro gagnant : **${BINGO_REWARD.money}** ${rc()} · **${BINGO_REWARD.xp}** XP · **${BINGO_REWARD.expeditions}** pack(s) (termine le bingo)`,
            `🎁 ${BINGO_BONUS_COUNT} numéros bonus cachés : **${BINGO_BONUS_EXPEDITIONS}** pack chacun (sans arrêter le bingo !)`,
            `🤝 Tous les participants gagnent **${BINGO_PARTICIPATION_FRAGMENTS}** fragments à la victoire`,
          ].join('\n'),
        ),
      );
  }

  private static buildParticipantLines(guessers: string[]): string[] {
    const total = guessers.length;
    if (total === 0) return [];
    const counts = new Map<string, number>();
    for (const id of guessers) counts.set(id, (counts.get(id) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => `<@${id}> — **${n}** coup${n > 1 ? 's' : ''} (${Math.round((n / total) * 100)}%)`);
  }

  private static buildFinishedContainer(
    winnerId: string,
    target: number,
    guessCount: number,
    guessers: string[],
  ): ContainerBuilder {
    const container = new ContainerBuilder()
      .setAccentColor(BINGO_FINISHED_ACCENT_COLOR)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# ✅ BINGO TERMINÉ'),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `🏆 Gagnant : <@${winnerId}>`,
            `🔢 Nombre à trouver : **${target}**`,
            `🎲 Trouvé en : **${guessCount}** coup${guessCount > 1 ? 's' : ''}`,
          ].join('\n'),
        ),
      );

    const participantLines = this.buildParticipantLines(guessers);
    if (participantLines.length > 0) {
      container
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [`## 👥 Participants — ${guessers.length} coup${guessers.length > 1 ? 's' : ''}`, ...participantLines].join('\n'),
          ),
        );
    }

    return container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `Récompense remportée : **${BINGO_REWARD.money}** ${rc()} · **${BINGO_REWARD.xp}** XP · **${BINGO_REWARD.expeditions}** pack(s)`,
        ),
      );
  }

  static async planDay(client: BotClient): Promise<void> {
    const state = await BingoRepository.getOrCreate();

    if (state.activeThreadId) await this.expire(client, state);
    if (state.nextSpawnAt && state.nextSpawnAt.getTime() > Date.now()) return;

    if (!(await ArcadeScheduleService.isToday(client, 'bingo'))) {
      LogService.info("Pas de bingo aujourd'hui (planning).", {
        feature: LOG_FEATURE,
        title: '🗓️ Planification du jour',
      }).catch(() => {});
      return;
    }

    const nextSpawnAt = todayAtParis(BINGO_SPAWN_HOUR);
    await BingoRepository.setNextSpawn(nextSpawnAt);
    this.scheduleTimer(client, nextSpawnAt);

    const unix = Math.floor(nextSpawnAt.getTime() / 1000);
    LogService.info(`Bingo programmé <t:${unix}:T> (<t:${unix}:R>)`, {
      feature: LOG_FEATURE,
      title: '🗓️ Planification du jour',
    }).catch(() => {});
  }

  static async rehydrate(client: BotClient): Promise<void> {
    const state = await BingoRepository.get();
    if (state?.activeThreadId && state.activeStartedAt && toParisDayYMD(state.activeStartedAt) !== toParisDayYMD(new Date())) {
      await this.expire(client, state);
      return;
    }
    if (!state?.nextSpawnAt) return;

    const ts = state.nextSpawnAt.getTime();
    if (ts <= Date.now()) {
      if (!state.activeThreadId) {
        await this.spawn(client);
      }
      return;
    }

    this.scheduleTimer(client, state.nextSpawnAt);
    const unix = Math.floor(ts / 1000);
    LogService.info(`Bingo réhydraté <t:${unix}:T> (<t:${unix}:R>)`, {
      feature: LOG_FEATURE,
      title: '🔄 Réhydratation',
    }).catch(() => {});
  }

  private static scheduleTimer(client: BotClient, date: Date): void {
    const delay = date.getTime() - Date.now();
    if (delay <= 0) {
      this.spawn(client).catch(() => {});
      return;
    }
    setTimeout(() => {
      this.spawn(client).catch((err) => console.error('[Bingo] spawn error:', err));
    }, delay);
  }

  static async spawn(client: BotClient): Promise<void> {
    const appConfig = await AppConfigService.getOrCreateConfig();
    const isEnabled = appConfig.features.arcade?.bingo?.enabled ?? true;
    const channelId = appConfig.config.channels?.arcade;

    if (!isEnabled) {
      LogService.info('Bingo désactivé dans la configuration, spawn ignoré.', {
        feature: LOG_FEATURE,
        title: '⏸️ Spawn ignoré',
      }).catch(() => {});
      await BingoRepository.setNextSpawn(null);
      return;
    }

    const forumConfig = await GamesForumService.getConfig();
    if (!channelId && !forumConfig.bingoThreadId) {
      LogService.warning('Aucun salon arcade ni post forum configuré, bingo annulé.', {
        feature: LOG_FEATURE,
        title: '⚠️ Spawn annulé',
      }).catch(() => {});
      await BingoRepository.setNextSpawn(null);
      return;
    }

    const guild = await client.guilds.fetch(getGuildId()).catch(() => null);
    if (!guild) {
      LogService.warning('Guild introuvable, bingo annulé.', {
        feature: LOG_FEATURE,
        title: '⚠️ Spawn annulé',
      }).catch(() => {});
      return;
    }

    const target = Math.floor(Math.random() * BINGO_NUMBER_MAX) + BINGO_NUMBER_MIN;
    const bonusNumbers = this.pickBonusNumbers(target);

    // Mode forum : la partie se joue dans le post permanent 🎯 Bingo
    if (forumConfig.bingoThreadId) {
      const post = await guild.channels.fetch(forumConfig.bingoThreadId).catch(() => null);
      if (post?.isThread()) {
        await GamesForumService.setThreadLocked(client, post.id, false);
        await post.setRateLimitPerUser(BINGO_THREAD_SLOWMODE_SECONDS).catch(() => {});
        const message = await post.send({
          components: [this.buildSpawnContainer()],
          flags: MessageFlags.IsComponentsV2,
        });
        await GamesForumService.pingInThread(post, 'bingo', `Un bingo démarre — devinez le nombre entre ${BINGO_NUMBER_MIN} et ${BINGO_NUMBER_MAX} !`);
        const announceMessageId = await GamesForumService.announce(
          client,
          `🎯 **Un bingo vient de démarrer !** Trouvez le nombre mystère → <#${post.id}>`,
        );

        await BingoRepository.setActive({
          channelId: post.parentId ?? post.id,
          messageId: message.id,
          threadId: post.id,
          target,
          bonusNumbers,
          startedAt: new Date(),
          announceMessageId,
        });

        LogService.info(`Bingo lancé dans <#${post.id}>`, {
          feature: LOG_FEATURE,
          title: '🎯 Spawn',
        }).catch(() => {});
        return;
      }
    }

    const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
    if (!channel || !channel.isTextBased() || channel.isThread()) {
      LogService.warning(`Salon arcade invalide ou introuvable (${channelId}), bingo annulé.`, {
        feature: LOG_FEATURE,
        title: '⚠️ Spawn annulé',
      }).catch(() => {});
      return;
    }

    const message = await (channel as TextChannel).send({
      components: [this.buildSpawnContainer()],
      flags: MessageFlags.IsComponentsV2,
    });

    let thread: ThreadChannel;
    try {
      thread = await message.startThread({
        name: '🎯 Bingo — trouvez le nombre !',
        autoArchiveDuration: BINGO_THREAD_AUTO_ARCHIVE_MINUTES,
        rateLimitPerUser: BINGO_THREAD_SLOWMODE_SECONDS,
      });
      await thread.send(
        `🎯 **Devinez le nombre entre ${BINGO_NUMBER_MIN} et ${BINGO_NUMBER_MAX}.** Bonne chance !`,
      );
    } catch (err) {
      console.error('[Bingo] startThread error:', err);
      await message.delete().catch(() => {});
      return;
    }

    await BingoRepository.setActive({
      channelId: channel.id,
      messageId: message.id,
      threadId: thread.id,
      target,
      bonusNumbers,
      startedAt: new Date(),
    });

    LogService.info(`Bingo lancé dans <#${channel.id}>`, {
      feature: LOG_FEATURE,
      title: '🎯 Spawn',
    }).catch(() => {});
  }

  private static pickBonusNumbers(target: number): number[] {
    const pool: number[] = [];
    for (let n = BINGO_NUMBER_MIN; n <= BINGO_NUMBER_MAX; n++) {
      if (n !== target) pool.push(n);
    }
    const picked: number[] = [];
    for (let i = 0; i < BINGO_BONUS_COUNT && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  static async handleMessage(message: Message, client: BotClient): Promise<void> {
    if (message.author.bot) return;
    if (!message.channel.isThread()) return;

    const state = await BingoRepository.get();
    if (!state?.activeThreadId || !state.activeTarget) return;
    if (message.channel.id !== state.activeThreadId) return;

    const content = message.content.trim();
    const num = Number(content);
    if (!Number.isInteger(num) || num < BINGO_NUMBER_MIN || num > BINGO_NUMBER_MAX) return;

    if (state.activeLastGuesserId === message.author.id) {
      await message.reply({
        content: '⏳ Pas deux réponses d\'affilée ! Laisse un autre joueur tenter sa chance.',
      }).catch(() => {});
      return;
    }

    const isDuplicateGuess = state.activeGuesses?.includes(num) ?? false;
    const updatedState = await BingoRepository.registerGuess(message.author.id, num);
    await UserService.recordArcadeAttempt(message.author.id, 'bingo');
    const guessCount = updatedState?.activeGuesses?.length ?? (state.activeGuesses?.length ?? 0) + 1;

    if (num === state.activeTarget) {
      await this.handleWin(message, client, updatedState ?? state, guessCount);
      return;
    }

    if (state.activeBonusNumbers?.includes(num) && (await BingoRepository.claimBonus(num))) {
      const expeditions = await awardExpeditions(message.author.id, BINGO_BONUS_EXPEDITIONS);
      await message.react('🎁').catch(() => {});
      await message.reply({
        content: `🎁 **NUMÉRO BONUS !** <@${message.author.id}> décroche **${BINGO_BONUS_EXPEDITIONS}** pack ${expeditions.summary} — le bingo continue !`,
      }).catch(() => {});
      LogService.info(
        `<@${message.author.id}> a trouvé un numéro bonus (**${num}**) — ${expeditions.summary}`,
        { feature: LOG_FEATURE, title: '🎁 Bonus' },
      ).catch(() => {});
    } else {
      await message.react(isDuplicateGuess ? '🔁' : '❌').catch(() => {});
    }

    if (guessCount > 0 && guessCount % BINGO_RECAP_EVERY === 0) {
      await this.sendRemainingRecap(message.channel as ThreadChannel, updatedState ?? state);
    }
  }

  private static buildRemainingNumbers(guesses: number[]): number[] {
    const guessed = new Set(guesses);
    const remaining: number[] = [];
    for (let n = BINGO_NUMBER_MIN; n <= BINGO_NUMBER_MAX; n++) {
      if (!guessed.has(n)) remaining.push(n);
    }
    return remaining;
  }

  private static async sendRemainingRecap(thread: ThreadChannel, state: IBingoStateDoc): Promise<void> {
    const remaining = this.buildRemainingNumbers(state.activeGuesses ?? []);
    if (remaining.length === 0) return;

    const container = new ContainerBuilder()
      .setAccentColor(BINGO_ACCENT_COLOR)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## 🔢 Numéros encore disponibles — ${remaining.length}/${BINGO_NUMBER_MAX}`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(remaining.join(' · ')),
      );

    await thread.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    }).catch(() => {});
  }

  /** Minuit : partie non gagnée → nombre révélé, post reverrouillé, état effacé. */
  static async expire(client: BotClient, state: IBingoStateDoc): Promise<void> {
    if (!state.activeThreadId) return;

    const guild = await client.guilds.fetch(getGuildId()).catch(() => null);
    const thread = guild ? await guild.channels.fetch(state.activeThreadId).catch(() => null) : null;
    if (thread?.isThread()) {
      await thread.send(`⏰ Minuit ! Personne n'a trouvé le nombre mystère… c'était **${state.activeTarget}**. À la prochaine partie !`).catch(() => {});
      await thread.setLocked(true).catch(() => {});
    }

    await GamesForumService.deleteAnnounce(client, state.announceMessageId);
    await BingoRepository.clearActive();
    LogService.info(`Bingo expiré à minuit sans gagnant (cible **${state.activeTarget}**, ${(state.activeGuesses ?? []).length} essai(s)).`, {
      feature: LOG_FEATURE,
      title: '⏰ Expiré',
    }).catch(() => {});
  }

  private static async handleWin(
    message: Message,
    client: BotClient,
    state: IBingoStateDoc,
    guessCount: number,
  ): Promise<void> {
    const user = message.author;
    const target = state.activeTarget;
    if (!target) return;

    const totalPacks = BINGO_REWARD.expeditions;

    await UserService.updateUserMoney(user.id, BINGO_REWARD.money, 'Bingo — gain');
    await LevelingService.giveXpDirectly(client, user.id, BINGO_REWARD.xp);
    const expeditions = await awardExpeditions(user.id, totalPacks);
    await UserService.recordArcadeWin(user.id, 'bingo');
    await GameResultRepository.record('bingo', user.id, 1, { attempts: guessCount, players: new Set(state.activeGuessers ?? []).size });

    const participants = [...new Set(state.activeGuessers ?? [])].filter((id) => id !== user.id);
    for (const participantId of participants) {
      await addFragmentsAndAward(participantId, BINGO_PARTICIPATION_FRAGMENTS).catch(() => {});
    }

    await ArcadeStatsService.incrementTotalGames('bingo');

    await this.updateMainMessage(message, state, user.id, target, guessCount, state.activeGuessers ?? []);

    await message.reply({
      content: [
        `🎉 **BINGO !** <@${user.id}> a trouvé le nombre **${target}** en **${guessCount}** coup${guessCount > 1 ? 's' : ''} !`,
        `🏆 +**${BINGO_REWARD.money}** ${rc()} · +**${BINGO_REWARD.xp}** XP · +**${totalPacks}** pack(s) ${expeditions.summary}`,
        ...(participants.length > 0 ? [`🤝 ${participants.length} participant${participants.length > 1 ? 's' : ''} repartent avec **${BINGO_PARTICIPATION_FRAGMENTS}** fragments chacun !`] : []),
      ].join('\n'),
    }).catch(() => {});

    // Post permanent : reverrouillé jusqu'à la prochaine partie ; thread legacy : verrouillé + archivé
    const forumConfig = await GamesForumService.getConfig();
    const thread = message.channel as ThreadChannel;
    if (thread.id === forumConfig.bingoThreadId) {
      await thread.setLocked(true).catch(() => {});
    } else {
      await thread.setLocked(true).catch(() => {});
      await thread.setArchived(true).catch(() => {});
    }

    await GamesForumService.deleteAnnounce(client, state.announceMessageId);
    await BingoRepository.clearActive();

    LogService.success(
      `<@${user.id}> a gagné le bingo (cible **${target}**, **${guessCount}** coup${guessCount > 1 ? 's' : ''}) — +${BINGO_REWARD.money} 💰 · +${BINGO_REWARD.xp} XP · ${expeditions.summary}`,
      { feature: LOG_FEATURE, title: '🏆 Gagnant' },
    ).catch(() => {});
  }

  private static async updateMainMessage(
    message: Message,
    state: IBingoStateDoc,
    winnerId: string,
    target: number,
    guessCount: number,
    guessers: string[],
  ): Promise<void> {
    if (!state.activeMessageId) return;

    const thread = message.channel;
    if (!thread.isThread()) return;

    // Mode forum : le message principal vit dans le post ; mode legacy : dans le channel parent
    const parent = thread?.parent;
    const starterMessage =
      (await thread.messages.fetch(state.activeMessageId).catch(() => null)) ??
      (parent && parent.isTextBased() && !parent.isThread()
        ? await parent.messages.fetch(state.activeMessageId).catch(() => null)
        : null);
    if (!starterMessage) return;

    await starterMessage.edit({
      components: [this.buildFinishedContainer(winnerId, target, guessCount, guessers)],
      flags: MessageFlags.IsComponentsV2,
    }).catch(() => {});
  }
}
