import { BetRepository } from '../repositories/bet.repository';
import { IBet } from '../models/bet.model';
import { UserService } from '../../user/services/user.service';
import UserModel from '../../user/models/user.model';
import { LogService } from '../../../shared/logs/logs.service';

const OPEN_STATUSES = ['open', 'locked'];

export class BetService {
  static async placeBet(
    betId: string,
    userId: string,
    optionIndex: number,
    amount: number,
  ): Promise<{ success: boolean; message: string; bet?: IBet }> {
    const bet = await BetRepository.findById(betId);
    if (!bet) return { success: false, message: 'Bet introuvable.' };
    if (bet.status !== 'open') return { success: false, message: 'Les paris sont fermés.' };
    if (optionIndex < 0 || optionIndex >= bet.options.length) return { success: false, message: 'Option invalide.' };
    if (!Number.isInteger(amount) || amount < 1) return { success: false, message: 'La mise minimum est de 1 💰.' };
    if (bet.entries.some(e => e.userId === userId)) {
      return { success: false, message: 'Tu as déjà misé sur ce bet.' };
    }

    if (!(await UserService.tryDebit(userId, amount))) {
      const balance = await UserService.getUserMoney(userId);
      return { success: false, message: `Solde insuffisant. Tu as **${Math.floor(balance).toLocaleString('fr-FR')}** 💰.` };
    }

    const updated = await BetRepository.addEntry(betId, userId, optionIndex, amount);
    if (!updated) {
      await UserModel.updateOne({ discordId: userId }, { $inc: { 'profil.money': amount } });
      return { success: false, message: 'Les paris viennent de fermer, ou tu as déjà misé : ta mise t\'est rendue.' };
    }

    await LogService.economy(userId, -amount, 'Pari — mise', 'bet', 'transfer');
    return { success: true, message: 'Pari enregistré !', bet: updated };
  }

  static async lockBet(betId: string): Promise<{ success: boolean; message: string; bet?: IBet }> {
    const updated = await BetRepository.transition(betId, ['open'], 'locked');
    if (!updated) return { success: false, message: 'Ce bet n\'est pas ouvert.' };
    return { success: true, message: 'Paris verrouillés.', bet: updated };
  }

  static async closeBet(
    betId: string,
    winnerIndex: number,
  ): Promise<{ success: boolean; message: string; bet?: IBet; payouts?: { userId: string; amount: number; gain: number }[] }> {
    const current = await BetRepository.findById(betId);
    if (!current) return { success: false, message: 'Bet introuvable.' };
    if (winnerIndex < 0 || winnerIndex >= current.options.length) return { success: false, message: 'Option invalide.' };

    const bet = await BetRepository.transition(betId, OPEN_STATUSES, 'closed', winnerIndex);
    if (!bet) return { success: false, message: 'Ce bet est déjà terminé.' };

    const totalPot = bet.options.reduce((sum, o) => sum + o.totalAmount, 0);
    const winnerPot = bet.options[winnerIndex].totalAmount;

    if (winnerPot === 0) {
      await this.refundEntries(bet);
      const refunded = await BetRepository.setStatus(betId, 'refunded');
      return { success: true, message: 'Paris remboursés.', bet: refunded ?? bet, payouts: [] };
    }

    const loserPot = totalPot - winnerPot;
    const rake = Math.floor(loserPot * bet.rakePercent / 100);
    const redistributable = loserPot - rake;

    const payouts: { userId: string; amount: number; gain: number }[] = [];
    for (const entry of bet.entries.filter(e => e.optionIndex === winnerIndex)) {
      const gain = Math.floor((entry.amount / winnerPot) * redistributable);
      const total = entry.amount + gain;
      payouts.push({ userId: entry.userId, amount: total, gain });
      await UserService.updateUserMoney(entry.userId, total, 'Pari — gains', 'transfer');
    }

    const dust = redistributable - payouts.reduce((sum, p) => sum + p.gain, 0);
    await LogService.economy(null, -(rake + dust), 'Pari — rake', 'bet', 'burn');

    return { success: true, message: 'Bet terminé.', bet, payouts };
  }

  static async refundBet(betId: string): Promise<{ success: boolean; message: string; bet?: IBet }> {
    const bet = await BetRepository.transition(betId, OPEN_STATUSES, 'refunded');
    if (!bet) return { success: false, message: 'Bet introuvable ou déjà terminé.' };

    await this.refundEntries(bet);
    return { success: true, message: 'Paris remboursés.', bet };
  }

  private static async refundEntries(bet: IBet): Promise<void> {
    for (const entry of bet.entries) {
      await UserService.updateUserMoney(entry.userId, entry.amount, 'Pari — remboursement', 'transfer');
    }
  }

  static getOddsMultiplier(bet: IBet, optionIndex: number): number {
    const totalPot = bet.options.reduce((sum, o) => sum + o.totalAmount, 0);
    const optionTotal = bet.options[optionIndex].totalAmount;
    if (optionTotal === 0 || totalPot === optionTotal) return 1;
    const loserPot = totalPot - optionTotal;
    const rake = loserPot * bet.rakePercent / 100;
    const redistributable = loserPot - rake;
    return 1 + redistributable / optionTotal;
  }
}
