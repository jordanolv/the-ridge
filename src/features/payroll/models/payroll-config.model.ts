import { prop, getModelForClass, DocumentType } from '@typegoose/typegoose';

export class PayrollConfig {
  @prop({ default: false })
  enabled!: boolean;

  /** Revenu moyen visé par qualifié, en RidgeCoins par semaine. */
  @prop({ default: 250 })
  budgetPerActive!: number;

  /** Part de la masse versée en base fixe ; le reste est au prorata des points. */
  @prop({ default: 40 })
  smicPercent!: number;

  /** Points minimum pour entrer sur la feuille de paie — voir economy.md §4. */
  @prop({ default: 1800 })
  qualificationThreshold!: number;
}

const PayrollConfigModel = getModelForClass(PayrollConfig, {
  schemaOptions: { collection: 'payroll_config' },
});

export type IPayrollConfig = DocumentType<PayrollConfig>;
export default PayrollConfigModel;
