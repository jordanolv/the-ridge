import EnigmeStateModel, { IEnigmeStateDoc, Riddle } from '../models/enigme-state.model';

export class EnigmeRepository {
  static async get(): Promise<IEnigmeStateDoc | null> {
    return EnigmeStateModel.findOne();
  }

  static async getOrCreate(): Promise<IEnigmeStateDoc> {
    const existing = await this.get();
    if (existing) return existing;
    return EnigmeStateModel.create({});
  }

  static async setNextSpawn(date: Date | null): Promise<void> {
    await EnigmeStateModel.updateOne(
      {},
      date ? { $set: { nextSpawnAt: date } } : { $unset: { nextSpawnAt: '' } },
      { upsert: true },
    );
  }

  static async setActive(params: {
    threadId: string;
    messageId: string;
    riddle: Riddle;
    endsAt: Date;
    announceMessageId?: string | null;
  }): Promise<void> {
    const doc = await this.getOrCreate();
    doc.activeThreadId = params.threadId;
    doc.activeMessageId = params.messageId;
    doc.riddle = params.riddle;
    doc.startedAt = new Date();
    doc.endsAt = params.endsAt;
    doc.revealedAt = {};
    doc.hintedAt = {};
    doc.attempts = {};
    doc.solvers = [];
    doc.announceMessageId = params.announceMessageId ?? undefined;
    doc.nextSpawnAt = undefined;
    doc.markModified('riddle');
    doc.markModified('revealedAt');
    doc.markModified('hintedAt');
    doc.markModified('attempts');
    doc.markModified('solvers');
    await doc.save();
  }

  static async incrementAttempt(userId: string): Promise<void> {
    await EnigmeStateModel.updateOne({}, { $inc: { [`attempts.${userId}`]: 1 } });
  }

  static async addSolver(userId: string, at: Date, durationMs: number, usedHint: boolean): Promise<void> {
    await EnigmeStateModel.updateOne({}, { $push: { solvers: { userId, at, durationMs, usedHint } } });
  }

  /** Pose le départ du chrono au premier appel, puis renvoie toujours la même date. */
  static async revealFor(userId: string): Promise<Date> {
    const key = `revealedAt.${userId}`;
    const doc = await EnigmeStateModel.findOneAndUpdate(
      { [key]: { $exists: false } },
      { $set: { [key]: new Date() } },
      { new: true },
    );
    if (doc?.revealedAt?.[userId]) return doc.revealedAt[userId];
    const current = await this.get();
    return current?.revealedAt?.[userId] ?? current?.startedAt ?? new Date();
  }

  static async takeHint(userId: string): Promise<void> {
    await EnigmeStateModel.updateOne(
      { [`hintedAt.${userId}`]: { $exists: false } },
      { $set: { [`hintedAt.${userId}`]: new Date() } },
    );
  }

  static async clearActive(): Promise<void> {
    await EnigmeStateModel.updateOne(
      {},
      {
        $unset: {
          activeThreadId: '',
          activeMessageId: '',
          riddle: '',
          startedAt: '',
          hintedAt: '',
          endsAt: '',
          revealedAt: '',
          attempts: '',
          solvers: '',
          announceMessageId: '',
        },
      },
    );
  }
}
