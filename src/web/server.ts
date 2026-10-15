import express from 'express';
import path from 'path';
import chalk from 'chalk';
import mountainMapRoute from './routes/mountain-map.route';
import adminRoute from './routes/admin.route';
import logsRoute from './routes/logs.route';
import activityRoute from './routes/activity.route';
import { ActivityLiveService } from '../features/activity/services/activity-live.service';
import fs from 'fs';
import { BotClient } from '../bot/client';

export function startWebServer(client: BotClient): void {
  const port = parseInt(process.env.WEB_PORT ?? '3001', 10);
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(mountainMapRoute);
  app.use(adminRoute(client));
  app.use(logsRoute(client));
  app.use(activityRoute(client));

  // Les URL mappings Discord pointent sur la racine des sous-domaines activity*.theridge.fr.
  const activityDist = path.join(process.cwd(), 'activity', 'dist');
  const hasActivity = fs.existsSync(activityDist);
  if (hasActivity) app.use(express.static(activityDist, { index: false }));
  app.get('/', (req, res) => {
    if (hasActivity && req.hostname.startsWith('activity')) res.sendFile(path.join(activityDist, 'index.html'));
    else res.redirect('/admin');
  });

  // Page globe — sert l'HTML pour toute route /map/*
  app.get('/map', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mountain-map.html'));
  });

  app.get('/admin', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  });

  const server = app.listen(port, () => {
    console.log(
      chalk.yellow('   ├─ 🌐 Web server') +
        chalk.gray(` • port ${port} • /admin actif`),
    );
  });
  ActivityLiveService.attach(server, client);
}
