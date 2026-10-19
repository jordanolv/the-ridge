import { EmbedBuilder, TextChannel } from 'discord.js';
import { BotClient } from '../../../bot/client';
import { getGuildId } from '../../../shared/guild';
import { LogService } from '../../../shared/logs/logs.service';
import UserModel from '../../user/models/user.model';
import { LevelingService } from '../../leveling/services/leveling.service';
import { RaidRepository } from '../repositories/raid.repository';
import { UserMountainsRepository } from '../repositories/user-mountains.repository';
import { PeakHuntersConfigRepository } from '../repositories/peak-hunters-config.repository';
import { MountainService } from './mountain.service';
import { RARITY_CONFIG, RAID_RARITY_CONFIG, RAID_COOLDOWN_MS, RAID_AVG_POINTS_FLOOR, RAID_MIN_CONTRIBUTION_RATIO, RAID_HP_BAR_LENGTH, RAID_SPAWN_CHANCE_PER_HOUR, EXPEDITION_TIER_CONFIG } from '../constants/peak-hunters.constants';
import { awardExpeditions } from './expedition.service';
import type { MountainRarity, ExpeditionTier } from '../types/peak-hunters.types';
import type { IRaidDoc } from '../models/raid.model';

const LOG_FEATURE = '⚔️ Raid';
const RAID_RARITY_WEIGHTS: { rarity: Exclude<MountainRarity, 'common'>; weight: number }[] = [
  { rarity: 'rare',      weight: 40 },
  { rarity: 'epic',      weight: 35 },
  { rarity: 'legendary', weight: 25 },
];

export class RaidService {
  // ─── Spawn ────────────────────────────────────────────────────────────────

  static async trySpawnRaid(client: BotClient): Promise<void> {
    const active = await RaidRepository.getActive();
    if (active) return;

    const last = await RaidRepository.getLastCompleted();
    if (last && Date.now() < last.startedAt.getTime() + RAID_COOLDOWN_MS) return;

    if (Math.random() >= RAID_SPAWN_CHANCE_PER_HOUR) return;

    await this.startRaid(client);
  }

  static async startRaid(client: BotClient, forcedMountainId?: string): Promise<IRaidDoc | null> {
    const active = await RaidRepository.getActive();
    if (active) return null;

    const rarity = this.rollRarity();
    const raidConfig = RAID_RARITY_CONFIG[rarity];

    let mountain = forcedMountainId
      ? MountainService.getById(forcedMountainId)
      : null;

    if (!mountain) {
      const pool = MountainService.getAll().filter(m => m.rarity === rarity);
      if (pool.length === 0) return null;
      mountain = pool[Math.floor(Math.random() * pool.length)];
    }

    const avgPoints = await this.computeAvgWeeklyPoints();
    const maxHp = Math.round(avgPoints * raidConfig.hpMultiplier);

    const durationDays = raidConfig.durationDaysMin
      + Math.floor(Math.random() * (raidConfig.durationDaysMax - raidConfig.durationDaysMin + 1));
    const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const raid = await RaidRepository.create({
      mountainId: mountain.id,
      rarity,
      maxHp,
      endsAt,
    });

    const { emoji, label, color } = RARITY_CONFIG[rarity];

    LogService.info(
      `Raid lancé : **${mountain.mountainLabel}** ${emoji} ${label} — ${maxHp} HP — ${durationDays}j`,
      { feature: LOG_FEATURE, title: '⚔️ Nouveau raid' },
    ).catch(() => {});

    const channel = await this.getNotificationChannel(client);
    if (channel) {
      const msg = await channel.send({ embeds: [this.buildProgressEmbed(raid, mountain.mountainLabel, mountain.image, color, emoji, label)] });

      let threadId: string | undefined;
      try {
        const thread = await msg.startThread({
          name: `⚔️ Raid — ${mountain.mountainLabel}`,
          autoArchiveDuration: 10080, // 7 jours
        });
        threadId = thread.id;
        await thread.send(`📣 Le raid sur **${mountain.mountainLabel}** ${emoji} ${label} vient de commencer ! Coordonnez-vous ici pour maximiser vos chances.`);
      } catch {}

      await RaidRepository.setProgressMessage(raid.id, msg.id, channel.id, threadId);
    }

    return raid;
  }

