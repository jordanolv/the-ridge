import { SlashCommandBuilder } from '@discordjs/builders';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ButtonInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  MessageFlags,
  AttachmentBuilder
} from 'discord.js';
import { BotClient } from '../../../bot/client';
import { UserService } from '../services/user.service';
import { getGuildId } from '../../../shared/guild';
import UserMountainsModel from '../../peak-hunters/models/user-mountains.model';
import { MountainService } from '../../peak-hunters/services/mountain.service';
import { ProfileCardService } from '../services/profileCard.service';

type UserDoc = NonNullable<Awaited<ReturnType<typeof UserService.getUserByDiscordId>>>;

function calculateXpProgress(level: number, experience: number): { current: number; required: number; percent: number } {
  const xpForCurrentLevel = 5 * (level ** 2) + 110 * level + 100;
  const xpForPreviousLevel = level > 1 ? 5 * ((level - 1) ** 2) + 110 * (level - 1) + 100 : 0;
  const current = Math.max(0, experience - xpForPreviousLevel);
  const required = Math.max(1, xpForCurrentLevel - xpForPreviousLevel);
  const percent = Math.min(1, current / required);
  return { current, required, percent };
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 1) {
    return `${hours}h`;
  }
  if (minutes >= 1) {
    const restSec = Math.floor(seconds % 60);
    return restSec > 0 ? `${minutes}m ${restSec}s` : `${minutes}m`;
  }
  return `${Math.floor(seconds)}s`;
}

