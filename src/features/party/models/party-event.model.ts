import { prop, getModelForClass } from '@typegoose/typegoose';
import { Types } from 'mongoose';

export class EventInfo {
  @prop({ required: true })
  name!: string;

  @prop({ required: true })
  game!: string;

  @prop()
  description?: string;

  @prop({ required: true })
  dateTime!: Date;

  @prop({ required: true, min: 1, max: 100 })
  maxSlots!: number;

  @prop()
  image?: string;

  @prop({ default: '#FF6B6B' })
  color!: string;
}

export class DiscordInfo {

  @prop({ required: true })
  channelId!: string;

  @prop()
  messageId?: string;

  @prop()
  threadId?: string;

  @prop()
  roleId?: string;

}

export class PartyEvent {
  _id!: Types.ObjectId;

  @prop({ type: () => EventInfo, required: true })
  eventInfo!: EventInfo;

  @prop({ type: () => DiscordInfo, required: true })
  discord!: DiscordInfo;

  @prop({ type: () => [String], default: [] })
  participants!: string[];

  @prop({ required: true })
  createdBy!: string;

  @prop()
  chatGamingGameId?: string;

  @prop({ enum: ['pending', 'started', 'ended'], default: 'pending' })
  status!: 'pending' | 'started' | 'ended';

  @prop({ type: () => [String], default: [] })
  attendedParticipants!: string[];

  @prop()
  rewardAmount?: number;

  @prop()
  xpAmount?: number;

  @prop()
  expeditionAmount?: number;

  @prop()
  startedAt?: Date;

  @prop()
  endedAt?: Date;
}

export const PartyEventModel = getModelForClass(PartyEvent, {
  schemaOptions: {
    timestamps: true,
    collection: 'party_items'
  }
});

export default PartyEventModel;