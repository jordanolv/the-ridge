import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { ShopService } from '../services/shop.service';
import { buildCatalogContainer } from '../services/shop-ui.service';

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('La boutique du serveur'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const balance = await ShopService.getBalance(interaction.user.id);

    await interaction.editReply({
      components: [buildCatalogContainer(interaction.user, balance)],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
