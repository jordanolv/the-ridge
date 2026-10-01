import { FRAGMENTS_PER_EXPEDITION, RARITY_CONFIG } from '../../peak-hunters/constants/peak-hunters.constants';
import { UserMountainsRepository } from '../../peak-hunters/repositories/user-mountains.repository';
import { MountainService } from '../../peak-hunters/services/mountain.service';
import { xpProgress } from '../../user/services/xp-progress';
import { UserService } from '../../user/services/user.service';
import type { MountainRarity } from '../../peak-hunters/types/peak-hunters.types';
import type { ActivityUser, ExpeditionTierName, HomeSummary, RarityProgress } from '../activity.types';

const TIERS: ExpeditionTierName[] = ['sentier', 'falaise', 'sommet'];
const RARITIES: MountainRarity[] = ['legendary', 'epic', 'rare', 'common'];

function rarityProgress(ownedIds: Set<string>): RarityProgress[] {
  const all = MountainService.getAll();
  return RARITIES.map(rarity => {
    const ofRarity = all.filter(m => MountainService.getRarity(m) === rarity);
    return {
      id: rarity,
      label: RARITY_CONFIG[rarity].label,
      color: `#${RARITY_CONFIG[rarity].color.toString(16).padStart(6, '0')}`,
      owned: ofRarity.filter(m => ownedIds.has(m.id)).length,
      total: ofRarity.length,
    };
  });
}

const perTier = (pick: (tier: ExpeditionTierName) => number) =>
  Object.fromEntries(TIERS.map(tier => [tier, pick(tier)])) as Record<ExpeditionTierName, number>;

export class ActivityHomeService {
  static async summary(user: ActivityUser): Promise<HomeSummary> {
    const [account, mountains] = await Promise.all([UserService.getUserByDiscordId(user.id), UserMountainsRepository.getByUserId(user.id)]);
    const level = account?.profil?.lvl ?? 0;
    const xp = xpProgress(level, account?.profil?.exp ?? 0);

    return {
      user,
      profile: account
        ? {
            level,
            xp: { current: xp.current, required: xp.required },
            money: account.profil?.money ?? 0,
            streak: account.stats?.dailyStreak ?? 0,
            weeklyPoints: account.stats?.activityPoints ?? 0,
            lastWeekPoints: account.stats?.lastWeekActivityPoints ?? 0,
          }
        : null,
      peakHunters: {
        owned: mountains?.unlockedMountains.length ?? 0,
        total: MountainService.count,
        byRarity: rarityProgress(new Set((mountains?.unlockedMountains ?? []).map(m => m.mountainId))),
        packs: perTier(tier => mountains?.[`${tier}Packs`] ?? 0),
        expeditions: perTier(tier => mountains?.[`${tier}Tickets`] ?? 0),
        fragments: mountains?.fragments ?? 0,
        fragmentsPerExpedition: FRAGMENTS_PER_EXPEDITION,
      },
    };
  }
}
