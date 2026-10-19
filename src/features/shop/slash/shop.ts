import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { ShopService } from '../services/shop.service';
import { buildCatalogContainer } from '../services/shop-ui.service';
import { SHOP_CATEGORIES } from '../catalog';

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('La boutique du serveur'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const wallet = await ShopService.getWallet(interaction.user.id);

    await interaction.editReply({
      components: [buildCatalogContainer(interaction.user, wallet, SHOP_CATEGORIES[0].id, 1)],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
