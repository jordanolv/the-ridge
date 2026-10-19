import PartyEventModel, { PartyEvent } from '../models/party-event.model';
import { NotFoundError } from './party.types';
import { Types } from 'mongoose';

export class PartyRepository {

  async findById(eventId: string): Promise<PartyEvent | null> {
    if (!Types.ObjectId.isValid(eventId)) {
      return null;
    }
    return PartyEventModel.findById(eventId);
  }

  async findAll(): Promise<PartyEvent[]> {
    return PartyEventModel
      .find({})
      .sort({ 'eventInfo.dateTime': 1 });
  }

  async findByMessageId(messageId: string): Promise<PartyEvent | null> {
    return PartyEventModel.findOne({ 'discord.messageId': messageId });
  }

  async findByThreadId(threadId: string): Promise<PartyEvent | null> {
    return PartyEventModel.findOne({ 'discord.threadId': threadId });
  }

  async create(eventData: Partial<PartyEvent>): Promise<PartyEvent> {
    return PartyEventModel.create(eventData);
  }

  /** Null si la soirée est déjà terminée : la condition est dans le filtre, un double clic ne la clôture qu'une fois. */
  async endOnce(eventId: string, updates: Partial<PartyEvent>): Promise<PartyEvent | null> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError('Événement non trouvé');
    }
    return PartyEventModel.findOneAndUpdate(
      { _id: eventId, status: { $ne: 'ended' } },
      { ...updates, status: 'ended' },
      { new: true },
    );
  }

  async update(eventId: string, updates: Partial<PartyEvent>): Promise<PartyEvent> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError('Événement non trouvé');
    }

    const updatedEvent = await PartyEventModel.findByIdAndUpdate(
      eventId,
      updates,
      { new: true }
    );

    if (!updatedEvent) {
      throw new NotFoundError('Événement non trouvé');
    }

    return updatedEvent;
  }

  async updateDiscordInfo(
    eventId: string,
    messageId?: string,
    threadId?: string,
    roleId?: string,
  ): Promise<PartyEvent> {
    const updateData: any = {};

    if (messageId) updateData['discord.messageId'] = messageId;
    if (threadId) updateData['discord.threadId'] = threadId;
    if (roleId) updateData['discord.roleId'] = roleId;

    return this.update(eventId, updateData);
  }

  async addParticipant(eventId: string, userId: string): Promise<PartyEvent> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError('Événement non trouvé');
    }

    const updatedEvent = await PartyEventModel.findByIdAndUpdate(
      eventId,
      { $addToSet: { participants: userId } },
      { new: true }
    );

    if (!updatedEvent) {
      throw new NotFoundError('Événement non trouvé');
    }

    return updatedEvent;
  }

  async removeParticipant(eventId: string, userId: string): Promise<PartyEvent> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError('Événement non trouvé');
    }

    const updatedEvent = await PartyEventModel.findByIdAndUpdate(
      eventId,
      { $pull: { participants: userId } },
      { new: true }
    );

    if (!updatedEvent) {
      throw new NotFoundError('Événement non trouvé');
    }

    return updatedEvent;
  }

  async delete(eventId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(eventId)) {
      return false;
    }

    const result = await PartyEventModel.findByIdAndDelete(eventId);
    return !!result;
  }

  async findByChannel(channelId: string): Promise<PartyEvent | null> {
    return PartyEventModel.findOne({ 'discord.channelId': channelId });
  }

  async findActiveEvents(): Promise<PartyEvent[]> {
    return PartyEventModel
      .find({ 'status': { $in: ['pending', 'started'] } })
      .sort({ 'eventInfo.dateTime': 1 });
  }

  async findPastEvents(limit: number = 10): Promise<PartyEvent[]> {
    return PartyEventModel
      .find({ 'status': 'ended' })
      .sort({ 'endedAt': -1 })
      .limit(limit);
  }

  async countEventsByUser(userId: string): Promise<number> {
    return PartyEventModel.countDocuments({ 'createdBy': userId });
  }

  async findEventsByDateRange(startDate: Date, endDate: Date): Promise<PartyEvent[]> {
    return PartyEventModel
      .find({
        'eventInfo.dateTime': {
          $gte: startDate,
          $lte: endDate
        }
      })
      .sort({ 'eventInfo.dateTime': 1 });
  }
}
