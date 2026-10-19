import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  Message,
  MessageFlags,
  ThreadChannel,
} from 'discord.js';
import { BotClient } from '../../../../bot/client';
import { getGuildId } from '../../../../shared/guild';
import { ArcadeScheduleService } from '../../schedule/services/arcade-schedule.service';
import { todayAtParis } from '../../../../shared/time/day-split';
import { LogService } from '../../../../shared/logs/logs.service';
import { GamesForumService } from '../../../discord/services/games-forum.service';
import { AppConfigService } from '../../../discord/services/app-config.service';
import { UserService } from '../../../user/services/user.service';
import { LevelingService } from '../../../leveling/services/leveling.service';
import { awardExpeditions, addFragmentsAndAward } from '../../../peak-hunters/services/expedition.service';
import { ArcadeStatsService } from '../../services/arcade-stats.service';
import { GameResultRepository } from '../../results/repositories/game-result.repository';
import { JustePrixRepository } from '../repositories/juste-prix.repository';
import type { IJustePrixStateDoc } from '../models/juste-prix-state.model';
import {
  JP_ACCENT_COLOR,
  JP_EXACT_BONUS_EXPEDITIONS,
  JP_FINISHED_ACCENT_COLOR,
  JP_SPAWN_HOUR,
  JP_NUMBER_MAX,
  JP_NUMBER_MIN,
  JP_REVEAL_HOUR,
  JP_PARTICIPATION_FRAGMENTS,
  JP_REWARD_CLOSEST,
} from '../constants/juste-prix.constants';
import { rc } from '../../../../shared/economy/currency';

const LOG_FEATURE = '💰 Juste Prix';


export class JustePrixService {
  private static async isEnabled(): Promise<boolean> {
    const appConfig = await AppConfigService.getOrCreateConfig();
    return (appConfig.features.arcade as any)?.justePrix?.enabled ?? true;
  }

