import UserModel, { IUser } from '../models/user.model';
import { AppConfigService } from '../../discord/services/app-config.service';
import { NotFoundError, BirthdaySearchCriteria, BirthdayUser } from './user.types';

export type RankedField = 'stats.totalMsg' | 'stats.voiceTime' | 'stats.dailyStreak' | 'stats.activityPoints';

export class UserRepository {

  // ===== USER OPERATIONS =====
  async findUserById(discordId: string): Promise<IUser | null> {
    return UserModel.findOne({ discordId });
  }

  async findAllUsers(): Promise<IUser[]> {
    return UserModel.find({});
  }

  async createUser(userData: {
    discordId: string,
    name: string,
    birthday?: Date
  }): Promise<IUser> {
    return UserModel.create({
      discordId: userData.discordId,
      name: userData.name,
      profil: { money: 50, exp: 0, lvl: 1 },
      stats: { totalMsg: 0, voiceTime: 0, voiceHistory: [] },
      infos: {
        registeredAt: new Date(),
        updatedAt: new Date(),
        birthDate: userData.birthday
      }
    });
  }

  async updateUser(
    discordId: string,
    updates: {
      name?: string;
      birthday?: Date;
      profil?: Partial<{ money: number; exp: number; lvl: number }>;
      stats?: Partial<{ totalMsg: number; voiceTime: number }>;
    }
  ): Promise<IUser> {
    const updateDoc: any = {};

    if (updates.name) updateDoc.name = updates.name;
    if (updates.birthday !== undefined) updateDoc['infos.birthDate'] = updates.birthday;
    if (updates.profil) {
      Object.keys(updates.profil).forEach(key => {
        updateDoc[`profil.${key}`] = updates.profil![key as keyof typeof updates.profil];
      });
    }
    if (updates.stats) {
      Object.keys(updates.stats).forEach(key => {
        updateDoc[`stats.${key}`] = updates.stats![key as keyof typeof updates.stats];
      });
    }

    updateDoc['infos.updatedAt'] = new Date();

    const user = await UserModel.findOneAndUpdate(
      { discordId },
      updateDoc,
      { new: true }
    );

    if (!user) {
      throw new NotFoundError('Utilisateur non trouvé');
    }

    return user;
  }

  async deleteUser(discordId: string): Promise<boolean> {
    const result = await UserModel.deleteOne({ discordId });
    return result.deletedCount > 0;
  }

  // ===== BIRTHDAY OPERATIONS =====
  async setBirthday(discordId: string, birthday: Date): Promise<IUser> {
    return this.updateUser(discordId, { birthday });
  }

  async findUsersByBirthday(criteria: BirthdaySearchCriteria): Promise<BirthdayUser[]> {
    const users = await UserModel.find({
      'infos.birthDate': { $exists: true, $ne: null }
    });

    return users
      .filter(user => {
        if (!user.infos.birthDate) return false;
        const birthday = new Date(user.infos.birthDate);
        return birthday.getMonth() + 1 === criteria.month &&
               birthday.getDate() === criteria.day;
      })
      .map(user => ({
        discordId: user.discordId,
        name: user.name,
        birthday: user.infos.birthDate!,
        age: this.calculateAge(user.infos.birthDate!)
      }));
  }

  // ===== BIRTHDAY CONFIG OPERATIONS =====
  async getBirthdayConfig() {
    const guild = await AppConfigService.getOrCreateConfig();

    if (!guild.features.birthday) {
      guild.features.birthday = {
        channel: '',
        enabled: false
      };
      await guild.save();
    }

    return guild.features.birthday;
  }

  async updateBirthdayConfig(updates: { channel?: string; enabled?: boolean }) {
    const guild = await AppConfigService.getOrCreateConfig();

    if (!guild.features.birthday) {
      guild.features.birthday = {
        channel: '',
        enabled: false
      };
    }

    if (updates.channel !== undefined) guild.features.birthday.channel = updates.channel;
    if (updates.enabled !== undefined) guild.features.birthday.enabled = updates.enabled;

    await guild.save();
    return guild.features.birthday;
  }

  // ===== LEVEL OPERATIONS =====
  async addExperience(discordId: string, exp: number): Promise<IUser> {
    const user = await this.findUserById(discordId);
    if (!user) {
      throw new NotFoundError('Utilisateur non trouvé');
    }

    const currentExp = user.profil.exp + exp;
    const newLevel = this.calculateLevel(currentExp);

    return this.updateUser(discordId, {
      profil: {
        exp: currentExp,
        lvl: newLevel
      }
    });
  }

  async updateMoney(discordId: string, amount: number): Promise<IUser> {
    const user = await this.findUserById(discordId);
    if (!user) {
      throw new NotFoundError('Utilisateur non trouvé');
    }

    const newAmount = Math.max(0, user.profil.money + amount);

    return this.updateUser(discordId, {
      profil: { money: newAmount }
    });
  }

  // ===== HELPER METHODS =====
  private calculateAge(birthday: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    const monthDiff = today.getMonth() - birthday.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
      age--;
    }

    return age;
  }

  private calculateLevel(exp: number): number {
    return Math.floor(exp / 100) + 1;
  }

  // ===== SEARCH & FILTERS =====
  async findTopUsersByExp(limit: number = 10): Promise<IUser[]> {
    return UserModel
      .find({})
      .sort({ 'profil.exp': -1 })
      .limit(limit);
  }

  async findTopUsersByMoney(limit: number = 10): Promise<IUser[]> {
    return UserModel
      .find({})
      .sort({ 'profil.money': -1 })
      .limit(limit);
  }

  async findTopUsersByMessages(limit: number = 10): Promise<IUser[]> {
    return UserModel
      .find({})
      .sort({ 'stats.totalMsg': -1 })
      .limit(limit);
  }

  async findTopUsersByVoiceTime(limit: number = 10): Promise<IUser[]> {
    return UserModel
      .find({})
      .sort({ 'stats.voiceTime': -1 })
      .limit(limit);
  }

  async countUsers(): Promise<number> {
    return UserModel.countDocuments({});
  }

  /** Rang dans un classement : 1 + le nombre de joueurs strictement devant. */
  async rankBy(field: RankedField, value: number): Promise<number> {
    return 1 + (await UserModel.countDocuments({ [field]: { $gt: value } }));
  }

  async namesOf(discordIds: string[]): Promise<Map<string, string>> {
    const users = await UserModel.find({ discordId: { $in: discordIds } }).select('discordId name').lean();
    return new Map(users.map(u => [u.discordId, u.name]));
  }
}
