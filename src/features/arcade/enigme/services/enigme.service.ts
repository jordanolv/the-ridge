import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SeparatorBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from 'discord.js';
import { BotClient } from '../../../../bot/client';
import { getGuildId } from '../../../../shared/guild';
import { todayAtParis } from '../../../../shared/time/day-split';
import { LogService } from '../../../../shared/logs/logs.service';
import { GamesForumService } from '../../../discord/services/games-forum.service';
import { AppConfigService } from '../../../discord/services/app-config.service';
import { UserService } from '../../../user/services/user.service';
import { LevelingService } from '../../../leveling/services/leveling.service';
import { awardExpeditions, addFragmentsAndAward } from '../../../peak-hunters/services/expedition.service';
import { ArcadeStatsService } from '../../services/arcade-stats.service';
import { ArcadeScheduleService } from '../../schedule/services/arcade-schedule.service';
import { GameResultRepository } from '../../results/repositories/game-result.repository';
import { EnigmeRepository } from '../repositories/enigme.repository';
import type { IEnigmeStateDoc, Riddle, Solver } from '../models/enigme-state.model';
import { EnigmeBankService, ENIGME_TYPE_LABELS } from './enigme-bank.service';
import { podiumSolvers, rankSolvers } from './enigme-ranking';
import {
  ENIGME_ACCENT_COLOR,
  ENIGME_BUTTON_ID,
  ENIGME_FINISHED_ACCENT_COLOR,
  ENIGME_HINT_BUTTON_ID,
  ENIGME_MAX_ATTEMPTS,
  ENIGME_MODAL_ID,
  ENIGME_PARTICIPATION_FRAGMENTS,
  ENIGME_PODIUM_REWARDS,
  ENIGME_REVEAL_BUTTON_ID,
  ENIGME_REVEAL_HOUR,
  ENIGME_SOLVER_FRAGMENTS,
  ENIGME_SPAWN_HOUR,
} from '../constants/enigme.constants';
import { rc } from '../../../../shared/economy/currency';

const LOG_FEATURE = '🧩 Énigme';
const MEDALS = ['🥇', '🥈', '🥉'];

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return `${m} min ${String(s).padStart(2, '0')} s`;
  return `${s} s`;
}

export class EnigmeService {
  private static async isEnabled(): Promise<boolean> {
    const appConfig = await AppConfigService.getOrCreateConfig();
    return (appConfig.features.arcade as any)?.enigme?.enabled ?? true;
  }

  private static buildRewardLines(): string[] {
    const podium = ENIGME_PODIUM_REWARDS.map((r, i) => `${MEDALS[i]} **${r.money}** ${rc()} · **${r.xp}** XP · **${r.expeditions}** pack${r.expeditions > 1 ? 's' : ''}`);
    return [
      ...podium,
      `🧠 Bonne réponse hors podium ou avec indice : **${ENIGME_SOLVER_FRAGMENTS}** fragments · tentative : **${ENIGME_PARTICIPATION_FRAGMENTS}** fragments`,
    ];
  }