function formatDateFR(date?: Date | string): string {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type ProfileData = {
  level: number;
  experience: number;
  money: number;
  totalMessages: number;
  voiceTime: number;
  dailyStreak: number;
  bio: string;
  birthday: string;
  joined: string;
  lastActive: string;
  xpText: string;
  avatarUrl: string;
};

function getProfileData(
  discordUser: { username: string; displayAvatarURL: (options?: { size?: number; extension?: string }) => string },
  user: UserDoc
): ProfileData {
  const level = user?.profil?.lvl ?? 0;
  const experience = user?.profil?.exp ?? 0;
  const money = user?.profil?.money ?? 0;
  const totalMessages = user?.stats?.totalMsg ?? 0;
  const voiceTime = user?.stats?.voiceTime ?? 0;
  const dailyStreak = user?.stats?.dailyStreak ?? 0;

  const { current, required, percent } = calculateXpProgress(level, experience);
  const xpText = `${current.toLocaleString('fr-FR')}/${required.toLocaleString('fr-FR')} XP (${Math.round(percent * 100)}%)`;

  const bio = user?.bio && user.bio.trim().length > 0 ? user.bio : 'Aucune bio définie.';
  const birthday = user?.infos?.birthDate ? formatDateFR(user.infos.birthDate) : '-';
  const joined = user?.infos?.registeredAt ? formatDateFR(user.infos.registeredAt) : '-';
  const lastActive = user?.stats?.lastActivityDate ? formatDateFR(user.stats.lastActivityDate) : '-';
  const avatarUrl = discordUser.displayAvatarURL({ size: 256, extension: 'png' });

  return {
    level,
    experience,
    money,
    totalMessages,
    voiceTime,
    dailyStreak,
    bio,
    birthday,
    joined,
    lastActive,
    xpText,
    avatarUrl
  };
}


function buildStatsEmbed(
  discordUser: { username: string; displayAvatarURL: (options?: { size?: number; extension?: string }) => string },
  guildName: string,
  data: ProfileData,
  unlockedMountains: { mountainId: string; unlockedAt: Date }[]
): EmbedBuilder {
  const totalMountains = MountainService.getAll().length;
  const mountainProgress = totalMountains > 0
    ? Math.round((unlockedMountains.length / totalMountains) * 100)
    : 0;

  const progressBar = createProgressBar(mountainProgress);
  const progressBarXP = createProgressBar(Math.round((data.experience % 1000) / 10));
  const badges = getBadges(data);
  const badgesText = badges.slice(0, 4).join('  ');

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setAuthor({
      name: `${discordUser.username} - Statistiques`,
      iconURL: data.avatarUrl
    })
    .setThumbnail(data.avatarUrl)
    .setTitle(`📈 Statistiques détaillées`)
    .setDescription(
      `${badgesText}\n\n` +
      `**💰 Économie** • **🎯 Expérience**\n` +
      `\`${data.money.toLocaleString('fr-FR')}\` 💰 • ${progressBarXP}\n` +
      `\`${data.xpText}\`\n\n` +
      `**━━━━━━━━━━━━━━━━━━━━━━━━**\n\n` +
      `**📊 Activité** • **⛰️ Montagnes**\n` +
      `💬 \`${data.totalMessages.toLocaleString('fr-FR')}\` msgs • 🎙️ \`${formatDuration(data.voiceTime)}\` • 🔥 \`${data.dailyStreak}\`j\n` +
      `${progressBar}\n` +
      `\`${unlockedMountains.length}/${totalMountains}\` montagnes (\`${mountainProgress}%\`)`
    )
    .setTimestamp()
    .setFooter({ text: `${guildName} • Dernière activité : ${data.lastActive}`, iconURL: data.avatarUrl });
}

function buildInfoEmbed(
  discordUser: { username: string; displayAvatarURL: (options?: { size?: number; extension?: string }) => string },
  guildName: string,
  data: ProfileData,
  roles: { name: string; color: string; id: string }[]
): EmbedBuilder {
  // Créer la liste des rôles avec mentions (@role)
  const rolesList = roles.length > 0
    ? roles.slice(0, 12).map(r => `> <@&${r.id}>`).join('\n')
    : '> Aucun rôle';
  const rolesSuffix = roles.length > 12 ? `\n> *... et \`${roles.length - 12}\` autre${roles.length - 12 > 1 ? 's' : ''}*` : '';

  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setAuthor({
      name: `${discordUser.username} - Informations`,
      iconURL: data.avatarUrl
    })
    .setThumbnail(data.avatarUrl)
    .setTitle(`ℹ️ Informations personnelles`)
    .setDescription(
      `**━━━━━━━━━━━━━━━━━━━━━━━━**\n` +
      `### 👤 Profil\n` +
      `> **Anniversaire:** \`${data.birthday}\` 🎂\n` +
      `> **Arrivée sur le serveur:** \`${data.joined}\` 📅\n` +
      `> **Dernière activité:** \`${data.lastActive}\` ⏰\n\n` +
      `**━━━━━━━━━━━━━━━━━━━━━━━━**\n` +
      `### 🏷️ Rôles (\`${roles.length}\`)\n` +
      `${rolesList}${rolesSuffix}`
    )
    .setTimestamp()
    .setFooter({
      text: `${guildName} • ${data.money.toLocaleString('fr-FR')} RidgeCoin • Niveau ${data.level}`,
      iconURL: data.avatarUrl
    });
}

function createProgressBar(percentage: number): string {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  const filledBar = '█'.repeat(filled);
  const emptyBar = '░'.repeat(empty);
  return `${filledBar}${emptyBar}`;
}

// Progress bar stylé avec emojis colorés
function createFancyProgressBar(percentage: number, style: 'blue' | 'green' | 'gold' = 'blue'): string {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;

  const styles = {
    blue: { fill: '🟦', empty: '⬜' },
    green: { fill: '🟩', empty: '⬜' },
    gold: { fill: '🟨', empty: '⬜' }
  };

  const { fill, empty: emptySquare } = styles[style];
  return `${fill.repeat(filled)}${emptySquare.repeat(empty)}`;
}

// Système de badges basé sur les stats
function getBadges(data: ProfileData): string[] {
  const badges: string[] = [];

  // Badges de niveau
  if (data.level >= 100) badges.push('🏆 Immortel');
  else if (data.level >= 75) badges.push('💎 Légendaire');
  else if (data.level >= 50) badges.push('👑 Maître');
  else if (data.level >= 30) badges.push('⭐ Vétéran');
  else if (data.level >= 15) badges.push('🌟 Expérimenté');
  else if (data.level >= 5) badges.push('🔰 Novice');

  // Badges de streak
  if (data.dailyStreak >= 365) badges.push('🔥 Année Complète');
  else if (data.dailyStreak >= 100) badges.push('💥 Centenaire');
  else if (data.dailyStreak >= 30) badges.push('⚡ Enflammé');
  else if (data.dailyStreak >= 7) badges.push('💫 Assidu');

  // Badges d'argent
  if (data.money >= 100000) badges.push('💰 Magnat');
  else if (data.money >= 50000) badges.push('💸 Riche');
  else if (data.money >= 10000) badges.push('🪙 Économe');

  // Badges d'activité
  if (data.totalMessages >= 10000) badges.push('🗣️ Légende du Chat');
  else if (data.totalMessages >= 5000) badges.push('💬 Bavard Expert');
  else if (data.totalMessages >= 1000) badges.push('📢 Communicant');

  if (data.voiceTime >= 360000) badges.push('🎙️ Podcasteur Pro'); // 100h+
  else if (data.voiceTime >= 72000) badges.push('🔊 Voix d\'Or'); // 20h+
  else if (data.voiceTime >= 36000) badges.push('🎧 Causeur'); // 10h+

  return badges.length > 0 ? badges : ['🆕 Nouveau'];
}


// Formatter les montagnes avec emojis
function formatMountains(unlockedMountains: { mountainId: string; unlockedAt: Date }[]): string {
  const allMountains = MountainService.getAll();
  const unlockedIds = new Set(unlockedMountains.map(m => m.mountainId));

  return allMountains.slice(0, 8).map(mountain => {
    const isUnlocked = unlockedIds.has(mountain.id);
    return isUnlocked ? `⛰️ **${mountain.mountainLabel}** ✅` : `🗻 ${mountain.mountainLabel} 🔒`;
  }).join('\n');
}

// ========== COMPONENTS V2 - CONTAINER BUILDERS ==========

function buildStatsContainer(
  discordUser: { username: string; displayAvatarURL: (options?: { size?: number; extension?: string }) => string },
  guildName: string,
  data: ProfileData,
  unlockedMountains: { mountainId: string; unlockedAt: Date }[]
): ContainerBuilder {
  const totalMountains = MountainService.getAll().length;
  const mountainProgress = totalMountains > 0
    ? Math.round((unlockedMountains.length / totalMountains) * 100)
    : 0;

  const progressBar = createFancyProgressBar(mountainProgress, 'green');
  const progressBarXP = createFancyProgressBar(Math.round((data.experience % 1000) / 10), 'gold');
  const badges = getBadges(data);
  const badgesText = badges.slice(0, 4).join('  ');

  return new ContainerBuilder()
    .setAccentColor(0x3498db)
    // Header avec nom et badges
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**${discordUser.username}** - Niveau ${data.level}\n${badgesText}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    )
    // Section avec 2 TextDisplay : Économie + Expérience
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(`**💰 Économie**\n\`${data.money.toLocaleString('fr-FR')}\` 💰`),
          new TextDisplayBuilder()
            .setContent(`**🎯 Expérience**\n${progressBarXP}\n\`${data.xpText}\``)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('eco_xp_details')
            .setLabel('💰🎯')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    )
    // Section avec 2 TextDisplay : Activité + Montagnes
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              `**📊 Activité**\n` +
              `💬 \`${data.totalMessages.toLocaleString('fr-FR')}\`\n` +
              `🎙️ \`${formatDuration(data.voiceTime)}\`\n` +
              `🔥 \`${data.dailyStreak}\` jour${data.dailyStreak > 1 ? 's' : ''}`
            ),
          new TextDisplayBuilder()
            .setContent(
              `**⛰️ Montagnes**\n` +
              `${progressBar}\n` +
              `\`${unlockedMountains.length}/${totalMountains}\` (\`${mountainProgress}%\`)`
            )
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('activity_mountains_details')
            .setLabel('📊⛰️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    // Footer
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*${guildName} • ${data.lastActive}*`)
    );
}

function buildInfoContainer(
  discordUser: { username: string; displayAvatarURL: (options?: { size?: number; extension?: string }) => string },
  guildName: string,
  data: ProfileData,
  roles: { name: string; color: string; id: string }[]
): ContainerBuilder {
  const rolesList = roles.length > 0
    ? roles.slice(0, 12).map(r => `<@&${r.id}>`).join(', ')
    : 'Aucun rôle';
  const rolesSuffix = roles.length > 12 ? `\n*... et \`${roles.length - 12}\` autre${roles.length - 12 > 1 ? 's' : ''}*` : '';

  return new ContainerBuilder()
    .setAccentColor(0x9b59b6)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**${discordUser.username}** - Informations`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**👤 Profil**`)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          `**Anniversaire:** \`${data.birthday}\` 🎂\n` +
          `**Arrivée sur le serveur:** \`${data.joined}\` 📅\n` +
          `**Dernière activité:** \`${data.lastActive}\` ⏰`
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**🏷️ Rôles (${roles.length})**`)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`${rolesList}${rolesSuffix}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*${guildName} • ${data.money.toLocaleString('fr-FR')} RidgeCoin • Niveau ${data.level}*`)
    );
}

function buildAchievementsContainer(
  discordUser: { username: string; displayAvatarURL: (options?: { size?: number; extension?: string }) => string },
  guildName: string,
  data: ProfileData,
  unlockedMountains: { mountainId: string; unlockedAt: Date }[]
): ContainerBuilder {
  const badges = getBadges(data);
  const mountains = formatMountains(unlockedMountains);
  const totalMountains = MountainService.getAll().length;

  return new ContainerBuilder()
    .setAccentColor(0xf39c12)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**${discordUser.username}** - Succès & Récompenses`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**🏆 Badges Débloqués (${badges.length})**`)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(badges.join('\n'))
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**⛰️ Collection de Montagnes (${unlockedMountains.length}/${totalMountains})**`)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(mountains || 'Aucune montagne débloquée pour le moment.')
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`*${guildName} • Continue à progresser pour débloquer plus de récompenses !*`)
    );
}

