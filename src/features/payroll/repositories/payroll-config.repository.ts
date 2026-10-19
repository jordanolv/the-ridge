import PayrollConfigModel, { IPayrollConfig } from '../models/payroll-config.model';

export class PayrollConfigRepository {
  static async getOrCreate(): Promise<IPayrollConfig> {
    const existing = await PayrollConfigModel.findOne();
    if (existing) return existing;
    return PayrollConfigModel.create({});
  }

  static async get(): Promise<IPayrollConfig | null> {
    return PayrollConfigModel.findOne();
  }

  static async update(data: Partial<{
    enabled: boolean;
    budgetPerActive: number;
    smicPercent: number;
    qualificationThreshold: number;
  }>): Promise<IPayrollConfig> {
    const doc = await this.getOrCreate();
    if (data.enabled !== undefined) doc.enabled = data.enabled;
    if (data.budgetPerActive !== undefined) doc.budgetPerActive = data.budgetPerActive;
    if (data.smicPercent !== undefined) doc.smicPercent = data.smicPercent;
    if (data.qualificationThreshold !== undefined) doc.qualificationThreshold = data.qualificationThreshold;
    return doc.save();
  }
}
