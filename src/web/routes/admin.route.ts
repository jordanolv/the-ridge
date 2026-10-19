import { Router, Request, Response, NextFunction } from 'express';
import { ChannelType } from 'discord.js';
import jwt from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'crypto';
import { requireAdmin, getSecret, TOKEN_TTL } from '../auth';
import { LogService } from '../../shared/logs/logs.service';
import { BotClient } from '../../bot/client';
import { QuizConfigRepository } from '../../features/quiz/repositories/quiz-config.repository';
import { QuizService } from '../../features/quiz/services/quiz.service';
import UserModel from '../../features/user/models/user.model';
import { AppConfigService } from '../../features/discord/services/app-config.service';
import { PeakHuntersConfigRepository } from '../../features/peak-hunters/repositories/peak-hunters-config.repository';
import { MountainService } from '../../features/peak-hunters/services/mountain.service';
import { SpawnService } from '../../features/peak-hunters/services/spawn.service';
import { ActivityRolesConfigRepository } from '../../features/activity-roles/repositories/activity-roles-config.repository';
import { PayrollConfigRepository } from '../../features/payroll/repositories/payroll-config.repository';
import { computePayroll } from '../../features/payroll/services/payroll.service';
import { PersonalityTestConfigRepository } from '../../features/personality-test/repositories/personality-test-config.repository';
import { GamesForumService } from '../../features/discord/services/games-forum.service';
import { PartyService } from '../../features/party/services/party.service';
import { ChatGamingService } from '../../features/chat-gaming/services/chat-gaming.service';
import { PersonalityTestService } from '../../features/personality-test/services/personality-test.service';
import { PersonalityTestSessionRepository } from '../../features/personality-test/repositories/personality-test-session.repository';
import { VoiceService } from '../../features/voice/services/voice.service';
import { VoiceConfigRepository } from '../../features/voice/repositories/voice-config.repository';
import { UserMountainsRepository } from '../../features/peak-hunters/repositories/user-mountains.repository';
import { runWeekly } from '../../shared/cron/weekly.cron';
import { BingoRepository } from '../../features/arcade/bingo/repositories/bingo.repository';
import { BingoService } from '../../features/arcade/bingo/services/bingo.service';
import { JustePrixRepository } from '../../features/arcade/juste-prix/repositories/juste-prix.repository';
import { JustePrixService } from '../../features/arcade/juste-prix/services/juste-prix.service';
import { ArcadeScheduleService } from '../../features/arcade/schedule/services/arcade-schedule.service';
import { AvalancheRepository } from '../../features/arcade/avalanche/repositories/avalanche.repository';
import { AvalancheService } from '../../features/arcade/avalanche/services/avalanche.service';
import { EnigmeRepository } from '../../features/arcade/enigme/repositories/enigme.repository';
import { WeeklyRecapService } from '../../shared/weekly-recap/weekly-recap.service';
import { EnigmeService } from '../../features/arcade/enigme/services/enigme.service';

const ARCADE_GAMES = ['shifumi', 'puissance4', 'morpion', 'battle', 'bingo', 'justePrix', 'avalanche', 'enigme'] as const;

function sha256(input: string): Buffer {
  return createHash('sha256').update(input).digest();
}

