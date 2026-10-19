import type { CollectionSummary, ExpeditionTierName, HomeSummary, OpenPackResult, PackTierInfo, PartiesSummary, StatsSummary } from '../../../src/features/activity/activity.types';
import { getJson, postJson } from './http';
import { SAMPLE_COLLECTION, SAMPLE_HOME, SAMPLE_PACKS, SAMPLE_PARTIES, SAMPLE_STATS, samplePackShow } from './sample';
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
  if (session.mode === 'preview') return { ok: true, show: samplePackShow(tier), remaining: 3 };
  return postJson<OpenPackResult>('/api/activity/packs/open', { tier, instanceId: session.instanceId }, session.accessToken);
}

export async function fetchCollection(session: Session): Promise<CollectionSummary> {
  if (session.mode === 'preview') return SAMPLE_COLLECTION;
  return getJson<CollectionSummary>('/api/activity/collection', session.accessToken);
}

export async function fetchStats(session: Session): Promise<StatsSummary> {
  if (session.mode === 'preview') return SAMPLE_STATS;
  return getJson<StatsSummary>('/api/activity/stats', session.accessToken);
}

export async function fetchParties(session: Session): Promise<PartiesSummary> {
  if (session.mode === 'preview') return SAMPLE_PARTIES;
  return getJson<PartiesSummary>('/api/activity/parties', session.accessToken);
}
