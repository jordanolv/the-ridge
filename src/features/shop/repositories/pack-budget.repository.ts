import PackBudgetModel from '../models/pack-budget.model';

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

export class PackBudgetRepository {
  static async spent(userId: string, weekKey: string): Promise<number> {
    const doc = await PackBudgetModel.findOne({ userId, weekKey }, { spent: 1 });
    return doc?.spent ?? 0;
  }

  /**
   * Réserve `amount` sur le plafond de la semaine, en une seule écriture : si le document
   * existe déjà sans la marge nécessaire, l'upsert tente un doublon et l'index unique refuse.
   */
  static async reserve(userId: string, weekKey: string, amount: number, cap: number): Promise<boolean> {
    if (amount > cap) return false;
    try {
      await PackBudgetModel.updateOne(
        { userId, weekKey, spent: { $lte: cap - amount } },
        { $inc: { spent: amount } },
        { upsert: true },
      );
      return true;
    } catch (err) {
      if (isDuplicateKey(err)) return false;
      throw err;
    }
  }

  static async release(userId: string, weekKey: string, amount: number): Promise<void> {
    await PackBudgetModel.updateOne({ userId, weekKey }, { $inc: { spent: -amount } });
  }
}
