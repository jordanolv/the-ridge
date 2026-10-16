import { BotClient } from './client';
import { connectToDatabase } from '../shared/db';
import { loadFeatures } from './handlers/feature';
import { loadEvents } from './handlers/event';
import path from 'path';
import { Events, REST, Routes } from 'discord.js';
import chalk from 'chalk';
import { CronManager } from '../shared/cron/cron-manager';
import { ensureActivityEntryPoint } from '../features/activity/services/activity-entry-point.service';

function attachGatewayHealthLogs(client: BotClient): void {
  client.on(Events.ShardDisconnect, (event, shardId) => {
    console.warn(chalk.yellow('📡 [GATEWAY]') + chalk.gray(` Shard ${shardId} déconnecté (code ${event.code})`));
  });
  client.on(Events.ShardReconnecting, (shardId) => {
    console.warn(chalk.yellow('📡 [GATEWAY]') + chalk.gray(` Shard ${shardId} reconnexion...`));
  });
  client.on(Events.ShardResume, (shardId, replayedEvents) => {
    console.log(chalk.cyan('📡 [GATEWAY]') + chalk.green(` Shard ${shardId} repris (${replayedEvents} events rejoués)`));
  });
  client.on(Events.ShardError, (error, shardId) => {
    console.error(chalk.red('📡 [GATEWAY]') + ` Shard ${shardId} erreur:`, error);
  });
  client.on(Events.ShardReady, (shardId) => {
    console.log(chalk.cyan('📡 [GATEWAY]') + chalk.green(` Shard ${shardId} prêt`));
  });
}

export async function startBot() {
  try {
    // Ne pas recharger dotenv ici car déjà chargé dans index.ts
    console.log(chalk.blueBright('🤖 [BOT]') + chalk.gray(' Initialisation...'));

    // Paralléliser l'init du client et la connexion DB
    const initStart = Date.now();
    const [client] = await Promise.all([
      (async () => {
        const t = Date.now();
        const c = await BotClient.init();
        console.log(chalk.blueBright('🤖 [BOT]') + chalk.green(` Initialisé (${Date.now() - t}ms)`));
        return c;
      })(),
      (async () => {
        const t = Date.now();
        console.log(chalk.greenBright('💾 [DB]') + chalk.gray(' Connexion...'));
        await connectToDatabase();
        console.log(chalk.greenBright('💾 [DB]') + chalk.green(` Connecté (${Date.now() - t}ms)`));
      })()
    ]);
    console.log(chalk.gray(`⏱️  Init + DB: ${Date.now() - initStart}ms`));

    // Charger les events et features en parallèle
    const eventsPath = path.join(__dirname, 'events');
    const featuresPath = path.join(__dirname, '../features');

    if (!client.eventsLoaded) {
      const loadStart = Date.now();
      await Promise.all([
        loadEvents(client, eventsPath),
        loadFeatures(client, featuresPath)
      ]);
      client.eventsLoaded = true;
      console.log(chalk.gray(`⏱️  Events + Features: ${Date.now() - loadStart}ms`));
    }

    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error("DISCORD_TOKEN manquant");

    // Déployer les commandes AVANT de se connecter à Discord
    if (process.env.AUTO_DEPLOY_COMMANDS === 'true') {
      const deployStart = Date.now();
      const slashCommands = Array.from(client.slashCommands.values());
      if (slashCommands.length > 0) {
        console.log(chalk.magenta('🔧 [DEPLOY]') + chalk.gray(` Déploiement de ${slashCommands.length} commandes...`));
        const rest = new REST({ version: '10' }).setToken(token);
        const commandsData = slashCommands.map(cmd => cmd.data.toJSON());

        await rest.put(
          Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID || '', process.env.GUILD_ID),
          { body: commandsData }
        );
        await ensureActivityEntryPoint(rest, process.env.DISCORD_CLIENT_ID || '');
        console.log(chalk.magenta('🔧 [DEPLOY]') + chalk.green(` Terminé (${Date.now() - deployStart}ms)`));
      }
    }

    console.log(chalk.yellow('⏰ [CRON]') + chalk.gray(' Démarrage...'));
    const cronStart = Date.now();
    const cronManager = new CronManager(client);
    cronManager.startAll();
    console.log(chalk.yellow('⏰ [CRON]') + chalk.green(` Démarré (${Date.now() - cronStart}ms)`));

    attachGatewayHealthLogs(client);

    const loginStart = Date.now();
    console.log(chalk.blueBright('🔐 [LOGIN]') + chalk.gray(' Connexion à Discord...'));
    await client.login(token);
    console.log(chalk.blueBright('🔐 [LOGIN]') + chalk.green(` Connecté (${Date.now() - loginStart}ms)`));

    return client;
  } catch (error) {
    console.error(chalk.red('❌ [BOT]'), error);
    throw error;
  }
} 