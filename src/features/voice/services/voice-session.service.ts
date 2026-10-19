import { ChannelType, TextChannel, VoiceState, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import { BotClient } from '../../../bot/client';
import { getGuildId } from '../../../shared/guild';
import { LogService } from '../../../shared/logs/logs.service';
import { BotEventBus } from '../../../shared/events/bot-event-bus';
import { splitSessionByDay, toParisDayYMD, type DayChunk } from '../../../shared/time/day-split';
import '../events/voice.events';
import type { VoiceTickSession } from '../events/voice.events';
import { VoiceConfigRepository } from '../repositories/voice-config.repository';
import { VoiceSessionRepository } from '../repositories/voice-session.repository';
import { VOICE_XP_PER_MINUTE, VOICE_MIN_RECAP_SECONDS } from '../constants/voice.constants';
import { estimateWeeklySalary, SalaryEstimate } from '../../../shared/economy/salary-estimate';
import UserModel from '../../user/models/user.model';
import { LevelingService } from '../../leveling/services/leveling.service';
import { rc } from '../../../shared/economy/currency';

// ─── Plugin contract ────────────────────────────────────────────────────────

export interface ActivePeriod {
  startedAt: number;
  endedAt: number;
}

export interface VoiceSession {
  userId: string;
  channelId: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  activeSeconds: number;
  activePeriods: ActivePeriod[];
}

/**
 * Seule méthode restante: onBeforeChannelCreate (sync, retourne le nom/prefix du channel).
 * Tout le reste (session start/end, channel created/deleted, tick) passe par le BotEventBus.
 */
export interface VoicePlugin {
  init?(): Promise<void>;
  onBeforeChannelCreate?(userId: string): {
    templateVars?: Record<string, string>;
    metadata?: Record<string, unknown>;
    channelNamePrefix?: string;
  };
}

// ─── Internal session ───────────────────────────────────────────────────────

interface InternalSession {
  startedAt: number;
  channelId: string;
  channelName: string;
  activePeriods: ActivePeriod[];
  currentActiveStart: number | null;
  /** Cumul des secondes actives (utilisé après réhydratation quand activePeriods est vide) */
  totalActiveSeconds?: number;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class VoiceSessionService {
  private static plugins: VoicePlugin[] = [];
  private static sessions = new Map<string, InternalSession>();
  private static channelCreatedAt = new Map<string, number>();

  static registerPlugin(plugin: VoicePlugin): void {
    this.plugins.push(plugin);
    plugin.init?.().catch(err => console.error('[VoiceSessionService] Plugin init error:', err));
  }

  // ─── Voice state helpers ──────────────────────────────────────────────────

  static isTrackableChannel(state: VoiceState): boolean {
    if (!state.channelId) return false;
    const type = state.channel?.type;
    if (type === undefined || type === null) return true;
    return type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice;
  }

  private static isActiveState(state: VoiceState): boolean {
    return !state.selfMute && !state.selfDeaf && !state.serverMute && !state.serverDeaf && !state.suppress;
  }

  // ─── Session lifecycle ────────────────────────────────────────────────────

  private static async startSession(userId: string, channelId: string, channelName: string, active: boolean, _client: BotClient): Promise<void> {
    const now = Date.now();
    const session: InternalSession = {
      startedAt: now,
      channelId,
      channelName,
      activePeriods: [],
      currentActiveStart: active ? now : null,
    };
    this.sessions.set(userId, session);

    await VoiceSessionRepository.upsert({
      userId,
      guildId: getGuildId(),
      channelId,
      channelName,
      startedAt: new Date(session.startedAt),
      totalActiveSeconds: 0,
      activePeriods: [],
      currentActiveStart: session.currentActiveStart ? new Date(session.currentActiveStart) : null,
    });
    console.log(`[VoiceSession] Session démarrée: user=${userId} channel=${channelId} active=${active}`);

    BotEventBus.emit('voice:session:started', {
      userId,
      channelId,
      channelName,
      startedAt: new Date(session.startedAt),
    });
  }

  private static endSession(userId: string): (VoiceSession & { channelName: string }) | null {
    const session = this.sessions.get(userId);
    if (!session) return null;

    this.sessions.delete(userId);
    const now = Date.now();

    if (session.currentActiveStart !== null) {
      session.activePeriods.push({ startedAt: session.currentActiveStart, endedAt: now });
      session.currentActiveStart = null;
    }

    const durationSeconds = Math.floor((now - session.startedAt) / 1000);
    const periodsSeconds = session.activePeriods.reduce(
      (acc, p) => acc + Math.floor((p.endedAt - p.startedAt) / 1000),
      0,
    );
    const currentPeriodSeconds = session.currentActiveStart !== null
      ? Math.floor((now - session.currentActiveStart) / 1000)
      : 0;
    const activeSeconds = (session.totalActiveSeconds ?? 0) + periodsSeconds + currentPeriodSeconds;

    VoiceSessionRepository.deleteByUserId(userId).catch(err =>
      console.error('[VoiceSession] Erreur suppression session DB:', err),
    );
    console.log(`[VoiceSession] Session terminée: user=${userId} durée=${durationSeconds}s actif=${activeSeconds}s`);

    return {
      userId,
      channelId: session.channelId,
      channelName: session.channelName,
      startedAt: session.startedAt,
      endedAt: now,
      durationSeconds,
      activeSeconds,
      activePeriods: session.activePeriods,
    };
  }

  private static async pauseSession(userId: string, session: InternalSession): Promise<void> {
    if (session.currentActiveStart === null) return;
    const now = Date.now();
    session.activePeriods.push({ startedAt: session.currentActiveStart, endedAt: now });
    session.currentActiveStart = null;

    await VoiceSessionRepository.upsert({
      userId,
      guildId: getGuildId(),
      channelId: session.channelId,
      channelName: session.channelName,
      startedAt: new Date(session.startedAt),
      totalActiveSeconds: session.totalActiveSeconds ?? 0,
      activePeriods: this.serializePeriods(session),
      currentActiveStart: null,
    });
  }

  private static async resumeSession(userId: string, session: InternalSession): Promise<void> {
    if (session.currentActiveStart !== null) return;
    const now = Date.now();
    session.currentActiveStart = now;

    await VoiceSessionRepository.upsert({
      userId,
      guildId: getGuildId(),
      channelId: session.channelId,
      channelName: session.channelName,
      startedAt: new Date(session.startedAt),
      totalActiveSeconds: session.totalActiveSeconds ?? 0,
      activePeriods: this.serializePeriods(session),
      currentActiveStart: new Date(now),
    });
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  static async handleJoin(client: BotClient, _oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (newState.member?.user.bot || !newState.channelId) return;
    if (!this.isTrackableChannel(newState)) return;

    const userId = newState.member!.user.id;
    const active = this.isActiveState(newState);
    const channelName = newState.channel?.name ?? newState.channelId;

    await this.startSession(userId, newState.channelId, channelName, active, client);

    const vocConfig = await VoiceConfigRepository.get();
    const isJoinChannel = vocConfig?.joinChannels.some(c => c.id === newState.channelId);

    if (!isJoinChannel) {
      const username = newState.member?.user.username ?? userId;
      LogService.info(`<@${userId}> (**${username}**) a rejoint **${channelName}**`, {
        feature: 'voice',
        title: '🎙️ Session vocale démarrée',
      });
    }

    if (!vocConfig?.enabled) return;

    const joinChannel = vocConfig.joinChannels.find(c => c.id === newState.channelId);
    if (joinChannel) {
      await this.createUserChannel(client, newState, joinChannel);
    }
  }

  static async handleLeave(client: BotClient, oldState: VoiceState, _newState: VoiceState): Promise<void> {
    if (oldState.member?.user.bot || !oldState.channelId) return;
    if (!this.isTrackableChannel(oldState)) return;

    const userId = oldState.member!.user.id;
    const channelId = oldState.channelId;

    const vocConfig = await VoiceConfigRepository.get();
    const isJoinChannel = vocConfig?.joinChannels.some(c => c.id === channelId);

    const session = this.endSession(userId);
    if (session) {
      if (!isJoinChannel) {
        const username = oldState.member?.user.username ?? userId;
        const duration = this.formatDuration(session.durationSeconds);
        const active = this.formatDuration(session.activeSeconds);
        LogService.info(`<@${userId}> (**${username}**) a quitté **${session.channelName}** — durée : ${duration} (actif : ${active})`, {
          feature: 'voice',
          title: '🔇 Session vocale terminée',
        });
      }

      BotEventBus.emit('voice:session:ended', {
        userId: session.userId,
        channelId: session.channelId,
        channelName: session.channelName,
        startedAt: new Date(session.startedAt),
        endedAt: new Date(session.endedAt),
        totalSeconds: session.durationSeconds,
        activeSeconds: session.activeSeconds,
        byDay: this.buildByDay(session.activePeriods),
      });

      await this.processSessionRewards(client, session, isJoinChannel);
    }

    if (!vocConfig?.enabled || !vocConfig.createdChannels.includes(channelId)) return;

    const channel = oldState.channel;
    if (channel && channel.members.size === 0) {
      try {
        await channel.delete();
        BotEventBus.emit('voice:channel:deleted', { channelId });
        this.channelCreatedAt.delete(channelId);
        await VoiceConfigRepository.removeCreatedChannel(channelId);
        console.log(`[VoiceSession] Canal supprimé: ${channel.name}`);
      } catch (err) {
        console.error('[VoiceSession] Erreur suppression canal:', err);
      }
    }
  }

  static async handleVoiceStateChange(oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (newState.member?.user.bot) return;

    const userId = newState.id;
    const session = this.sessions.get(userId);
    if (!session) return;

    if (oldState.channelId !== newState.channelId && newState.channelId) {
      session.channelId = newState.channelId;
      session.channelName = newState.channel?.name ?? newState.channelId;
      await VoiceSessionRepository.upsert({
        userId,
        guildId: getGuildId(),
        channelId: session.channelId,
        channelName: session.channelName,
        startedAt: new Date(session.startedAt),
        totalActiveSeconds: session.totalActiveSeconds ?? 0,
        activePeriods: this.serializePeriods(session),
        currentActiveStart: session.currentActiveStart ? new Date(session.currentActiveStart) : null,
      }).catch(() => {});
    }

    const wasActive = this.isActiveState(oldState);
    const isActive = this.isActiveState(newState);

    if (wasActive && !isActive) {
      await this.pauseSession(userId, session);
    } else if (!wasActive && isActive) {
      await this.resumeSession(userId, session);
    }
  }

  // ─── Rehydration ──────────────────────────────────────────────────────────

  static async rehydrate(client: BotClient): Promise<void> {
    const guild = client.guilds.cache.get(getGuildId());
    if (!guild) return;

    const states = Array.from(guild.voiceStates.cache.values()).filter(state =>
      state.channelId && !state.member?.user.bot && this.isTrackableChannel(state),
    );

    const results = await Promise.all(
      states.map(state => this.rehydrateOne(client, state).catch(err => {
        console.error('[VoiceSession] Erreur réhydratation:', err);
        return false;
      })),
    );

    const count = results.filter(Boolean).length;
    if (count > 0) {
      console.log(`[VoiceSession] ${count} session(s) réhydratée(s)`);
    }
  }

  private static async rehydrateOne(client: BotClient, state: VoiceState): Promise<boolean> {
    if (!state.channelId) return false;

    const userId = state.id;
    const active = this.isActiveState(state);
    const channelName = state.channel?.name ?? state.channelId;

    const persisted = await VoiceSessionRepository.getByUserId(userId);
    const now = Date.now();
    const guildId = getGuildId();

    if (persisted) {
      const startedAt = persisted.startedAt.getTime();
      const activePeriods: ActivePeriod[] = (persisted.activePeriods ?? []).map(p => ({
        startedAt: p.startedAt.getTime(),
        endedAt: p.endedAt.getTime(),
      }));
      if (persisted.currentActiveStart) {
        activePeriods.push({ startedAt: persisted.currentActiveStart.getTime(), endedAt: now });
      }
      const legacySeconds = persisted.totalActiveSeconds ?? 0;
      const currentActiveStart = active ? now : null;
      const session: InternalSession = {
        startedAt,
        channelId: state.channelId,
        channelName,
        activePeriods,
        currentActiveStart,
        totalActiveSeconds: legacySeconds,
      };
      this.sessions.set(userId, session);
      await VoiceSessionRepository.upsert({
        userId,
        guildId,
        channelId: state.channelId,
        channelName,
        startedAt: new Date(startedAt),
        totalActiveSeconds: legacySeconds,
        activePeriods: this.serializePeriods(session),
        currentActiveStart: currentActiveStart ? new Date(currentActiveStart) : null,
      });
      console.log(
        `[VoiceSession] Réhydratée: ${state.member?.user.tag || userId} ` +
        `channel=${channelName} active=${active} (timer préservé)`,
      );
    } else {
      await this.startSession(userId, state.channelId, channelName, active, client);
      console.log(
        `[VoiceSession] Réhydratée: ${state.member?.user.tag || userId} ` +
        `channel=${channelName} active=${active}`,
      );
    }
    return true;
  }

  // ─── Session rewards & recap ──────────────────────────────────────────────

  private static async processSessionRewards(
    client: BotClient,
    session: VoiceSession & { channelName: string },
    skipRecapEmbed: boolean = false,
  ): Promise<void> {
    const activeMinutes = Math.floor(session.activeSeconds / 60);
    const xpGained = activeMinutes * VOICE_XP_PER_MINUTE;

    let leveledUp = false;
    let newLevel = 0;

    // Le vocal ne verse plus d'argent : la seule source est la paie du lundi (economy.md §3).
    if (xpGained > 0) {
      try {
        const user = await UserModel.findOne({ discordId: session.userId });
        if (user) {
          const oldLevel = user.profil.lvl;
          user.profil.exp += xpGained;

          while (user.profil.exp >= LevelingService.getXpToLevelUp(user.profil.lvl)) {
            user.profil.lvl++;
          }

          await user.save();
          leveledUp = user.profil.lvl > oldLevel;
          newLevel = user.profil.lvl;
          if (leveledUp) {
            await LogService.info(`<@${session.userId}> passe niveau **${newLevel}**`, { feature: 'leveling', title: 'Level up' });
          }
        }
      } catch (err) {
        console.error('[VoiceSession] Erreur mise à jour récompenses:', err);
      }
    }

    if (!skipRecapEmbed && session.activeSeconds >= VOICE_MIN_RECAP_SECONDS) {
      const salary = await estimateWeeklySalary(session.userId).catch(() => null);
      await this.sendSessionRecap(client, session, {
        xpGained,
        pointsGained: session.activeSeconds,
        salary,
        leveledUp,
        newLevel,
      });
    }
  }

  private static serializePeriods(session: InternalSession): { startedAt: Date; endedAt: Date }[] {
    return session.activePeriods.map(p => ({
      startedAt: new Date(p.startedAt),
      endedAt: new Date(p.endedAt),
    }));
  }

  private static buildByDay(periods: ActivePeriod[]): DayChunk[] {
    const totals = new Map<string, number>();
    for (const period of periods) {
      const chunks = splitSessionByDay(new Date(period.startedAt), new Date(period.endedAt));
      for (const chunk of chunks) {
        totals.set(chunk.dateYMD, (totals.get(chunk.dateYMD) ?? 0) + chunk.seconds);
      }
    }
    return Array.from(totals.entries()).map(([dateYMD, seconds]) => ({ dateYMD, seconds }));
  }

  private static async sendSessionRecap(
    client: BotClient,
    session: VoiceSession & { channelName: string },
    rewards: {
      xpGained: number;
      pointsGained: number;
      salary: SalaryEstimate | null;
      leveledUp: boolean;
      newLevel: number;
    },
  ): Promise<void> {


    const vocConfig = await VoiceConfigRepository.get();
    console.log(`[VoiceSession] sendSessionRecap — notificationChannelId=${vocConfig?.notificationChannelId}`);
    if (!vocConfig?.notificationChannelId) return;

    const guild = await client.guilds.fetch(getGuildId()).catch(() => null);
    console.log(`[VoiceSession] sendSessionRecap — guild=${guild?.id}`);
    if (!guild) return;

    const channel = await guild.channels.fetch(vocConfig.notificationChannelId).catch(() => null);
    console.log(`[VoiceSession] sendSessionRecap — channel=${channel?.id} isTextBased=${channel?.isTextBased()}`);
    if (!channel?.isTextBased()) return;

    const member = await guild.members.fetch(session.userId).catch(() => null);
    const displayName = member?.displayName ?? member?.user.username ?? `<@${session.userId}>`;

    const startTimestamp = Math.floor(session.startedAt / 1000);
    const endTimestamp = Math.floor(session.endedAt / 1000);
    const duration = this.formatDuration(session.durationSeconds);
    const activeDuration = this.formatDuration(session.activeSeconds);

    let rewardLines = `+**${rewards.xpGained}** XP ✨  ·  +**${rewards.pointsGained.toLocaleString('fr-FR')}** pts d'activité 📊`;
    if (rewards.salary) {
      const { rank, qualified, estimate } = rewards.salary;
      rewardLines += `\n-# ${rank}ᵉ/${qualified} cette semaine · ≈ **${estimate.toLocaleString('fr-FR')}** ${rc()} lundi`;
    }
    if (rewards.leveledUp) rewardLines += `\n🎉 **Level up !** Niveau **${rewards.newLevel}**`;

    const container = new ContainerBuilder()
      .setAccentColor(0x5865f2)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### 🔇 ${displayName} a quitté **${session.channelName}**`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `⏰ <t:${startTimestamp}:t> → <t:${endTimestamp}:t>  ·  ⏱️ ${duration} (actif : ${activeDuration})`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(rewardLines),
      );

    try {
      await (channel as TextChannel).send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      console.error('[VoiceSession] Erreur envoi recap:', err);
    }
  }

  // ─── Read-only API ────────────────────────────────────────────────────────

  static getActiveSessionsSnapshot(): VoiceTickSession[] {
    const now = new Date();
    const nowMs = now.getTime();
    const todayYMD = toParisDayYMD(now);
    const startedAtYMD = (ts: number) => toParisDayYMD(new Date(ts));
    const snapshot: VoiceTickSession[] = [];

    for (const [userId, s] of this.sessions) {
      const periodsSeconds = s.activePeriods.reduce(
        (acc, p) => acc + Math.floor((p.endedAt - p.startedAt) / 1000),
        0,
      );
      const currentPeriodSeconds = s.currentActiveStart !== null
        ? Math.floor((nowMs - s.currentActiveStart) / 1000)
        : 0;
      const activeSecondsSoFar = (s.totalActiveSeconds ?? 0) + periodsSeconds + currentPeriodSeconds;

      let activeSecondsTodayParis = 0;
      if (startedAtYMD(s.startedAt) === todayYMD) {
        activeSecondsTodayParis += s.totalActiveSeconds ?? 0;
      }
      for (const p of s.activePeriods) {
        for (const chunk of splitSessionByDay(new Date(p.startedAt), new Date(p.endedAt))) {
          if (chunk.dateYMD === todayYMD) activeSecondsTodayParis += chunk.seconds;
        }
      }
      if (s.currentActiveStart !== null) {
        for (const chunk of splitSessionByDay(new Date(s.currentActiveStart), now)) {
          if (chunk.dateYMD === todayYMD) activeSecondsTodayParis += chunk.seconds;
        }
      }

      snapshot.push({
        userId,
        channelId: s.channelId,
        sessionStartedAt: new Date(s.startedAt),
        activeSecondsSoFar,
        activeSecondsTodayParis,
      });
    }
    return snapshot;
  }

  // ─── Tick loop ────────────────────────────────────────────────────────────

  private static tickIntervalHandle: NodeJS.Timeout | null = null;
  private static readonly TICK_INTERVAL_MS = 60_000;

  static startTickLoop(): void {
    if (this.tickIntervalHandle !== null) return;
    this.tickIntervalHandle = setInterval(() => {
      BotEventBus.emit('voice:tick', {
        tickAt: new Date(),
        sessions: this.getActiveSessionsSnapshot(),
      });
    }, this.TICK_INTERVAL_MS);
  }

  static stopTickLoop(): void {
    if (this.tickIntervalHandle === null) return;
    clearInterval(this.tickIntervalHandle);
    this.tickIntervalHandle = null;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private static formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours}h` : `${hours}h${rest.toString().padStart(2, '0')}`;
  }

  private static async createUserChannel(
    _client: BotClient,
    newState: VoiceState,
    joinChannel: { id: string; category: string; nameTemplate: string },
  ): Promise<void> {
    const username = newState.member?.user.username ?? 'Utilisateur';
    const userId = newState.member!.user.id;

    const metadata: Record<string, unknown> = {};
    const extraVars: Record<string, string> = {};
    const channelNamePrefixes: string[] = [];

    for (const plugin of this.plugins) {
      try {
        const result = plugin.onBeforeChannelCreate?.(userId);
        if (result) {
          if (result.channelNamePrefix) channelNamePrefixes.push(result.channelNamePrefix);
          Object.assign(extraVars, result.templateVars ?? {});
          Object.assign(metadata, result.metadata ?? {});
        }
      } catch {}
    }

    const streak = await VoiceConfigRepository.getAndUpdateStreak();

    let channelName = (joinChannel.nameTemplate ?? '{mountain} #{count}')
      .replace('{username}', username)
      .replace('{user}', username)
      .replace('{count}', streak.toString())
      .replace('{total}', streak.toString());

    for (const [key, value] of Object.entries(extraVars)) {
      channelName = channelName.replace(`{${key}}`, value);
    }

    if (channelNamePrefixes.length > 0) {
      channelName = `${channelNamePrefixes.join(' ')} ${channelName}`.trim();
    }

    if (channelName.length > 100) {
      channelName = channelName.slice(0, 100);
    }

    try {
      const newChannel = await newState.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: joinChannel.category,
      });

      if (newState.member?.voice.channel) {
        await newState.member.voice.setChannel(newChannel).catch(err => {
          console.error('[VoiceSession] Erreur déplacement utilisateur:', err);
        });
      }

      await VoiceConfigRepository.addCreatedChannel(newChannel.id);
      this.channelCreatedAt.set(newChannel.id, Date.now());

      BotEventBus.emit('voice:channel:created', {
        channel: newChannel,
        userId,
        metadata,
      });

      console.log(`[VoiceSession] Canal créé: ${newChannel.name} pour ${username}`);
    } catch (err) {
      console.error('[VoiceSession] Erreur création canal:', err);
    }
  }
}

