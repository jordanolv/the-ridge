import { BaseCronManager } from './base-cron-manager';
import { BotClient } from '../../bot/client';
import { WeeklyCron } from './weekly.cron';

export class WeeklyCronManager extends BaseCronManager {
  constructor(client: BotClient) {
    super(client, 'weekly');
    this.addCron(new WeeklyCron(client));
  }
}
