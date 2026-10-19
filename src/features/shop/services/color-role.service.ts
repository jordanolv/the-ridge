import { Guild, GuildFeature, GuildMember, Role, type RoleColorsResolvable } from 'discord.js';
import type { ShopVariant } from '../catalog';
import { ColorRoleRepository } from '../repositories/color-role.repository';

const ROLE_PREFIX = '🎨 ';
const MAX_ROLE_NAME = 100;

function roleName(member: GuildMember): string {
  return `${ROLE_PREFIX}${member.displayName}`.slice(0, MAX_ROLE_NAME);
}

/** Les anciens rôles partagés (`🎨 Écarlate`…) portent le même préfixe et sont retirés au passage. */
function isColorRole(role: Role): boolean {
  return role.name.startsWith(ROLE_PREFIX);
}

export function supportsGradient(guild: Guild): boolean {
  return guild.features.includes(GuildFeature.EnhancedRoleColors);
}

function roleColors(guild: Guild, variant: ShopVariant): RoleColorsResolvable {
  return {
    primaryColor: variant.color,
    secondaryColor: supportsGradient(guild) ? variant.secondaryColor : undefined,
  };
}

async function findPersonalRole(guild: Guild, userId: string): Promise<Role | null> {
  const roleId = await ColorRoleRepository.findRoleId(userId);
  if (!roleId) return null;
  return guild.roles.fetch(roleId).catch(() => null);
}

async function upsertPersonalRole(member: GuildMember, variant: ShopVariant): Promise<Role> {
  const { guild } = member;
  const colors = roleColors(guild, variant);
  const existing = await findPersonalRole(guild, member.id);
  if (existing) return existing.edit({ name: roleName(member), colors, reason: 'Boutique — rôle coloré' });

  const botHighest = guild.members.me?.roles.highest.position;
  const role = await guild.roles.create({
    name: roleName(member),
    colors,
    permissions: [],
    position: botHighest ? botHighest - 1 : undefined,
    reason: 'Boutique — rôle coloré',
  });
  await ColorRoleRepository.save(member.id, role.id);
  return role;
}

export class ColorRoleService {
  /** Un rôle perso par joueur, recoloré à chaque achat plutôt que recréé. */
  static async apply(member: GuildMember, variant: ShopVariant): Promise<void> {
    const role = await upsertPersonalRole(member, variant);
    const stale = member.roles.cache.filter(r => isColorRole(r) && r.id !== role.id);
    if (stale.size > 0) await member.roles.remove(stale);
    if (!member.roles.cache.has(role.id)) await member.roles.add(role);
  }

  /** `member` est null quand le joueur a quitté le serveur : son rôle perso est supprimé quand même. */
  static async revoke(guild: Guild, userId: string, member: GuildMember | null): Promise<void> {
    const personal = await findPersonalRole(guild, userId);
    if (personal) await personal.delete('Boutique — rôle coloré expiré');
    await ColorRoleRepository.remove(userId);

    if (!member) return;
    const legacy = member.roles.cache.filter(r => isColorRole(r) && r.id !== personal?.id);
    if (legacy.size > 0) await member.roles.remove(legacy);
  }
}
