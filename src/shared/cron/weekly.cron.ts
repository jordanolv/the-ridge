import { CronJob } from 'cron';
import { BotClient } from '../../bot/client';
import { ActivityRolesService } from '../../features/activity-roles/services/activity-roles.service';
import { PayrollService } from '../../features/payroll/services/payroll.service';
import { WeeklyRecapService } from '../weekly-recap/weekly-recap.service';

const TZ = 'Europe/Paris';
const CRON_EXPRESSION = '0 0 0 * * 1'; // lundi minuit Paris

/**
 * Séquence du lundi. L'ordre est le contrat : `collectAndReset` rend le classement de
 * la semaine écoulée et remet les compteurs à zéro, donc tout le reste doit consommer
 * son retour. Déplacer la paie avant cet appel la ferait travailler sur la semaine en
 * cours ; la déplacer après un second reset la ferait verser zéro.
 *
 * La paie passe avant les rôles : l'attribution fetch tous les membres de la guilde et
 * peut échouer, on ne veut pas qu'elle emporte le versement avec elle.
 */
export async function runWeekly(client: BotClient): Promise<void> {
  const scores = await ActivityRolesService.collectAndReset();

  await PayrollService.run(client, scores).catch(err => console.error('[Weekly] Erreur paie:', err));
  await ActivityRolesService.apply(client, scores).catch(err => console.error('[Weekly] Erreur rôles:', err));
  await WeeklyRecapService.post(client, scores).catch(err => console.error('[Weekly] Erreur récap:', err));
}

export class WeeklyCron {
  private job: CronJob;
  private client: BotClient;

  constructor(client: BotClient) {
    this.client = client;
    this.job = new CronJob(CRON_EXPRESSION, this.run.bind(this), null, false, TZ);
  }

  public start(): void {
    this.job.start();
    const chalk = require('chalk');
    console.log(
      chalk.yellow('   ├─ 🗓️  Rotation hebdomadaire') +
        chalk.gray(` • paie, rôles et récap • lundi minuit ${TZ}`),
    );
  }

  public stop(): void {
    this.job.stop();
  }

  private async run(): Promise<void> {
    await runWeekly(this.client).catch(err => console.error('[Weekly] Erreur rotation:', err));
  }
}
