import UserModel from '../../features/user/models/user.model';
import { PayrollConfigRepository } from '../../features/payroll/repositories/payroll-config.repository';
import { computePayroll } from '../../features/payroll/services/payroll.service';

export interface SalaryEstimate {
  points: number;
  rank: number;
  qualified: number;
  estimate: number;
}

/**
 * Ce que toucherait un joueur si la semaine s'arrêtait maintenant.
 * Sert uniquement d'affichage : la paie du lundi recalcule tout depuis zéro.
 */
export async function estimateWeeklySalary(userId: string): Promise<SalaryEstimate | null> {
  const config = await PayrollConfigRepository.get();
  if (!config?.enabled) return null;

  const users = await UserModel.find({ 'stats.activityPoints': { $gt: 0 } })
    .select('discordId stats.activityPoints')
    .lean();

  const scores = users
    .map(u => ({ userId: u.discordId, points: u.stats?.activityPoints ?? 0 }))
    .sort((a, b) => b.points - a.points);

  const slips = computePayroll(scores, config);
  const index = slips.findIndex(s => s.userId === userId);
  if (index === -1) return null;

  return {
    points: slips[index].points,
    rank: index + 1,
    qualified: slips.length,
    estimate: slips[index].total,
  };
}
