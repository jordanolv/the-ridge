import { ContainerBuilder, MessageFlags, SeparatorBuilder, TextDisplayBuilder } from 'discord.js';
import { BotClient } from '../../../bot/client';
import { UserService } from '../../user/services/user.service';
import { LogService } from '../../../shared/logs/logs.service';
import { toParisDayYMD } from '../../../shared/time/day-split';
import { PayrollConfigRepository } from '../repositories/payroll-config.repository';
import PayrollRunModel from '../models/payroll-run.model';

const LOG_FEATURE = '💰 Paie';
const ACCENT_COLOR = 0xf1c40f;
const fmt = (n: number) => n.toLocaleString('fr-FR');

export interface ActivityScore {
  userId: string;
  name?: string;
  points: number;
}

export interface Payslip {
  userId: string;
  points: number;
  share: number;
  base: number;
  variable: number;
  total: number;
}

export interface PayrollParams {
  budgetPerActive: number;
  smicPercent: number;
  qualificationThreshold: number;
}

/**
 * Règles et invariants : voir economy.md §3 et §4.
 * La masse s'indexe sur les seuls qualifiés — jamais sur l'effectif total de la base,
 * sinon un message unique envoyé par des comptes dormants multiplie l'émission.
 */
export function computePayroll(scores: ActivityScore[], params: PayrollParams): Payslip[] {
  const { budgetPerActive, smicPercent, qualificationThreshold } = params;

  const qualified = scores.filter(s => s.points >= qualificationThreshold);
  if (!qualified.length) return [];

  const totalPoints = qualified.reduce((sum, s) => sum + s.points, 0);
  if (totalPoints <= 0) return [];

  const base = Math.round((budgetPerActive * smicPercent) / 100);
  const variablePool = qualified.length * budgetPerActive - qualified.length * base;

  return qualified.map(s => {
    const share = s.points / totalPoints;
    const variable = Math.round(share * variablePool);
    return { userId: s.userId, points: s.points, share, base, variable, total: base + variable };
  });
}

export function parisWeekKey(date: Date): string {
  const [y, m, d] = toParisDayYMD(date).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d));
  // ISO 8601 : la semaine appartient à l'année de son jeudi.
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7));
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export class PayrollService {
  /**
   * `scores` doit être lu AVANT le reset hebdomadaire des activityPoints (economy.md §4).
   * Le marqueur de semaine est posé avant tout versement : en cas de crash au milieu de
   * la paie, mieux vaut personne payé et un rattrapage manuel que tout le monde payé deux fois.
   */
  static async run(client: BotClient, scores: ActivityScore[]): Promise<Payslip[]> {
    const config = await PayrollConfigRepository.get();
    if (!config?.enabled) return [];

    const payslips = computePayroll(scores, config);
    if (!payslips.length) {
      await LogService.info('Aucun qualifié cette semaine, aucune paie versée.', {
        feature: LOG_FEATURE,
        title: '🗓️ Paie hebdomadaire',
      }).catch(() => {});
      return [];
    }

    const weekKey = parisWeekKey(new Date());
    const totalPaid = payslips.reduce((sum, p) => sum + p.total, 0);

    try {
      await PayrollRunModel.create({ weekKey, headcount: payslips.length, totalPaid });
    } catch {
      await LogService.warning(`Paie de la semaine ${weekKey} déjà versée — versement ignoré.`, {
        feature: LOG_FEATURE,
        title: '🗓️ Paie hebdomadaire',
      }).catch(() => {});
      return [];
    }

    for (const [index, slip] of payslips.entries()) {
      await UserService.updateUserMoney(slip.userId, slip.total, `Salaire ${weekKey}`, 'mint')
        .catch(err => console.error(`[Payroll] Versement impossible pour ${slip.userId}:`, err));
      await this.sendPayslip(client, slip, index + 1, payslips.length);
    }

    const top3 = payslips
      .slice(0, 3)
      .map((p, i) => `${i + 1}. <@${p.userId}> — **${p.total.toLocaleString('fr-FR')}** 💰`)
      .join('\n');

    await LogService.success(
      `**${payslips.length}** qualifié(s) payé(s) pour **${totalPaid.toLocaleString('fr-FR')}** 💰\n\n**🏆 Top 3**\n${top3}`,
      { feature: LOG_FEATURE, title: `🗓️ Paie ${weekKey}` },
    ).catch(() => {});

    return payslips;
  }

  private static async sendPayslip(
    client: BotClient,
    slip: Payslip,
    rank: number,
    qualified: number,
  ): Promise<void> {
    const user = await client.users.fetch(slip.userId).catch(() => null);
    if (!user) return;

    const container = new ContainerBuilder()
      .setAccentColor(ACCENT_COLOR)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `# 💰 Ta paie de la semaine\n-# ${fmt(slip.points)} points d'activité · ${rank}ᵉ sur ${qualified} qualifié${qualified > 1 ? 's' : ''}`,
      ))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        [
          `Base fixe — **${fmt(slip.base)}** 💰`,
          `Part d'activité — **${fmt(slip.variable)}** 💰`,
          '',
          `## **${fmt(slip.total)}** 💰 versés`,
          '-# Voc et messages comptent · rendez-vous lundi prochain',
        ].join('\n'),
      ));

    await user.send({ components: [container], flags: MessageFlags.IsComponentsV2 })
      .catch(() => {});
  }
}
