import { Guild, GuildMember, Role } from 'discord.js';
import type { ShopVariant } from '../catalog';

const ROLE_PREFIX = '🎨 ';

function roleName(variant: ShopVariant): string {
  return `${ROLE_PREFIX}${variant.label}`;
}

/**
 * Les rôles de couleur sont reconnus à leur préfixe, pas stockés en base :
 * un renommage manuel côté Discord fait perdre le lien et le rôle sera recréé.
 */
function isColorRole(role: Role): boolean {
  return role.name.startsWith(ROLE_PREFIX);
}

async function ensureRole(guild: Guild, variant: ShopVariant): Promise<Role> {
  const name = roleName(variant);
  const existing = guild.roles.cache.find(r => r.name === name);
  if (existing) return existing;

  const botHighest = guild.members.me?.roles.highest.position;
  return guild.roles.create({
    name,
    color: variant.color,
    permissions: [],
    position: botHighest ? botHighest - 1 : undefined,
    reason: 'Boutique — rôle coloré',
  });
}

export class ColorRoleService {
  /** Un seul rôle coloré à la fois : les précédents sont retirés. */
  static async apply(member: GuildMember, variant: ShopVariant): Promise<void> {
    const role = await ensureRole(member.guild, variant);
    const stale = member.roles.cache.filter(r => isColorRole(r) && r.id !== role.id);
    if (stale.size > 0) await member.roles.remove(stale);
    if (!member.roles.cache.has(role.id)) await member.roles.add(role);
  }

  static async revoke(member: GuildMember): Promise<void> {
    const owned = member.roles.cache.filter(isColorRole);
    if (owned.size > 0) await member.roles.remove(owned);
  }
}
