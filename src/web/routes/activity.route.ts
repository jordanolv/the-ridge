import path from 'path';
import { Router, Request, Response, NextFunction } from 'express';
import { BotClient } from '../../bot/client';
import { ActivityAuthService } from '../../features/activity/services/activity-auth.service';
import { ActivityHomeService } from '../../features/activity/services/activity-home.service';
import type { ActivityConfig, ActivityUser } from '../../features/activity/activity.types';
import { defaultTheme } from '../../features/user/services/profile-card/engine/themes';
import { fetchImage } from '../../features/user/services/profile-card/engine/remote-image';

const BRAND_ASSETS: Record<string, () => string> = {
  logo: () => path.join(process.cwd(), 'assets/profile-card/logo.png'),
  background: () => defaultTheme().background,
};

function activityUser(res: Response): ActivityUser {
  return res.locals.activityUser;
}

async function requireActivityUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  const user = token ? await ActivityAuthService.identify(token).catch(() => null) : null;
  if (!user) {
    res.status(401).json({ error: 'Session Discord invalide' });
    return;
  }
  res.locals.activityUser = user;
  next();
}

/**
 * API de l'Activity Discord. Tout passe par ce domaine, y compris les images : la CSP
 * d'une Activity bloque les requêtes vers des domaines non déclarés dans ses URL mappings.
 */
export default function activityRoute(client: BotClient): Router {
  const router = Router();

  router.get('/api/activity/config', (_req, res) => {
    const config: ActivityConfig = { clientId: ActivityAuthService.clientId() };
    res.json(config);
  });

  router.post('/api/activity/token', async (req, res) => {
    const code = typeof req.body?.code === 'string' ? req.body.code : null;
    const accessToken = code ? await ActivityAuthService.exchangeCode(code).catch(() => null) : null;
    if (!accessToken) {
      res.status(400).json({ error: 'Code Discord invalide' });
      return;
    }
    res.json({ access_token: accessToken });
  });

  router.get('/api/activity/brand/:asset', (req, res) => {
    const file = BRAND_ASSETS[req.params.asset];
    if (!file) {
      res.sendStatus(404);
      return;
    }
    res.set('Cache-Control', 'public, max-age=3600').sendFile(file());
  });

  router.get('/api/activity/avatar/:userId', async (req, res) => {
    const user = await client.users.fetch(req.params.userId).catch(() => null);
    const image = user ? await fetchImage(user.displayAvatarURL({ extension: 'png', size: 256 })) : null;
    if (!image) {
      res.sendStatus(404);
      return;
    }
    res.set('Cache-Control', 'public, max-age=600').type('png').send(image);
  });

  router.get('/api/activity/home', requireActivityUser, async (_req, res) => {
    res.json(await ActivityHomeService.summary(activityUser(res)));
  });

  return router;
}
