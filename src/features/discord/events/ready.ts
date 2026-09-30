import { Events, ActivityType } from 'discord.js';
import { BotClient } from '../../../bot/client';
import { VoiceService } from '../../voice/services/voice.service';
import { PersonalityTestService } from '../../personality-test/services/personality-test.service';
import { SpawnService } from '../../peak-hunters/services/spawn.service';
import { QuizService } from '../../quiz/services/quiz.service';
import { BingoService } from '../../arcade/bingo/services/bingo.service';
import { JustePrixService } from '../../arcade/juste-prix/services/juste-prix.service';
import { AvalancheService } from '../../arcade/avalanche/services/avalanche.service';
import { EnigmeService } from '../../arcade/enigme/services/enigme.service';
import { VoiceSessionService } from '../../voice/services/voice-session.service';
import { registerPeakHuntersVoiceListeners } from '../../peak-hunters/services/peak-hunters.register';
import { registerStatsVoiceListeners } from '../../stats/services/stats.voice-listener';
import { registerRaidListeners } from '../../peak-hunters/services/raid.voice-listener';
import { ProfileCardService } from '../../user/services/profile-card/profile-card.service';

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client: BotClient) {
    const statuses = [
      { name: 'Bienvenue sur The Ridge ⛰️', type: ActivityType.Playing },
      { name: '/profil pour remplir votre profil 📝', type: ActivityType.Watching },
      { name: '/peak-hunters — lance tes expéditions 🗺️', type: ActivityType.Playing },
    ];

    let currentStatusIndex = 0;

    const setStatus = () => {
      const status = statuses[currentStatusIndex];
      client.user?.setActivity(status.name, { type: status.type });
      currentStatusIndex = (currentStatusIndex + 1) % statuses.length;
    };

    setStatus();
    setInterval(setStatus, 8000);

    registerStatsVoiceListeners(client);
    registerRaidListeners();
    registerPeakHuntersVoiceListeners(client);
    VoiceSessionService.startTickLoop();
    ProfileCardService.warmUp().catch(error => console.error('[Ready] Préparation des cartes /me échouée :', error));

    await VoiceService.rehydrate(client);
    await SpawnService.rehydrate(client);
    await QuizService.rehydrate(client);
    await BingoService.rehydrate(client);
    await JustePrixService.rehydrate(client);
    await AvalancheService.rehydrate(client);
    await EnigmeService.rehydrate(client);
    await PersonalityTestService.rehydrate(client);
    const ownerDiscordId = process.env.OWNER_DISCORD_ID;
    if (ownerDiscordId) {
      try {
        const owner = await client.users.fetch(ownerDiscordId);
        await owner.send('✅ Le bot est maintenant en ligne et prêt à être utilisé !');
        console.log(`[Ready] Notification envoyée à l'owner (${ownerDiscordId})`);
      } catch (error) {
        console.error('[Ready] Erreur lors de l\'envoi de la notification à l\'owner:', error);
      }
    }
  }
};
