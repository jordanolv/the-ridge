import { prop, getModelForClass, index, DocumentType } from '@typegoose/typegoose';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';
export type MoneyFlow = 'mint' | 'transfer' | 'burn';

const RETENTION_SECONDS = 90 * 24 * 60 * 60;

@index({ createdAt: -1 })
@index({ feature: 1, createdAt: -1 })
@index({ kind: 1, createdAt: -1 })
@index({ userId: 1, createdAt: -1 })
@index({ kind: 1, flow: 1, createdAt: -1 })
class BotLog {
  @prop({ required: true, type: String })
  level!: LogLevel;

  @prop()
  feature?: string;

  @prop()
  title?: string;

  @prop({ required: true })
  message!: string;

  @prop()
  kind?: string;

  @prop()
  userId?: string;

  @prop()
  channelId?: string;

  @prop()
  amount?: number;

  @prop({ type: String })
  flow?: MoneyFlow;

  @prop({ default: () => new Date(), expires: RETENTION_SECONDS })
  createdAt!: Date;
}

const BotLogModel = getModelForClass(BotLog, {
  schemaOptions: { collection: 'bot_logs' },
});

export type IBotLog = DocumentType<BotLog>;
export default BotLogModel;
