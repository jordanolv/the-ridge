import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  User
} from 'discord.js';
import { ChallengeService } from '../services/challenge.service';
import { Puissance4Service, Puissance4Cell } from '../services/puissance4.service';
import { ArcadeStatsService } from '../services/arcade-stats.service';
import { UserService } from '../../user/services/user.service';
import { ArcadeValidationService } from '../services/arcade-validation.service';
import { getGuildId } from '../../../shared/guild';

interface Puissance4Game {
  grid: Puissance4Cell[][];
  player1: User;
  player2: User;
  currentPlayer: User;
  timeout?: NodeJS.Timeout;
}

const pendingGames = new Map<string, Puissance4Game>();

export default {
  data: new SlashCommandBuilder()
    .setName('puissance4')
    .setDescription('Jouer au Puissance 4')
    .addUserOption(option =>
      option
        .setName('adversaire')
        .setDescription('L\'adversaire à défier')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const opponent = interaction.options.getUser('adversaire');

    if (!opponent) {
      await interaction.reply({ content: '❌ Le mode solo n\'est pas encore disponible. Utilisez `/puissance4 adversaire:@user` pour jouer contre un joueur.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const error = await ArcadeValidationService.validatePvPGame(interaction.user, opponent, 'puissance4');
    if (error) {
      await interaction.editReply({ content: error });
      return;
    }

    const accepted = await ChallengeService.requestChallenge(interaction, {
      challenger: interaction.user,
      opponent,
      gameName: 'Puissance 4',
      gameEmoji: '🔴',
    });
    if (!accepted) return;

    await this.startPvPGame(interaction, interaction.user, opponent);
  },

  async startPvPGame(interaction: ChatInputCommandInteraction, player1: User, player2: User) {
    const gameId = `${player1.id}-${player2.id}-${Date.now()}`;
    const grid = Puissance4Service.createEmptyGrid();

    const game: Puissance4Game = {
      grid,
      player1,
      player2,
      currentPlayer: player1,
    };

    pendingGames.set(gameId, game);

    // Créer les boutons de colonnes
    const row1 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('p4_col_0')
          .setLabel('1')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('p4_col_1')
          .setLabel('2')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('p4_col_2')
          .setLabel('3')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('p4_col_3')
          .setLabel('4')
          .setStyle(ButtonStyle.Primary)
      );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('p4_col_4')
          .setLabel('5')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('p4_col_5')
          .setLabel('6')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('p4_col_6')
          .setLabel('7')
          .setStyle(ButtonStyle.Primary)
      );

    const gameEmbed = new EmbedBuilder()
      .setTitle(`🔴 Puissance 4`)
      .setDescription(
        `${player1} (🔴) vs ${player2} (🟡)\n\n` +
        `${Puissance4Service.gridToString(grid)}\n\n` +
        `C'est au tour de ${player1} !`
      )
      .setColor(0xff0000)
      .setFooter({
        text: `Premier à aligner 4 jetons` +
              ` • /puissance4`
      });

    const message = await interaction.editReply({
      embeds: [gameEmbed],
      components: [row1, row2]
    });

    // Collecter les choix
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (buttonInteraction) => {
      const game = pendingGames.get(gameId);
      if (!game) return;

      // Vérifier que c'est le bon joueur
      if (buttonInteraction.user.id !== game.currentPlayer.id) {
        await buttonInteraction.reply({
          content: '❌ Ce n\'est pas votre tour !',
          flags: ['Ephemeral']
        });
        return;
      }

      const col = parseInt(buttonInteraction.customId.split('_')[2]);

      // Vérifier si la colonne est pleine
      if (Puissance4Service.isColumnFull(game.grid, col)) {
        await buttonInteraction.reply({
          content: '❌ Cette colonne est pleine !',
          flags: ['Ephemeral']
        });
        return;
      }

      // Placer le jeton
      const disc = game.currentPlayer.id === game.player1.id
        ? Puissance4Service.PLAYER1_DISC
        : Puissance4Service.PLAYER2_DISC;

      const row = Puissance4Service.dropDisc(game.grid, col, disc);

      // Vérifier le résultat
      const result = Puissance4Service.checkWinner(game.grid, row, col);

      if (result === 'continue') {
        // Changer de joueur
        game.currentPlayer = game.currentPlayer.id === game.player1.id ? game.player2 : game.player1;

        const continueEmbed = new EmbedBuilder()
          .setTitle(`🔴 Puissance 4`)
          .setDescription(
            `${game.player1} (🔴) vs ${game.player2} (🟡)\n\n` +
            `${Puissance4Service.gridToString(game.grid)}\n\n` +
            `C'est au tour de ${game.currentPlayer} !`
          )
          .setColor(game.currentPlayer.id === game.player1.id ? 0xff0000 : 0xffff00)
          .setFooter({
            text: `Premier à aligner 4 jetons` +
                  ` • /puissance4`
          });

        await buttonInteraction.update({
          embeds: [continueEmbed]
        });
      } else {
        // Fin de partie
        collector.stop('finished');
        await this.endGame(game, buttonInteraction, gameId, result);
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        this.cancelGame(gameId, interaction);
      }
    });
  },

  async endGame(game: Puissance4Game, interaction: any, gameId: string, result: 'player1' | 'player2' | 'draw') {
    let victoryMsg: string;
    let winner: User | null = null;
    let loser: User | null = null;

    if (result === 'draw') {
      victoryMsg = '🤝 Match nul ! La grille est pleine.';
    } else {
      winner = result === 'player1' ? game.player1 : game.player2;
      loser = result === 'player1' ? game.player2 : game.player1;
      victoryMsg = `🏆 **${winner.username}** remporte la partie !`;

      try {
        await UserService.recordArcadeWin(winner.id, 'puissance4');
        await UserService.recordArcadeLoss(loser.id, 'puissance4');
        await ArcadeStatsService.incrementGameCount('puissance4');

      } catch (error) {
        console.error('Erreur lors de la fin de partie:', error);
      }
    }

    const finalEmbed = new EmbedBuilder()
      .setTitle(`🔴 Partie terminée`)
      .setDescription(
        `${game.player1} (🔴) vs ${game.player2} (🟡)\n\n` +
        `${Puissance4Service.gridToString(game.grid)}\n\n` +
        victoryMsg
      )
      .setColor(result === 'draw' ? 0xffaa00 : 0xffd700)
      .setFooter({
        text: `Premier à aligner 4 jetons` +
              ` • /puissance4`
      });

    await interaction.update({
      embeds: [finalEmbed],
      components: []
    });

    if (game.timeout) clearTimeout(game.timeout);
    pendingGames.delete(gameId);
  },

  async cancelGame(gameId: string, interaction: ChatInputCommandInteraction) {
    const game = pendingGames.get(gameId);
    if (!game) return;

    const cancelEmbed = new EmbedBuilder()
      .setTitle('⏱️ Temps écoulé')
      .setDescription('La partie a été annulée car personne n\'a joué.')
      .setColor(0xff9900);

    await interaction.editReply({
      embeds: [cancelEmbed],
      components: []
    }).catch(() => {});

    if (game.timeout) clearTimeout(game.timeout);
    pendingGames.delete(gameId);
  }
};
