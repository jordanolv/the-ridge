import { useSyncExternalStore } from 'react';
import type { ExpeditionTierName, PackTierInfo } from '../../../src/features/activity/activity.types';
import { openPack } from './api';
import { addShow } from './live';
import type { Session } from './session';

export interface OpeningState {
  opening: ExpeditionTierName | null;
  failure: string | null;
  packs: PackTierInfo[];
  /** Augmente à chaque ouverture réussie, d'où qu'elle vienne : la page Packs s'y recharge. */
  opened: number;
}

const FAILURES = {
  'no-pack': "Tu n'as plus de pack de ce type : passe par la boutique (/shop).",
  'draw-failed': "Le tirage a échoué, ton pack t'a été rendu.",
};

let state: OpeningState = { opening: null, failure: null, packs: [], opened: 0 };
const listeners = new Set<() => void>();

function update(patch: Partial<OpeningState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export async function openAndPlay(session: Session, tier: ExpeditionTierName): Promise<void> {
  if (state.opening) return;
  update({ opening: tier, failure: null });
  try {
    const result = await openPack(session, tier);
    if (result.ok) {
      addShow(result.show);
      update({ packs: result.packs, opened: state.opened + 1 });
    } else {
      const packs = result.reason === 'no-pack' ? state.packs.map(p => (p.id === tier ? { ...p, owned: 0 } : p)) : state.packs;
      update({ failure: FAILURES[result.reason], packs });
    }
  } catch {
    update({ failure: "L'ouverture a échoué. Réessaie dans un instant." });
  } finally {
    update({ opening: null });
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useOpening = () => useSyncExternalStore(subscribe, () => state);
