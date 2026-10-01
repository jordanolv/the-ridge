import type { HomeSummary } from '../../../src/features/activity/activity.types';
import { getJson } from './http';
import { SAMPLE_HOME } from './sample';
import type { Session } from './session';

export const avatarUrl = (userId: string) => `/api/activity/avatar/${userId}`;
export const brandUrl = (asset: 'logo' | 'background') => `/api/activity/brand/${asset}`;

export async function fetchHome(session: Session): Promise<HomeSummary> {
  if (session.mode === 'preview') return SAMPLE_HOME;
  return getJson<HomeSummary>('/api/activity/home', session.accessToken);
}
