import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  TextChannel,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionWebhook,
} from 'discord.js';
import { BotClient } from '../../../bot/client';
import { BetRepository } from '../repositories/bet.repository';
import { BetService } from '../services/bet.service';
import { buildBetMessage } from '../utils/bet-renderer';
import { rc } from '../../../shared/economy/currency';

// ─── Setup state ─────────────────────────────────────────────────────────────

interface BetSetupState {
  userId: string;
  webhook: InteractionWebhook;
  title?: string;
  options: (string | undefined)[];
}

export const betSetupStates = new Map<string, BetSetupState>();

// ─── Setup UI builder ─────────────────────────────────────────────────────────

export function buildSetupContainer(stateId: string, state: BetSetupState): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(0x7289da)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# 🎲 Nouveau bet\nDéfinis le titre et les options, puis crée le bet.'))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Titre**\n${state.title ?? '*non défini*'}`))
        .setButtonAccessory(new ButtonBuilder().setCustomId(`bet:setup_title:${stateId}`).setLabel('✏️ Modifier').setStyle(ButtonStyle.Secondary)),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(false));

  for (let i = 0; i < state.options.length; i++) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Option ${i + 1}**\n${state.options[i] ?? '*non définie*'}`))
        .setButtonAccessory(new ButtonBuilder().setCustomId(`bet:setup_option:${stateId}:${i}`).setLabel('✏️ Modifier').setStyle(ButtonStyle.Secondary)),
    );
  }

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(state.options.length < 12
      ? [new ButtonBuilder().setCustomId(`bet:setup_addmore:${stateId}`).setLabel('＋ 3 options').setStyle(ButtonStyle.Secondary)]
      : []),
    new ButtonBuilder().setCustomId(`bet:setup_create:${stateId}`).setLabel('🎲 Créer le bet').setStyle(ButtonStyle.Success),
  );

  container
    .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
    .addActionRowComponents(actionRow);

  return container;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function updateBetMessage(bet: any, client: BotClient): Promise<void> {
  try {
    const channel = client.channels.cache.get(bet.channelId) as TextChannel;
    if (!channel) return;
    const message = await channel.messages.fetch(bet.messageId);
    await message.edit({ components: buildBetMessage(bet), flags: MessageFlags.IsComponentsV2 });
  } catch (e) {
    console.error('[bet] updateBetMessage error', e);
  }
}

// ─── Setup handlers ───────────────────────────────────────────────────────────

async function handleBetSetupButton(interaction: ButtonInteraction, client: BotClient): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  if (action === 'setup_title') {
    const stateId = parts[2];
    const state = betSetupStates.get(stateId);
    if (!state) {
      await interaction.reply({ content: '❌ Session expirée. Relance /bet.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (state.userId !== interaction.user.id) {
      await interaction.reply({ content: '❌ Ce n\'est pas ton bet.', flags: MessageFlags.Ephemeral });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`bet:setup_modal:title:${stateId}`)
      .setTitle('Titre du bet');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel('Titre du bet')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Valo custom soir — qui gagne ?')
          .setRequired(true),
      ),
    );
    await interaction.showModal(modal);
    return;
  }

  if (action === 'setup_option') {
    const stateId = parts[2];
    const n = parseInt(parts[3], 10);
    const state = betSetupStates.get(stateId);
    if (!state) {
      await interaction.reply({ content: '❌ Session expirée. Relance /bet.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (state.userId !== interaction.user.id) {
      await interaction.reply({ content: '❌ Ce n\'est pas ton bet.', flags: MessageFlags.Ephemeral });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`bet:setup_modal:option:${stateId}:${n}`)
      .setTitle(`Option ${n + 1}`);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel(`Option ${n + 1}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Équipe Jordan')
          .setRequired(true),
      ),
    );
    await interaction.showModal(modal);
    return;
  }

  if (action === 'setup_addmore') {
    const stateId = parts[2];
    const state = betSetupStates.get(stateId);
    if (!state) {
      await interaction.reply({ content: '❌ Session expirée. Relance /bet.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (state.userId !== interaction.user.id) {
      await interaction.reply({ content: '❌ Ce n\'est pas ton bet.', flags: MessageFlags.Ephemeral });
      return;
    }

    const toAdd = Math.min(3, 12 - state.options.length);
    for (let i = 0; i < toAdd; i++) state.options.push(undefined);

    await interaction.deferUpdate();
    await state.webhook.editMessage('@original', {
      components: [buildSetupContainer(stateId, state)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (action === 'setup_create') {
    const stateId = parts[2];
    const state = betSetupStates.get(stateId);
    if (!state) {
      await interaction.reply({ content: '❌ Session expirée. Relance /bet.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (state.userId !== interaction.user.id) {
      await interaction.reply({ content: '❌ Ce n\'est pas ton bet.', flags: MessageFlags.Ephemeral });
      return;
    }

    const definedOptions = state.options.filter(Boolean) as string[];
    if (!state.title) {
      await interaction.reply({ content: '❌ Titre manquant.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (definedOptions.length < 2) {
      await interaction.reply({ content: '❌ Il faut au moins 2 options définies.', flags: MessageFlags.Ephemeral });
      return;
    }

    const channel = interaction.channel as TextChannel;
    const placeholder = await channel.send('*Création du bet...*');

    const bet = await BetRepository.create({
      title: state.title,
      options: definedOptions.map(name => ({ name })),
      channelId: interaction.channelId,
      messageId: placeholder.id,
      createdBy: interaction.user.id,
    });

    const containers = buildBetMessage(bet);
    await placeholder.edit({ content: null, components: containers, flags: MessageFlags.IsComponentsV2 });

    betSetupStates.delete(stateId);

    await interaction.deferUpdate();
    await state.webhook.editMessage('@original', {
      components: [
        new ContainerBuilder()
          .setAccentColor(0x2ecc71)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent('✅ Bet créé !')),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }
}

export async function handleBetSetupModal(interaction: ModalSubmitInteraction, _client: BotClient): Promise<void> {
  const parts = interaction.customId.split(':');
  // bet:setup_modal:TYPE:STATEID[:N]
  const type = parts[2];
  const stateId = parts[3];
  const state = betSetupStates.get(stateId);

  if (!state) {
    await interaction.reply({ content: '❌ Session expirée. Relance /bet.', flags: MessageFlags.Ephemeral });
    return;
  }

  const value = interaction.fields.getTextInputValue('value').trim();

  if (type === 'title') {
    state.title = value;
  } else if (type === 'option') {
    const n = parseInt(parts[4], 10);
    state.options[n] = value;
  }

  await interaction.deferUpdate();
  await state.webhook.editMessage('@original', {
    components: [buildSetupContainer(stateId, state)],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ─── Live bet handlers ────────────────────────────────────────────────────────

export async function handleBetButton(interaction: ButtonInteraction, client: BotClient): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  if (action.startsWith('setup_')) {
    await handleBetSetupButton(interaction, client);
    return;
  }

  const betId = parts[2];

  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ content: '❌ Action réservée aux admins.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'lock') {
    const result = await BetService.lockBet(betId);
    if (!result.success) {
      await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
      return;
    }
    await updateBetMessage(result.bet!, client);
    await interaction.reply({ content: '🔒 Paris verrouillés.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'close') {
    const bet = await BetRepository.findById(betId);
    if (!bet) {
      await interaction.reply({ content: '❌ Bet introuvable.', flags: MessageFlags.Ephemeral });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`bet:winner:${betId}`)
      .setPlaceholder('Sélectionner le vainqueur')
      .addOptions(
        bet.options.map((opt, i) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(opt.name)
            .setValue(String(i))
            .setDescription(`${opt.totalAmount.toLocaleString('fr-FR')} 💰 misés (${opt.entryCount} parieurs)`),
        ),
      );

    await interaction.reply({
      content: '### Choisir le vainqueur',
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === 'refund') {
    const result = await BetService.refundBet(betId);
    if (!result.success) {
      await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
      return;
    }
    await updateBetMessage(result.bet!, client);
    await interaction.reply({ content: '↩ Paris remboursés à tous les participants.', flags: MessageFlags.Ephemeral });
    return;
  }
}

export async function handleBetSelectMenu(interaction: StringSelectMenuInteraction, client: BotClient): Promise<void> {
  const betId = interaction.customId.split(':')[2];
  const winnerIndex = parseInt(interaction.values[0], 10);

  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ content: '❌ Action réservée aux admins.', flags: MessageFlags.Ephemeral });
    return;
  }

  const result = await BetService.closeBet(betId, winnerIndex);
  if (!result.success) {
    await interaction.update({ content: `❌ ${result.message}`, components: [] });
    return;
  }

  await updateBetMessage(result.bet!, client);

  const winner = result.bet!.options[winnerIndex];
  const payoutLines = result.payouts!.length > 0
    ? result.payouts!.map(p => `<@${p.userId}> récupère **${p.amount.toLocaleString('fr-FR')}** ${rc()} (+${p.gain.toLocaleString('fr-FR')})`).join('\n')
    : '*Aucun parieur sur le vainqueur — remboursement automatique.*';

  await interaction.update({ content: `🏆 **${winner.name}** a gagné !\n\n${payoutLines}`, components: [] });
}

export async function handleBetPlaceSelect(interaction: StringSelectMenuInteraction, client: BotClient): Promise<void> {
  const betId = interaction.customId.split(':')[2];
  const optionIndex = parseInt(interaction.values[0], 10);
  const bet = await BetRepository.findById(betId);

  if (!bet || bet.status !== 'open') {
    await interaction.reply({ content: 'Les paris ne sont plus acceptés.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (bet.entries.some(e => e.userId === interaction.user.id)) {
    await interaction.reply({ content: 'Tu as déjà misé sur ce bet.', flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`bet:place_modal:${betId}:${optionIndex}`)
    .setTitle(`Miser sur ${bet.options[optionIndex].name}`);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Montant à miser (en 💰)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 500')
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

export async function handleBetPlaceModal(interaction: ModalSubmitInteraction, client: BotClient): Promise<void> {
  const parts = interaction.customId.split(':');
  const betId = parts[2];
  const optionIndex = parseInt(parts[3], 10);

  const rawAmount = interaction.fields.getTextInputValue('amount').trim();
  const amount = parseInt(rawAmount, 10);

  if (isNaN(amount) || amount < 1) {
    await interaction.reply({ content: '❌ Montant invalide. Entre un nombre entier positif.', flags: MessageFlags.Ephemeral });
    return;
  }

  const result = await BetService.placeBet(betId, interaction.user.id, optionIndex, amount);
  if (!result.success) {
    await interaction.reply({ content: `❌ ${result.message}`, flags: MessageFlags.Ephemeral });
    return;
  }

  await updateBetMessage(result.bet!, client);
  const optionName = result.bet!.options[optionIndex].name;
  await interaction.reply({
    content: `✅ **${amount.toLocaleString('fr-FR')}** ${rc()} misés sur **${optionName}** !`,
    flags: MessageFlags.Ephemeral,
  });
}
