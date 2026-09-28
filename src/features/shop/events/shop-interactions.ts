import { ButtonInteraction, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { clampQuantity, findItem, findVariant } from '../catalog';
import { ShopService, type PurchaseFailure } from '../services/shop.service';
import {
  buildCatalogContainer,
  buildItemContainer,
  buildResultContainer,
  SHOP_PREFIX,
} from '../services/shop-ui.service';

export { SHOP_PREFIX };

const FAILURE_MESSAGE: Record<PurchaseFailure, string> = {
  soon: "⏳ Cet article n'est pas encore disponible.",
  variant: "❌ Choisis une couleur avant d'acheter.",
  funds: '❌ Solde insuffisant — un autre achat est peut-être passé avant celui-ci.',
  grant: '❌ La livraison a échoué, tu as été remboursé. Préviens un admin si ça se reproduit.',
};

type ShopInteraction = ButtonInteraction | StringSelectMenuInteraction;

async function showCatalog(interaction: ShopInteraction): Promise<void> {
  const balance = await ShopService.getBalance(interaction.user.id);

  await interaction.update({
    components: [buildCatalogContainer(interaction.user, balance)],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function showItem(
  interaction: ShopInteraction,
  itemId: string,
  variantId: string | undefined,
  qty: number,
): Promise<void> {
  const item = findItem(itemId);
  if (!item) return showCatalog(interaction);

  const balance = await ShopService.getBalance(interaction.user.id);
  const variant = variantId ? findVariant(item, variantId) : undefined;

  await interaction.update({
    components: [buildItemContainer(balance, item, variant, clampQuantity(qty))],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function buy(
  interaction: ButtonInteraction,
  itemId: string,
  variantId: string | undefined,
  qty: number,
): Promise<void> {
  const item = findItem(itemId);
  if (!item) return showCatalog(interaction);

  await interaction.deferUpdate();

  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.followUp({ content: '❌ Impossible de te retrouver sur le serveur.', flags: MessageFlags.Ephemeral });
    return;
  }

  const quantity = clampQuantity(qty);
  const result = await ShopService.purchase(member, item, variantId, quantity);

  if (result.ok === false) {
    await interaction.followUp({ content: FAILURE_MESSAGE[result.reason], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.editReply({
    components: [
      buildResultContainer(
        item,
        variantId ? findVariant(item, variantId) : undefined,
        quantity,
        result.balance,
        interaction.user.id,
        result.expiresAt,
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });
}

export async function handleShopButton(interaction: ButtonInteraction): Promise<void> {
  const [, action, itemId, rawVariant, rawQty] = interaction.customId.split(':');
  const variantId = rawVariant === '_' ? undefined : rawVariant;
  const qty = Number(rawQty);

  if (action === 'home') return showCatalog(interaction);
  if (action === 'view') return showItem(interaction, itemId, variantId, qty);
  if (action === 'buy') return buy(interaction, itemId, variantId, qty);
}

export async function handleShopSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const [, action, itemId, , rawQty] = interaction.customId.split(':');
  if (action !== 'variant') return;

  return showItem(interaction, itemId, interaction.values[0], Number(rawQty));
}
