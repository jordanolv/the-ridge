import {
  Client,
  GuildMember,
  Role,
  TextChannel,
  ChannelType,
  PermissionsBitField
} from 'discord.js';
import { UserRepository } from '../../user/services/user.repository';
import { getGuildId } from '../../../shared/guild';

export class AdminService {

  // ===== CHANNEL CONFIGURATION =====
  async setBirthdayChannel(client: Client, channelId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const validation = await this.validateChannel(client, channelId);
      if (!validation.isValid) {
        return { success: false, message: validation.error! };
      }

      const userRepo = new UserRepository();
      await userRepo.updateBirthdayConfig({ channel: channelId, enabled: true });
      
      return {
        success: true,
        message: `✅ Canal d'anniversaires configuré : <#${channelId}>`
      };
    } catch (error) {
      console.error('Error setting birthday channel:', error);
      return {
        success: false,
        message: '❌ Erreur lors de la configuration du canal d\'anniversaires'
      };
    }
  }

  // ===== ROLE MANAGEMENT =====
  async assignRoleToUsersWithRoles(
    client: Client,
    targetRoleId: string,
    requiredRoleIds: string[]
  ): Promise<{
    success: boolean;
    message: string;
    stats?: {
      processed: number;
      assigned: number;
      errors: number;
    };
  }> {
    try {
      const guild = client.guilds.cache.get(getGuildId());
      if (!guild) {
        return { success: false, message: '❌ Serveur non trouvé' };
      }

      const targetRole = guild.roles.cache.get(targetRoleId);
      if (!targetRole) {
        return { success: false, message: '❌ Rôle cible non trouvé' };
      }

      const requiredRoles = requiredRoleIds.map(id => guild.roles.cache.get(id)).filter(Boolean) as Role[];
      if (requiredRoles.length !== requiredRoleIds.length) {
        return { success: false, message: '❌ Un ou plusieurs rôles requis non trouvés' };
      }

      const botMember = guild.members.me;
      if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return { success: false, message: '❌ Le bot n\'a pas la permission de gérer les rôles' };
      }

      if (targetRole.position >= botMember.roles.highest.position) {
        return { success: false, message: '❌ Le rôle cible est trop élevé dans la hiérarchie' };
      }

      await guild.members.fetch();

      let processed = 0;
      let assigned = 0;
      let errors = 0;

      for (const [, member] of guild.members.cache) {
        if (member.user.bot) continue;
        processed++;

        try {
          if (member.roles.cache.has(targetRoleId)) continue;

          const hasRequiredRole = requiredRoles.some(role => member.roles.cache.has(role.id));
          
          if (hasRequiredRole) {
            await member.roles.add(targetRole);
            assigned++;
          }
        } catch (error) {
          console.error(`Error assigning role to ${member.user.tag}:`, error);
          errors++;
        }
      }

      return {
        success: true,
        message: `✅ Attribution terminée : ${assigned} membres ont reçu le rôle ${targetRole.name}`,
        stats: { processed, assigned, errors }
      };
    } catch (error) {
      console.error('Error in role assignment:', error);
      return {
        success: false,
        message: '❌ Erreur lors de l\'attribution des rôles'
      };
    }
  }

  private async validateChannel(client: Client, channelId: string): Promise<{
    isValid: boolean;
    error?: string;
    channel?: TextChannel;
  }> {
    try {
      const guild = client.guilds.cache.get(getGuildId());
      if (!guild) {
        return { isValid: false, error: '❌ Serveur non trouvé' };
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        return { isValid: false, error: '❌ Canal non trouvé' };
      }

      if (channel.type !== ChannelType.GuildText) {
        return { isValid: false, error: '❌ Le canal doit être un canal textuel' };
      }

      const textChannel = channel as TextChannel;
      const botMember = guild.members.me;
      
      if (!botMember || !textChannel.permissionsFor(botMember)?.has([
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.EmbedLinks
      ])) {
        return { 
          isValid: false, 
          error: '❌ Le bot n\'a pas les permissions nécessaires dans ce canal' 
        };
      }

      return { isValid: true, channel: textChannel };
    } catch (error) {
      console.error('Error validating channel:', error);
      return { isValid: false, error: '❌ Erreur lors de la validation du canal' };
    }
  }

  static hasManageGuildPermission(member: GuildMember): boolean {
    return member.permissions.has(PermissionsBitField.Flags.ManageGuild);
  }

  static hasManageRolesPermission(member: GuildMember): boolean {
    return member.permissions.has(PermissionsBitField.Flags.ManageRoles);
  }
}
