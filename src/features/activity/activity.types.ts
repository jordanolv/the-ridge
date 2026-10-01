/** Contrat entre le serveur et l'Activity Discord (`activity/`), qui importe ces types tels quels. */

export interface ActivityConfig {
  clientId: string;
}

export interface ActivityUser {
  id: string;
  username: string;
  displayName: string;
}

export type ExpeditionTierName = 'sentier' | 'falaise' | 'sommet';

export interface RarityProgress {
  id: string;
  label: string;
  color: string;
  owned: number;
  total: number;
}

export interface HomeSummary {
  user: ActivityUser;
  profile: {
    level: number;
    xp: { current: number; required: number };
    money: number;
    streak: number;
    weeklyPoints: number;
    lastWeekPoints: number;
  } | null;
  peakHunters: {
    owned: number;
    total: number;
    byRarity: RarityProgress[];
    packs: Record<ExpeditionTierName, number>;
    expeditions: Record<ExpeditionTierName, number>;
    fragments: number;
    fragmentsPerExpedition: number;
  };
}
