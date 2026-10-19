import { BotClient } from '../../../bot/client';
import { LogService } from '../../../shared/logs/logs.service';
import { LevelingConfig } from '../models/leveling-config.model';
import { AppConfigService } from '../../discord/services/app-config.service';
import UserModel, { IUser } from '../../user/models/user.model';
import { Message } from 'discord.js';
import { emojis } from '../../../utils/emojis';
import {
  UpdateLevelingConfigDTO,
  LevelUpResult,
  XpCalculation,
  LevelingError,
  ValidationError,
  ValidationResult
} from './leveling.types';

export class LevelingService {
  private static xpCooldown: Record<string, number> = {};

  /**
   * Récupère la configuration de leveling pour une guilde
   */
  static async getLevelingConfig(): Promise<LevelingConfig | null> {
    try {
      const guild = await AppConfigService.getOrCreateConfig();
      return guild?.features?.leveling || null;
    } catch (error) {
      throw new LevelingError(`Erreur lors de la récupération de la config leveling: ${error}`, 'CONFIG_FETCH_ERROR');
    }
  }

  /**
   * Récupère ou crée la configuration de leveling
   */
  static async getOrCreateLevelingConfig(enabled: boolean = false): Promise<LevelingConfig> {
    try {
      const guild = await AppConfigService.getOrCreateConfig();
      
      // Initialisation de la config si elle n'existe pas
      if (!guild.features) guild.features = {};
      if (!guild.features.leveling) {
        guild.features.leveling = {
          enabled: false,
          taux: 1,
          notifLevelUp: true,
        };
      }
      
      // Si la config est nouvellement créée et enabled est spécifié
      if (!guild.features.leveling.enabled && enabled) {
        guild.features.leveling.enabled = enabled;
        await guild.save();
      }

      return guild.features.leveling;
    } catch (error) {
      throw new LevelingError(`Erreur lors de la récupération/création de la config leveling: ${error}`, 'CONFIG_CREATE_ERROR');
    }
  }

  /**
   * Met à jour la configuration de leveling
   */
  static async updateLevelingConfig(updates: UpdateLevelingConfigDTO): Promise<LevelingConfig> {
    try {
      const validation = this.validateConfigUpdates(updates);
      if (!validation.isValid) {
        throw new ValidationError('Données de configuration invalides', validation.errors);
      }

      await this.getOrCreateLevelingConfig();
      const guild = await AppConfigService.getOrCreateConfig();

      // Mise à jour des propriétés
      Object.assign(guild.features.leveling, updates);
      
      await guild.save();
      return guild.features.leveling;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new LevelingError(`Erreur lors de la mise à jour de la config: ${error}`, 'CONFIG_UPDATE_ERROR');
    }
  }

  /**
   * Active ou désactive la fonctionnalité
   */
  static async toggleFeature(enabled: boolean): Promise<LevelingConfig> {
    return this.updateLevelingConfig({ enabled });
  }

  static async setTaux(taux: number): Promise<LevelingConfig> {
    return this.updateLevelingConfig({ taux });
  }

  static async configureNotifications(notifEnabled: boolean): Promise<LevelingConfig> {
    return this.updateLevelingConfig({ notifLevelUp: notifEnabled });
  }

  /**
   * Calcule l'XP nécessaire pour atteindre un niveau
   */
  static getXpToLevelUp(level: number): number {
    return 5 * (level * level) + 110 * level + 100;
  }

  /**
   * Calcule l'XP à donner selon la configuration
   */
  static calculateXpToGive(config: LevelingConfig, baseAmount?: number): XpCalculation {
    const baseXp = baseAmount || (Math.floor(Math.random() * 11) + 10); // 10-20 XP base
    const multiplier = config.taux;
    const finalXp = Math.floor(baseXp * multiplier);

    return { baseXp, multiplier, finalXp };
  }

