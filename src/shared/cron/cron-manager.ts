import { Client } from 'discord.js';
import { UserCronManager } from '../../features/user/cron';
import { PeakHuntersCronManager } from '../../features/peak-hunters/cron';
import { WeeklyCronManager } from './weekly-cron-manager';
import { QuizCronManager } from '../../features/quiz/cron';
import { BingoCronManager } from '../../features/arcade/bingo/cron';
import { JustePrixCronManager } from '../../features/arcade/juste-prix/cron';
import { AvalancheCronManager } from '../../features/arcade/avalanche/cron';
import { EnigmeCronManager } from '../../features/arcade/enigme/cron';
import { ShopCronManager } from '../../features/shop/cron';
import { BaseCronManager, IStartStoppable } from './base-cron-manager';
import { BotClient } from '../../bot/client';

export class CronManager extends BaseCronManager {
    private userCronManager: UserCronManager;
    private mountainCronManager: PeakHuntersCronManager;
    private weeklyCronManager: WeeklyCronManager;
    private quizCronManager: QuizCronManager;
    private bingoCronManager: BingoCronManager;
    private justePrixCronManager: JustePrixCronManager;
    private avalancheCronManager: AvalancheCronManager;
    private enigmeCronManager: EnigmeCronManager;
    private shopCronManager: ShopCronManager;

    constructor(client: BotClient) {
        super(client, 'global');

        this.userCronManager = new UserCronManager(client);
        this.mountainCronManager = new PeakHuntersCronManager(client);
        this.weeklyCronManager = new WeeklyCronManager(client);
        this.quizCronManager = new QuizCronManager(client);
        this.bingoCronManager = new BingoCronManager(client);
        this.justePrixCronManager = new JustePrixCronManager(client);
        this.avalancheCronManager = new AvalancheCronManager(client);
        this.enigmeCronManager = new EnigmeCronManager(client);
        this.shopCronManager = new ShopCronManager(client);

        this.addCron(this.userCronManager);
        this.addCron(this.mountainCronManager);
        this.addCron(this.weeklyCronManager);
        this.addCron(this.quizCronManager);
        this.addCron(this.bingoCronManager);
        this.addCron(this.justePrixCronManager);
        this.addCron(this.avalancheCronManager);
        this.addCron(this.enigmeCronManager);
        this.addCron(this.shopCronManager);
    }

    public getUserCronManager(): UserCronManager {
        return this.userCronManager;
    }
} 