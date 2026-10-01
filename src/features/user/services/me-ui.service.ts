import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, type Guild } from 'discord.js';
import { ProfileCardService } from './profile-card/profile-card.service';
import { TABS, type TabTarget } from './profile-card/tabs';
import type { ProfileTab } from './profile-card/tabs/tab';
import { UserService } from './user.service';

export const ME_BUTTON_PREFIX = 'me';

/** `me:<onglet>:<profil affiché>:<auteur de la commande>` */
export const tabButtonId = (tabId: string, targetId: string, ownerId: string) => `${ME_BUTTON_PREFIX}:${tabId}:${targetId}:${ownerId}`;

export function parseTabButtonId(customId: string): { tabId: string; targetId: string; ownerId: string } {
  const [, tabId, targetId, ownerId] = customId.split(':');
  return { tabId, targetId, ownerId };
}

export async function resolveTarget(guild: Guild, userId: string): Promise<TabTarget | null> {
  const [account, member] = await Promise.all([UserService.getUserByDiscordId(userId), guild.members.fetch(userId).catch(() => null)]);
  if (!account) return null;
  const user = member?.user ?? (await guild.client.users.fetch(userId).catch(() => null));
  return user ? { user, member, account } : null;
}

function tabButtons(active: ProfileTab<unknown>, targetId: string, ownerId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    TABS.map(tab =>
      new ButtonBuilder()
        .setCustomId(tabButtonId(tab.id, targetId, ownerId))
        .setLabel(tab.label)
        .setEmoji(tab.emoji)
        .setStyle(tab.id === active.id ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(tab.id === active.id),
    ),
  );
}

export async function buildTabMessage(tab: ProfileTab<unknown>, target: TabTarget, ownerId: string) {
  const image = await ProfileCardService.render(tab, target);
  return {
    files: [new AttachmentBuilder(image, { name: `${tab.id}.png` })],
    components: [tabButtons(tab, target.user.id, ownerId)],
  };
}
