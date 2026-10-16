import { UserMountainsRepository } from '../../peak-hunters/repositories/user-mountains.repository';
import { MountainService, type MountainInfo } from '../../peak-hunters/services/mountain.service';
import type { CollectionMountain, CollectionSummary } from '../activity.types';
import { mountainImagePath } from './mountain-image';
import { RARITY_ORDER, rarityInfo } from './rarities';

function toCollectionMountain(mountain: MountainInfo, unlockedAt: Date | undefined): CollectionMountain {
  return {
    id: mountain.id,
    label: mountain.mountainLabel,
    altitude: MountainService.getAltitude(mountain),
    elevation: Number.parseFloat(mountain.elevation) || 0,
    countries: mountain.countries,
    flags: mountain.flags,
    rarity: MountainService.getRarity(mountain),
    lat: mountain.lat ?? null,
    lng: mountain.lng ?? null,
    image: mountainImagePath(mountain.id),
    thumbnail: mountainImagePath(mountain.id, 'thumb'),
    unlockedAt: unlockedAt ? new Date(unlockedAt).getTime() : null,
  };
}

export class ActivityCollectionService {
  static async summary(userId: string): Promise<CollectionSummary> {
    const doc = await UserMountainsRepository.getByUserId(userId);
    const unlocked = new Map((doc?.unlockedMountains ?? []).map(m => [m.mountainId, m.unlockedAt]));

    return {
      rarities: RARITY_ORDER.map(rarityInfo),
      mountains: MountainService.getAll().map(mountain => toCollectionMountain(mountain, unlocked.get(mountain.id))),
    };
  }
}
