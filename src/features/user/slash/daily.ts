import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { isSilentDiscordError } from '../../../shared/utils/discord-errors';
import { BotClient } from '../../../bot/client';
import UserModel from '../models/user.model';
import { LogService } from '../../../shared/logs/logs.service';
import { parisMidnightUTC, toParisDayYMD } from '../../../shared/time/day-split';
import { DailyStoryService } from '../services/daily-story.service';
import { awardExpeditions } from '../../peak-hunters/services/expedition.service';
import { dropMountain } from '../../peak-hunters/services/mountain.service';

const MAX_MONEY = 10;
const MAX_XP = 100;

const PACK_CHANCES = [
  { packs: 0, weight: 40 },
  { packs: 1, weight: 40 },
  { packs: 2, weight: 15 },
  { packs: 3, weight: 5  },
];

function randomUpTo(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}

function rollPacks(): number {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const { packs, weight } of PACK_CHANCES) {
    cumulative += weight;
    if (roll < cumulative) return packs;
  }
  return 0;
}

export default {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Réclamez votre récompense quotidienne'),

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    try {
      await interaction.deferReply();

      const user = await UserModel.findOne({
        discordId: interaction.user.id
      });

      if (!user) {
        await interaction.editReply({
          content: '❌ Utilisateur non trouvé dans la base de données.'
        });
        return;
      }

      const now = new Date();
      const moneyReward = randomUpTo(MAX_MONEY);
      const xpReward = randomUpTo(MAX_XP);
      const packsReward = rollPacks();

      const claimed = await UserModel.findOneAndUpdate(
        {
          discordId: interaction.user.id,
          $or: [
            { 'stats.lastDailyClaimDate': null },
            { 'stats.lastDailyClaimDate': { $lt: parisMidnightUTC(toParisDayYMD(now)) } },
          ],
        },
        {
          $inc: {
            'profil.money': moneyReward,
            'profil.exp': xpReward,
            'stats.totalDailies': 1
          },
          $set: {
            'stats.lastDailyClaimDate': now
          }
        },
        { new: true }
      );

      if (!claimed) {
        const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const nextParisMidnight = new Date(parisNow);
        nextParisMidnight.setDate(nextParisMidnight.getDate() + 1);
        nextParisMidnight.setHours(0, 0, 0, 0);
        const tomorrowTimestamp = Math.floor((nextParisMidnight.getTime() + (now.getTime() - parisNow.getTime())) / 1000);

        await interaction.editReply({
          content: `⏰ Vous avez déjà réclamé votre récompense quotidienne aujourd'hui !\n` +
                   `Revenez <t:${tomorrowTimestamp}:R>.`
        });
        return;
      }

      await LogService.economy(interaction.user.id, moneyReward, 'Daily', 'Daily');

      let expeditionSummary = '';
      if (packsReward > 0) {
        const result = await awardExpeditions(interaction.user.id, packsReward);
        expeditionSummary = result.summary;
        await LogService.info(`<@${interaction.user.id}> a reçu **${packsReward} expédition${packsReward > 1 ? 's' : ''}** ${expeditionSummary}`, { feature: 'Daily', title: '🗺️ Expéditions gagnées' });
      }

      const story = await DailyStoryService.generate(interaction.user.displayName, moneyReward, xpReward, packsReward);

      const fields = [
        {
          name: '💰 Argent',
          value: `+${moneyReward} 💰`,
          inline: true
        },
        {
          name: '⭐ Expérience',
          value: `+${xpReward} XP`,
          inline: true
        },
      ];

      if (packsReward > 0) {
        fields.push({
          name: '🗺️ Expéditions',
          value: `+${packsReward} expédition${packsReward > 1 ? 's' : ''} ${expeditionSummary}`,
          inline: true
        });
      }

      const mountainDrop = await dropMountain(interaction.user.id);
      if (mountainDrop) {
        const { rarityEmoji, rarityLabel, mountainLabel, isDuplicate, fragmentsGained, expeditionsAwarded, expeditionsSummary } = mountainDrop;
        let mountainValue = isDuplicate
          ? `${rarityEmoji} **${mountainLabel}** — ${rarityLabel}\n🔁 Déjà possédée → +${fragmentsGained} fragment${fragmentsGained > 1 ? 's' : ''} 🧩`
          : `${rarityEmoji} **${mountainLabel}** — ${rarityLabel}\n✅ Nouvelle montagne débloquée !`;
        if (expeditionsAwarded > 0) {
          mountainValue += `\n→ +${expeditionsAwarded} expédition${expeditionsAwarded > 1 ? 's' : ''} ${expeditionsSummary}`;
        }
        fields.push({
          name: '⛰️ Montagne',
          value: mountainValue,
          inline: false
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#4CAF50')
        .setTitle('🎁 Récompense Quotidienne')
        .setDescription(story ?? 'Vous avez réclamé votre récompense quotidienne !')
        .addFields(...fields)
        .setFooter({
          text: `Revenez demain pour plus de récompenses !`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      if (mountainDrop) embed.setImage(mountainDrop.image);

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      if (isSilentDiscordError(error)) return;
      console.error('Erreur dans la commande /daily:', error);

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors de l\'exécution de la commande.'
        }).catch(() => {});
      } else {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de l\'exécution de la commande.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }
  }
};
