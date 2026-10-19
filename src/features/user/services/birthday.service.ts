import {
  Client,
  TextChannel,
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
} from 'discord.js';
import { toZonedTime } from 'date-fns-tz';
import UserModel from '../models/user.model';
import { UserMountainsRepository } from '../../peak-hunters/repositories/user-mountains.repository';
import { LogService } from '../../../shared/logs/logs.service';
import { rc } from '../../../shared/economy/currency';

export const BIRTHDAY_TZ = 'Europe/Paris';
export const BIRTHDAY_EXPEDITIONS = 5;

export async function sendBirthdayAnnouncement(
  client: Client,
  channel: TextChannel,
  discordId: string,
  name: string,
  birthDate: Date,
): Promise<{ moneyGift: number }> {
  const nowParis = toZonedTime(new Date(), BIRTHDAY_TZ);
  const bdParis = toZonedTime(new Date(birthDate), BIRTHDAY_TZ);
  const age = nowParis.getFullYear() - bdParis.getFullYear();

  const discordUser = await client.users.fetch(discordId).catch(() => null);
  const avatarUrl = discordUser?.displayAvatarURL({ size: 256 });

  const moneyGift = Math.floor(Math.random() * 91) + 10;

  await Promise.all([
    UserModel.updateOne({ discordId }, { $inc: { 'profil.money': moneyGift } }),
    UserMountainsRepository.addExpeditions(discordId, BIRTHDAY_EXPEDITIONS),
  ]);
  await LogService.economy(discordId, moneyGift, 'Cadeau anniversaire', 'Birthday');
  await LogService.info(`<@${discordId}> a reçu **${BIRTHDAY_EXPEDITIONS} expéditions** 🗺️ pour son anniversaire 🎂`, { feature: 'Birthday', title: '🗺️ Expéditions gagnées' });

  const container = new ContainerBuilder()
    .setAccentColor(0xdac1ff)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# 🎉 Joyeux Anniversaire !\n-# <@${discordId}> · ${age} ans aujourd'hui`
          ),
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl ?? 'https://cdn.discordapp.com/embed/avatars/0.png'),
        ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Toute l'équipe de **The Ridge** souhaite un joyeux anniversaire à <@${discordId}> ! 🎂`
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '### 🎁 Cadeaux du jour',
          `-# **+${moneyGift}** ${rc()} ajoutés à ton solde`,
          `-# 🗺️ **+${BIRTHDAY_EXPEDITIONS} expéditions** pour découvrir des montagnes`,
        ].join('\n')
      ),
    );

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  return { moneyGift };
}
