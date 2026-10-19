import {
  MessageFlags,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  UserContextMenuCommandInteraction,
  PermissionFlagsBits,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotClient } from '../../../bot/client';
import { UserService } from '../../user/services/user.service';

export const MONEY_MODAL_PREFIX = 'admin_money_modal:';

export default {
  data: new ContextMenuCommandBuilder()
    .setName('Gérer l\'argent')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: UserContextMenuCommandInteraction, client: BotClient) {
    try {
      const target = interaction.targetUser;
      const currentMoney = await UserService.getUserMoney(target.id);

      const modal = new ModalBuilder()
        .setCustomId(`${MONEY_MODAL_PREFIX}${target.id}`)
        .setTitle(`Gérer l'argent de ${target.username}`)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('amount')
              .setLabel('Montant (négatif pour retirer)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('ex: 500 ou -200')
              .setValue(''),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Raison (optionnelle)')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(100)
              .setPlaceholder(`Solde actuel : ${currentMoney} 💰`),
          ),
        );

      await interaction.showModal(modal);
    } catch (error) {
      console.error('[Money] Erreur execute:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ Une erreur est survenue.', flags: MessageFlags.Ephemeral });
      }
    }
  },

  async handleModalSubmit(interaction: ModalSubmitInteraction, client: BotClient): Promise<void> {
    const targetId = interaction.customId.replace(MONEY_MODAL_PREFIX, '');
    const amountRaw = interaction.fields.getTextInputValue('amount').trim();
    const reason = interaction.fields.getTextInputValue('reason').trim() || undefined;

    const amount = parseInt(amountRaw);
    if (isNaN(amount) || amount === 0) {
      await interaction.reply({
        content: '❌ Montant invalide. Entrez un nombre entier non nul (ex: `500` ou `-200`).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const updated = await UserService.updateUserMoney(targetId, amount, `Ajustement admin (${interaction.user.tag})`, amount > 0 ? 'mint' : 'burn');
    if (!updated) {
      await interaction.editReply({ content: '❌ Utilisateur introuvable en base de données.' });
      return;
    }

    const newBalance = updated.profil.money;
    const action = amount > 0 ? 'ajouté' : 'retiré';
    const absAmount = Math.abs(amount);

    const embed = new EmbedBuilder()
      .setColor(amount > 0 ? 0x57f287 : 0xed4245)
      .setTitle(`${amount > 0 ? '➕' : '➖'} Argent ${action}`)
      .addFields(
        { name: 'Utilisateur', value: `<@${targetId}>`, inline: true },
        { name: 'Montant', value: `${amount > 0 ? '+' : ''}${amount} 💰`, inline: true },
        { name: 'Nouveau solde', value: `${newBalance} 💰`, inline: true },
      )
      .setFooter({ text: `Par ${interaction.user.username}${reason ? ` · ${reason}` : ''}` });

    await interaction.editReply({ embeds: [embed] });

    // Notifier l'utilisateur cible
    try {
      const target = await client.users.fetch(targetId);
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(amount > 0 ? 0x57f287 : 0xed4245)
            .setTitle(`${amount > 0 ? "💰 Vous avez reçu de l'argent !" : "💸 De l'argent a été retiré"}`)
            .setDescription(
              `Un administrateur a ${action} **${absAmount}** 💰 de votre compte.${reason ? `\n**Raison :** ${reason}` : ''}`
            )
            .addFields({ name: 'Nouveau solde', value: `${newBalance} 💰` }),
        ],
      });
    } catch {
      // DM désactivés, pas bloquant
    }
  },
};
