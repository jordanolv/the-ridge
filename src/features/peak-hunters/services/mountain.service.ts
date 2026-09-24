import * as fs from 'fs';
import * as path from 'path';
import type { MountainRarity, ExpeditionTier } from '../types/peak-hunters.types';
import { RARITY_CONFIG, EXPEDITION_TIER_CHANCES, EXPEDITION_TIER_RARITY_WEIGHTS, rollExpeditionTier } from '../constants/peak-hunters.constants';
import { UserMountainsRepository } from '../repositories/user-mountains.repository';
import { addFragmentsAndAward } from './expedition.service';

export interface MountainInfo {
  id: string;
  mountainLabel: string;
  elevation: string;
  countries: string[];
  flags: string[];
  image: string;
  article: string;
  rarity: MountainRarity;
  lat?: number;
  lng?: number;
}

export class MountainService {
  private static mountains: MountainInfo[] = [];

  static {
    MountainService.loadMountains();
  }

  static loadMountains(): void {
    try {
      const filePath = path.join(__dirname, '../data/mountains.json');
      const raw: Omit<MountainInfo, 'id'>[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.mountains = raw.map(m => ({
        ...m,
        id: m.article.split('/wiki/')[1] ?? m.mountainLabel,
      }));
      console.log(`[MountainService] ${this.mountains.length} montagnes chargées`);
    } catch (err) {
      console.error('[MountainService] Erreur chargement mountains.json:', err);
      this.mountains = [];
    }
  }

  static getAltitude(mountain: MountainInfo): string {
    return Math.round(parseFloat(mountain.elevation)).toLocaleString('fr-FR') + ' m';
  }

  static getCountryDisplay(mountain: MountainInfo): string {
    return mountain.flags.map((f, i) => `${f} ${mountain.countries[i]}`).join('  ·  ');
  }

  static getAll(): MountainInfo[] {
    return [...this.mountains];
  }

  static getById(id: string): MountainInfo | undefined {
    const normalized = decodeURIComponent(id).replace(/_/g, ' ');
    return this.mountains.find(m =>
      m.id === id ||
      decodeURIComponent(m.id).replace(/_/g, ' ') === normalized,
    );
  }

  static getRandom(): MountainInfo | null {
    if (this.mountains.length === 0) return null;
    return this.mountains[Math.floor(Math.random() * this.mountains.length)];
  }

  static getRarity(mountain: MountainInfo): MountainRarity {
    return mountain.rarity;
  }

  /** Tire une montagne au hasard pondérée par les poids de rareté standard (tier Sentier) */
  static getRandomWeighted(): MountainInfo | null {
    return this.getRandomByTier('sentier');
  }

  /** Tire une montagne au hasard selon le tier d'expédition */
  static getRandomByTier(tier: ExpeditionTier): MountainInfo | null {
    if (this.mountains.length === 0) return null;

    const weights = EXPEDITION_TIER_RARITY_WEIGHTS[tier];
    const totalWeight = Object.values(weights).reduce((acc, w) => acc + w, 0);
    let roll = Math.random() * totalWeight;

    const rarityOrder: MountainRarity[] = ['common', 'rare', 'epic', 'legendary'];
    let targetRarity: MountainRarity = 'common';
    for (const rarity of rarityOrder) {
      roll -= weights[rarity];
      if (roll <= 0) {
        targetRarity = rarity;
        break;
      }
    }

    const pool = this.mountains.filter(m => m.rarity === targetRarity);
    if (pool.length === 0) return this.getRandom();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  static get count(): number {
    return this.mountains.length;
  }
}

export interface MountainDropResult {
  mountainLabel: string;
  rarityEmoji: string;
  rarityLabel: string;
  image: string;
  isDuplicate: boolean;
  fragmentsGained: number;
  expeditionsAwarded: number;
  expeditionsSummary: string;
}

export interface CardDraw {
  mountain: MountainInfo;
  rarity: MountainRarity;
  isDuplicate: boolean;
  fragmentsGained: number;
  expeditionsAwarded: number;
  expeditionsSummary: string;
}

/**
 * Tire une montagne, la débloque, et convertit le doublon en fragments.
 * Point d'entrée unique de tout tirage de carte : expédition, pack, spawn.
 */
export async function drawCard(userId: string, tier: ExpeditionTier): Promise<CardDraw | null> {
  const mountain = MountainService.getRandomByTier(tier);
  if (!mountain) return null;

  const rarity = MountainService.getRarity(mountain);
  const { fragmentsOnDuplicate } = RARITY_CONFIG[rarity];
  const isDuplicate = (await UserMountainsRepository.unlock(userId, mountain.id, rarity)) === null;

  if (!isDuplicate) {
    return { mountain, rarity, isDuplicate: false, fragmentsGained: 0, expeditionsAwarded: 0, expeditionsSummary: '' };
  }

  const { expeditionsAwarded, summary } = await addFragmentsAndAward(userId, fragmentsOnDuplicate);
  return { mountain, rarity, isDuplicate: true, fragmentsGained: fragmentsOnDuplicate, expeditionsAwarded, expeditionsSummary: summary };
}

export async function drawCards(userId: string, tiers: ExpeditionTier[]): Promise<CardDraw[]> {
  const cards: CardDraw[] = [];
  for (const tier of tiers) {
    const card = await drawCard(userId, tier);
    if (card) cards.push(card);
  }
  return cards;
}

export async function dropMountain(userId: string): Promise<MountainDropResult | null> {
  const card = await drawCard(userId, rollExpeditionTier(EXPEDITION_TIER_CHANCES));
  if (!card) return null;

  const { emoji, label } = RARITY_CONFIG[card.rarity];
  return {
    mountainLabel: card.mountain.mountainLabel,
    rarityEmoji: emoji,
    rarityLabel: label,
    image: card.mountain.image,
    isDuplicate: card.isDuplicate,
    fragmentsGained: card.fragmentsGained,
    expeditionsAwarded: card.expeditionsAwarded,
    expeditionsSummary: card.expeditionsSummary,
  };
}