export default function adminRoute(client: BotClient): Router {
  const router = Router();

  function channelName(channelId?: string | null): string | null {
    if (!channelId) return null;
    const guild = client.guilds.cache.get(process.env.GUILD_ID!);
    const channel = guild?.channels.cache.get(channelId);
    return channel ? `#${channel.name}` : `(inconnu : ${channelId})`;
  }

  router.use((req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'GET' || req.path === '/api/admin/login') { next(); return; }
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const body = JSON.stringify(req.body ?? {});
      LogService.record({
        level: 'info',
        kind: 'dashboard',
        feature: 'dashboard',
        title: `${req.method} ${req.path}`,
        message: `Dashboard : \`${req.method} ${req.path}\`${body === '{}' ? '' : ` ${body.slice(0, 500)}`}`,
      }).catch(() => {});
    });
    next();
  });

  router.post('/api/admin/login', (req: Request, res: Response): void => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) { res.status(503).json({ error: 'ADMIN_PASSWORD non configuré' }); return; }

    const given = String(req.body?.password ?? '');
    if (!timingSafeEqual(sha256(given), sha256(expected))) {
      res.status(401).json({ error: 'Mot de passe incorrect' });
      return;
    }

    const token = jwt.sign({ admin: true }, getSecret(), { expiresIn: TOKEN_TTL });
    res.json({ token });
  });

  // ───────────────────────── Vue d'ensemble ─────────────────────────

  router.get('/api/admin/overview', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const [userCount, totals, topActivity] = await Promise.all([
      UserModel.countDocuments(),
      UserModel.aggregate([{
        $group: {
          _id: null,
          totalMsg: { $sum: '$stats.totalMsg' },
          voiceTime: { $sum: '$stats.voiceTime' },
          totalDailies: { $sum: '$stats.totalDailies' },
          activityPoints: { $sum: '$stats.activityPoints' },
        },
      }]),
      UserModel.find().sort({ 'stats.activityPoints': -1 }).limit(5)
        .select('name stats.activityPoints stats.totalMsg stats.voiceTime').lean(),
    ]);

    const guild = client.guilds.cache.get(process.env.GUILD_ID!);

    res.json({
      guild: guild ? { name: guild.name, memberCount: guild.memberCount } : null,
      userCount,
      totals: totals[0] ?? { totalMsg: 0, voiceTime: 0, totalDailies: 0, activityPoints: 0 },
      topActivity: topActivity.map((u: any) => ({
        name: u.name,
        activityPoints: u.stats?.activityPoints ?? 0,
        totalMsg: u.stats?.totalMsg ?? 0,
        voiceTime: u.stats?.voiceTime ?? 0,
      })),
    });
  });

  // ───────────────────────── Joueurs ─────────────────────────

  router.get('/api/admin/users', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const sortMap: Record<string, string> = {
      activity: 'stats.activityPoints',
      messages: 'stats.totalMsg',
      voice: 'stats.voiceTime',
      level: 'profil.lvl',
      money: 'profil.money',
    };
    const sortField = sortMap[String(req.query.sort ?? 'activity')] ?? sortMap.activity!;
    const limit = Math.min(parseInt(String(req.query.limit ?? '25'), 10) || 25, 100);

    const users = await UserModel.find().sort({ [sortField]: -1 }).limit(limit)
      .select('discordId name profil stats.activityPoints stats.totalMsg stats.voiceTime stats.dailyStreak').lean();

    res.json({
      users: users.map((u: any) => ({
        discordId: u.discordId,
        name: u.name,
        lvl: u.profil?.lvl ?? 1,
        money: u.profil?.money ?? 0,
        activityPoints: u.stats?.activityPoints ?? 0,
        totalMsg: u.stats?.totalMsg ?? 0,
        voiceTime: u.stats?.voiceTime ?? 0,
        dailyStreak: u.stats?.dailyStreak ?? 0,
      })),
    });
  });

  // ───────────────────────── Quiz ─────────────────────────

  router.get('/api/admin/quiz', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const config = await QuizConfigRepository.getOrCreate();
    const choices = config.activeThemeChoices ?? {};
    const answers = config.activeAnswers ?? {};

    const questions = (config.activeQuestions ?? []).map((q) => {
      const players = Object.entries(choices).filter(([, id]) => id === q.id);
      const answered = players.filter(([userId]) => answers[userId] !== undefined);
      return {
        id: q.id,
        theme: q.theme,
        subtheme: q.subtheme,
        question: q.question,
        choices: q.choices,
        answer: q.answer,
        image: q.image ?? null,
        picks: players.length,
        answered: answered.length,
        correct: answered.filter(([userId]) => answers[userId] === q.answer).length,
      };
    });

    res.json({
      active: questions.length > 0,
      activeUntil: config.activeUntil ?? null,
      participants: Object.keys(choices).length,
      answered: Object.keys(answers).length,
      questions,
    });
  });

  router.post('/api/admin/quiz/repost', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const posted = await QuizService.repost(client);
    if (!posted) { res.status(409).json({ error: 'Aucun channel de spawn configuré' }); return; }
    res.json({ ok: true });
  });

  router.post('/api/admin/quiz/reveal', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    await QuizService.revealActive(client);
    res.json({ ok: true });
  });

  // ───────────────────────── Channels (création à la volée) ─────────────────────────

  router.post('/api/admin/channels', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const name = String(req.body?.name ?? '').trim().slice(0, 90);
    if (!name) { res.status(400).json({ error: 'Nom de channel requis' }); return; }
    const guild = client.guilds.cache.get(process.env.GUILD_ID!);
    if (!guild) { res.status(503).json({ error: 'Guild introuvable' }); return; }
    const type = req.body?.type === 'forum' ? ChannelType.GuildForum : ChannelType.GuildText;
    try {
      const channel = await guild.channels.create({ name, type });
      res.json({ id: channel.id, name: channel.name });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Création impossible' });
    }
  });

  // ───────────────────────── Arcade ─────────────────────────

  router.get('/api/admin/arcade', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const appConfig = await AppConfigService.getOrCreateConfig();
    const arcade = (appConfig.features?.arcade ?? {}) as any;
    const games = ARCADE_GAMES.map((key) => ({
      key,
      enabled: arcade[key]?.enabled ?? true,
      totalGames: arcade[key]?.stats?.totalGames ?? 0,
    }));

    const [bingoState, jpState, avalancheState, enigmeState] = await Promise.all([
      BingoRepository.get(),
      JustePrixRepository.get(),
      AvalancheRepository.get(),
      EnigmeRepository.get(),
    ]);
    res.json({
      enabled: games.every((g) => g.enabled),
      games,
      schedule: await ArcadeScheduleService.getCurrentWeek(),
      bingo: {
        active: Boolean(bingoState?.activeThreadId),
        nextSpawnAt: bingoState?.nextSpawnAt ?? null,
        guessCount: bingoState?.activeGuessers?.length ?? 0,
      },
      justePrix: {
        active: Boolean(jpState?.activeThreadId),
        endsAt: jpState?.activeEndsAt ?? null,
        nextSpawnAt: jpState?.nextSpawnAt ?? null,
        guessCount: Object.keys(jpState?.guesses ?? {}).length,
      },
      avalanche: {
        active: Boolean(avalancheState?.activeThreadId),
        registrationEndsAt: avalancheState?.registrationEndsAt ?? null,
        playerCount: Object.keys(avalancheState?.players ?? {}).length,
        eliminatedCount: (avalancheState?.eliminatedNumbers ?? []).length,
      },
      enigme: {
        active: Boolean(enigmeState?.activeThreadId),
        type: enigmeState?.riddle?.type ?? null,
        endsAt: enigmeState?.endsAt ?? null,
        nextSpawnAt: enigmeState?.nextSpawnAt ?? null,
        solverCount: (enigmeState?.solvers ?? []).length,
        attemptCount: Object.keys(enigmeState?.attempts ?? {}).length,
      },
    });
  });

  router.post('/api/admin/arcade/schedule/generate', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    await ArcadeScheduleService.regenerate(client);
    res.json({ ok: true });
  });

  /** Aperçu du récap du lundi : points d'activité actuels, sans reset ni rôles. */
  router.post('/api/admin/arcade/recap/preview', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const users = await UserModel.find({ 'stats.activityPoints': { $gt: 0 } })
      .sort({ 'stats.activityPoints': -1 }).limit(3).select('discordId stats.activityPoints').lean();
    await WeeklyRecapService.post(client, users.map((u) => ({ userId: u.discordId, points: u.stats.activityPoints ?? 0 })));
    res.json({ ok: true });
  });

  router.post('/api/admin/arcade/bingo/spawn', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const state = await BingoRepository.get();
    if (state?.activeThreadId) { res.status(409).json({ error: 'Un bingo est déjà en cours' }); return; }
    await BingoService.spawn(client);
    const after = await BingoRepository.get();
    if (!after?.activeThreadId) { res.status(409).json({ error: 'Spawn impossible (channel/post non configuré ?)' }); return; }
    res.json({ ok: true });
  });

  router.post('/api/admin/arcade/juste-prix/spawn', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const state = await JustePrixRepository.get();
    if (state?.activeThreadId) { res.status(409).json({ error: 'Une manche est déjà en cours' }); return; }
    await JustePrixService.spawn(client);
    const after = await JustePrixRepository.get();
    if (!after?.activeThreadId) { res.status(409).json({ error: 'Spawn impossible : configure le forum des jeux (post 💰) et vérifie qu\'il n\'est pas trop tard (révélation 21h)' }); return; }
    res.json({ ok: true });
  });

  router.post('/api/admin/arcade/avalanche/spawn', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const state = await AvalancheRepository.get();
    if (state?.activeThreadId) { res.status(409).json({ error: 'Une avalanche est déjà en cours' }); return; }
    await AvalancheService.spawn(client);
    const after = await AvalancheRepository.get();
    if (!after?.activeThreadId) { res.status(409).json({ error: 'Spawn impossible : configure le forum des jeux (post 🏔️) et vérifie qu\'il n\'est pas trop tard (inscriptions jusqu\'à 13h)' }); return; }
    res.json({ ok: true });
  });

  router.post('/api/admin/arcade/enigme/spawn', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const state = await EnigmeRepository.get();
    if (state?.activeThreadId) { res.status(409).json({ error: 'Une énigme est déjà en cours' }); return; }
    await EnigmeService.spawn(client);
    const after = await EnigmeRepository.get();
    if (!after?.activeThreadId) { res.status(409).json({ error: 'Spawn impossible : configure le forum des jeux (post 🧩) et vérifie qu\'il n\'est pas trop tard (révélation 21h)' }); return; }
    res.json({ ok: true });
  });

  router.post('/api/admin/arcade/enigme/resolve', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const state = await EnigmeRepository.get();
    if (!state?.activeThreadId) { res.status(409).json({ error: 'Aucune énigme en cours' }); return; }
    await EnigmeService.resolve(client);
    res.json({ ok: true });
  });

  router.post('/api/admin/arcade/toggle-all', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const enabled = Boolean(req.body?.enabled);
    const appConfig = await AppConfigService.getOrCreateConfig();
    if (!appConfig.features.arcade) appConfig.features.arcade = {} as any;
    const arcade = appConfig.features.arcade as any;
    for (const key of ARCADE_GAMES) {
      if (!arcade[key]) arcade[key] = { enabled, stats: { totalGames: 0 } };
      else arcade[key].enabled = enabled;
    }
    appConfig.markModified('features.arcade');
    await appConfig.save();
    res.json({ ok: true, enabled });
  });

  router.post('/api/admin/arcade/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const game = String(req.body?.game ?? '');
    if (!ARCADE_GAMES.includes(game as any)) { res.status(400).json({ error: 'Jeu inconnu' }); return; }

    const appConfig = await AppConfigService.getOrCreateConfig();
    if (!appConfig.features.arcade) appConfig.features.arcade = {} as any;
    const arcade = appConfig.features.arcade as any;
    if (!arcade[game]) arcade[game] = { enabled: true, stats: { totalGames: 0 } };
    arcade[game].enabled = !arcade[game].enabled;
    await appConfig.save();

    res.json({ ok: true, enabled: arcade[game].enabled });
  });

  // ───────────────────────── Peak Hunters ─────────────────────────

  router.get('/api/admin/peak-hunters', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const config = await PeakHuntersConfigRepository.get();
    const now = Date.now();
    const schedule = (config?.spawnSchedule ?? []).map((d) => new Date(d));
    res.json({
      enabled: config?.enabled ?? false,
      spawnChannel: channelName(config?.spawnChannelId),
      notificationChannel: channelName(config?.notificationChannelId),
      raidChannel: channelName(config?.raidChannelId),
      mountainsCount: MountainService.count,
      dailyMountain: config?.dailyMountain ?? null,
      spawnsToday: schedule.length,
      nextSpawns: schedule.filter((d) => d.getTime() > now).map((d) => d.toISOString()),
      activeSpawns: Object.keys(config?.activeChannelMountains ?? {}).length,
    });
  });

  router.post('/api/admin/peak-hunters/toggle', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const config = await PeakHuntersConfigRepository.getOrCreate();
    config.enabled = !config.enabled;
    await config.save();
    res.json({ ok: true, enabled: config.enabled });
  });

  router.post('/api/admin/peak-hunters/spawn', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const config = await PeakHuntersConfigRepository.get();
    if (!config?.spawnChannelId) { res.status(409).json({ error: 'Aucun channel de spawn configuré' }); return; }
    await SpawnService.doSpawn(client);
    res.json({ ok: true });
  });

  router.post('/api/admin/peak-hunters/give-expeditions', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const tier = String(req.body?.tier ?? '');
    if (!['sentier', 'falaise', 'sommet'].includes(tier)) { res.status(400).json({ error: 'Palier inconnu' }); return; }
    const amount = parseInt(String(req.body?.amount), 10);
    if (!Number.isFinite(amount) || amount < 1 || amount > 999) { res.status(400).json({ error: 'Quantité : entre 1 et 999' }); return; }
    const count = await UserMountainsRepository.addExpeditionsToAll(amount, tier as any);
    res.json({ ok: true, count });
  });

  // ───────────────────────── Config des features ─────────────────────────

  router.get('/api/admin/guild-meta', requireAdmin, (_req: Request, res: Response): void => {
    const guild = client.guilds.cache.get(process.env.GUILD_ID!);
    if (!guild) { res.status(503).json({ error: 'Guild introuvable' }); return; }
    res.json({
      channels: guild.channels.cache
        .filter((c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      forums: guild.channels.cache
        .filter((c) => c.type === ChannelType.GuildForum)
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      voiceChannels: guild.channels.cache
        .filter((c) => c.type === ChannelType.GuildVoice)
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      roles: guild.roles.cache
        .filter((r) => r.id !== guild.id && !r.managed)
        .map((r) => ({ id: r.id, name: r.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  });

  router.get('/api/admin/config', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const [app, ph, ptest, quiz] = await Promise.all([
      AppConfigService.getOrCreateConfig(),
      PeakHuntersConfigRepository.getOrCreate(),
      PersonalityTestConfigRepository.getOrCreate(),
      QuizConfigRepository.getOrCreate(),
    ]);
    const f = (app.features ?? {}) as any;
    const generalChannels = (app.config.channels ?? {}) as Record<string, string>;
    res.json({
      'quiz': { enabled: quiz.enabled !== false },
      'general': {
        prefix: app.config.prefix ?? '!',
        primaryColor: (app.config.colors as any)?.get?.('primary') ?? '#dac1ff',
        welcomeChannelId: generalChannels.welcome ?? null,
        commandesChannelId: generalChannels.commandes ?? null,
        arcadeChannelId: generalChannels.arcade ?? null,
      },
      'peak-hunters': {
        enabled: ph.enabled,
        spawnChannelId: ph.spawnChannelId ?? null,
        notificationChannelId: ph.notificationChannelId ?? null,
        raidChannelId: ph.raidChannelId ?? null,
      },
      'chat-gaming': { enabled: f.chatGaming?.enabled ?? false, channelId: f.chatGaming?.channelId || null },
      'party': { enabled: f.party?.enabled ?? false, channelId: f.party?.channelId || null, defaultRoleId: f.party?.defaultRoleId ?? null },
      'birthday': { enabled: f.birthday?.enabled ?? false, channelId: f.birthday?.channel || null },
      'suggestion': { enabled: f.suggestion?.enabled ?? false, channelIds: f.suggestion?.channels ?? [] },
      'leveling': { enabled: f.leveling?.enabled ?? false, taux: f.leveling?.taux ?? 1, notifLevelUp: f.leveling?.notifLevelUp ?? true },
      'personality-test': { channelId: ptest.channelId ?? null },
    });
  });

  router.post('/api/admin/config/:feature', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {};
    const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
    const feature = String(req.params.feature);

    if (feature === 'peak-hunters') {
      const ph = await PeakHuntersConfigRepository.getOrCreate();
      if (typeof body.enabled === 'boolean') ph.enabled = body.enabled;
      if ('spawnChannelId' in body) ph.spawnChannelId = str(body.spawnChannelId) ?? undefined;
      if ('notificationChannelId' in body) ph.notificationChannelId = str(body.notificationChannelId) ?? undefined;
      if ('raidChannelId' in body) ph.raidChannelId = str(body.raidChannelId) ?? undefined;
      await ph.save();
      res.json({ ok: true });
      return;
    }

    if (feature === 'personality-test') {
      await PersonalityTestConfigRepository.update({ channelId: str(body.channelId) ?? '' });
      res.json({ ok: true });
      return;
    }

    if (feature === 'quiz') {
      if (typeof body.enabled === 'boolean') {
        const quiz = await QuizConfigRepository.getOrCreate();
        quiz.enabled = body.enabled;
        await quiz.save();
      }
      res.json({ ok: true });
      return;
    }

    if (feature === 'general') {
      const app = await AppConfigService.getOrCreateConfig();
      if (typeof body.prefix === 'string' && body.prefix.trim() && body.prefix.length <= 5) {
        app.config.prefix = body.prefix.trim();
      }
      if (typeof body.primaryColor === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(body.primaryColor)) {
        (app.config.colors as any).set('primary', body.primaryColor);
        app.markModified('config.colors');
      }
      if (!app.config.channels) app.config.channels = {};
      const chans = app.config.channels as Record<string, string>;
      for (const [bodyKey, chanKey] of [['welcomeChannelId', 'welcome'], ['commandesChannelId', 'commandes'], ['arcadeChannelId', 'arcade']] as const) {
        if (bodyKey in body) {
          const v = str(body[bodyKey]);
          if (v) chans[chanKey] = v;
          else delete chans[chanKey];
        }
      }
      app.markModified('config.channels');
      await app.save();
      res.json({ ok: true });
      return;
    }

    const appFeatures: Record<string, { key: string; apply: (cfg: any) => void }> = {
      'chat-gaming': {
        key: 'chatGaming',
        apply: (cfg) => {
          if (typeof body.enabled === 'boolean') cfg.enabled = body.enabled;
          if ('channelId' in body) cfg.channelId = str(body.channelId) ?? '';
        },
      },
      'party': {
        key: 'party',
        apply: (cfg) => {
          if (typeof body.enabled === 'boolean') cfg.enabled = body.enabled;
          if ('channelId' in body) cfg.channelId = str(body.channelId) ?? '';
          if ('defaultRoleId' in body) cfg.defaultRoleId = str(body.defaultRoleId) ?? undefined;
        },
      },
      'birthday': {
        key: 'birthday',
        apply: (cfg) => {
          if (typeof body.enabled === 'boolean') cfg.enabled = body.enabled;
          if ('channelId' in body) cfg.channel = str(body.channelId) ?? '';
        },
      },
      'suggestion': {
        key: 'suggestion',
        apply: (cfg) => {
          if (typeof body.enabled === 'boolean') cfg.enabled = body.enabled;
          if (Array.isArray(body.channelIds)) cfg.channels = body.channelIds.filter((c: unknown) => typeof c === 'string');
        },
      },
      'leveling': {
        key: 'leveling',
        apply: (cfg) => {
          if (typeof body.enabled === 'boolean') cfg.enabled = body.enabled;
          if (typeof body.notifLevelUp === 'boolean') cfg.notifLevelUp = body.notifLevelUp;
          const taux = parseFloat(String(body.taux));
          if ('taux' in body && Number.isFinite(taux) && taux > 0) cfg.taux = taux;
        },
      },
    };

    const handler = appFeatures[feature ?? ''];
    if (!handler) { res.status(404).json({ error: 'Feature inconnue' }); return; }

    const app = await AppConfigService.getOrCreateConfig();
    if (!app.features) (app as any).features = {};
    const features = app.features as any;
    if (!features[handler.key]) features[handler.key] = {};
    handler.apply(features[handler.key]);
    app.markModified('features');
    await app.save();
    res.json({ ok: true });
  });

  // ───────────────────────── Forum des jeux ─────────────────────────

  router.get('/api/admin/game-forum', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const config = await GamesForumService.getConfig();
    const guild = client.guilds.cache.get(process.env.GUILD_ID!);
    const name = (id?: string | null) => {
      if (!id || !guild) return null;
      const c = guild.channels.cache.get(id);
      return c ? c.name : `(inconnu : ${id})`;
    };
    res.json({
      forumChannelId: config.forumId,
      forumName: name(config.forumId),
      quizThreadName: name(config.quizThreadId),
      bingoThreadName: name(config.bingoThreadId),
      arcadeThreadName: name(config.arcadeThreadId),
      justePrixThreadName: name(config.justePrixThreadId),
      avalancheThreadName: name(config.avalancheThreadId),
      enigmeThreadName: name(config.enigmeThreadId),
      announceChannelId: config.announceChannelId,
      announceChannelName: name(config.announceChannelId),
      scheduleChannelId: config.scheduleChannelId,
      scheduleChannelName: name(config.scheduleChannelId),
      pingRoleNames: Object.fromEntries(Object.entries(config.pingRoles).map(([k, id]) =>
        [k, id ? guild?.roles.cache.get(id)?.name ?? '(inconnu)' : null])),
    });
  });

  router.post('/api/admin/game-forum/setup', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const str2 = (v: unknown) => (typeof v === 'string' && v ? v : null);
    try {
      await GamesForumService.setup(client, {
        announceChannelId: str2(req.body?.announceChannelId),
        scheduleChannelId: str2(req.body?.scheduleChannelId),
        forumChannelId: str2(req.body?.forumChannelId),
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Setup impossible' });
    }
  });

  // ───────────────────────── Soirées ─────────────────────────

  router.get('/api/admin/party', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const app = await AppConfigService.getOrCreateConfig();
    const party = (app.features?.party ?? {}) as any;
    const guild = client.guilds.cache.get(process.env.GUILD_ID!);
    const events = await PartyService.getActiveEvents();
    res.json({
      channelId: party.channelId || null,
      defaultRoleId: party.defaultRoleId ?? null,
      events: events.map((e: any) => ({
        id: String(e._id),
        name: e.eventInfo.name,
        game: e.eventInfo.game,
        dateTime: e.eventInfo.dateTime,
        maxSlots: e.eventInfo.maxSlots,
        status: e.status,
        image: e.eventInfo.image ?? null,
        participants: (e.participants ?? []).map((id: string) => ({
          id,
          name: guild?.members.cache.get(id)?.displayName ?? id,
        })),
      })),
    });
  });

  router.post('/api/admin/party/events', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const app = await AppConfigService.getOrCreateConfig();
    const channelId = (app.features?.party as any)?.channelId;
    if (!channelId) { res.status(409).json({ error: 'Configure d\'abord le channel des soirées' }); return; }

    const body = req.body ?? {};
    const name = String(body.name ?? '').trim();
    const game = String(body.game ?? '').trim();
    const dateTime = new Date(String(body.dateTime ?? ''));
    const maxSlots = parseInt(String(body.maxSlots), 10);
    if (!name || !game) { res.status(400).json({ error: 'Nom et jeu requis' }); return; }
    if (Number.isNaN(dateTime.getTime()) || dateTime.getTime() < Date.now()) {
      res.status(400).json({ error: 'Date invalide ou passée' }); return;
    }
    if (!Number.isFinite(maxSlots) || maxSlots < 1 || maxSlots > 100) {
      res.status(400).json({ error: 'Places : entre 1 et 100' }); return;
    }
    const color = typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : undefined;

    try {
      await PartyService.createEvent(client, {
        name,
        game,
        description: String(body.description ?? '').trim() || undefined,
        dateTime,
        maxSlots,
        color,
        image: typeof body.image === 'string' && body.image.startsWith('http') ? body.image : undefined,
        channelId,
        createdBy: client.user?.id ?? 'dashboard',
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Création impossible' });
    }
  });

  router.post('/api/admin/party/events/:id/start', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      await PartyService.startEvent(client, String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Démarrage impossible' });
    }
  });

  router.post('/api/admin/party/events/:id/end', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {};
    const attended = Array.isArray(body.attendedIds) ? body.attendedIds.filter((x: unknown) => typeof x === 'string') : [];
    const money = parseInt(String(body.money ?? '0'), 10) || 0;
    const xp = parseInt(String(body.xp ?? '0'), 10) || 0;
    const expeditions = parseInt(String(body.expeditions ?? '0'), 10) || 0;
    try {
      await PartyService.endEvent(client, String(req.params.id), {
        attendedParticipants: attended,
        rewardAmount: money > 0 ? money : undefined,
        xpAmount: xp > 0 ? xp : undefined,
        expeditionAmount: expeditions > 0 ? expeditions : undefined,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Clôture impossible' });
    }
  });

  router.post('/api/admin/party/events/:id/image', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const image = String(req.body?.image ?? '').trim();
    if (!image.startsWith('http')) { res.status(400).json({ error: 'URL d\'image invalide' }); return; }
    try {
      await PartyService.updateEventImage(client, String(req.params.id), image);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Mise à jour impossible' });
    }
  });

  router.delete('/api/admin/party/events/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      await PartyService.deleteEvent(client, String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Suppression impossible' });
    }
  });

  // ───────────────────────── Test de personnalité ─────────────────────────

  router.get('/api/admin/personality-test', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const [config, sessions] = await Promise.all([
      PersonalityTestConfigRepository.getOrCreate(),
      PersonalityTestSessionRepository.findAll(),
    ]);
    res.json({
      channelId: config.channelId ?? null,
      sessions: sessions.map((s) => ({ testId: s.testId, subject: s.subject, createdAt: s.createdAt })),
    });
  });

  router.post('/api/admin/personality-test/launch', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const subject = String(req.body?.subject ?? '').trim().slice(0, 500);
    if (!subject) { res.status(400).json({ error: 'Sujet requis' }); return; }
    try {
      await PersonalityTestService.launch(client, subject);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Lancement impossible' });
    }
  });

  router.post('/api/admin/personality-test/close', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const testId = String(req.body?.testId ?? '');
    if (!testId) { res.status(400).json({ error: 'testId requis' }); return; }
    await PersonalityTestService.closeTest(testId);
    res.json({ ok: true });
  });

  // ───────────────────────── Chat Gaming ─────────────────────────

  router.get('/api/admin/chat-gaming', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const app = await AppConfigService.getOrCreateConfig();
    const cg = (app.features?.chatGaming ?? {}) as any;
    const games = await ChatGamingService.getAllGames();
    res.json({
      enabled: cg.enabled ?? false,
      channelId: cg.channelId || null,
      games: games.map((g: any) => ({
        id: String(g._id),
        name: g.name,
        description: g.description ?? null,
        color: g.color ?? null,
        image: g.image ?? null,
      })),
    });
  });

  router.post('/api/admin/chat-gaming/games', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {};
    const name = String(body.name ?? '').trim();
    if (name.length < 2) { res.status(400).json({ error: 'Nom trop court' }); return; }
    try {
      await ChatGamingService.createGame(client, {
        name,
        description: String(body.description ?? '').trim() || undefined,
        color: typeof body.color === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(body.color) ? body.color : undefined,
        image: typeof body.image === 'string' && body.image.startsWith('http') ? body.image : undefined,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Création impossible' });
    }
  });

  router.put('/api/admin/chat-gaming/games/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {};
    try {
      await ChatGamingService.updateGame(client, String(req.params.id), {
        ...(body.name ? { name: String(body.name).trim() } : {}),
        ...('description' in body ? { description: String(body.description ?? '').trim() || undefined } : {}),
        ...(typeof body.color === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(body.color) ? { color: body.color } : {}),
        ...('image' in body ? { image: typeof body.image === 'string' && body.image.startsWith('http') ? body.image : undefined } : {}),
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Mise à jour impossible' });
    }
  });

  router.delete('/api/admin/chat-gaming/games/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    await ChatGamingService.deleteGame(client, String(req.params.id));
    res.json({ ok: true });
  });

  // ───────────────────────── Vocaux ─────────────────────────

  router.get('/api/admin/voice', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const config = await VoiceService.getOrCreateConfig();
    const guild = client.guilds.cache.get(process.env.GUILD_ID!);
    res.json({
      enabled: config.enabled,
      notificationChannelId: config.notificationChannelId ?? null,
      joinChannels: (config.joinChannels ?? []).map((j) => ({
        id: j.id,
        name: guild?.channels.cache.get(j.id)?.name ?? `(inconnu : ${j.id})`,
        nameTemplate: j.nameTemplate,
      })),
    });
  });

  router.post('/api/admin/voice', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {};
    if (typeof body.enabled === 'boolean') await VoiceService.toggleFeature(body.enabled);
    if ('notificationChannelId' in body) {
      await VoiceConfigRepository.setNotificationChannel(typeof body.notificationChannelId === 'string' ? body.notificationChannelId : '');
    }
    res.json({ ok: true });
  });

  router.post('/api/admin/voice/join-channels', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const channelId = String(req.body?.channelId ?? '');
    const guild = client.guilds.cache.get(process.env.GUILD_ID!);
    const channel = guild?.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      res.status(400).json({ error: 'Channel vocal invalide' });
      return;
    }
    await VoiceService.addJoinChannel(channelId, channel.parentId ?? '');
    res.json({ ok: true });
  });

  router.delete('/api/admin/voice/join-channels/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    await VoiceService.removeJoinChannel(String(req.params.id));
    res.json({ ok: true });
  });

  // ───────────────────────── Rôles d'activité ─────────────────────────

  router.get('/api/admin/activity-roles', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const config = await ActivityRolesConfigRepository.getOrCreate();
    const guild = client.guilds.cache.get(process.env.GUILD_ID!);
    const roleName = (id?: string | null) => (id ? guild?.roles.cache.get(id)?.name ?? `(inconnu)` : null);
    res.json({
      enabled: config.enabled,
      activeThresholdPercent: config.activeThresholdPercent,
      regularThresholdPercent: config.regularThresholdPercent,
      roleIds: {
        podium: config.podiumRoleId ?? null,
        active: config.activeRoleId ?? null,
        regular: config.regularRoleId ?? null,
        inactive: config.inactiveRoleId ?? null,
      },
      roles: {
        podium: roleName(config.podiumRoleId),
        active: roleName(config.activeRoleId),
        regular: roleName(config.regularRoleId),
        inactive: roleName(config.inactiveRoleId),
      },
    });
  });

  router.post('/api/admin/activity-roles', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {};
    const clamp = (v: unknown) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : undefined;
    };
    const role = (v: unknown) => (typeof v === 'string' && v ? v : null);
    await ActivityRolesConfigRepository.update({
      ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
      ...(clamp(body.activeThresholdPercent) !== undefined ? { activeThresholdPercent: clamp(body.activeThresholdPercent)! } : {}),
      ...(clamp(body.regularThresholdPercent) !== undefined ? { regularThresholdPercent: clamp(body.regularThresholdPercent)! } : {}),
      ...('podiumRoleId' in body ? { podiumRoleId: role(body.podiumRoleId) } : {}),
      ...('activeRoleId' in body ? { activeRoleId: role(body.activeRoleId) } : {}),
      ...('regularRoleId' in body ? { regularRoleId: role(body.regularRoleId) } : {}),
      ...('inactiveRoleId' in body ? { inactiveRoleId: role(body.inactiveRoleId) } : {}),
    });
    res.json({ ok: true });
  });

  router.get('/api/admin/payroll', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    const config = await PayrollConfigRepository.getOrCreate();
    res.json({
      enabled: config.enabled,
      budgetPerActive: config.budgetPerActive,
      smicPercent: config.smicPercent,
      qualificationThreshold: config.qualificationThreshold,
    });
  });

  router.post('/api/admin/payroll', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {};
    const int = (v: unknown, min: number, max: number) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : undefined;
    };
    const budget = int(body.budgetPerActive, 1, 100_000);
    const smic = int(body.smicPercent, 0, 100);
    const seuil = int(body.qualificationThreshold, 0, 10_000_000);
    await PayrollConfigRepository.update({
      ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
      ...(budget !== undefined ? { budgetPerActive: budget } : {}),
      ...(smic !== undefined ? { smicPercent: smic } : {}),
      ...(seuil !== undefined ? { qualificationThreshold: seuil } : {}),
    });
    res.json({ ok: true });
  });

  // Simule la paie sur la derniere semaine reellement enregistree, sans rien verser.
  // C'est l'outil de calibrage : les parametres se reglent sur de vrais points.
  router.get('/api/admin/payroll/preview', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const config = await PayrollConfigRepository.getOrCreate();
    const num = (v: unknown, fallback: number) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? n : fallback;
    };
    const params = {
      budgetPerActive: num(req.query.budgetPerActive, config.budgetPerActive),
      smicPercent: num(req.query.smicPercent, config.smicPercent),
      qualificationThreshold: num(req.query.qualificationThreshold, config.qualificationThreshold),
    };

    const users = await UserModel.find({ 'stats.lastWeekActivityPoints': { $gt: 0 } })
      .select('discordId name stats.lastWeekActivityPoints')
      .lean();

    const scores = users
      .map(u => ({ userId: u.discordId, name: u.name, points: u.stats?.lastWeekActivityPoints ?? 0 }))
      .sort((a, b) => b.points - a.points);

    const byId = new Map(scores.map(s => [s.userId, s.name]));
    const slips = computePayroll(scores, params).map(s => ({ ...s, name: byId.get(s.userId) ?? s.userId }));
    const totals = slips.map(s => s.total).sort((a, b) => a - b);
    const median = totals.length
      ? totals.length % 2 ? totals[(totals.length - 1) / 2] : (totals[totals.length / 2 - 1] + totals[totals.length / 2]) / 2
      : 0;

    res.json({
      params,
      scored: scores.length,
      qualified: slips.length,
      totalPaid: slips.reduce((sum, s) => sum + s.total, 0),
      median,
      min: totals[0] ?? 0,
      max: totals[totals.length - 1] ?? 0,
      slips,
    });
  });

  router.post('/api/admin/activity-roles/run', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    await runWeekly(client);
    res.json({ ok: true });
  });

  return router;
}
