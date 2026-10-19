import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  User,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from 'discord.js';

export interface ChallengeOptions {
  challenger: User;
  opponent: User;
  gameName: string;
  gameEmoji: string;
  targetScore?: number;
  customDescription?: string;
}

export class ChallengeService {
  static async requestChallenge(
    interaction: ChatInputCommandInteraction,
    options: ChallengeOptions,
  ): Promise<boolean> {
    const { challenger, opponent, gameName, gameEmoji, targetScore, customDescription } = options;

    let description = `${challenger} vous défie à une partie de **${gameName}** !\n\n`;
    if (customDescription) description += `${customDescription}\n\n`;
    else if (targetScore) description += `🎯 Premier à **${targetScore}** points\n`;
    description += `${opponent}, acceptez-vous ce défi ?`;

    const challengeEmbed = new EmbedBuilder()
      .setTitle(`${gameEmoji} Défi ${gameName}`)
      .setDescription(description)
      .setColor(0x00aaff)
      .setFooter({ text: 'Vous avez 30 secondes pour répondre' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('challenge_accept').setLabel('Accepter').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('challenge_decline').setLabel('Refuser').setEmoji('❌').setStyle(ButtonStyle.Danger),
    );

    const message = await interaction.editReply({
      content: `${opponent}`,
      embeds: [challengeEmbed],
      components: [row],
    });

    return new Promise((resolve) => {
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30_000,
      });

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== opponent.id) {
          await buttonInteraction.reply({ content: '❌ Seul le joueur défié peut répondre à ce défi !', flags: MessageFlags.Ephemeral });
          return;
        }

        if (buttonInteraction.customId === 'challenge_accept') {
          await buttonInteraction.update({
            embeds: [new EmbedBuilder().setTitle(`${gameEmoji} Défi accepté !`).setDescription(`${opponent.username} a accepté le défi ! La partie commence...`).setColor(0x00ff00)],
            components: [],
          });
          collector.stop('accepted');
          resolve(true);
        } else {
          await buttonInteraction.update({
            embeds: [new EmbedBuilder().setTitle(`${gameEmoji} Défi refusé`).setDescription(`${opponent.username} a refusé le défi.`).setColor(0xff0000)],
            components: [],
          });
          collector.stop('declined');
          resolve(false);
        }
      });

      collector.on('end', (_collected, reason) => {
        if (reason === 'time') {
          interaction.editReply({
            embeds: [new EmbedBuilder().setTitle(`${gameEmoji} Temps écoulé`).setDescription(`${opponent.username} n'a pas répondu à temps. Le défi est annulé.`).setColor(0xff9900)],
            components: [],
          }).catch(() => {});
          resolve(false);
        }
      });
    });
  }
}
