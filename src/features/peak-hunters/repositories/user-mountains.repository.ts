import UserMountainsModel, { IUserMountainsDoc } from '../models/user-mountains.model';
import type { MountainRarity, ExpeditionTier } from '../types/peak-hunters.types';
import { FRAGMENTS_PER_EXPEDITION } from '../constants/peak-hunters.constants';

export interface UnlockedMountainEntry {
  mountainId: string;
  unlockedAt: Date;
  rarity: MountainRarity;
}

export class UserMountainsRepository {
  static async getByUserId(userId: string): Promise<IUserMountainsDoc | null> {
    return UserMountainsModel.findOne({ userId });
  }

  static async getOrCreate(userId: string): Promise<IUserMountainsDoc> {
    let doc = await this.getByUserId(userId);
    if (!doc) {
      doc = new UserMountainsModel({ userId, unlockedMountains: [], sentierTickets: 0, falaiseTickets: 0, sommetTickets: 0, fragments: 0 });
      await doc.save();
    }
    doc.falaiseTickets ??= 0;
    doc.sommetTickets ??= 0;
    doc.sentierPacks ??= 0;
    doc.falaisePacks ??= 0;
    doc.sommetPacks ??= 0;
    doc.fragments ??= 0;
    return doc;
  }

  /** Packs non ouverts du tier donné. */
  static packsOf(doc: IUserMountainsDoc, tier: ExpeditionTier): number {
    if (tier === 'falaise') return doc.falaisePacks ?? 0;
    if (tier === 'sommet') return doc.sommetPacks ?? 0;
    return doc.sentierPacks ?? 0;
  }

  static async addPacks(userId: string, tier: ExpeditionTier, amount: number): Promise<void> {
    await this.getOrCreate(userId);
    await UserMountainsModel.updateOne({ userId }, { $inc: { [`${tier}Packs`]: amount } });
  }

  /**
   * Décrément conditionnel : la condition est dans le filtre, donc deux clics
   * simultanés ne peuvent pas consommer le même pack.
   */
  static async spendPack(userId: string, tier: ExpeditionTier): Promise<boolean> {
    const res = await UserMountainsModel.updateOne(
      { userId, [`${tier}Packs`]: { $gte: 1 } },
      { $inc: { [`${tier}Packs`]: -1 } },
    );
    return res.modifiedCount === 1;
  }

  static async isUnlocked(userId: string, mountainId: string): Promise<boolean> {
    const doc = await this.getByUserId(userId);
    return doc?.unlockedMountains.some(m => m.mountainId === mountainId) ?? false;
  }

  /**
   * Débloque une montagne.
   * Retourne null si déjà débloquée (doublon → fragments à gérer côté appelant).
   */
  static async unlock(
    userId: string,
    mountainId: string,
    rarity: MountainRarity,
  ): Promise<{ totalUnlocked: number } | null> {
    const doc = await this.getOrCreate(userId);

    if (doc.unlockedMountains.some(m => m.mountainId === mountainId)) {
      return null;
    }

    doc.unlockedMountains.push({ mountainId, unlockedAt: new Date(), rarity });
    await doc.save();

    return { totalUnlocked: doc.unlockedMountains.length };
  }

  /**
   * Ajoute des fragments. Quand un palier de {@link FRAGMENTS_PER_EXPEDITION} est atteint,
   * retourne le nombre d'expéditions à créditer via `awardExpeditions` (roll de tier côté appelant).
   */
  static async addFragments(userId: string, amount: number): Promise<{ newFragments: number; expeditionsToAward: number }> {
    const doc = await this.getOrCreate(userId);

    doc.fragments += amount;
    const expeditionsToAward = Math.floor(doc.fragments / FRAGMENTS_PER_EXPEDITION);
    if (expeditionsToAward > 0) {
      doc.fragments = doc.fragments % FRAGMENTS_PER_EXPEDITION;
    }
    doc.markModified('fragments');
    await doc.save();

    return { newFragments: doc.fragments, expeditionsToAward };
  }

