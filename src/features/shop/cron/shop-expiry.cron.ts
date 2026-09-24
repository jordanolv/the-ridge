import { CronJob } from 'cron';
import { BotClient } from '../../../bot/client';
import { ShopService } from '../services/shop.service';

const TZ = 'Europe/Paris';
const CRON_EXPRESSION = '0 0 * * * *';

export class ShopExpiryCron {
  private job: CronJob;

  constructor() {
    this.job = new CronJob(CRON_EXPRESSION, this.run.bind(this), null, false, TZ);
  }

  public start(): void {
    this.job.start();
    const chalk = require('chalk');
    console.log(chalk.yellow('   ├─ 🛒 Boutique') + chalk.gray(' • expirations toutes les heures'));
  }

  public stop(): void {
    this.job.stop();
  }

  private async run(): Promise<void> {
    const guild = BotClient.getGuild();
    if (!guild) return;

    const revoked = await ShopService.expireDue(userId => guild.members.fetch(userId).catch(() => null));
    if (revoked > 0) console.log(`[Shop] ${revoked} location(s) expirée(s)`);
  }
}
