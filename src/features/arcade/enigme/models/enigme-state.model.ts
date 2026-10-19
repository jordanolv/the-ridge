import { prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

export type EnigmeType = 'suite' | 'anagramme' | 'calcul' | 'devinette' | 'charade' | 'emoji';

export interface Riddle {
  type: EnigmeType;
  question: string;
  answers: string[];
  hint: string;
}

export interface Solver {
  userId: string;
  at: Date;
  durationMs: number;
  usedHint: boolean;
}

export class EnigmeState {
  @prop()
  nextSpawnAt?: Date;

  @prop()
  activeThreadId?: string;

  @prop()
  activeMessageId?: string;

  @prop({ type: Object })
  riddle?: Riddle;

  @prop()
  startedAt?: Date;

  @prop()
  endsAt?: Date;

  /** userId -> date de découverte de l'énigme, départ de son chrono */
  @prop({ type: Object, default: {} })
  revealedAt?: Record<string, Date>;

  /** userId -> date de demande de l'indice */
  @prop({ type: Object, default: {} })
  hintedAt?: Record<string, Date>;

  /** userId -> nombre d'essais */
  @prop({ type: Object, default: {} })
  attempts?: Record<string, number>;

  /** Bonnes réponses, dans l'ordre d'arrivée */
  @prop({ type: Object, default: [] })
  solvers?: Solver[];

  @prop()
  announceMessageId?: string;
}

const EnigmeStateModel = getModelForClass(EnigmeState, {
  schemaOptions: { collection: 'enigme_state', timestamps: true },
});

export type IEnigmeStateDoc = DocumentType<EnigmeState>;
export default EnigmeStateModel;
