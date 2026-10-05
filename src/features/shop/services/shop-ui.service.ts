import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  ModalBuilder,
  SectionBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder,
  User,
} from 'discord.js';
import {
  COLOR_PRESETS,
  MAX_QUANTITY,
  SHOP_ITEMS,
  colorVariantId,
  formatHex,
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

export const COLOR_MODAL_ID = `${SHOP_PREFIX}:color`;
export const COLOR_PRIMARY_INPUT = 'primary';
export const COLOR_SECONDARY_INPUT = 'secondary';

/** Un consommable s'achète en un clic depuis le catalogue ; une location passe par l'écran de l'article. */
function catalogButtonId(item: ShopItem): string {
  return item.durationDays ? viewId(item.id, undefined, 1) : buyId(item.id, undefined, 1);
}

function buyId(itemId: string, variantId: string | undefined, qty: number): string {
  return `${SHOP_PREFIX}:buy:${itemId}:${variantId ?? '_'}:${qty}`;
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
            .setCustomId(catalogButtonId(item))
            .setLabel(item.soon ? 'Bientôt' : `${item.price} 💰`)
            .setStyle(item.soon ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(item.soon === true),
        ),
    );
  }

  return container;
}

function colorLine(variant: ShopVariant): string {
  const hex = variant.secondaryColor === undefined
    ? formatHex(variant.color)
    : `${formatHex(variant.color)} → ${formatHex(variant.secondaryColor)}`;
  return hex === variant.label ? `Couleur : **${hex}**` : `Couleur : **${variant.label}** · \`${hex}\``;
}

export function buildItemContainer(
  balance: number,
  item: ShopItem,
  variant: ShopVariant | undefined,
  qty: number,
): ContainerBuilder {
  const total = item.price * qty;
  const needsVariant = Boolean(item.variants || item.colorPicker) && !variant;
  const affordable = balance >= total;

  const lines = [
    `## ${item.emoji} ${item.label}`,
    `-# ${item.description}`,
    '',
    ...(item.colorPicker && variant ? [colorLine(variant)] : []),
    `Quantité : **${quantityLabel(item, qty)}**`,
    `Total : **${total}** 💰  ·  solde **${balance}** 💰`,
  ];

  if (needsVariant) lines.push('', item.colorPicker ? '-# Choisis une couleur toute prête, ou tape la tienne.' : '-# Choisis une couleur ci-dessous.');
  else if (!affordable) lines.push('', `-# ❌ Il te manque **${total - balance}** 💰.`);

  const container = new ContainerBuilder()
    .setAccentColor(variant?.color ?? ACCENT)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

  if (item.colorPicker) addColorPicker(container, item, variant, qty);
  else if (item.variants) addVariantSelect(container, item, item.variants, variant, qty);

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
        .setCustomId(buyId(item.id, variant?.id, qty))
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

function variantSelect(
  item: ShopItem,
  qty: number,
  placeholder: string,
  options: StringSelectMenuOptionBuilder[],
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${SHOP_PREFIX}:variant:${item.id}:_:${qty}`)
      .setPlaceholder(placeholder)
      .addOptions(options),
  );
}

function addVariantSelect(
  container: ContainerBuilder,
  item: ShopItem,
  variants: ShopVariant[],
  selected: ShopVariant | undefined,
  qty: number,
): void {
  container.addActionRowComponents(
    variantSelect(
      item,
      qty,
      selected ? selected.label : 'Choisir une couleur',
      variants.map(v =>
        new StringSelectMenuOptionBuilder()
          .setValue(v.id)
          .setLabel(v.label)
          .setEmoji(v.emoji)
          .setDefault(v.id === selected?.id),
      ),
    ),
  );
}

function addColorPicker(
  container: ContainerBuilder,
  item: ShopItem,
  selected: ShopVariant | undefined,
  qty: number,
): void {
  container.addActionRowComponents(
    variantSelect(
      item,
      qty,
      selected ? selected.label : 'Une couleur toute prête',
      COLOR_PRESETS.map(p => {
        const id = colorVariantId(p.color);
        return new StringSelectMenuOptionBuilder()
          .setValue(id)
          .setLabel(p.label)
          .setDescription(formatHex(p.color))
          .setEmoji(p.emoji)
          .setDefault(id === selected?.id);
      }),
    ),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${COLOR_MODAL_ID}:${item.id}:${selected?.id ?? '_'}:${qty}`)
        .setLabel('Ma propre couleur')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Primary),
    ),
  );
}

export function buildColorModal(
  itemId: string,
  current: ShopVariant | undefined,
  qty: number,
  allowGradient: boolean,
): ModalBuilder {
  const primary = new TextInputBuilder()
    .setCustomId(COLOR_PRIMARY_INPUT)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('#FF8800')
    .setMinLength(3)
    .setMaxLength(7)
    .setRequired(true);
  if (current) primary.setValue(formatHex(current.color));

  const modal = new ModalBuilder()
    .setCustomId(`${COLOR_MODAL_ID}:${itemId}:_:${qty}`)
    .setTitle('🎨 Ta couleur')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Couleur')
        .setDescription('Code hexadécimal — cherche « color picker » sur Google pour trouver le tien.')
        .setTextInputComponent(primary),
    );

  if (allowGradient) {
    const secondary = new TextInputBuilder()
      .setCustomId(COLOR_SECONDARY_INPUT)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Laisse vide pour une couleur unie')
      .setMaxLength(7)
      .setRequired(false);
    if (current?.secondaryColor !== undefined) secondary.setValue(formatHex(current.secondaryColor));

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel('Seconde couleur (dégradé)')
        .setDescription('Facultatif : ton pseudo passera de la première à la seconde.')
        .setTextInputComponent(secondary),
    );
  }

  return modal;
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
      new ButtonBuilder()
        .setCustomId(buyId(item.id, undefined, 1))
        .setLabel(`Encore un — ${item.price} 💰`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(balance < item.price),
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
