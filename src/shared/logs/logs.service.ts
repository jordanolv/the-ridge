import {
  GuildMember,
  PartialGuildMember,
  User,
  Role,
  GuildChannel,
  VoiceState,
  Message,
  PartialMessage,
  Invite,
  Guild,
  AuditLogEvent,
} from 'discord.js';
import BotLogModel, { LogLevel, MoneyFlow } from './bot-log.model';

interface LogEntry {
  level: LogLevel;
  message: string;
  kind: string;
  feature?: string;
  title?: string;
  userId?: string;
  channelId?: string;
  amount?: number;
  flow?: MoneyFlow;
}

const truncate = (value: string | null | undefined, max = 500): string =>
  !value ? '_vide_' : value.length > max ? `${value.slice(0, max)}…` : value;

export class LogService {
  static async record(entry: LogEntry): Promise<void> {
    try {
      await BotLogModel.create(entry);
    } catch (error) {
      console.error('[LogService] Écriture du log impossible:', error);
    }
  }

  static async info(message: string, options?: { feature?: string; title?: string }): Promise<void> {
    await this.record({ level: 'info', kind: 'app', message, ...options });
  }

  static async success(message: string, options?: { feature?: string; title?: string }): Promise<void> {
    await this.record({ level: 'success', kind: 'app', message, ...options });
  }

  static async warning(message: string, options?: { feature?: string; title?: string }): Promise<void> {
    await this.record({ level: 'warning', kind: 'app', message, ...options });
  }

  static async error(message: string, options?: { feature?: string; title?: string }): Promise<void> {
    await this.record({ level: 'error', kind: 'app', message, ...options });
  }

  static async economy(
    userId: string | null,
    amount: number,
    reason: string,
    feature?: string,
    flow: MoneyFlow = 'mint',
  ): Promise<void> {
    if (amount === 0) return;
    const sign = amount > 0 ? '+' : '';
    await this.record({
      level: 'info',
      kind: 'economy',
      title: reason,
      feature,
      userId: userId ?? undefined,
      amount,
      flow,
      message: `${userId ? `<@${userId}> ` : ''}${sign}${amount} 💰 — ${reason}`,
    });
  }

  /** Mouvements d'argent d'un joueur depuis `since` : de quoi retracer l'évolution de son solde. */
  static async economyMovements(userId: string, since: Date): Promise<{ date: Date; amount: number }[]> {
    const entries = await BotLogModel.find({ kind: 'economy', userId, createdAt: { $gte: since } })
      .select('amount createdAt')
      .lean();
    return entries.map(entry => ({ date: entry.createdAt, amount: entry.amount ?? 0 }));
  }

