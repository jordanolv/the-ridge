import type { ExpeditionTierName, HomeSummary, OpenPackResult, PackTierInfo } from '../../../src/features/activity/activity.types';
import { getJson, postJson } from './http';
import { SAMPLE_HOME, SAMPLE_PACKS, samplePackShow } from './sample';
import type { Session } from './session';

export const avatarUrl = (userId: string) => `/api/activity/avatar/${userId}`;
export const brandUrl = (asset: 'logo' | 'background') => `/api/activity/brand/${asset}`;

export async function fetchHome(session: Session): Promise<HomeSummary> {
  if (session.mode === 'preview') return SAMPLE_HOME;
  return getJson<HomeSummary>('/api/activity/home', session.accessToken);
}

export async function fetchPacks(session: Session): Promise<PackTierInfo[]> {
  if (session.mode === 'preview') return SAMPLE_PACKS;
  return getJson<PackTierInfo[]>('/api/activity/packs', session.accessToken);
}

export async function openPack(session: Session, tier: ExpeditionTierName): Promise<OpenPackResult> {
  if (session.mode === 'preview') return { ok: true, show: samplePackShow(tier) };
  return postJson<OpenPackResult>('/api/activity/packs/open', { tier, instanceId: session.instanceId }, session.accessToken);
}