  // ─── Contributions ────────────────────────────────────────────────────────

  static async addContribution(userId: string, points: number): Promise<void> {
    if (points <= 0) return;
    const raid = await RaidRepository.addContribution(userId, points);
    if (!raid) return;

    if (raid.currentHp <= 0 && raid.status === 'active') {
      await RaidRepository.complete(raid.id);
    }
  }

  // ─── Cron tasks ───────────────────────────────────────────────────────────

  static async updateProgressEmbed(client: BotClient): Promise<void> {
    const raid = await RaidRepository.getActive();
    if (!raid?.progressMessageId || !raid.progressChannelId) return;

    const mountain = MountainService.getById(raid.mountainId);
    if (!mountain) return;

    const { emoji, label, color } = RARITY_CONFIG[raid.rarity];

    try {
      const guild = await client.guilds.fetch(getGuildId()).catch(() => null);
      if (!guild) return;
      const channel = await guild.channels.fetch(raid.progressChannelId).catch(() => null);
      if (!channel?.isTextBased()) return;
      const msg = await (channel as TextChannel).messages.fetch(raid.progressMessageId).catch(() => null);
      if (!msg) return;
      await msg.edit({ embeds: [this.buildProgressEmbed(raid, mountain.mountainLabel, mountain.image, color, emoji, label)] });
    } catch {}
  }

  /**
   * Appelé par le cron toutes les 15min.
   * Gère deux cas :
   *   - HP tombés à 0 (status 'completed') → distribue les récompenses
   *   - Deadline dépassée sans finir → fail + éventuelle consolation
   */
  static async checkAndFinalize(client: BotClient): Promise<void> {
    const { default: RaidModel } = await import('../models/raid.model');

    const completedPending = await RaidModel.findOneAndUpdate(
      { status: 'completed' },
      { $set: { status: 'failed' } },
      { new: false },
    );
    if (completedPending) {
      await this.distributeRewards(client, completedPending, false);
      return;
    }

    const active = await RaidRepository.getActive();
    if (!active || Date.now() < active.endsAt.getTime()) return;

    const hpDestroyed = active.maxHp - Math.max(0, active.currentHp);
    const partial = hpDestroyed / active.maxHp >= 0.5;

    const resolved = await RaidRepository.fail(active.id, partial);
    if (!resolved) return;

    await this.distributeRewards(client, resolved, partial);
  }

