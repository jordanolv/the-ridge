import { Types } from 'mongoose';
import AssistantConversationDB, { AssistantMessage, IAssistantConversation } from '../models/assistant-conversation.model';

export class AssistantConversationRepository {
  static async list(limit = 30) {
    return AssistantConversationDB.find({}, { title: 1, updatedAt: 1 }).sort({ updatedAt: -1 }).limit(limit).lean();
  }

  static async findById(id: string): Promise<IAssistantConversation | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return AssistantConversationDB.findById(id);
  }

  static async create(title: string): Promise<IAssistantConversation> {
    return AssistantConversationDB.create({ title, messages: [] });
  }

  static async append(id: string, ...messages: AssistantMessage[]): Promise<IAssistantConversation | null> {
    return AssistantConversationDB.findByIdAndUpdate(id, { $push: { messages: { $each: messages } } }, { new: true });
  }

  static async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return;
    await AssistantConversationDB.findByIdAndDelete(id);
  }
}
