import { DiscordSDK } from '@discord/embedded-app-sdk';
import type { ActivityConfig } from '../../../src/features/activity/activity.types';
import { getJson, postJson } from './http';

export type Session = { mode: 'discord'; accessToken: string } | { mode: 'preview' };

/** Discord ajoute `frame_id` à l'URL de l'Activity ; ouverte ailleurs, on passe en aperçu. */
const isInsideDiscord = () => new URLSearchParams(window.location.search).has('frame_id');

export async function connect(): Promise<Session> {
  if (!isInsideDiscord()) return { mode: 'preview' };

  const { clientId } = await getJson<ActivityConfig>('/api/activity/config');
  const sdk = new DiscordSDK(clientId);
  await sdk.ready();

  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  });
  const { access_token } = await postJson<{ access_token: string }>('/api/activity/token', { code });
  await sdk.commands.authenticate({ access_token });

  return { mode: 'discord', accessToken: access_token };
}