  static async distributeRewards(client: BotClient, raidDoc: IRaidDoc, isPartial = false): Promise<void> {
    const mountain = MountainService.getById(raidDoc.mountainId);
    if (!mountain) return;

    const { emoji, label, color } = RARITY_CONFIG[raidDoc.rarity];
    const raidConfig = RAID_RARITY_CONFIG[raidDoc.rarity as Exclude<MountainRarity, 'common'>];

    const totalPoints = raidDoc.participants.reduce((sum, p) => sum + p.contributedPoints, 0);
    const avgContrib = raidDoc.participants.length > 0 ? totalPoints / raidDoc.participants.length : 0;
    const minEligible = avgContrib * RAID_MIN_CONTRIBUTION_RATIO;

    const eligible = raidDoc.participants.filter(p => p.contributedPoints >= minEligible);
    const sorted = [...eligible].sort((a, b) => b.contributedPoints - a.contributedPoints);

    const baseXp = isPartial ? Math.round(raidConfig.baseXp * 0.25) : raidConfig.baseXp;
    const baseCoins = isPartial ? Math.round(raidConfig.baseCoins * 0.25) : raidConfig.baseCoins;

    interface RewardLine {
      userId: string;
      pct: number;
      xpGained: number;
      coinsGained: number;
      expeditionsGained: number;
      expeditionTiers: ExpeditionTier[];
      mountainDropped: boolean;
      isNew: boolean;
    }

    const lines: RewardLine[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const pct = totalPoints > 0 ? p.contributedPoints / totalPoints : 0;

      let xpMultiplier = 1;
      if (!isPartial) {
        if (pct > 0.5) xpMultiplier = 3;
        else if (pct > 0.25) xpMultiplier = 2;
      }

      const xpGained = Math.round(baseXp * (1 + pct) * xpMultiplier);
      const coinsGained = Math.round(baseCoins * (1 + pct));
      let expeditionsGained = isPartial
        ? 0
        : 1 + (pct > 0.1 ? 1 : 0) + (i === 0 ? 1 : 0);

      const mountainDropped = !isPartial && Math.random() < Math.min(1, 0.10 + pct);
      let isNew = false;

      await UserModel.findOneAndUpdate(
        { discordId: p.userId },
        { $inc: { 'profil.money': coinsGained } },
      );
      await LogService.economy(p.userId, coinsGained, 'Raid — récompense', 'Peak Hunters');
      await LevelingService.giveXpDirectly(client, p.userId, xpGained);
      let expeditionTiers: ExpeditionTier[] = [];
      if (expeditionsGained > 0) {
        const result = await awardExpeditions(p.userId, expeditionsGained);
        expeditionTiers = result.tiers;
      }

      if (mountainDropped) {
        const unlocked = await UserMountainsRepository.unlock(p.userId, raidDoc.mountainId, raidDoc.rarity as MountainRarity);
        if (!unlocked) {
          const { fragmentsOnDuplicate } = RARITY_CONFIG[raidDoc.rarity as MountainRarity];
          const { expeditionsToAward } = await UserMountainsRepository.addFragments(p.userId, fragmentsOnDuplicate);
          if (expeditionsToAward > 0) {
            const { tiers: fragTiers } = await awardExpeditions(p.userId, expeditionsToAward);
            expeditionTiers = [...expeditionTiers, ...fragTiers];
            expeditionsGained += expeditionsToAward;
          }
        } else {
          isNew = true;
        }
      }

      await RaidRepository.markRewarded(raidDoc.id, p.userId);
      lines.push({ userId: p.userId, pct, xpGained, coinsGained, expeditionsGained, expeditionTiers, mountainDropped, isNew });
    }

    const channel = await this.getNotificationChannel(client);
    if (channel) {
      const embed = await this.buildResultsEmbed(raidDoc, mountain.mountainLabel, mountain.image, color, emoji, label, lines, isPartial, client);
      await channel.send({ embeds: [embed] });
    }

    const status = isPartial ? 'failed_partial' : raidDoc.status;
    LogService.info(
      `Raid terminé (${status}) : **${mountain.mountainLabel}** — ${eligible.length} participants éligibles`,
      { feature: LOG_FEATURE, title: isPartial ? '💀 Raid échoué (partiel)' : '🏆 Raid terminé' },
    ).catch(() => {});
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  static buildHpBar(currentHp: number, maxHp: number): string {
    const depleted = Math.round((1 - Math.max(0, currentHp) / maxHp) * RAID_HP_BAR_LENGTH);
    const remaining = RAID_HP_BAR_LENGTH - depleted;
    return '▓'.repeat(depleted) + '░'.repeat(remaining);
  }

  static formatDuration(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    if (days > 0 && hours > 0) return `${days}j ${hours}h`;
    if (days > 0) return `${days}j`;
    return `${hours}h`;
  }

  private static buildProgressEmbed(
    raid: IRaidDoc,
    mountainLabel: string,
    image: string,
    color: number,
    emoji: string,
    label: string,
  ): EmbedBuilder {
    const hpDestroyed = raid.maxHp - Math.max(0, raid.currentHp);
    const pct = Math.round((hpDestroyed / raid.maxHp) * 100);
    const bar = this.buildHpBar(raid.currentHp, raid.maxHp);
    const timeLeft = this.formatDuration(raid.endsAt.getTime() - Date.now());

    const top = raid.participants.sort((a, b) => b.contributedPoints - a.contributedPoints)[0];
    const topLine = top ? `\`${top.contributedPoints.toLocaleString('fr-FR')} pts\`` : '—';

    return new EmbedBuilder()
      .setColor(color)
      .setTitle(`⚔️ RAID EN COURS — ${mountainLabel}  ${emoji} ${label}`)
      .setDescription(
        `\`${bar}\`  **${pct}%**\n${hpDestroyed.toLocaleString('fr-FR')} / ${raid.maxHp.toLocaleString('fr-FR')} pts détruits — **${raid.participants.length}** participants`,
      )
      .addFields(
        { name: '⏳ Temps restant', value: timeLeft, inline: true },
        { name: '👑 Top contributeur', value: topLine, inline: true },
      )
      .setImage(image)
      .setFooter({ text: '→ Plus tu contribues, plus tu as de chances de décrocher la montagne !  •  Mise à jour toutes les 15 min' });
  }

  private static async buildResultsEmbed(
    raid: IRaidDoc,
    mountainLabel: string,
    image: string,
    color: number,
    emoji: string,
    label: string,
    lines: {
      userId: string;
      pct: number;
      xpGained: number;
      coinsGained: number;
      expeditionsGained: number;
      expeditionTiers: ExpeditionTier[];
      mountainDropped: boolean;
      isNew: boolean;
    }[],
    isPartial: boolean,
    client: BotClient,
  ): Promise<EmbedBuilder> {
    const duration = this.formatDuration(Date.now() - raid.startedAt.getTime());

    const rankLines: string[] = [];
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const l = lines[i];
      const medal = i === 0 ? '👑' : `${i + 1}.`;
      let username = l.userId;
      try {
        const user = await client.users.fetch(l.userId);
        username = user.displayName ?? user.username;
      } catch {}

      const pctStr = `${Math.round(l.pct * 100)}%`;
      const tierEmojis = l.expeditionTiers.map(t => EXPEDITION_TIER_CONFIG[t].emoji).join('');
      const rewards = isPartial
        ? `+${l.coinsGained} 💵  +${l.xpGained} XP`
        : `+${l.coinsGained} 💵  +${l.xpGained} XP  ${tierEmojis}${l.mountainDropped ? (l.isNew ? '  ✅ montagne !' : '  🧩 fragments') : ''}`;

      rankLines.push(`${medal} **${username}** — ${pctStr}  |  ${rewards}`);
    }

    if (lines.length > 10) {
      rankLines.push(`*+ ${lines.length - 10} autres participants…*`);
    }

    const title = isPartial
      ? `💀 RAID ÉCHOUÉ (partiel) — ${mountainLabel}  ${emoji}`
      : `🏆 EXPÉDITION TERMINÉE — ${mountainLabel}  ${emoji}`;

    const description = isPartial
      ? `Le serveur a détruit plus de 50% des HP mais la montagne a résisté.\n**${lines.length} participants** ont reçu des récompenses de consolation.`
      : `La montagne est tombée ! **${lines.length} participants** ont contribué en **${duration}**.`;

    const embed = new EmbedBuilder()
      .setColor(isPartial ? 0xe74c3c : color)
      .setTitle(title)
      .setDescription(description)
      .setImage(image);

    if (rankLines.length > 0) {
      embed.addFields({ name: `${emoji} Classement — ${label}`, value: rankLines.join('\n') });
    }

    if (!isPartial) {
      embed.setFooter({ text: 'Récompenses distribuées selon la contribution' });
    }

    return embed;
  }

  private static rollRarity(): Exclude<MountainRarity, 'common'> {
    const total = RAID_RARITY_WEIGHTS.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * total;
    for (const { rarity, weight } of RAID_RARITY_WEIGHTS) {
      roll -= weight;
      if (roll <= 0) return rarity;
    }
    return 'rare';
  }

  private static async computeAvgWeeklyPoints(): Promise<number> {
    const users = await UserModel.find({ 'stats.lastWeekActivityPoints': { $gt: 0 } }).select('stats.lastWeekActivityPoints');
    if (users.length === 0) return RAID_AVG_POINTS_FLOOR;
    const sum = users.reduce((acc, u) => acc + (u.stats.lastWeekActivityPoints ?? 0), 0);
    return Math.max(RAID_AVG_POINTS_FLOOR, Math.round(sum / users.length));
  }

  private static async getNotificationChannel(client: BotClient): Promise<TextChannel | null> {
    const guild = await client.guilds.fetch(getGuildId()).catch(() => null);
    if (!guild) return null;
    const config = await PeakHuntersConfigRepository.get();
    const channelId = config?.raidChannelId ?? config?.notificationChannelId;
    if (!channelId) return null;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return null;
    return channel as TextChannel;
  }
}
