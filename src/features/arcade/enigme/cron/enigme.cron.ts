import { CronJob } from 'cron';
import { BotClient } from '../../../../bot/client';
import { EnigmeService } from '../services/enigme.service';
import { ENIGME_REVEAL_HOUR, ENIGME_SPAWN_HOUR } from '../constants/enigme.constants';

const TZ = 'Europe/Paris';

export class EnigmeCron {
  private job: CronJob;
  private client: BotClient;

  constructor(client: BotClient) {
    this.client = client;
    this.job = new CronJob('0 1 0 * * *', () => EnigmeService.planDay(this.client), null, false, TZ);
  }

  public start(): void {
    this.job.start();
    const chalk = require('chalk');
    console.log(
      chalk.yellow('   ├─ 🧩 Énigme') +
        chalk.gray(` • minuit ${TZ}, selon planning hebdo, lancement ${ENIGME_SPAWN_HOUR}h, révélation ${ENIGME_REVEAL_HOUR}h`),
    );
  }

  public stop(): void {
    this.job.stop();
  }
}
