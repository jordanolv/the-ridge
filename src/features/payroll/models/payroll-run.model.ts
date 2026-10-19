import { prop, getModelForClass, index, DocumentType } from '@typegoose/typegoose';

@index({ weekKey: 1 }, { unique: true })
class PayrollRun {
  /** Semaine ISO au format `2026-W38`, en heure de Paris. */
  @prop({ required: true })
  weekKey!: string;

  @prop({ required: true })
  headcount!: number;

  @prop({ required: true })
  totalPaid!: number;

  @prop({ default: () => new Date() })
  paidAt!: Date;
}

const PayrollRunModel = getModelForClass(PayrollRun, {
  schemaOptions: { collection: 'payroll_runs' },
});

export type IPayrollRun = DocumentType<PayrollRun>;
export default PayrollRunModel;
