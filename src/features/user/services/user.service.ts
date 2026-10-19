import { User as DiscordUser, Guild } from 'discord.js';
import UserModel, { IUser } from '../models/user.model';
import { ArcadeGameName } from '../../arcade/types/arcade.types';
import { toParisDayYMD, parisMidnightUTC } from '../../../shared/time/day-split';
import { LogService } from '../../../shared/logs/logs.service';
import { MoneyFlow } from '../../../shared/logs/bot-log.model';

export class UserService {

  static async getUserByDiscordId(discordId: string) {
    return UserModel.findOne({ discordId });
  }

  static async getUsers() {
    return UserModel.find({});
  }

  static async createUser(userData: DiscordUser, _guildData?: Guild) {
    return UserModel.create({
      discordId: userData.id,
      name: userData.username,
      profil: { money: 50, exp: 0, lvl: 1 },
      stats: { totalMsg: 0, voiceTime: 0, voiceHistory: [] },
      infos: { registeredAt: new Date(), updatedAt: new Date() }
    });
  }

  static async updateUser(discordId: string, updates: any) {
    return UserModel.findOneAndUpdate(
      { discordId },
      { $set: updates },
      { new: true }
    );
  }

  static async incrementTotalMsg(discordId: string) {
    return UserModel.findOneAndUpdate(
      { discordId },
      { $inc: { 'stats.totalMsg': 1 } },
      { new: true, upsert: true }
    );
  }

  static async getVoiceStatsLast14Days(discordId: string): Promise<{ date: Date; time: number }[]> {
    return this.aggregateVoiceHistoryByParisDay(discordId, 14);
  }

  static async getVoiceStatsLast7Days(discordId: string): Promise<{ date: Date; time: number }[]> {
    return this.aggregateVoiceHistoryByParisDay(discordId, 7);
  }

  private static async aggregateVoiceHistoryByParisDay(
    discordId: string,
    days: number,
  ): Promise<{ date: Date; time: number }[]> {
    const user = await UserModel.findOne({ discordId });
    if (!user) return [];

    const cutoffYMD = toParisDayYMD(new Date(Date.now() - days * 86_400_000));

    const dailyStats = new Map<string, number>();
    user.stats.voiceHistory.forEach(entry => {
      const dayYMD = toParisDayYMD(new Date(entry.date));
      if (dayYMD >= cutoffYMD) {
        dailyStats.set(dayYMD, (dailyStats.get(dayYMD) || 0) + entry.time);
      }
    });

    return Array.from(dailyStats.entries())
      .map(([dayYMD, time]) => ({ date: parisMidnightUTC(dayYMD), time }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  static async updateUserMoney(discordId: string, amount: number, reason = 'inconnu', flow: MoneyFlow = 'mint') {
    const updated = await UserModel.findOneAndUpdate(
      { discordId },
      { $inc: { 'profil.money': amount } },
      { new: true }
    );
    await LogService.economy(discordId, amount, reason, undefined, flow);
    return updated;
  }

  /** Débite seulement si le solde suffit, en une écriture : deux débits simultanés ne passent pas tous les deux. */
  static async tryDebit(discordId: string, amount: number): Promise<boolean> {
    const res = await UserModel.updateOne(
      { discordId, 'profil.money': { $gte: amount } },
      { $inc: { 'profil.money': -amount } },
    );
    return res.modifiedCount === 1;
  }

  static async getUserMoney(discordId: string): Promise<number> {
    const user = await UserModel.findOne({ discordId });
    return user?.profil?.money || 0;
  }

  static async recordArcadeWin(discordId: string, gameName: ArcadeGameName) {
    return UserModel.findOneAndUpdate(
      { discordId },
      { $inc: { [`stats.arcade.${gameName}.wins`]: 1 } },
      { new: true, upsert: true }
    );
  }

  static async recordArcadeAttempt(discordId: string, gameName: ArcadeGameName) {
    return UserModel.findOneAndUpdate(
      { discordId },
      { $inc: { [`stats.arcade.${gameName}.attempts`]: 1 } },
      { new: true, upsert: true }
    );
  }

  static async recordArcadeLoss(discordId: string, gameName: ArcadeGameName) {
    return UserModel.findOneAndUpdate(
      { discordId },
      { $inc: { [`stats.arcade.${gameName}.losses`]: 1 } },
      { new: true, upsert: true }
    );
  }

  static async getArcadeStats(discordId: string, gameName?: ArcadeGameName) {
    const user = await UserModel.findOne({ discordId });
    if (!user?.stats?.arcade) return gameName ? { wins: 0, losses: 0 } : { shifumi: { wins: 0, losses: 0 }, puissance4: { wins: 0, losses: 0 }, morpion: { wins: 0, losses: 0 }, battle: { wins: 0, losses: 0 } };

    if (gameName) {
      return user.stats.arcade[gameName] || { wins: 0, losses: 0 };
    }

    return user.stats.arcade;
  }

  static async updateDailyStreak(discordId: string): Promise<IUser | null> {
    const user = await UserModel.findOne({ discordId });
    if (!user) return null;

    const now = new Date();
    const toParisDay = (d: Date) => d.toLocaleDateString('sv', { timeZone: 'Europe/Paris' });
    const today = toParisDay(now);

    if (!user.stats.lastActivityDate) {
      return UserModel.findOneAndUpdate(
        { discordId },
        {
          $set: {
            'stats.lastActivityDate': now,
            'stats.dailyStreak': 1
          }
        },
        { new: true }
      );
    }

    const lastActivity = new Date(user.stats.lastActivityDate);
    const lastActivityDay = toParisDay(lastActivity);

    const diffDays = Math.floor((Date.parse(today) - Date.parse(lastActivityDay)) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return user;
    } else if (diffDays === 1) {
      return UserModel.findOneAndUpdate(
        { discordId },
        {
          $set: { 'stats.lastActivityDate': now },
          $inc: { 'stats.dailyStreak': 1 }
        },
        { new: true }
      );
    } else {
      return UserModel.findOneAndUpdate(
        { discordId },
        {
          $set: {
            'stats.lastActivityDate': now,
            'stats.dailyStreak': 1
          }
        },
        { new: true }
      );
    }
  }

}
