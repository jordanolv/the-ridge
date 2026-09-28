import { setTimeout as sleep } from 'node:timers/promises';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { EXPEDITION_TIER_CONFIG, FRAGMENTS_PER_EXPEDITION, RARITY_CONFIG, packTiers } from '../constants/peak-hunters.constants';
import { UserMountainsRepository } from '../repositories/user-mountains.repository';
import { MountainService, drawCards, type CardDraw } from './mountain.service';
import {
  addCardSections,
  buildBlurredImageUrl,
  buildProgressBar,
  buildRarityImageUrl,
  buildRarityTally,
  highestRarity,
} from './card-render';
import { formatExpeditionsLine } from './expedition.service';
import { REVEAL_ANIMATION_MS, ensureRevealAnimation } from './reveal-animation.service';
import { LogService } from '../../../shared/logs/logs.service';
import type { ExpeditionTier } from '../types/peak-hunters.types';

export const PACK_BUTTON_PREFIX = 'mountain:pack';
export const packOpenId = (tier: ExpeditionTier, userId: string) => `${PACK_BUTTON_PREFIX}:open:${tier}:${userId}`;
const packNextId = (tier: ExpeditionTier, userId: string) => `${PACK_BUTTON_PREFIX}:next:${tier}:${userId}`;

const BLUR_FRAMES = [2000, 400, 0];
const BLUR_FRAME_MS = 1200;
/** Au-delà, on révèle la dernière carte sans animation plutôt que de faire attendre. */
const ANIMATION_WAIT_MS = 6000;
const LOG_FEATURE = 'Mountain · Packs';

interface OpeningPack {
  tier: ExpeditionTier;
  cards: CardDraw[];
  revealed: number;
}

// ponytail: seule l'ouverture en cours est en RAM — le pack non ouvert vit en base
// et les cartes sont débloquées dès le premier clic. Un redémarrage ne coûte que
// les frames restantes, jamais une carte ni un pack payé.
const opening = new Map<string, OpeningPack>();

/** Achat boutique : le pack entre en inventaire, il n'est tiré qu'à l'ouverture. */
export async function grantPacks(userId: string, tier: ExpeditionTier, quantity: number): Promise<void> {
  await UserMountainsRepository.addPacks(userId, tier, quantity);

  const { label, emoji } = EXPEDITION_TIER_CONFIG[tier];
  await LogService.info(
    `<@${userId}> a acheté **${quantity > 1 ? `${quantity} packs` : 'un pack'} ${label}** ${emoji}`,
    { feature: LOG_FEATURE, title: `${emoji} Pack ${label} acheté` },
  );
}

function buildCardContainer(pack: OpeningPack, userId: string, blur = 0): ContainerBuilder {
  const card = pack.cards[pack.revealed - 1];
  const total = pack.cards.length;
  const { emoji, label, color } = RARITY_CONFIG[card.rarity];
  const hidden = blur > 0;

  const header = hidden
    ? `## ❔ ???\n-# La dernière carte…`
    : `## ${emoji} ${card.mountain.mountainLabel} ${card.mountain.flags?.join(' ') ?? ''}\n-# ${label} · ${MountainService.getAltitude(card.mountain)}`;

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(
          hidden ? buildBlurredImageUrl(card.mountain.image, blur) : buildRarityImageUrl(card.mountain.image, card.rarity),
        ),
      ),
    );

  const revealedSoFar = pack.cards.slice(0, pack.revealed);
  const status = card.isDuplicate ? `🔁 **Double** — +${card.fragmentsGained} 🧩` : '✅ **Nouvelle montagne !**';

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `${buildProgressBar(pack.revealed, total)}  \`${pack.revealed}/${total}\``,
        `-# ${buildRarityTally(revealedSoFar)}`,
        hidden ? '' : status,
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  );

  if (hidden || pack.revealed >= total) return container;

  return container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(packNextId(pack.tier, userId))
        .setLabel(pack.revealed === total - 1 ? 'Dernière carte' : `Suivante (${pack.revealed + 1}/${total})`)
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Primary),
    ),
  );
}

/** La dernière carte : le nom et la rareté sont incrustés dans l'animation. */
function buildAnimatedCardContainer(pack: OpeningPack, url: string): ContainerBuilder {
  const total = pack.cards.length;
  return new ContainerBuilder()
    .setAccentColor(RARITY_CONFIG[pack.cards[pack.revealed - 1].rarity].color)
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(url)))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${buildProgressBar(pack.revealed, total)}  \`${pack.revealed}/${total}\`\n-# ${buildRarityTally(pack.cards.slice(0, pack.revealed - 1))}`,
      ),
    );
}

