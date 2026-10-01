import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { findTab } from '../services/profile-card/tabs';
import { buildTabMessage, ME_BUTTON_PREFIX, parseTabButtonId, resolveTarget } from '../services/me-ui.service';

export { ME_BUTTON_PREFIX };

export async function handleMeButton(interaction: ButtonInteraction): Promise<void> {
  const { tabId, targetId, ownerId } = parseTabButtonId(interaction.customId);

  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: "❌ Ces onglets ne sont pas à toi : lance `/me` pour ouvrir ton profil.", flags: MessageFlags.Ephemeral });
    return;
  }

  const tab = findTab(tabId);
  if (!tab || !interaction.guild) return;

  await interaction.deferUpdate();
  const target = await resolveTarget(interaction.guild, targetId);
  if (!target) {
    await interaction.followUp({ content: "❌ Ce profil n'existe plus.", flags: MessageFlags.Ephemeral });
    return;
  }

  const message = await buildTabMessage(tab, target, ownerId);
  await interaction.editReply({ ...message, attachments: [] });
}
