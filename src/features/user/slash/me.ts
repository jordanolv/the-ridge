import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotClient } from '../../../bot/client';
import { DEFAULT_TAB } from '../services/profile-card/tabs';
import { buildTabMessage, resolveTarget } from '../services/me-ui.service';

const ERROR_MESSAGE = "❌ Une erreur est survenue lors de l'exécution de la commande.";

export default {
  data: new SlashCommandBuilder()
    .setName('me')
    .setDescription('Ton profil : carte, activité, jeux et collection Peak Hunters')
    .addUserOption(option => option.setName('membre').setDescription("Voir le profil de quelqu'un d'autre").setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction, _client: BotClient) {
    try {
      if (!interaction.guild) return;
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('membre') ?? interaction.user;
      const target = await resolveTarget(interaction.guild, targetUser.id);
      if (!target) {
        const isSelf = targetUser.id === interaction.user.id;
        await interaction.editReply({
          content: isSelf ? '❌ Utilisateur non trouvé dans la base de données.' : `❌ ${targetUser.username} n'a pas encore de profil.`,
        });
        return;
      }

      await interaction.editReply(await buildTabMessage(DEFAULT_TAB, target, interaction.user.id));
    } catch (error) {
      console.error('Erreur dans la commande /me:', error);
      const reply = { content: ERROR_MESSAGE, flags: MessageFlags.Ephemeral } as const;
      if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
      else await interaction.reply(reply);
    }
  },
};