  /**
   * Donne de l'XP à un utilisateur et gère le level up
   */
  static async giveXpToUser(
    client: BotClient, 
    message: Message, 
    amount?: number
  ): Promise<LevelUpResult | null> {
    try {
      if (!message.guild) return null;

      const discordId = message.author.id;

      if (this.isUserInCooldown(discordId)) return null;

      const user = await UserModel.findOne({ discordId }) as IUser;
      if (!user) return null;

      const config = await this.getOrCreateLevelingConfig();
      if (!config?.enabled) return null;
      
      // Cooldown seulement si tout est valide
      this.setCooldown(discordId);
      
      // Calcul de l'XP à donner
      const xpCalculation = this.calculateXpToGive(config, amount);
      
      // Mise à jour de l'XP
      user.profil.exp += xpCalculation.finalXp;
      
      // Calcul optimisé du level up avec cache du xpNeeded
      const currentLevelXpNeeded = this.getXpToLevelUp(user.profil.lvl);
      const hasLeveledUp = await this.checkAndHandleLevelUp(client, user, message, config, currentLevelXpNeeded);
      
      await user.save();

      // Utiliser le niveau actuel pour le calcul final
      const finalLevelXpNeeded = hasLeveledUp ? this.getXpToLevelUp(user.profil.lvl) : currentLevelXpNeeded;

      return {
        hasLeveledUp,
        newLevel: user.profil.lvl,
        xpGiven: xpCalculation.finalXp,
        xpNeededForNext: finalLevelXpNeeded - user.profil.exp
      };
    } catch (error) {
      throw new LevelingError(`Erreur lors de l'attribution d'XP: ${error}`, 'XP_ATTRIBUTION_ERROR');
    }
  }

  static async giveXpDirectly(client: BotClient, userId: string, amount: number): Promise<void> {
    const user = await UserModel.findOne({ discordId: userId }) as IUser;
    if (!user) return;

    const config = await this.getOrCreateLevelingConfig();
    if (!config?.enabled) return;

    user.profil.exp += amount;

    if (user.profil.exp >= this.getXpToLevelUp(user.profil.lvl)) {
      user.profil.lvl++;
      await LogService.info(`<@${userId}> passe niveau **${user.profil.lvl}**`, { feature: 'leveling', title: 'Level up' });
    }

    await user.save();
  }

  /**
   * Vérifie et gère le level up
   */
  private static async checkAndHandleLevelUp(
    client: BotClient,
    user: IUser, 
    message: Message,
    config: LevelingConfig,
    neededXpToLevelUp?: number
  ): Promise<boolean> {
    const xpNeeded = neededXpToLevelUp ?? this.getXpToLevelUp(user.profil.lvl);
    
    if (user.profil.exp >= xpNeeded) {
      user.profil.lvl++;
      await LogService.info(`<@${user.discordId}> passe niveau **${user.profil.lvl}**`, { feature: 'leveling', title: 'Level up' });
      
      // Gestion des notifications de level up
      await this.handleLevelUpNotification(client, user, message, config);
      
      return true;
    }
    
    return false;
  }

  /**
   * Gère les notifications de level up
   */
  private static async handleLevelUpNotification(
    client: BotClient,
    user: IUser,
    message: Message,
    config: LevelingConfig
  ): Promise<void> {
    try {
      console.log(`${user.name} a atteint le niveau ${user.profil.lvl}`);

      if (!config.notifLevelUp) return;

      // Réaction sur le message
      if (message) {
        await message.react(emojis.levelUp).catch(console.error);
      }

    } catch (error) {
      console.error('Erreur lors de la notification de level up:', error);
    }
  }

  /**
   * Vérifie si un utilisateur est en cooldown
   */
  private static isUserInCooldown(discordId: string): boolean {
    const cooldownEnd = this.xpCooldown[discordId];
    return cooldownEnd && cooldownEnd > Date.now();
  }

  /**
   * Définit le cooldown pour un utilisateur
   */
  private static setCooldown(discordId: string): void {
    this.xpCooldown[discordId] = Date.now() + 2500; // 2.5 secondes
    
    // Nettoyage automatique du cache toutes les 100 entrées
    if (Object.keys(this.xpCooldown).length > 100) {
      this.cleanupCooldowns();
    }
  }

  /**
   * Nettoie les cooldowns expirés
   */
  private static cleanupCooldowns(): void {
    const now = Date.now();
    for (const [userId, cooldownEnd] of Object.entries(this.xpCooldown)) {
      if (cooldownEnd <= now) {
        delete this.xpCooldown[userId];
      }
    }
  }

  /**
   * Valide les mises à jour de configuration
   */
  private static validateConfigUpdates(updates: UpdateLevelingConfigDTO): ValidationResult {
    const errors: string[] = [];

    if (updates.taux !== undefined) {
      if (typeof updates.taux !== 'number' || updates.taux < 0.1 || updates.taux > 10) {
        errors.push('Le taux doit être un nombre entre 0.1 et 10');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}