import BetModel, { IBet } from '../models/bet.model';

export class BetRepository {
  static async create(data: {
    title: string;
    options: { name: string }[];
    channelId: string;
    messageId: string;
    createdBy: string;
  }): Promise<IBet> {
    return BetModel.create({
      ...data,
      options: data.options.map(o => ({ name: o.name, totalAmount: 0, entryCount: 0 })),
    });
  }

  static async findById(id: string): Promise<IBet | null> {
    return BetModel.findById(id);
  }

  static async updateMessageId(betId: string, messageId: string): Promise<void> {
    await BetModel.updateOne({ _id: betId }, { $set: { messageId } });
  }

  /** Null si le bet n'est plus ouvert ou si le joueur a déjà misé : la condition est dans le filtre. */
  static async addEntry(betId: string, userId: string, optionIndex: number, amount: number): Promise<IBet | null> {
    return BetModel.findOneAndUpdate(
      { _id: betId, status: 'open', 'entries.userId': { $ne: userId } },
      {
        $push: { entries: { userId, optionIndex, amount } },
        $inc: {
          [`options.${optionIndex}.totalAmount`]: amount,
          [`options.${optionIndex}.entryCount`]: 1,
        },
      },
      { new: true },
    );
  }

  /** Passe le bet de l'un des statuts `from` à `to` en une écriture : un double clic ne clôture qu'une fois. */
  static async transition(betId: string, from: string[], to: string, winnerIndex?: number): Promise<IBet | null> {
    const $set: Record<string, unknown> = { status: to };
    if (winnerIndex !== undefined) $set.winnerIndex = winnerIndex;
    return BetModel.findOneAndUpdate({ _id: betId, status: { $in: from } }, { $set }, { new: true });
  }

  static async setStatus(betId: string, status: string, winnerIndex?: number): Promise<IBet | null> {
    const update: any = { $set: { status } };
    if (winnerIndex !== undefined) update.$set.winnerIndex = winnerIndex;
    return BetModel.findByIdAndUpdate(betId, update, { new: true });
  }
}
