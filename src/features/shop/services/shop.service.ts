import { Guild, GuildMember } from 'discord.js';
import mongoose from 'mongoose';
import UserModel from '../../user/models/user.model';
import { LogService } from '../../../shared/logs/logs.service';
import { ShopRentalRepository } from '../repositories/shop-rental.repository';
import { PackBudgetRepository } from '../repositories/pack-budget.repository';
import { parisWeekKey } from '../../../shared/time/week-key';
import { ColorRoleService } from './color-role.service';
import {
  PACK_WEEKLY_BUDGET,
  clampQuantity,
  findVariant,
  packTierOf,
  quantityLabel,
  type ShopItem,
  type ShopVariant,
  type ShopWallet,
} from '../catalog';
import { grantPacks } from '../../peak-hunters/services/pack.service';
import type { ExpeditionTier } from '../../peak-hunters/types/peak-hunters.types';

const LOG_FEATURE = '🛒 Boutique';
const REDENOMINATION_MARKER = 'redenominate-v1';

let redenominated = false;

/**
 * Les prix sont à la nouvelle échelle (economy.md §8). Entre le déploiement et
 * `scripts/redenominate.mjs --apply`, les soldes valent encore dix fois trop :
 * la boutique reste fermée tant que le marqueur de migration n'est pas posé.
 */
async function isRedenominated(): Promise<boolean> {
  if (redenominated) return true;
  const marker = await mongoose.connection.db
    ?.collection<{ _id: string }>('migrations')
    .findOne({ _id: REDENOMINATION_MARKER });
  redenominated = marker != null;
  return redenominated;
}

export type PurchaseFailure = 'closed' | 'soon' | 'variant' | 'limit' | 'funds' | 'grant';
export type PurchaseResult =
  | { ok: true; expiresAt?: Date; wallet: ShopWallet }
  | { ok: false; reason: PurchaseFailure };

/**
 * Débit conditionnel : la condition sur le solde est dans le filtre, donc deux
 * clics simultanés ne peuvent pas passer tous les deux.
 */
async function debit(userId: string, amount: number): Promise<boolean> {
  const res = await UserModel.updateOne(
    { discordId: userId, 'profil.money': { $gte: amount } },
    { $inc: { 'profil.money': -amount } },
  );
  return res.modifiedCount === 1;
}

async function grant(member: GuildMember, item: ShopItem, variant: ShopVariant | undefined, qty: number): Promise<void> {
  const packTier = packTierOf(item);
  if (packTier) return grantPacks(member.id, packTier as ExpeditionTier, qty);

  switch (item.id) {
    case 'role-color':
      await ColorRoleService.apply(member, variant!);
      return;
    case 'profile-theme':
      await UserModel.updateOne({ discordId: member.id }, { $set: { 'profil.cardTheme': variant!.id } });
      return;
    default:
      throw new Error(`Aucune livraison définie pour l'article ${item.id}`);
  }
}

async function revokeItem(guild: Guild, userId: string, itemId: string): Promise<void> {
  switch (itemId) {
    case 'role-color': {
      const member = await guild.members.fetch(userId).catch(() => null);
      await ColorRoleService.revoke(guild, userId, member);
      return;
    }
    case 'profile-theme':
      await UserModel.updateOne({ discordId: userId }, { $unset: { 'profil.cardTheme': '' } });
      return;
    default:
      console.warn(`[Shop] Expiration ignorée : aucune révocation pour ${itemId}`);
  }
}

export class ShopService {
  static async purchase(
    member: GuildMember,
    item: ShopItem,
    variantId?: string,
    quantity = 1,
  ): Promise<PurchaseResult> {
    if (!(await isRedenominated())) return { ok: false, reason: 'closed' };
    if (item.soon) return { ok: false, reason: 'soon' };

    const variant = variantId ? findVariant(item, variantId) : undefined;
    if ((item.variants || item.colorPicker) && !variant) return { ok: false, reason: 'variant' };

    const qty = clampQuantity(quantity);
    const total = item.price * qty;
    const weekKey = parisWeekKey(new Date());
    const isPack = packTierOf(item) !== undefined;
    const releaseBudget = () => (isPack ? PackBudgetRepository.release(member.id, weekKey, total) : Promise.resolve());

    if (isPack && !(await PackBudgetRepository.reserve(member.id, weekKey, total, PACK_WEEKLY_BUDGET))) {
      return { ok: false, reason: 'limit' };
    }
    if (!(await debit(member.id, total))) {
      await releaseBudget();
      return { ok: false, reason: 'funds' };
    }

    let expiresAt: Date | undefined;
    try {
      await grant(member, item, variant, qty);
      if (item.durationDays) {
        expiresAt = await ShopRentalRepository.extend(member.id, item.id, variant?.id, item.durationDays * qty);
      }
    } catch (err) {
      await UserModel.updateOne({ discordId: member.id }, { $inc: { 'profil.money': total } });
      await releaseBudget();
      console.error(`[Shop] Livraison échouée pour ${item.id}, achat remboursé:`, err);
      return { ok: false, reason: 'grant' };
    }

    const label = variant ? `${item.label} — ${variant.label}` : item.label;
    const suffix = qty > 1 ? ` (${quantityLabel(item, qty)})` : '';
    await LogService.economy(member.id, -total, `Boutique — ${label}${suffix}`, LOG_FEATURE, 'burn');

    return { ok: true, expiresAt, wallet: await this.getWallet(member.id) };
  }

  static async getWallet(userId: string): Promise<ShopWallet> {
    const [balance, spent] = await Promise.all([
      this.getBalance(userId),
      PackBudgetRepository.spent(userId, parisWeekKey(new Date())),
    ]);
    return { balance, packBudgetLeft: Math.max(0, PACK_WEEKLY_BUDGET - spent) };
  }

  static async getBalance(userId: string): Promise<number> {
    const user = await UserModel.findOne({ discordId: userId }, { 'profil.money': 1 });
    return Math.floor(user?.profil?.money ?? 0);
  }

  static async expireDue(guild: Guild): Promise<number> {
    const due = await ShopRentalRepository.findExpired();
    let revoked = 0;

    for (const rental of due) {
      try {
        await revokeItem(guild, rental.userId, rental.itemId);
        await ShopRentalRepository.remove(rental.userId, rental.itemId);
        revoked++;
      } catch (err) {
        console.error(`[Shop] Expiration échouée pour ${rental.userId}/${rental.itemId}:`, err);
      }
    }

    return revoked;
  }
}
