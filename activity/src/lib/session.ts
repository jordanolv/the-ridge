import { DiscordSDK } from '@discord/embedded-app-sdk';
import type { ActivityConfig } from '../../../src/features/activity/activity.types';
import { getJson, postJson } from './http';

export type Session =
  | { mode: 'discord'; accessToken: string; instanceId: string; config: ActivityConfig }
  | { mode: 'preview'; config: ActivityConfig };

/** Discord ajoute `frame_id` à l'URL de l'Activity ; ouverte ailleurs, on passe en aperçu. */
const isInsideDiscord = () => new URLSearchParams(window.location.search).has('frame_id');

/**
 * Une seule poignée de main par fenêtre : un second `DiscordSDK` (double montage de React
 * en dev, bouton « Réessayer ») attendrait indéfiniment sa réponse.
 */
let handshake: Promise<{ sdk: DiscordSDK; config: ActivityConfig }> | null = null;

function discord() {
  handshake ??= (async () => {
    const config = await getJson<ActivityConfig>('/api/activity/config');
    const sdk = new DiscordSDK(config.clientId);
    await sdk.ready();
    return { sdk, config };
  })().catch(error => {
    handshake = null;
    throw error;
  });
  return handshake;
}

let session: Promise<Session> | null = null;

async function authenticate(): Promise<Session> {
  const { sdk, config } = await discord();
  const { code } = await sdk.commands.authorize({
    client_id: config.clientId,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  });
  const { access_token } = await postJson<{ access_token: string }>('/api/activity/token', { code });
  await sdk.commands.authenticate({ access_token });
  return { mode: 'discord', accessToken: access_token, instanceId: sdk.instanceId, config };
}

const OFFLINE_CONFIG: ActivityConfig = { clientId: '', mapboxToken: null };

async function previewSession(): Promise<Session> {
  const config = await getJson<ActivityConfig>('/api/activity/config').catch(() => OFFLINE_CONFIG);
  return { mode: 'preview', config };
}

export function connect(): Promise<Session> {
  if (!isInsideDiscord()) return previewSession();
  session ??= authenticate().catch(error => {
    session = null;
    throw error;
  });
  return session;
}

export function describeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const code = 'code' in error ? ` (code ${String(error.code)})` : '';
    return `${String(error.message)}${code}`;
  }
  return String(error);
}