  /** Ajoute des expéditions directement (Sentier par défaut). */
  static async addExpeditions(userId: string, amount: number, tier: ExpeditionTier = 'sentier'): Promise<void> {
    const doc = await this.getOrCreate(userId);
    if (tier === 'falaise') doc.falaiseTickets += amount;
    else if (tier === 'sommet') doc.sommetTickets += amount;
    else doc.sentierTickets += amount;
    await doc.save();
  }

  static async addExpeditionsToAll(amount: number, tier: ExpeditionTier = 'sentier'): Promise<number> {
    const field = tier === 'falaise' ? 'falaiseTickets' : tier === 'sommet' ? 'sommetTickets' : 'sentierTickets';
    const result = await UserMountainsModel.updateMany({}, { $inc: { [field]: amount } });
    return result.modifiedCount;
  }

  /**
   * Consomme 1 expédition.
   * Retourne false si pas assez d'expéditions.
   */
  static async spendExpedition(userId: string, tier: ExpeditionTier = 'sentier'): Promise<boolean> {
    const doc = await this.getOrCreate(userId);
    if (tier === 'falaise') {
      if (doc.falaiseTickets <= 0) return false;
      doc.falaiseTickets -= 1;
      doc.falaiseOpened = (doc.falaiseOpened ?? 0) + 1;
    } else if (tier === 'sommet') {
      if (doc.sommetTickets <= 0) return false;
      doc.sommetTickets -= 1;
      doc.sommetOpened = (doc.sommetOpened ?? 0) + 1;
    } else {
      if (doc.sentierTickets <= 0) return false;
      doc.sentierTickets -= 1;
      doc.sentierOpened = (doc.sentierOpened ?? 0) + 1;
    }
    await doc.save();
    return true;
  }

  /**
   * Consomme N expéditions.
   * Retourne false si pas assez d'expéditions.
   */
  static async spendExpeditions(userId: string, amount: number, tier: ExpeditionTier = 'sentier'): Promise<boolean> {
    const doc = await this.getOrCreate(userId);
    if (tier === 'falaise') {
      if (doc.falaiseTickets < amount) return false;
      doc.falaiseTickets -= amount;
      doc.falaiseOpened = (doc.falaiseOpened ?? 0) + amount;
    } else if (tier === 'sommet') {
      if (doc.sommetTickets < amount) return false;
      doc.sommetTickets -= amount;
      doc.sommetOpened = (doc.sommetOpened ?? 0) + amount;
    } else {
      if (doc.sentierTickets < amount) return false;
      doc.sentierTickets -= amount;
      doc.sentierOpened = (doc.sentierOpened ?? 0) + amount;
    }
    await doc.save();
    return true;
  }

  /** Transfère une montagne d'un user à un autre (pour les échanges). */
  static async transferMountain(
    fromUserId: string,
    toUserId: string,
    mountainId: string,
  ): Promise<boolean> {
    const fromDoc = await this.getByUserId(fromUserId);
    if (!fromDoc) return false;

    const idx = fromDoc.unlockedMountains.findIndex(m => m.mountainId === mountainId);
    if (idx === -1) return false;

    const [entry] = fromDoc.unlockedMountains.splice(idx, 1);
    fromDoc.markModified('unlockedMountains');
    await fromDoc.save();

    const toDoc = await this.getOrCreate(toUserId);
    if (!toDoc.unlockedMountains.some(m => m.mountainId === mountainId)) {
      toDoc.unlockedMountains.push(entry);
      await toDoc.save();
    }

    return true;
  }

  static async getUnlocked(userId: string): Promise<UnlockedMountainEntry[]> {
    const doc = await this.getByUserId(userId);
    return (doc?.unlockedMountains ?? []).map(m => ({
      mountainId: m.mountainId,
      unlockedAt: m.unlockedAt,
      rarity: (m.rarity as MountainRarity) ?? 'common',
    }));
  }
}
