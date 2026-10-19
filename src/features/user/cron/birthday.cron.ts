import { CronJob } from 'cron';
import { Client, TextChannel, ChannelType, PermissionsBitField } from 'discord.js';
import { toZonedTime } from 'date-fns-tz';
import UserModel from '../models/user.model';
import AppConfigModel from '../../discord/models/app-config.model';
import { LogService } from '../../../shared/logs/logs.service';
import { getGuildId } from '../../../shared/guild';
import { sendBirthdayAnnouncement, BIRTHDAY_TZ, BIRTHDAY_EXPEDITIONS } from '../services/birthday.service';

export class BirthdayCron {
  private job: CronJob;
  private client: Client;

  constructor(client: Client) {
    this.client = client;

    this.job = new CronJob(
      '0 0 0 * * *',
      this.checkBirthdays.bind(this),
      null,
      false,
      BIRTHDAY_TZ
    );
  }

  public start(): void {
    this.job.start();
    const chalk = require('chalk');
    console.log(chalk.yellow('   ├─ 🎂 Birthday') + chalk.gray(` • tous les jours à 00:00 ${BIRTHDAY_TZ}`));
  }

  public stop(): void {
    this.job.stop();
  }

  public async checkBirthdays(): Promise<void> {
    try {
      const nowParis = toZonedTime(new Date(), BIRTHDAY_TZ);
      const monthToday = nowParis.getMonth() + 1;
      const dayToday = nowParis.getDate();

      await LogService.info(`Vérification des anniversaires pour ${dayToday}/${monthToday} (Paris)`, {
        feature: 'birthday'
      });

      const guildDoc = await AppConfigModel.findOne({});
      const birthdayConfig = guildDoc?.features?.birthday;

      if (!birthdayConfig?.enabled) {
        await LogService.info(`Fonctionnalité d'anniversaire désactivée`, { feature: 'birthday' });
        return;
      }

      const users = await UserModel.find({
        'infos.birthDate': { $exists: true, $ne: null }
      });

      const discordGuild = this.client.guilds.cache.get(getGuildId());
      const birthdayChannelId = birthdayConfig?.channel || discordGuild?.systemChannelId;
      if (!birthdayChannelId) {
        await LogService.warning(`Aucun canal d'anniversaire configuré`, { feature: 'birthday' });
        return;
      }

      for (const user of users) {
        if (!user.infos.birthDate) continue;

        const bdParis = toZonedTime(new Date(user.infos.birthDate), BIRTHDAY_TZ);
        if (bdParis.getMonth() + 1 !== monthToday || bdParis.getDate() !== dayToday) continue;

        const chan = await this.client.channels.fetch(birthdayChannelId).catch(() => null);
        if (!chan || chan.type !== ChannelType.GuildText) {
          await LogService.error(`Canal ${birthdayChannelId} non trouvé ou n'est pas un canal texte`, { feature: 'birthday' });
          continue;
        }
        const textChannel = chan as TextChannel;

        const me = this.client.user;
        if (!me || !textChannel.permissionsFor(me).has(PermissionsBitField.Flags.SendMessages)) {
          await LogService.error(`Permission d'envoi manquante dans le canal ${birthdayChannelId}`, { feature: 'birthday' });
          continue;
        }

        const { moneyGift } = await sendBirthdayAnnouncement(this.client, textChannel, user.discordId, user.name, user.infos.birthDate);

        await LogService.success(
                    `🎂 Anniversaire de ${user.name} — +${moneyGift} 💰, +${BIRTHDAY_EXPEDITIONS} expéditions`,
          { feature: 'birthday' },
        );
      }
    } catch (err) {
      console.error('Error in BirthdayCron:', err);
      await LogService.error(`Erreur lors de la vérification des anniversaires: ${err.message}`, { feature: 'birthday' });
    }
  }
}
