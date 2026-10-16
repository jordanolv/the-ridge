import type { ActivityUser } from '../activity.types';

const DISCORD_API = 'https://discord.com/api/v10';
const IDENTITY_TTL_MS = 10 * 60 * 1000;

interface DiscordUserPayload {
  id: string;
  username: string;
  global_name: string | null;
}

const identities = new Map<string, { user: ActivityUser; expiresAt: number }>();

function clientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('DISCORD_CLIENT_ID ou DISCORD_CLIENT_SECRET manquant');
  return { clientId, clientSecret };
}

export class ActivityAuthService {
  static clientId(): string {
    return clientCredentials().clientId;
  }

  /** Le secret client ne quitte jamais le serveur : l'Activity n'envoie que le code obtenu via `authorize`. */
  static async exchangeCode(code: string): Promise<string | null> {
    const { clientId, clientSecret } = clientCredentials();
    const response = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code }),
    });
    if (!response.ok) return null;
    const { access_token } = (await response.json()) as { access_token?: string };
    return access_token ?? null;
  }

  /** Qui se cache derrière ce jeton ? Mis en cache pour ne pas solliciter Discord à chaque requête. */
  static async identify(accessToken: string): Promise<ActivityUser | null> {
    const cached = identities.get(accessToken);
    if (cached && cached.expiresAt > Date.now()) return cached.user;

    const response = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      identities.delete(accessToken);
      return null;
    }

    const payload = (await response.json()) as DiscordUserPayload;
    const user = { id: payload.id, username: payload.username, displayName: payload.global_name ?? payload.username };
    identities.set(accessToken, { user, expiresAt: Date.now() + IDENTITY_TTL_MS });
    return user;
  }
}
