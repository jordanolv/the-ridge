import { SlashCommandBuilder } from '@discordjs/builders';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  User
} from 'discord.js';
import { BotClient } from '../../../bot/client';
import { ShifumiService, ShifumiChoice } from '../services/shifumi.service';
import { ChallengeService } from '../services/challenge.service';
import { ArcadeStatsService } from '../services/arcade-stats.service';
import { UserService } from '../../user/services/user.service';
import { ArcadeValidationService } from '../services/arcade-validation.service';

const pendingGames = new Map<string, {
  challenger: User;
  opponent: User;
  challengerChoice?: ShifumiChoice;
  opponentChoice?: ShifumiChoice;
  challengerScore: number;
  opponentScore: number;
  targetScore: number;
  currentRound: number;
  resolving: boolean;
  timeout?: NodeJS.Timeout;
}>();

export default {
  data: new SlashCommandBuilder()
    .setName('shifumi')
    .setDescription('🎮 Défier quelqu\'un à Pierre-Feuille-Ciseaux')
    .addUserOption(option =>
      option
        .setName('adversaire')
        .setDescription('Le joueur à défier')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('points')
        .setDescription('Nombre de points pour gagner (3 par défaut)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    ),

  async execute(interaction: ChatInputCommandInteraction, _client: BotClient) {
    try {
      const opponent = interaction.options.getUser('adversaire', true);
      const challenger = interaction.user;
      const targetScore = interaction.options.getInteger('points') || 3;

      const validationError = await ArcadeValidationService.validatePvPGame(challenger, opponent, 'shifumi');
      if (validationError) {
        await interaction.editReply({ content: validationError });
        return;
      }

      const accepted = await ChallengeService.requestChallenge(interaction, {
        challenger,
        opponent,
        gameName: 'Shifumi',
        gameEmoji: '✂️',
        targetScore
      });

      if (!accepted) return;

      const gameId = `${challenger.id}-${opponent.id}-${Date.now()}`;

      const row = this.buildChoiceRow(gameId, 1);

      const gameEmbed = new EmbedBuilder()
        .setTitle(`✂️ Manche 1`)
        .setDescription(`${challenger} **0** - **0** ${opponent}\n\nFaites vos choix !`)
        .setColor(0x00aaff)
        .setFooter({ text: this.footerText(targetScore) });

      const message = await interaction.editReply({
        content: '',
        embeds: [gameEmbed],
        components: [row]
      });

      pendingGames.set(gameId, {
        challenger,
        opponent,
        challengerScore: 0,
        opponentScore: 0,
        targetScore,
        currentRound: 1,
        resolving: false,
        timeout: setTimeout(() => this.cancelGame(gameId, interaction), 60000)
      });

      this.attachCollector(message, gameId, interaction);

    } catch (error) {
      console.error('Erreur dans la commande shifumi:', error);
      const errorMessage = { content: '❌ Une erreur est survenue lors du jeu.', flags: 64 };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(() => {});
      } else {
        await interaction.reply(errorMessage).catch(() => {});
      }
    }
  },

  attachCollector(message: any, gameId: string, interaction: ChatInputCommandInteraction) {
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on('collect', async (buttonInteraction: any) => {
      try {
        const game = pendingGames.get(gameId);
        if (!game || game.resolving) {
          await buttonInteraction.deferUpdate().catch(() => {});
          return;
        }

        const userId = buttonInteraction.user.id;
        const isChallenger = userId === game.challenger.id;
        const isOpponent = userId === game.opponent.id;

        if (!isChallenger && !isOpponent) {
          await buttonInteraction.reply({ content: '❌ Vous ne participez pas à cette partie !', flags: 64 });
          return;
        }

        const choice = buttonInteraction.customId.split('_')[1] as ShifumiChoice;

        if (isChallenger && !game.challengerChoice) {
          game.challengerChoice = choice;
        } else if (isOpponent && !game.opponentChoice) {
          game.opponentChoice = choice;
        }

        await buttonInteraction.reply({
          content: `✅ Vous avez choisi ${ShifumiService.getEmoji(choice)} **${this.capitalize(choice)}** !`,
          flags: 64
        });

        if (game.challengerChoice && game.opponentChoice && !game.resolving) {
          game.resolving = true;
          collector.stop('completed');
          await this.revealResults(game, interaction, gameId);
        }
      } catch (error) {
        console.error('Erreur collecteur shifumi:', error);
      }
    });

    collector.on('end', (_: any, reason: string) => {
      if (reason === 'time') {
        this.cancelGame(gameId, interaction);
      }
    });
  },

  async revealResults(game: any, interaction: ChatInputCommandInteraction, gameId: string) {
    try {
      if (!game.challengerChoice || !game.opponentChoice) return;

      const result = this.determineWinner(game.challengerChoice, game.opponentChoice);

      if (result === 'player1') game.challengerScore++;
      else if (result === 'player2') game.opponentScore++;

      if (game.challengerScore >= game.targetScore || game.opponentScore >= game.targetScore) {
        await this.endGame(game, interaction, gameId);
        return;
      }

      const winnerName = result === 'player1' ? game.challenger.username : game.opponent.username;
      const resultMsg = result === 'draw' ? '🤝 Égalité' : `✅ **${winnerName}** gagne la manche !`;

      const roundEmbed = new EmbedBuilder()
        .setTitle(`✂️ Manche ${game.currentRound}`)
        .setDescription(
          `${game.challenger} **${game.challengerScore}** - **${game.opponentScore}** ${game.opponent}\n\n` +
          `${ShifumiService.getEmoji(game.challengerChoice)} **VS** ${ShifumiService.getEmoji(game.opponentChoice)}\n\n` +
          `${resultMsg}`
        )
        .setColor(0x00aaff)
        .setFooter({ text: this.footerText(game.targetScore) });

      await interaction.editReply({ embeds: [roundEmbed], components: [] });

      setTimeout(() => this.startNextRound(game, interaction, gameId), 3000);
    } catch (error) {
      console.error('Erreur revealResults shifumi:', error);
      pendingGames.delete(gameId);
    }
  },

  async startNextRound(game: any, interaction: ChatInputCommandInteraction, gameId: string) {
    try {
      game.currentRound++;
      game.challengerChoice = undefined;
      game.opponentChoice = undefined;
      game.resolving = false;

      if (game.timeout) clearTimeout(game.timeout);
      game.timeout = setTimeout(() => this.cancelGame(gameId, interaction), 60000);

      const row = this.buildChoiceRow(gameId, game.currentRound);

      const nextRoundEmbed = new EmbedBuilder()
        .setTitle(`✂️ Manche ${game.currentRound}`)
        .setDescription(
          `${game.challenger} **${game.challengerScore}** - **${game.opponentScore}** ${game.opponent}\n\nFaites vos choix !`
        )
        .setColor(0x00aaff)
        .setFooter({ text: this.footerText(game.targetScore) });

      const message = await interaction.editReply({ embeds: [nextRoundEmbed], components: [row] });

      this.attachCollector(message, gameId, interaction);
    } catch (error) {
      console.error('Erreur startNextRound shifumi:', error);
      pendingGames.delete(gameId);
    }
  },

  async endGame(game: any, interaction: ChatInputCommandInteraction, gameId: string) {
    try {
      const winner = game.challengerScore >= game.targetScore ? game.challenger : game.opponent;
      const loser = winner.id === game.challenger.id ? game.opponent : game.challenger;

      let victoryMsg = `🏆 **${winner.username}** remporte la partie !`;

      try {
        await UserService.recordArcadeWin(winner.id, 'shifumi');
        await UserService.recordArcadeLoss(loser.id, 'shifumi');
        await ArcadeStatsService.incrementGameCount('shifumi');

      } catch (error) {
        console.error('Erreur lors de la fin de partie shifumi:', error);
      }

      const finalEmbed = new EmbedBuilder()
        .setTitle(`✂️ Partie terminée`)
        .setDescription(
          `${game.challenger} **${game.challengerScore}** - **${game.opponentScore}** ${game.opponent}\n\n` +
          victoryMsg
        )
        .setColor(0xffd700)
        .setFooter({ text: this.footerText(game.targetScore) });

      await interaction.editReply({ embeds: [finalEmbed], components: [] });
    } catch (error) {
      console.error('Erreur endGame shifumi:', error);
    } finally {
      if (game.timeout) clearTimeout(game.timeout);
      pendingGames.delete(gameId);
    }
  },

  async cancelGame(gameId: string, interaction: ChatInputCommandInteraction) {
    const game = pendingGames.get(gameId);
    if (!game) return;

    try {
      const cancelEmbed = new EmbedBuilder()
        .setDescription('⏱️ Temps écoulé - Partie annulée')
        .setColor(0xff0000);

      await interaction.editReply({ embeds: [cancelEmbed], components: [] });
    } catch (error) {
      console.error('Erreur cancelGame shifumi:', error);
    } finally {
      if (game.timeout) clearTimeout(game.timeout);
      pendingGames.delete(gameId);
    }
  },

  buildChoiceRow(gameId: string, round: number) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`shifumi_pierre_${gameId}_${round}`)
        .setLabel('Pierre')
        .setEmoji('🪨')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`shifumi_feuille_${gameId}_${round}`)
        .setLabel('Feuille')
        .setEmoji('📄')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`shifumi_ciseaux_${gameId}_${round}`)
        .setLabel('Ciseaux')
        .setEmoji('✂️')
        .setStyle(ButtonStyle.Danger)
    );
  },

  footerText(targetScore: number): string {
    return `Premier à ${targetScore} points` + ` • /shifumi`;
  },

  determineWinner(choice1: ShifumiChoice, choice2: ShifumiChoice): 'player1' | 'player2' | 'draw' {
    if (choice1 === choice2) return 'draw';
    const winConditions: Record<ShifumiChoice, ShifumiChoice> = {
      pierre: 'ciseaux',
      feuille: 'pierre',
      ciseaux: 'feuille'
    };
    return winConditions[choice1] === choice2 ? 'player1' : 'player2';
  },

  capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
};