  static async logMessageEdit(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
    if (!oldMessage.author || oldMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;

    await this.record({
      level: 'warning',
      kind: 'message.edit',
      title: 'Message modifié',
      userId: oldMessage.author.id,
      channelId: oldMessage.channelId,
      message: `<@${oldMessage.author.id}> a modifié un message dans <#${oldMessage.channelId}>\n**Avant** : ${truncate(oldMessage.content)}\n**Après** : ${truncate(newMessage.content)}\n[Voir le message](${newMessage.url})`,
    });
  }

  private static async findMessageDeleter(message: Message | PartialMessage): Promise<string> {
    if (!message.guild || !message.author) return '*inconnu*';
    const authorId = message.author.id;
    try {
      const auditLogs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 });
      const entry = auditLogs.entries.find(
        (e) =>
          e.target?.id === authorId &&
          e.extra?.channel?.id === message.channelId &&
          Date.now() - e.createdTimestamp < 10_000,
      );
      // ponytail: Discord n'écrit rien dans l'audit log quand l'auteur supprime son propre
      // message, et agrège les suppressions d'un même modérateur — d'où la fenêtre de 10s.
      return entry?.executor ? `<@${entry.executor.id}>` : `<@${authorId}> (lui-même)`;
    } catch {
      return '*inconnu*';
    }
  }

  static async logMessageDelete(message: Message | PartialMessage): Promise<void> {
    if (!message.author || message.author.bot) return;

    const attachments = message.attachments.size > 0
      ? `\n**Fichiers** : ${message.attachments.map((a) => a.url).join(', ')}`
      : '';

    const deleter = await this.findMessageDeleter(message);

    await this.record({
      level: 'error',
      kind: 'message.delete',
      title: 'Message supprimé',
      userId: message.author.id,
      channelId: message.channelId,
      message: `Message de <@${message.author.id}> supprimé par ${deleter} dans <#${message.channelId}>\n${truncate(message.content)}${attachments}`,
    });
  }

  static async logMemberJoin(member: GuildMember): Promise<void> {
    const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
    await this.record({
      level: 'success',
      kind: 'member.join',
      title: 'Membre rejoint',
      userId: member.id,
      message: `<@${member.id}> (${member.user.tag}) a rejoint — compte créé il y a ${accountAge} jour(s)`,
    });
  }

  static async logMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
    const roles = member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => `<@&${r.id}>`).join(', ') || '*aucun*';
    await this.record({
      level: 'error',
      kind: 'member.leave',
      title: 'Membre parti',
      userId: member.id,
      message: `**${member.user.tag}** (${member.id}) a quitté le serveur — rôles : ${roles}`,
    });
  }

  static async logMemberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> {
    const changes: string[] = [];

    if (oldMember.nickname !== newMember.nickname) {
      changes.push(`**Surnom** : \`${oldMember.nickname ?? 'aucun'}\` → \`${newMember.nickname ?? 'aucun'}\``);
    }

    const addedRoles = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id) && r.id !== newMember.guild.id);
    const removedRoles = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id) && r.id !== newMember.guild.id);
    if (addedRoles.size > 0) changes.push(`**Rôles ajoutés** : ${addedRoles.map((r) => `<@&${r.id}>`).join(', ')}`);
    if (removedRoles.size > 0) changes.push(`**Rôles retirés** : ${removedRoles.map((r) => `<@&${r.id}>`).join(', ')}`);

    const wasTimedOut = (oldMember as GuildMember).communicationDisabledUntil;
    const isTimedOut = newMember.communicationDisabledUntil;
    if (!wasTimedOut && isTimedOut) {
      changes.push(`**Timeout** : jusqu'à <t:${Math.floor(isTimedOut.getTime() / 1000)}:F>`);
    } else if (wasTimedOut && !isTimedOut) {
      changes.push('**Timeout levé**');
    }

    if (changes.length === 0) return;

    await this.record({
      level: 'info',
      kind: 'member.update',
      title: 'Membre modifié',
      userId: newMember.id,
      message: `<@${newMember.id}> — ${changes.join(' · ')}`,
    });
  }

  static async logUserUpdate(oldUser: User | null, newUser: User): Promise<void> {
    if (!oldUser) return;
    const changes: string[] = [];

    if (oldUser.username !== newUser.username) {
      changes.push(`**Pseudo** : \`${oldUser.username}\` → \`${newUser.username}\``);
    }
    if (oldUser.displayAvatarURL() !== newUser.displayAvatarURL()) {
      changes.push('**Avatar modifié**');
    }

    if (changes.length === 0) return;

    await this.record({
      level: 'info',
      kind: 'user.update',
      title: 'Profil utilisateur modifié',
      userId: newUser.id,
      message: `<@${newUser.id}> — ${changes.join(' · ')}`,
    });
  }

  static async logVoiceMove(oldState: VoiceState, newState: VoiceState): Promise<void> {
    await this.record({
      level: 'info',
      kind: 'voice.move',
      title: 'Déplacement vocal',
      userId: newState.member!.id,
      channelId: newState.channelId ?? undefined,
      message: `<@${newState.member!.id}> : <#${oldState.channelId}> → <#${newState.channelId}>`,
    });
  }

  static async logVoiceStateChange(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const changes: string[] = [];
    const member = newState.member ?? oldState.member;
    if (!member) return;

    if (!oldState.mute && newState.mute) changes.push('🔇 Micro coupé (mute serveur)');
    if (oldState.mute && !newState.mute) changes.push('🎙️ Micro réactivé (unmute serveur)');
    if (!oldState.deaf && newState.deaf) changes.push('🙉 Sourd (deaf serveur)');
    if (oldState.deaf && !newState.deaf) changes.push('👂 Undeaf serveur');
    if (!oldState.selfMute && newState.selfMute) changes.push('🔇 S\'est coupé le micro');
    if (oldState.selfMute && !newState.selfMute) changes.push('🎙️ A réactivé son micro');
    if (!oldState.selfDeaf && newState.selfDeaf) changes.push('🙉 S\'est mis sourd');
    if (oldState.selfDeaf && !newState.selfDeaf) changes.push('👂 S\'est désourendu');
    if (!oldState.streaming && newState.streaming) changes.push('📺 A commencé un stream');
    if (oldState.streaming && !newState.streaming) changes.push('📺 A arrêté le stream');
    if (!oldState.selfVideo && newState.selfVideo) changes.push('📷 A activé la caméra');
    if (oldState.selfVideo && !newState.selfVideo) changes.push('📷 A désactivé la caméra');

    if (changes.length === 0) return;

    await this.record({
      level: 'info',
      kind: 'voice.state',
      title: 'Changement d\'état vocal',
      userId: member.id,
      channelId: newState.channelId ?? undefined,
      message: `<@${member.id}> dans ${newState.channelId ? `<#${newState.channelId}>` : '*aucun salon*'} — ${changes.join(' · ')}`,
    });
  }

  static async logChannelCreate(channel: GuildChannel): Promise<void> {
    await this.record({
      level: 'success',
      kind: 'channel.create',
      title: 'Salon créé',
      channelId: channel.id,
      message: `**${channel.name}** (type ${channel.type}) dans ${channel.parent?.name ?? '*aucune catégorie*'}`,
    });
  }

  static async logChannelDelete(channel: GuildChannel): Promise<void> {
    await this.record({
      level: 'error',
      kind: 'channel.delete',
      title: 'Salon supprimé',
      channelId: channel.id,
      message: `**${channel.name}** (type ${channel.type}) dans ${channel.parent?.name ?? '*aucune catégorie*'}`,
    });
  }

  static async logChannelUpdate(oldChannel: GuildChannel, newChannel: GuildChannel): Promise<void> {
    if (oldChannel.name === newChannel.name) return;
    await this.record({
      level: 'warning',
      kind: 'channel.update',
      title: 'Salon modifié',
      channelId: newChannel.id,
      message: `<#${newChannel.id}> — **Nom** : \`${oldChannel.name}\` → \`${newChannel.name}\``,
    });
  }

  static async logRoleCreate(role: Role): Promise<void> {
    await this.record({
      level: 'success',
      kind: 'role.create',
      title: 'Rôle créé',
      message: `**${role.name}** (${role.hexColor}) — mentionnable : ${role.mentionable ? 'oui' : 'non'}`,
    });
  }

  static async logRoleDelete(role: Role): Promise<void> {
    await this.record({
      level: 'error',
      kind: 'role.delete',
      title: 'Rôle supprimé',
      message: `**${role.name}** (${role.hexColor})`,
    });
  }

  static async logRoleUpdate(oldRole: Role, newRole: Role): Promise<void> {
    const changes: string[] = [];
    if (oldRole.name !== newRole.name) changes.push(`**Nom** : \`${oldRole.name}\` → \`${newRole.name}\``);
    if (oldRole.color !== newRole.color) changes.push(`**Couleur** : \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push('**Permissions modifiées**');

    if (changes.length === 0) return;

    await this.record({
      level: 'warning',
      kind: 'role.update',
      title: 'Rôle modifié',
      message: `<@&${newRole.id}> — ${changes.join(' · ')}`,
    });
  }

  static async logBanAdd(guild: Guild, user: User): Promise<void> {
    let moderator = '*inconnu*';
    let reason = '*aucune*';
    try {
      const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const entry = auditLogs.entries.first();
      if (entry && entry.target?.id === user.id) {
        moderator = `<@${entry.executor?.id}>`;
        reason = entry.reason ?? '*aucune*';
      }
    } catch { /* audit log pas accessible */ }

    await this.record({
      level: 'error',
      kind: 'ban.add',
      title: 'Membre banni',
      userId: user.id,
      message: `**${user.tag}** (${user.id}) banni par ${moderator} — raison : ${reason}`,
    });
  }

  static async logBanRemove(guild: Guild, user: User): Promise<void> {
    let moderator = '*inconnu*';
    try {
      const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 1 });
      const entry = auditLogs.entries.first();
      if (entry && entry.target?.id === user.id) {
        moderator = `<@${entry.executor?.id}>`;
      }
    } catch { /* audit log pas accessible */ }

    await this.record({
      level: 'success',
      kind: 'ban.remove',
      title: 'Bannissement levé',
      userId: user.id,
      message: `**${user.tag}** (${user.id}) débanni par ${moderator}`,
    });
  }

  static async logInviteCreate(invite: Invite): Promise<void> {
    await this.record({
      level: 'info',
      kind: 'invite.create',
      title: 'Invitation créée',
      userId: invite.inviter?.id,
      channelId: invite.channel?.id,
      message: `\`${invite.code}\` par ${invite.inviter ? `<@${invite.inviter.id}>` : '*inconnu*'} sur ${invite.channel ? `<#${invite.channel.id}>` : '*inconnu*'} — expire : ${invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : 'jamais'}, max ${invite.maxUses ?? '∞'} utilisation(s)`,
    });
  }

  static async logInviteDelete(invite: Invite): Promise<void> {
    await this.record({
      level: 'warning',
      kind: 'invite.delete',
      title: 'Invitation supprimée',
      channelId: invite.channel?.id,
      message: `\`${invite.code}\` sur ${invite.channel ? `<#${invite.channel.id}>` : '*inconnu*'}`,
    });
  }
}
