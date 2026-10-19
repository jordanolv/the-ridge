import { User } from 'discord.js';
import { ArcadeStatsService } from './arcade-stats.service';
import { ArcadeGameName } from '../types/arcade.types';

const GAME_LABELS: Record<ArcadeGameName, string> = {
  shifumi: 'Le shifumi',
  puissance4: 'Le puissance 4',
  battle: 'La battle',
  morpion: 'Le morpion',
  bingo: 'Le bingo',
  justePrix: 'Le Juste Prix',
  avalanche: 'L\'Avalanche',
  enigme: 'L\'Énigme',
};

export class ArcadeValidationService {
  static async isGameEnabled(gameName: ArcadeGameName): Promise<string | null> {
    const enabled = await ArcadeStatsService.isGameEnabled(gameName);
    return enabled ? null : `❌ ${GAME_LABELS[gameName]} est actuellement désactivé sur ce serveur.`;
  }

  static checkOpponentValid(challenger: User, opponent: User): string | null {
    if (opponent.id === challenger.id) return '❌ Vous ne pouvez pas jouer contre vous-même !';
    if (opponent.bot) return '❌ Vous ne pouvez pas jouer contre un bot !';
    return null;
  }

  static async validatePvPGame(
    challenger: User,
    opponent: User,
    gameName: ArcadeGameName,
  ): Promise<string | null> {
    const opponentErr = this.checkOpponentValid(challenger, opponent);
    if (opponentErr) return opponentErr;

    return this.isGameEnabled(gameName);
  }
}
