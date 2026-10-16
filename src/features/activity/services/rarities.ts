import { RARITY_CONFIG } from '../../peak-hunters/constants/peak-hunters.constants';
import type { MountainRarity } from '../../peak-hunters/types/peak-hunters.types';
import type { RarityInfo } from '../activity.types';
import { hexColor } from './hex-color';

export const RARITY_ORDER: MountainRarity[] = ['legendary', 'epic', 'rare', 'common'];

export const rarityInfo = (rarity: MountainRarity): RarityInfo => ({
  id: rarity,
  label: RARITY_CONFIG[rarity].label,
  color: hexColor(RARITY_CONFIG[rarity].color),
});
