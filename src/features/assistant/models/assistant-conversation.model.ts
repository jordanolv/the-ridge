import { prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

export class AssistantAttachment {
  @prop({ required: true, enum: ['message', 'image'] })
  kind!: 'message' | 'image';

  @prop({ required: true })
  label!: string;

  @prop()
  content?: string;

  @prop()
  url?: string;
}

export class AssistantMessage {
  @prop({ required: true, enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant';

  @prop({ default: '' })
  text!: string;

  @prop({ type: () => [AssistantAttachment], default: [] })
  attachments!: AssistantAttachment[];

  @prop({ default: () => new Date() })
  createdAt!: Date;
}

export class AssistantConversation {
  @prop({ required: true })
  title!: string;

  @prop({ type: () => [AssistantMessage], default: [] })
  messages!: AssistantMessage[];
}

const AssistantConversationDB = getModelForClass(AssistantConversation, {
  schemaOptions: { collection: 'assistant_conversations', timestamps: true },
});

export type IAssistantConversation = DocumentType<AssistantConversation>;
export default AssistantConversationDB;
