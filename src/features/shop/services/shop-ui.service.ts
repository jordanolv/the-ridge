import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  User,
} from 'discord.js';
import {
  MAX_QUANTITY,
  SHOP_ITEMS,
  packTierOf,
  quantityLabel,
  type ShopItem,
  type ShopVariant,
} from '../catalog';
import { packOpenId } from '../../peak-hunters/services/pack.service';
import type { ExpeditionTier } from '../../peak-hunters/types/peak-hunters.types';

export const SHOP_PREFIX = 'shop';
const ACCENT = 0x2ecc71;

function viewId(itemId: string, variantId: string | undefined, qty: number): string {
  return `${SHOP_PREFIX}:view:${itemId}:${variantId ?? '_'}:${qty}`;
}

function priceLine(item: ShopItem): string {
  return `**${item.price}** 💰${item.durationDays ? ` · ${item.durationDays} jours` : ''}`;
}

function relative(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

export function buildCatalogContainer(user: User, balance: number): ContainerBuilder {
  const header = [
    '## 🛒 Boutique',
    `-# **${user.displayName}** · solde **${balance}** 💰`,
  ].join('\n');

  const container = new ContainerBuilder()
    .setAccentColor(ACCENT)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 64 }))),
    );

  for (const item of SHOP_ITEMS) {
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${item.emoji} **${item.label}** — ${priceLine(item)}\n-# ${item.description}`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(viewId(item.id, undefined, 1))
            .setLabel(item.soon ? 'Bientôt' : `${item.price} 💰`)
            .setStyle(item.soon ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(item.soon === true),
        ),
    );
  }

  return container;
}

export function buildItemContainer(
  balance: number,
  item: ShopItem,
  variant: ShopVariant | undefined,
  qty: number,
): ContainerBuilder {
  const total = item.price * qty;
  const needsVariant = Boolean(item.variants) && !variant;
  const affordable = balance >= total;

  const lines = [
    `## ${item.emoji} ${item.label}`,
    `-# ${item.description}`,
    '',
    `Quantité : **${quantityLabel(item, qty)}**`,
    `Total : **${total}** 💰  ·  solde **${balance}** 💰`,
  ];

  if (needsVariant) lines.push('', '-# Choisis une couleur ci-dessous.');
  else if (!affordable) lines.push('', `-# ❌ Il te manque **${total - balance}** 💰.`);

  const container = new ContainerBuilder()
    .setAccentColor(variant?.color ?? ACCENT)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

  if (item.variants) {
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${SHOP_PREFIX}:variant:${item.id}:_:${qty}`)
          .setPlaceholder(variant ? `${variant.label}` : 'Choisir une couleur')
          .addOptions(
            item.variants.map(v =>
              new StringSelectMenuOptionBuilder()
                .setValue(v.id)
                .setLabel(v.label)
                .setEmoji(v.emoji)
                .setDefault(v.id === variant?.id),
            ),
          ),
      ),
    );
  }

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(viewId(item.id, variant?.id, qty - 1))
        .setLabel('−')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(qty <= 1),
      new ButtonBuilder()
        .setCustomId(`${SHOP_PREFIX}:noop`)
        .setLabel(quantityLabel(item, qty))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(viewId(item.id, variant?.id, qty + 1))
        .setLabel('+')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(qty >= MAX_QUANTITY),
    ),
  );

  return container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${SHOP_PREFIX}:buy:${item.id}:${variant?.id ?? '_'}:${qty}`)
        .setLabel(`Acheter — ${total} 💰`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(needsVariant || !affordable),
      new ButtonBuilder()
        .setCustomId(`${SHOP_PREFIX}:home`)
        .setLabel('Retour')
        .setEmoji('↩️')
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}

export function buildResultContainer(
  item: ShopItem,
  variant: ShopVariant | undefined,
  qty: number,
  balance: number,
  userId: string,
  expiresAt?: Date,
): ContainerBuilder {
  const label = variant ? `${item.label} — ${variant.label}` : item.label;
  const packTier = packTierOf(item);
  const lines = [
    `## ✅ ${label}`,
    expiresAt ? `-# Actif jusqu'au ${relative(expiresAt)}` : `-# ${quantityLabel(item, qty)} ajouté à ton inventaire.`,
    '',
    `Il te reste **${balance}** 💰`,
  ];
  if (packTier) lines.push('', '-# Tes packs t\'attendent dans `/peak-hunters` → Packs, tu peux les ouvrir quand tu veux.');

  const buttons = new ActionRowBuilder<ButtonBuilder>();
  if (packTier) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(packOpenId(packTier as ExpeditionTier, userId))
        .setLabel(qty > 1 ? `Ouvrir un pack (${qty} en stock)` : 'Ouvrir le pack')
        .setEmoji('🎁')
        .setStyle(ButtonStyle.Success),
    );
  }
  buttons.addComponents(
    new ButtonBuilder()
      .setCustomId(`${SHOP_PREFIX}:home`)
      .setLabel('Retour à la boutique')
      .setEmoji('🛒')
      .setStyle(ButtonStyle.Secondary),
  );

  return new ContainerBuilder()
    .setAccentColor(variant?.color ?? ACCENT)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
    .addActionRowComponents(buttons);
}
