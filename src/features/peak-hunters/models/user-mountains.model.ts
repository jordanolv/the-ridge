import { prop, getModelForClass, DocumentType } from '@typegoose/typegoose';
import type { MountainRarity } from '../types/peak-hunters.types';

export class UnlockedMountain {
  @prop({ required: true })
  mountainId!: string;

  @prop({ required: true })
  unlockedAt!: Date;

  @prop({ type: () => String, default: 'common' })
  rarity?: MountainRarity;
}

export class UserMountains {
  @prop({ required: true, unique: true })
  userId!: string;

  @prop({ type: () => [UnlockedMountain], default: [] })
  unlockedMountains!: UnlockedMountain[];

  /** Expéditions Sentier disponibles */
  @prop({ default: 0 })
  sentierTickets!: number;

  /** Expéditions Falaise disponibles */
  @prop({ default: 0 })
  falaiseTickets!: number;

  /** Expéditions Sommet disponibles (garantit épique ou légendaire) */
  @prop({ default: 0 })
  sommetTickets!: number;

  /** Packs Sentier achetés en boutique, non ouverts */
  @prop({ default: 0 })
  sentierPacks!: number;

  /** Packs Falaise achetés en boutique, non ouverts */
  @prop({ default: 0 })
  falaisePacks!: number;

  /** Packs Sommet achetés en boutique, non ouverts */
  @prop({ default: 0 })
  sommetPacks!: number;

  /** Fragments accumulés (convertis en expéditions tous les 20) */
  @prop({ default: 0 })
  fragments!: number;

  /** Total d'expéditions Sentier ouvertes (cumulatif, jamais décrémenté) */
  @prop({ default: 0 })
  sentierOpened!: number;

  /** Total d'expéditions Falaise ouvertes (cumulatif) */
  @prop({ default: 0 })
  falaiseOpened!: number;

  /** Total d'expéditions Sommet ouvertes (cumulatif) */
  @prop({ default: 0 })
  sommetOpened!: number;
}

const UserMountainsModel = getModelForClass(UserMountains, {
  schemaOptions: {
    timestamps: true,
    collection: 'user_mountains'
  }
});

export type IUserMountains = UserMountains;
export type IUserMountainsDoc = DocumentType<UserMountains>;
export default UserMountainsModel;
