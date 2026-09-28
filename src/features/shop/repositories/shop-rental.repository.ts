import ShopRentalModel, { IShopRental } from '../models/shop-rental.model';
import { nextExpiry } from '../services/rental-expiry';

export class ShopRentalRepository {
  static async findExpired(now = new Date()): Promise<IShopRental[]> {
    return ShopRentalModel.find({ expiresAt: { $lte: now } });
  }

  static async extend(userId: string, itemId: string, variantId: string | undefined, days: number): Promise<Date> {
    const current = await ShopRentalModel.findOne({ userId, itemId });
    const expiresAt = nextExpiry(current?.expiresAt, new Date(), days);
    await ShopRentalModel.updateOne(
      { userId, itemId },
      { $set: { variantId, expiresAt } },
      { upsert: true },
    );
    return expiresAt;
  }

  static async remove(userId: string, itemId: string): Promise<void> {
    await ShopRentalModel.deleteOne({ userId, itemId });
  }
}
