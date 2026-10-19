import { activityTab } from './activity.tab';
import { gamesTab } from './games.tab';
import { inventoryTab } from './inventory.tab';
import { peakHuntersTab } from './peak-hunters.tab';
import { profileTab } from './profile.tab';
import type { ProfileTab } from './tab';

export type { TabTarget } from './tab';

/** L'ordre est celui des boutons sous la carte. */
export const TABS: readonly ProfileTab<any>[] = [profileTab, activityTab, gamesTab, peakHuntersTab, inventoryTab];

export const DEFAULT_TAB = profileTab;

export function findTab(id: string): ProfileTab<any> | undefined {
  return TABS.find(tab => tab.id === id);
}