async function buildSummaryContainer(pack: OpeningPack, userId: string): Promise<ContainerBuilder> {
  const doc = await UserMountainsRepository.getOrCreate(userId);
  const { label, emoji } = EXPEDITION_TIER_CONFIG[pack.tier];

  const fragments = pack.cards.reduce((sum, c) => sum + c.fragmentsGained, 0);
  const bonus = pack.cards.reduce((sum, c) => sum + c.expeditionsAwarded, 0);
  const fresh = pack.cards.filter(c => !c.isDuplicate).length;
  const owned = doc.unlockedMountains.length;
  const total = MountainService.count;

  const lines = [
    `# ${emoji} Pack ${label}\n-# par <@${userId}>\n`,
    buildRarityTally(pack.cards),
    `✨ **${fresh}** nouvelle${fresh > 1 ? 's' : ''} · collection **${owned}/${total}** (${Math.round((owned / total) * 100)}%)`,
  ];
  if (fragments > 0) lines.push(`🧩 +${fragments} fragments — ${doc.fragments}/${FRAGMENTS_PER_EXPEDITION}`);
  if (bonus > 0) lines.push(`🗺️ **+${bonus} expédition${bonus > 1 ? 's' : ''}** bonus ! ${pack.cards.map(c => c.expeditionsSummary).join('')}`);
  lines.push(formatExpeditionsLine(doc.sentierTickets, doc.falaiseTickets, doc.sommetTickets));

  const container = new ContainerBuilder()
    .setAccentColor(RARITY_CONFIG[highestRarity(pack.cards)].color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  addCardSections(container, pack.cards);

  const remaining = UserMountainsRepository.packsOf(doc, pack.tier);
  if (remaining > 0) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true)).addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(packOpenId(pack.tier, userId))
          .setLabel(`Ouvrir un autre pack (${remaining} en stock)`)
          .setEmoji('🎁')
          .setStyle(ButtonStyle.Success),
      ),
    );
  }

  return container;
}

async function openPack(interaction: ButtonInteraction, tier: ExpeditionTier, userId: string): Promise<void> {
  if (!(await UserMountainsRepository.spendPack(userId, tier))) {
    await interaction.followUp({
      content: `❌ Tu n'as plus de pack ${EXPEDITION_TIER_CONFIG[tier].label} — passe par la boutique (\`/shop\`).`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cards = await drawCards(userId, packTiers(tier));
  if (cards.length === 0) {
    await UserMountainsRepository.addPacks(userId, tier, 1);
    await interaction.followUp({ content: '❌ Erreur lors du tirage, ton pack t\'a été rendu.', flags: MessageFlags.Ephemeral });
    return;
  }

  const pack: OpeningPack = { tier, cards, revealed: 1 };
  opening.set(userId, pack);

  // La dernière carte est connue dès maintenant : son animation se génère pendant
  // que le joueur clique sur les premières, elle est prête quand il y arrive.
  const last = cards[cards.length - 1];
  void ensureRevealAnimation(last.mountain, last.rarity);

  await interaction.editReply({ components: [buildCardContainer(pack, userId)], flags: MessageFlags.IsComponentsV2 });

  const { label, emoji } = EXPEDITION_TIER_CONFIG[tier];
  const list = cards.map(c => `${RARITY_CONFIG[c.rarity].emoji} ${c.mountain.mountainLabel}${c.isDuplicate ? ' 🔁' : ''}`).join(', ');
  await LogService.info(`<@${userId}> a ouvert un **pack ${label}** ${emoji}\n${list}`, {
    feature: LOG_FEATURE,
    title: `${emoji} Pack ${label} ouvert`,
  });
}

async function revealNext(interaction: ButtonInteraction, userId: string): Promise<void> {
  const pack = opening.get(userId);
  if (!pack) {
    await interaction.followUp({
      content: '❌ Cette ouverture a expiré — tes cartes sont déjà dans ta collection (`/peak-hunters`).',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // L'animation dure plusieurs secondes pendant lesquelles le bouton reste cliquable.
  if (pack.revealed >= pack.cards.length) return;

  pack.revealed++;
  const render = (blur = 0) =>
    interaction.editReply({ components: [buildCardContainer(pack, userId, blur)], flags: MessageFlags.IsComponentsV2 });

  if (pack.revealed < pack.cards.length) {
    await render();
    return;
  }

  const card = pack.cards[pack.revealed - 1];
  const animation = await Promise.race([
    ensureRevealAnimation(card.mountain, card.rarity),
    sleep(ANIMATION_WAIT_MS, null),
  ]);

  if (animation) {
    await interaction.editReply({
      components: [buildAnimatedCardContainer(pack, animation)],
      flags: MessageFlags.IsComponentsV2,
    });
    await sleep(REVEAL_ANIMATION_MS);
  } else {
    for (const blur of BLUR_FRAMES) {
      await render(blur);
      await sleep(BLUR_FRAME_MS);
    }
  }

  opening.delete(userId);
  await interaction.editReply({ components: [await buildSummaryContainer(pack, userId)], flags: MessageFlags.IsComponentsV2 });
}

export async function handlePackButton(interaction: ButtonInteraction): Promise<void> {
  const [, , action, tier, ownerId] = interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: "❌ Ce n'est pas ton pack !", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();

  if (action === 'open') await openPack(interaction, tier as ExpeditionTier, ownerId);
  else if (action === 'next') await revealNext(interaction, ownerId);
}