function createButtons(currentPage: 'stats' | 'info' | 'achievements', useContainer: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const navButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_stats')
      .setLabel('Statistiques')
      .setEmoji('📈')
      .setStyle(currentPage === 'stats' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(currentPage === 'stats'),
    new ButtonBuilder()
      .setCustomId('profile_info')
      .setLabel('Informations')
      .setEmoji('ℹ️')
      .setStyle(currentPage === 'info' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(currentPage === 'info'),
    new ButtonBuilder()
      .setCustomId('profile_achievements')
      .setLabel('Succès')
      .setEmoji('🏆')
      .setStyle(currentPage === 'achievements' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(currentPage === 'achievements')
  );

  const toggleButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_toggle_view')
      .setLabel(useContainer ? 'Mode Embed' : 'Mode Container')
      .setEmoji(useContainer ? '📋' : '🎨')
      .setStyle(ButtonStyle.Success)
  );

  return [navButtons, toggleButton];
}

export default {
  data: new SlashCommandBuilder()
    .setName('me')
    .setDescription('Afficher vos informations personnelles'),
  async execute(interaction: ChatInputCommandInteraction, _client: BotClient) {
    try {
      await interaction.deferReply();

      const user = await UserService.getUserByDiscordId(interaction.user.id);

      if (!user) {
        await interaction.editReply({
          content: '❌ Utilisateur non trouvé dans la base de données.'
        });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const roles = member.roles.cache
        .filter(role => role.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.hexColor
        }));

      // Récupérer les montagnes débloquées
      const userMountains = await UserMountainsModel.findOne({ userId: interaction.user.id });
      const unlockedMountains = userMountains?.unlockedMountains ?? [];

      // Récupérer les données du profil
      const profileData = getProfileData(interaction.user, user);

      // Préparer les données des montagnes
      const allMountains = MountainService.getAll();
      const unlockedIds = new Set(unlockedMountains.map(m => m.mountainId));
      const mountainsData = allMountains.map(m => ({
        name: m.mountainLabel,
        unlocked: unlockedIds.has(m.id)
      }));

      const weeklyActivity = await UserService.getVoiceStatsLast14Days(interaction.user.id);

      // Générer l'image de profil
      const xpProgress = calculateXpProgress(profileData.level, profileData.experience);
      const cardBuffer = await ProfileCardService.generateCard({
        themeId: user.profil?.cardTheme,
        pseudo: interaction.user.username,
        bio: profileData.bio,
        ridgecoin: profileData.money.toLocaleString('fr-FR'),
        level: profileData.level.toString(),
        messages: profileData.totalMessages.toLocaleString('fr-FR'),
        voc: formatDuration(profileData.voiceTime),
        birthday: profileData.birthday,
        joinedAt: profileData.joined,
        avatarUrl: profileData.avatarUrl,
        roles: roles.map(r => ({ name: r.name, color: r.color })),
        weeklyActivity,
        mountains: mountainsData,
        xp: xpProgress
      });
      const attachment = new AttachmentBuilder(cardBuffer, { name: 'profile-card.png' });

      await interaction.editReply({
        files: [attachment]
      });
    } catch (error) {
      console.error('Erreur dans la commande /me:', error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: '❌ Une erreur est survenue lors de l\'exécution de la commande.',
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de l\'exécution de la commande.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
};
