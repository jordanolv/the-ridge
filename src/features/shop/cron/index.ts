import { BaseCronManager } from '../../../shared/cron/base-cron-manager';
import { BotClient } from '../../../bot/client';
import { ShopExpiryCron } from './shop-expiry.cron';

export class ShopCronManager extends BaseCronManager {
  constructor(client: BotClient) {
    super(client, 'shop');
    this.addCron(new ShopExpiryCron());
  }
}
