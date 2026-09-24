import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from 'discord.js';
import { EXPEDITION_TIER_RARITY_WEIGHTS, RARITY_CONFIG } from '../constants/peak-hunters.constants';
import { MountainService, type MountainInfo } from './mountain.service';
import type { ExpeditionTier, MountainRarity } from '../types/peak-hunters.types';

const RARITY_ORDER: MountainRarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface RenderableCard {
  mountain: MountainInfo;
  rarity: MountainRarity;
  isDuplicate: boolean;
  fragmentsGained: number;
}

/** Cloudinary : bande de couleur de rareté collée en bas de l'image. */
export function buildRarityImageUrl(imageUrl: string, rarity: MountainRarity): string {
  const colorHex = RARITY_CONFIG[rarity].color.toString(16).padStart(6, '0');
  const overlay = `l_text:Arial_1:.,co_rgb:${colorHex},b_rgb:${colorHex},g_south,y_0,fl_relative,w_1.0,h_0.09`;
  return imageUrl.replace('/upload/', `/upload/${overlay}/`);
}

export function buildBlurredImageUrl(imageUrl: string, blur: number): string {
  return blur > 0 ? imageUrl.replace('/upload/', `/upload/e_blur:${blur}/`) : imageUrl;
}

export function highestRarity(cards: RenderableCard[]): MountainRarity {
  return cards.reduce<MountainRarity>((best, c) => (RARITY_ORDER.indexOf(c.rarity) > RARITY_ORDER.indexOf(best) ? c.rarity : best), 'common');
}

/** `⬜×2  🟦×1` — tableau de chasse des cartes déjà révélées. */
export function buildRarityTally(cards: RenderableCard[]): string {
  return RARITY_ORDER
    .map(rarity => ({ rarity, count: cards.filter(c => c.rarity === rarity).length }))
    .filter(({ count }) => count > 0)
    .map(({ rarity, count }) => `${RARITY_CONFIG[rarity].nameEmoji}×${count}`)
    .join('  ');
}

/** `⬜ 60%  🟦 25%` — chances de chaque rareté pour un tirage de ce tier. */
export function buildRarityOddsLine(tier: ExpeditionTier): string {
  const weights = EXPEDITION_TIER_RARITY_WEIGHTS[tier];
  const total = RARITY_ORDER.reduce((sum, r) => sum + weights[r], 0);
  return RARITY_ORDER
    .filter(r => weights[r] > 0)
    .map(r => `${RARITY_CONFIG[r].emoji} ${Math.round((weights[r] / total) * 100)}%`)
    .join('  ');
}

/** `▮▮▯▯▯` */
export function buildProgressBar(done: number, total: number): string {
  return '▮'.repeat(done) + '▯'.repeat(Math.max(0, total - done));
}

export function addCardSections(container: ContainerBuilder, cards: RenderableCard[]): ContainerBuilder {
  for (const card of cards) {
    const { emoji, label } = RARITY_CONFIG[card.rarity];
    const status = card.isDuplicate ? `-# 🔁 Double — +${card.fragmentsGained} 🧩` : '-# ✅ Nouvelle !';
    const flags = card.mountain.flags?.join(' ') ?? '';
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `${emoji} **${card.mountain.mountainLabel}** ${flags}\n-# ${label} · ${MountainService.getAltitude(card.mountain)}\n${status}`,
          ),
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(buildRarityImageUrl(card.mountain.image, card.rarity))),
    );
  }
  return container;
}