  private static buildSpawnContainer(endsAt: Date): ContainerBuilder {
    const unix = Math.floor(endsAt.getTime() / 1000);
    return new ContainerBuilder()
      .setAccentColor(JP_ACCENT_COLOR)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# 💰 LE JUSTE PRIX'))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        [
          `Un nombre mystère entre **${JP_NUMBER_MIN}** et **${JP_NUMBER_MAX}** a été tiré.`,
          '',
          '**Règles :**',
          '• Propose **UN SEUL** nombre dans le fil — le renvoyer remplace ta proposition',
          '• Ta proposition reste **secrète** jusqu\'à la révélation',
          `• Révélation <t:${unix}:R> (<t:${unix}:t>)`,
          '• **Le plus proche gagne** — tomber juste double la mise !',
          '',
          `🏆 Le plus proche : **${JP_REWARD_CLOSEST.money}** ${rc()} · **${JP_REWARD_CLOSEST.xp}** XP · **${JP_REWARD_CLOSEST.expeditions}** packs`,
          `🎯 Nombre exact : **+${JP_EXACT_BONUS_EXPEDITIONS}** packs bonus !`,
          `🤝 Les autres participants repartent avec **${JP_PARTICIPATION_FRAGMENTS}** fragments`,
        ].join('\n'),
      ));
  }

  private static buildResultContainer(state: IJustePrixStateDoc, ranking: { userId: string; value: number; diff: number }[]): ContainerBuilder {
    const target = state.activeTarget!;
    const winner = ranking[0];
    const container = new ContainerBuilder()
      .setAccentColor(JP_FINISHED_ACCENT_COLOR)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# 💰 JUSTE PRIX — RÉSULTAT'))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    if (!winner) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `Le nombre mystère était **${target}**… mais personne n'a joué ! 😢`,
      ));
      return container;
    }

    const podium = ranking.slice(0, 3).map((r, i) =>
      `${['🥇', '🥈', '🥉'][i]} <@${r.userId}> — **${r.value}** (à ${r.diff === 0 ? '🎯 EXACT' : r.diff + ' près'})`);

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      [
        `Le nombre mystère était **${target}** !`,
        '',
        ...podium,
        '',
        `👥 ${ranking.length} participant${ranking.length > 1 ? 's' : ''}`,
      ].join('\n'),
    ));
    return container;
  }

  static async planDay(client: BotClient): Promise<void> {
    const state = await JustePrixRepository.getOrCreate();

    if (state.activeThreadId) {
      // Manche de la veille jamais résolue (bot down à 21h) : on résout maintenant
      await this.resolve(client);
    }
    if (state.nextSpawnAt && state.nextSpawnAt.getTime() > Date.now()) return;

    if (!(await ArcadeScheduleService.isToday(client, 'justePrix'))) {
      LogService.info("Pas de Juste Prix aujourd'hui (planning).", {
        feature: LOG_FEATURE,
        title: '🗓️ Planification du jour',
      }).catch(() => {});
      return;
    }

    const nextSpawnAt = todayAtParis(JP_SPAWN_HOUR);
    await JustePrixRepository.setNextSpawn(nextSpawnAt);
    this.scheduleTimer(client, nextSpawnAt, () => this.spawn(client));

    const unix = Math.floor(nextSpawnAt.getTime() / 1000);
    LogService.info(`Juste Prix programmé <t:${unix}:T> (<t:${unix}:R>)`, {
      feature: LOG_FEATURE,
      title: '🗓️ Planification du jour',
    }).catch(() => {});
  }

  static async rehydrate(client: BotClient): Promise<void> {
    const state = await JustePrixRepository.get();
    if (!state) return;

    if (state.activeThreadId && state.activeEndsAt) {
      const remaining = state.activeEndsAt.getTime() - Date.now();
      if (remaining <= 0) await this.resolve(client);
      else this.scheduleTimer(client, state.activeEndsAt, () => this.resolve(client));
      return;
    }

    if (state.nextSpawnAt) {
      if (state.nextSpawnAt.getTime() <= Date.now()) await this.spawn(client);
      else this.scheduleTimer(client, state.nextSpawnAt, () => this.spawn(client));
    }
  }

  private static scheduleTimer(client: BotClient, date: Date, action: () => Promise<void>): void {
    const delay = Math.max(date.getTime() - Date.now(), 0);
    setTimeout(() => {
      action().catch((err) => console.error('[JustePrix] timer error:', err));
    }, delay);
  }

  static async spawn(client: BotClient): Promise<void> {
    if (!(await this.isEnabled())) {
      await JustePrixRepository.setNextSpawn(null);
      return;
    }

    const state = await JustePrixRepository.getOrCreate();
    if (state.activeThreadId) return;

    const forumConfig = await GamesForumService.getConfig();
    if (!forumConfig.justePrixThreadId) {
      LogService.warning('Post forum 💰 Juste Prix non configuré, manche annulée (configure le forum des jeux).', {
        feature: LOG_FEATURE,
        title: '⚠️ Spawn annulé',
      }).catch(() => {});
      await JustePrixRepository.setNextSpawn(null);
      return;
    }

    const guild = await client.guilds.fetch(getGuildId()).catch(() => null);
    const post = guild ? await guild.channels.fetch(forumConfig.justePrixThreadId).catch(() => null) : null;
    if (!post?.isThread()) {
      await JustePrixRepository.setNextSpawn(null);
      return;
    }

    const endsAt = todayAtParis(JP_REVEAL_HOUR);
    if (endsAt.getTime() <= Date.now()) {
      await JustePrixRepository.setNextSpawn(null);
      return;
    }

    const target = JP_NUMBER_MIN + Math.floor(Math.random() * (JP_NUMBER_MAX - JP_NUMBER_MIN + 1));
    await GamesForumService.setThreadLocked(client, post.id, false);
    const message = await post.send({
      components: [this.buildSpawnContainer(endsAt)],
      flags: MessageFlags.IsComponentsV2,
    });
    await GamesForumService.pingInThread(post as ThreadChannel, 'justePrix', `Une manche du Juste Prix démarre — un nombre entre ${JP_NUMBER_MIN} et ${JP_NUMBER_MAX}, révélation à ${JP_REVEAL_HOUR}h !`);
    const announceMessageId = await GamesForumService.announce(
      client,
      `💰 **Le Juste Prix est lancé !** Propose ton nombre avant ${JP_REVEAL_HOUR}h → <#${post.id}>`,
    );

    await JustePrixRepository.setActive({
      threadId: post.id,
      messageId: message.id,
      target,
      endsAt,
      announceMessageId,
    });
    this.scheduleTimer(client, endsAt, () => this.resolve(client));

    LogService.info(`Juste Prix lancé dans <#${post.id}> (cible ${target}, révélation ${JP_REVEAL_HOUR}h)`, {
      feature: LOG_FEATURE,
      title: '💰 Spawn',
    }).catch(() => {});
  }

  static async handleMessage(message: Message, _client: BotClient): Promise<void> {
    if (message.author.bot) return;
    if (!message.channel.isThread()) return;

    const state = await JustePrixRepository.get();
    if (!state?.activeThreadId || !state.activeTarget) return;
    if (message.channel.id !== state.activeThreadId) return;
    if (state.activeEndsAt && state.activeEndsAt.getTime() <= Date.now()) return;

    const num = Number(message.content.trim());
    if (!Number.isInteger(num) || num < JP_NUMBER_MIN || num > JP_NUMBER_MAX) return;

    await message.delete().catch(() => {});

    const taken = Object.entries(state.guesses ?? {}).some(([userId, g]) => userId !== message.author.id && g.value === num);
    if (taken) {
      await message.channel.send(`🔄 <@${message.author.id}> ce nombre est déjà pris, tente autre chose !`).catch(() => {});
      return;
    }

    const isUpdate = Boolean(state.guesses?.[message.author.id]);
    await JustePrixRepository.setGuess(message.author.id, num);
    if (!isUpdate) await UserService.recordArcadeAttempt(message.author.id, 'justePrix' as any);
    await message.channel.send(`✅ <@${message.author.id}> a participé !`).catch(() => {});
  }

  static async resolve(client: BotClient): Promise<void> {
    const state = await JustePrixRepository.get();
    if (!state?.activeThreadId || !state.activeTarget) return;

    const target = state.activeTarget;
    const guild = await client.guilds.fetch(getGuildId()).catch(() => null);
    const thread = guild ? await guild.channels.fetch(state.activeThreadId).catch(() => null) : null;

    const ranking = Object.entries(state.guesses ?? {})
      .map(([userId, g]) => ({ userId, value: g.value, at: new Date(g.at).getTime(), diff: Math.abs(g.value - target) }))
      .sort((a, b) => a.diff - b.diff || a.at - b.at);

    const winner = ranking[0];

    if (thread?.isThread()) {
      if (state.activeMessageId) {
        const mainMessage = await thread.messages.fetch(state.activeMessageId).catch(() => null);
        await mainMessage?.edit({
          components: [this.buildResultContainer(state, ranking)],
          flags: MessageFlags.IsComponentsV2,
        }).catch(() => {});
      }

      if (winner) {
        const exact = winner.diff === 0;
        const packs = JP_REWARD_CLOSEST.expeditions + (exact ? JP_EXACT_BONUS_EXPEDITIONS : 0);
        await UserService.updateUserMoney(winner.userId, JP_REWARD_CLOSEST.money, 'Juste Prix — gain');
        await LevelingService.giveXpDirectly(client, winner.userId, JP_REWARD_CLOSEST.xp);
        const expeditions = await awardExpeditions(winner.userId, packs);
        await UserService.recordArcadeWin(winner.userId, 'justePrix' as any);
        await GameResultRepository.record('justePrix', winner.userId, 1, { exact, diff: winner.diff, players: ranking.length });
        await ArcadeStatsService.incrementTotalGames('justePrix');

        const participants = ranking.slice(1);
        for (const { userId } of participants) {
          await addFragmentsAndAward(userId, JP_PARTICIPATION_FRAGMENTS).catch(() => {});
        }

        await thread.send({
          content: [
            exact
              ? `🎯 **INCROYABLE !** <@${winner.userId}> a trouvé le nombre EXACT : **${target}** !`
              : `💰 **RÉVÉLATION !** Le nombre était **${target}** — <@${winner.userId}> gagne avec **${winner.value}** (à ${winner.diff} près) !`,
            `🏆 +**${JP_REWARD_CLOSEST.money}** ${rc()} · +**${JP_REWARD_CLOSEST.xp}** XP · +**${packs}** pack${packs > 1 ? 's' : ''} ${expeditions.summary}`,
            ...(participants.length > 0 ? [`🤝 ${participants.length} participant${participants.length > 1 ? 's' : ''} repartent avec **${JP_PARTICIPATION_FRAGMENTS}** fragments chacun !`] : []),
          ].join('\n'),
        }).catch(() => {});

        LogService.success(
          `<@${winner.userId}> gagne le Juste Prix (cible **${target}**, proposé **${winner.value}**)${exact ? ' — EXACT 🎯' : ''}`,
          { feature: LOG_FEATURE, title: '🏆 Gagnant' },
        ).catch(() => {});
      } else {
        await thread.send(`💨 Le nombre était **${target}**… mais personne n'a joué cette fois !`).catch(() => {});
      }
    }

    if (thread?.isThread()) {
      await thread.setLocked(true).catch(() => {});
    }
    await GamesForumService.deleteAnnounce(client, state.announceMessageId);
    await JustePrixRepository.clearActive();
  }
}
