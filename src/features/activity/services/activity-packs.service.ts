import { randomUUID } from 'node:crypto';
import { EXPEDITION_TIER_CONFIG, PACK_CARDS, RARITY_CONFIG } from '../../peak-hunters/constants/peak-hunters.constants';
import { UserMountainsRepository } from '../../peak-hunters/repositories/user-mountains.repository';
import { MountainService, type CardDraw } from '../../peak-hunters/services/mountain.service';
import { openPack } from '../../peak-hunters/services/pack.service';
import type { ActivityUser, ExpeditionTierName, OpenPackResult, PackShow, PackTierInfo, ShowCard } from '../activity.types';
import { ActivityLiveService } from './activity-live.service';
import { hexColor } from './hex-color';

const TIERS: ExpeditionTierName[] = ['sentier', 'falaise', 'sommet'];

export const isPackTier = (value: unknown): value is ExpeditionTierName => TIERS.includes(value as ExpeditionTierName);

export const mountainImagePath = (mountainId: string) => `/api/activity/mountains/${encodeURIComponent(mountainId)}/image`;

function toShowCard(card: CardDraw): ShowCard {
  const { mountain, rarity } = card;
  return {
    id: mountain.id,
    label: mountain.mountainLabel,
    countries: mountain.countries,
    altitude: MountainService.getAltitude(mountain),
    elevation: Number.parseFloat(mountain.elevation) || 0,
    rarity,
    rarityLabel: RARITY_CONFIG[rarity].label,
    color: hexColor(RARITY_CONFIG[rarity].color),
    image: mountainImagePath(mountain.id),
    lat: mountain.lat ?? null,
    lng: mountain.lng ?? null,
    isDuplicate: card.isDuplicate,
    fragmentsGained: card.fragmentsGained,
    expeditionsAwarded: card.expeditionsAwarded,
  };
}

export class ActivityPacksService {
  static async tiers(userId: string): Promise<PackTierInfo[]> {
    const doc = await UserMountainsRepository.getByUserId(userId);
    return TIERS.map(tier => ({
      id: tier,
      label: EXPEDITION_TIER_CONFIG[tier].label,
      description: EXPEDITION_TIER_CONFIG[tier].description,
      color: hexColor(EXPEDITION_TIER_CONFIG[tier].color),
      cards: PACK_CARDS[tier],
      owned: doc ? UserMountainsRepository.packsOf(doc, tier) : 0,
    }));
  }

  /** Ouvre le pack et le met en scène dans la salle de l'Activity, si le joueur y est connecté. */
  static async open(user: ActivityUser, tier: ExpeditionTierName, instanceId: string | null): Promise<OpenPackResult> {
    const opened = await openPack(user.id, tier);
    if ('reason' in opened) return opened;

    const show: Omit<PackShow, 'startsAt'> = {
      id: randomUUID(),
      opener: user,
      tier,
      tierLabel: EXPEDITION_TIER_CONFIG[tier].label,
      tierColor: hexColor(EXPEDITION_TIER_CONFIG[tier].color),
      cards: opened.cards.map(toShowCard),
      skippedAt: null,
    };
    return { ok: true, show: ActivityLiveService.schedule(instanceId, show) };
  }
}