  private static buildSpawnContainer(riddle: Riddle, endsAt: Date): ContainerBuilder {
    const unix = Math.floor(endsAt.getTime() / 1000);
    const container = new ContainerBuilder()
      .setAccentColor(ENIGME_ACCENT_COLOR)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🧩 ÉNIGME DU JOUR\n-# ${ENIGME_TYPE_LABELS[riddle.type]}`))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        '🔒 **L\'énigme est scellée.** Ouvre-la quand tu es prêt : ton chrono démarre à cet instant, pas avant.',
      ));

    return container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        [
          `Tout se joue en secret. **${ENIGME_MAX_ATTEMPTS}** essais par personne, et un indice si tu le demandes.`,
          `Le podium récompense les **trois meilleurs chronos sans indice**, pas les plus matinaux · révélation <t:${unix}:t> (<t:${unix}:R>)`,
          '',
          ...this.buildRewardLines(),
        ].join('\n'),
      ));
  }

  private static buildRevealRow(disabled = false): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(ENIGME_REVEAL_BUTTON_ID)
        .setLabel("Découvrir l'énigme")
        .setEmoji('🔍')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
    );
  }

  private static buildPlayRow(usedHint: boolean): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(ENIGME_BUTTON_ID)
        .setLabel('Répondre')
        .setEmoji('🧩')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(ENIGME_HINT_BUTTON_ID)
        .setLabel(usedHint ? 'Indice utilisé — hors podium' : "Indice (abandonne le podium)")
        .setEmoji('💡')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(usedHint),
    );
  }

  private static buildRiddleView(state: IEnigmeStateDoc, revealedAt: Date, usedHint: boolean): ContainerBuilder {
    const riddle = state.riddle!;
    const unix = Math.floor(revealedAt.getTime() / 1000);
    const container = new ContainerBuilder()
      .setAccentColor(ENIGME_ACCENT_COLOR)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🧩 ÉNIGME\n-# ${ENIGME_TYPE_LABELS[riddle.type]}`))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(riddle.question));

    if (usedHint) {
      container
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`💡 **Indice :** ${riddle.hint}`));
    }

    return container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        usedHint
          ? `⏱️ Chrono lancé <t:${unix}:R> · 💡 indice pris, tu joues pour les fragments.`
          : `⏱️ Chrono lancé <t:${unix}:R> · l'indice te sort du podium, à toi de voir.`,
      ));
  }

  /** Le podium se joue au chrono personnel, pas à l'ordre d'arrivée. */
  private static podiumSolvers(state: IEnigmeStateDoc): Solver[] {
    return podiumSolvers(state.solvers ?? [], state.startedAt);
  }

  private static rankSolvers(state: IEnigmeStateDoc): Solver[] {
    return rankSolvers(state.solvers ?? [], state.startedAt);
  }

  private static buildResultContainer(state: IEnigmeStateDoc): ContainerBuilder {
    const riddle = state.riddle!;
    const ranked = this.rankSolvers(state);
    const winners = this.podiumSolvers(state);
    const winnerIds = new Set(winners.map((s) => s.userId));
    const podium = winners.map((s, i) => `${MEDALS[i]} <@${s.userId}> · ${formatDuration(s.durationMs)}`);
    const others = ranked.filter((s) => !winnerIds.has(s.userId));
    const triedCount = Object.keys(state.attempts ?? {}).length;

    return new ContainerBuilder()
      .setAccentColor(ENIGME_FINISHED_ACCENT_COLOR)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🧩 ÉNIGME — TERMINÉE\n-# ${ENIGME_TYPE_LABELS[riddle.type]}`))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(riddle.question))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        [
          `✅ La réponse était : **${riddle.answers[0]}**`,
          '',
          ...(podium.length > 0 ? podium : ['💨 Personne n\'a trouvé sans indice cette fois !']),
          ...(others.length > 0 ? [`🧠 et **${others.length}** autre${others.length > 1 ? 's' : ''} ont trouvé (dont ${others.filter((s) => s.usedHint).length} avec l'indice 💡)`] : []),
          `👥 ${triedCount} participant${triedCount > 1 ? 's' : ''}`,
          "-# L'indice fait sortir du podium, mais garde les fragments.",
        ].join('\n'),
      ));
  }

  static async planDay(client: BotClient): Promise<void> {
    const state = await EnigmeRepository.getOrCreate();

    if (state.activeThreadId) await this.resolve(client);
    if (state.nextSpawnAt && state.nextSpawnAt.getTime() > Date.now()) return;

    if (!(await ArcadeScheduleService.isToday(client, 'enigme'))) {
      LogService.info("Pas d'énigme aujourd'hui (planning).", { feature: LOG_FEATURE, title: '🗓️ Planification du jour' }).catch(() => {});
      return;
    }

    const nextSpawnAt = todayAtParis(ENIGME_SPAWN_HOUR);
    await EnigmeRepository.setNextSpawn(nextSpawnAt);
    this.scheduleTimer(nextSpawnAt, () => this.spawn(client));

    const unix = Math.floor(nextSpawnAt.getTime() / 1000);
    LogService.info(`Énigme programmée <t:${unix}:T> (<t:${unix}:R>)`, { feature: LOG_FEATURE, title: '🗓️ Planification du jour' }).catch(() => {});
  }

  static async rehydrate(client: BotClient): Promise<void> {
    const state = await EnigmeRepository.get();
    if (!state) return;

    if (state.activeThreadId && state.endsAt) {
      if (state.endsAt.getTime() <= Date.now()) {
        await this.resolve(client);
        return;
      }
      this.scheduleTimer(state.endsAt, () => this.resolve(client));
      return;
    }

    if (state.nextSpawnAt) {
      if (state.nextSpawnAt.getTime() <= Date.now()) await this.spawn(client);
      else this.scheduleTimer(state.nextSpawnAt, () => this.spawn(client));
    }
  }

  private static scheduleTimer(date: Date, action: () => Promise<void>): void {
    const delay = Math.max(date.getTime() - Date.now(), 0);
    setTimeout(() => {
      action().catch((err) => console.error('[Enigme] timer error:', err));
    }, delay);
  }

  static async spawn(client: BotClient): Promise<void> {
    if (!(await this.isEnabled())) {
      await EnigmeRepository.setNextSpawn(null);
      return;
    }

    const state = await EnigmeRepository.getOrCreate();
    if (state.activeThreadId) return;

    const forumConfig = await GamesForumService.getConfig();
    if (!forumConfig.enigmeThreadId) {
      LogService.warning('Post forum 🧩 Énigme non configuré, énigme annulée (configure le forum des jeux).', { feature: LOG_FEATURE, title: '⚠️ Spawn annulé' }).catch(() => {});
      await EnigmeRepository.setNextSpawn(null);
      return;
    }

    const guild = await client.guilds.fetch(getGuildId()).catch(() => null);
    const post = guild ? await guild.channels.fetch(forumConfig.enigmeThreadId).catch(() => null) : null;
    if (!post?.isThread()) {
      await EnigmeRepository.setNextSpawn(null);
      return;
    }

    const endsAt = todayAtParis(ENIGME_REVEAL_HOUR);
    if (endsAt.getTime() <= Date.now()) {
      await EnigmeRepository.setNextSpawn(null);
      return;
    }

    const riddle = EnigmeBankService.pickRiddle();
    await GamesForumService.setThreadLocked(client, post.id, false);
    const message = await post.send({
      components: [this.buildSpawnContainer(riddle, endsAt), this.buildRevealRow()],
      flags: MessageFlags.IsComponentsV2,
    });
    await GamesForumService.pingInThread(post as ThreadChannel, 'enigme', `Une énigme vient de tomber (${ENIGME_TYPE_LABELS[riddle.type]}) — ton chrono part quand tu l'ouvres, révélation à ${ENIGME_REVEAL_HOUR}h !`);
    const announceMessageId = await GamesForumService.announce(
      client,
      `🧩 **L'énigme du jour est là !** ${ENIGME_TYPE_LABELS[riddle.type]} · révélation à ${ENIGME_REVEAL_HOUR}h → <#${post.id}>`,
    );

    await EnigmeRepository.setActive({ threadId: post.id, messageId: message.id, riddle, endsAt, announceMessageId });
    this.scheduleTimer(endsAt, () => this.resolve(client));

    LogService.info(`Énigme lancée dans <#${post.id}> (${ENIGME_TYPE_LABELS[riddle.type]}, réponse **${riddle.answers[0]}**)`, { feature: LOG_FEATURE, title: '🧩 Spawn' }).catch(() => {});
  }

  static async handleReveal(interaction: ButtonInteraction): Promise<void> {
    const state = await EnigmeRepository.get();
    if (!state?.activeThreadId || !state.riddle || (state.endsAt && state.endsAt.getTime() <= Date.now())) {
      await interaction.reply({ content: "L'énigme est terminée.", flags: MessageFlags.Ephemeral });
      return;
    }

    const userId = interaction.user.id;
    const revealedAt = await EnigmeRepository.revealFor(userId);
    const usedHint = Boolean(state.hintedAt?.[userId]);
    const solved = (state.solvers ?? []).some((s) => s.userId === userId);
    const exhausted = (state.attempts?.[userId] ?? 0) >= ENIGME_MAX_ATTEMPTS;
    const view = this.buildRiddleView(state, revealedAt, usedHint);

    await interaction.reply({
      components: solved || exhausted ? [view] : [view, this.buildPlayRow(usedHint)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }

  static async handleHint(interaction: ButtonInteraction): Promise<void> {
    const state = await EnigmeRepository.get();
    if (!state?.activeThreadId || !state.riddle || (state.endsAt && state.endsAt.getTime() <= Date.now())) {
      await interaction.reply({ content: "L'énigme est terminée.", flags: MessageFlags.Ephemeral });
      return;
    }

    const userId = interaction.user.id;
    await EnigmeRepository.takeHint(userId);
    const revealedAt = state.revealedAt?.[userId] ?? state.startedAt ?? new Date();
    await interaction.update({
      components: [this.buildRiddleView(state, new Date(revealedAt), true), this.buildPlayRow(true)],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  static async handleButton(interaction: ButtonInteraction): Promise<void> {
    const state = await EnigmeRepository.get();
    if (!state?.activeThreadId || !state.riddle || (state.endsAt && state.endsAt.getTime() <= Date.now())) {
      await interaction.reply({ content: "L'énigme est terminée.", flags: MessageFlags.Ephemeral });
      return;
    }

    const userId = interaction.user.id;
    if ((state.solvers ?? []).some((s) => s.userId === userId)) {
      await interaction.reply({ content: '✅ Tu as déjà trouvé, bravo ! Rendez-vous à la révélation.', flags: MessageFlags.Ephemeral });
      return;
    }
    const used = state.attempts?.[userId] ?? 0;
    if (used >= ENIGME_MAX_ATTEMPTS) {
      await interaction.reply({ content: `❌ Tu as épuisé tes ${ENIGME_MAX_ATTEMPTS} essais. Réponse à ${ENIGME_REVEAL_HOUR}h !`, flags: MessageFlags.Ephemeral });
      return;
    }

    const remaining = ENIGME_MAX_ATTEMPTS - used;
    const modal = new ModalBuilder()
      .setCustomId(ENIGME_MODAL_ID)
      .setTitle(`🧩 Ta réponse (${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''})`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('answer')
            .setLabel('Réponse')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Un mot, un nombre, un titre…')
            .setMinLength(1)
            .setMaxLength(80)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
  }

  static async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const state = await EnigmeRepository.get();
    if (!state?.activeThreadId || !state.riddle || (state.endsAt && state.endsAt.getTime() <= Date.now())) {
      await interaction.editReply({ content: "L'énigme est terminée." });
      return;
    }

    const userId = interaction.user.id;
    if ((state.solvers ?? []).some((s) => s.userId === userId)) {
      await interaction.editReply({ content: '✅ Tu as déjà trouvé !' });
      return;
    }
    const used = state.attempts?.[userId] ?? 0;
    if (used >= ENIGME_MAX_ATTEMPTS) {
      await interaction.editReply({ content: `❌ Plus d'essai disponible. Réponse à ${ENIGME_REVEAL_HOUR}h !` });
      return;
    }

    const raw = interaction.fields.getTextInputValue('answer');
    await EnigmeRepository.incrementAttempt(userId);
    if (used === 0) await UserService.recordArcadeAttempt(userId, 'enigme');

    if (!EnigmeBankService.isCorrect(state.riddle, raw)) {
      const left = ENIGME_MAX_ATTEMPTS - used - 1;
      await interaction.editReply({
        content: left > 0
          ? `❌ Ce n'est pas ça. Il te reste **${left}** essai${left > 1 ? 's' : ''}.`
          : `❌ Ce n'est pas ça, et c'était ton dernier essai. Réponse à ${ENIGME_REVEAL_HOUR}h !`,
      });
      return;
    }

    const now = new Date();
    const startedFrom = state.revealedAt?.[userId] ?? state.startedAt ?? now;
    const durationMs = now.getTime() - new Date(startedFrom).getTime();
    const usedHint = Boolean(state.hintedAt?.[userId]);
    await EnigmeRepository.addSolver(userId, now, durationMs, usedHint);
    const elapsed = formatDuration(durationMs);
    await interaction.editReply({
      content: usedHint
        ? `✅ **Trouvé en ${elapsed}**, mais avec l'indice 💡 — hors podium. Tu repars avec **${ENIGME_SOLVER_FRAGMENTS}** fragments à ${ENIGME_REVEAL_HOUR}h.`
        : `✅ **Trouvé en ${elapsed} sans indice 🧠 !** Le podium se joue au chrono, verdict à la révélation de ${ENIGME_REVEAL_HOUR}h.`,
    });

    const guild = await interaction.client.guilds.fetch(getGuildId()).catch(() => null);
    const thread = guild ? await guild.channels.fetch(state.activeThreadId).catch(() => null) : null;
    if (thread?.isThread()) {
      await thread.send(usedHint
        ? `💡 <@${userId}> a trouvé en **${elapsed}**, avec l'indice.`
        : `🧠 <@${userId}> a trouvé en **${elapsed}**, sans indice !`,
      ).catch(() => {});
    }
  }

  static async resolve(client: BotClient): Promise<void> {
    const state = await EnigmeRepository.get();
    if (!state?.activeThreadId || !state.riddle) return;

    const guild = await client.guilds.fetch(getGuildId()).catch(() => null);
    const thread = guild ? await guild.channels.fetch(state.activeThreadId).catch(() => null) : null;
    const solvers = this.rankSolvers(state);
    const solverIds = new Set(solvers.map((s) => s.userId));
    const winners = this.podiumSolvers(state);
    const winnerIds = new Set(winners.map((s) => s.userId));

    const podiumLines: string[] = [];
    for (const [i, solver] of winners.entries()) {
      const reward = ENIGME_PODIUM_REWARDS[i];
      await UserService.updateUserMoney(solver.userId, reward.money, 'Énigme — gain');
      await LevelingService.giveXpDirectly(client, solver.userId, reward.xp);
      const expeditions = await awardExpeditions(solver.userId, reward.expeditions);
      await GameResultRepository.record('enigme', solver.userId, i + 1, { timeMs: solver.durationMs, type: state.riddle.type, players: Object.keys(state.attempts ?? {}).length });
      podiumLines.push(`${MEDALS[i]} <@${solver.userId}> · ${formatDuration(solver.durationMs)} · +${reward.money} ${rc()} · +${reward.xp} XP · +${reward.expeditions} pack${reward.expeditions > 1 ? 's' : ''} ${expeditions.summary}`);
    }
    for (const solver of solvers.filter((s) => !winnerIds.has(s.userId))) {
      await addFragmentsAndAward(solver.userId, ENIGME_SOLVER_FRAGMENTS).catch(() => {});
    }
    for (const userId of Object.keys(state.attempts ?? {})) {
      if (!solverIds.has(userId)) await addFragmentsAndAward(userId, ENIGME_PARTICIPATION_FRAGMENTS).catch(() => {});
    }
    if (winners[0]) await UserService.recordArcadeWin(winners[0].userId, 'enigme');
    await ArcadeStatsService.incrementTotalGames('enigme');

    if (thread?.isThread()) {
      if (state.activeMessageId) {
        const mainMessage = await thread.messages.fetch(state.activeMessageId).catch(() => null);
        await mainMessage?.edit({ components: [this.buildResultContainer(state)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
      }
      const others = solvers.length - winners.length;
      await thread.send({
        content: [
          `🧩 **RÉVÉLATION !** La réponse était **${state.riddle.answers[0]}**.`,
          ...(podiumLines.length > 0 ? podiumLines : ['💨 Personne n\'a trouvé cette fois… à la prochaine !']),
          ...(others > 0 ? [`🧠 ${others} autre${others > 1 ? 's' : ''} ont trouvé et repartent avec **${ENIGME_SOLVER_FRAGMENTS}** fragments.`] : []),
        ].join('\n'),
      }).catch(() => {});
      await thread.setLocked(true).catch(() => {});
    }

    await GamesForumService.deleteAnnounce(client, state.announceMessageId);
    await EnigmeRepository.clearActive();

    LogService.success(
      `Énigme terminée (réponse **${state.riddle.answers[0]}**) — ${solvers.length} bonne${solvers.length > 1 ? 's' : ''} réponse${solvers.length > 1 ? 's' : ''}, ${Object.keys(state.attempts ?? {}).length} participant(s).`,
      { feature: LOG_FEATURE, title: '🏁 Révélation' },
    ).catch(() => {});
  }
}
