import { prop, getModelForClass, index, DocumentType } from '@typegoose/typegoose';

@index({ userId: 1, weekKey: 1 }, { unique: true })
@index({ createdAt: 1 }, { expireAfterSeconds: 60 * 86_400 })
export class PackBudget {
  @prop({ required: true })
  userId!: string;

  @prop({ required: true })
  weekKey!: string;

  @prop({ default: 0 })
  spent!: number;
}

const PackBudgetModel = getModelForClass(PackBudget, {
  schemaOptions: { collection: 'shop_pack_budgets', timestamps: true },
});

export type IPackBudget = DocumentType<PackBudget>;
export default PackBudgetModel;
