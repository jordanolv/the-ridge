import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from 'discord.js';
import { BotClient } from '../../../bot/client';
import { AdminService } from '../services/admin.service';

export default {
  data: new SlashCommandBuilder()
    .setName('set-channel')
    .setDescription('Configure les channels pour différentes fonctionnalités')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option.setName('feature')
        .setDescription('La fonctionnalité à configurer')
        .setRequired(true)
        .addChoices(
          { name: 'Anniversaires', value: 'birthday' },
          // On peut ajouter d'autres features ici plus tard
        ))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Le channel à configurer')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: '❌ Cette commande ne peut être utilisée que dans un serveur.',
          flags: [64] // MessageFlags.Ephemeral
        });
      }

      const feature = interaction.options.getString('feature', true);
      const channel = interaction.options.getChannel('channel', true);
      
      const adminService = new AdminService();
      let result: { success: boolean; message: string };

      switch (feature) {
        case 'birthday':
          result = await adminService.setBirthdayChannel(client, channel.id);
          break;

        default:
          await interaction.reply({
            content: '❌ Fonctionnalité non reconnue.',
            flags: [64] // MessageFlags.Ephemeral
          });
          return;
      }

      await interaction.reply({
        content: result.message,
        flags: [64] // MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('Erreur dans la commande set-channel:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la configuration.',
        flags: [64] // MessageFlags.Ephemeral
      });
    }
  }
};