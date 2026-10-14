import { setTimeout as sleep } from 'node:timers/promises';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  TextDisplayBuilder,
  type WebhookMessageEditOptions,
} from 'discord.js';
import { EXPEDITION_TIER_CONFIG, FRAGMENTS_PER_EXPEDITION, RARITY_CONFIG, packTiers } from '../constants/peak-hunters.constants';
import { UserMountainsRepository } from '../repositories/user-mountains.repository';
import type { IUserMountainsDoc } from '../models/user-mountains.model';
import { MountainService, drawCards, type CardDraw } from './mountain.service';
import {
  buildBlurredImageUrl,
  buildProgressBar,
  buildRarityImageUrl,
  buildRarityTally,
  highestRarity,
  withRarestLast,
} from './card-render';
import { formatExpeditionsLine } from './expedition.service';
import { renderPackStrip } from './pack-strip.service';
import { REVEAL_ANIMATION_MS, ensureRevealAnimation } from './reveal-animation.service';
import { LogService } from '../../../shared/logs/logs.service';
import type { ExpeditionTier } from '../types/peak-hunters.types';

export const PACK_BUTTON_PREFIX = 'mountain:pack';
export const packOpenId = (tier: ExpeditionTier, userId: string) => `${PACK_BUTTON_PREFIX}:open:${tier}:${userId}`;
const packReopenId = (pack: OpeningPack, userId: string) => `${PACK_BUTTON_PREFIX}:reopen:${pack.tier}:${userId}:${pack.id}`;
const packViewId = (pack: OpeningPack, userId: string, index: number) =>
  `${PACK_BUTTON_PREFIX}:view:${pack.tier}:${userId}:${pack.id}:${index}`;

const BLUR_FRAMES = [2000, 400];
const BLUR_FRAME_MS = 1200;
/** Au-delà, on révèle la carte sans animation plutôt que de faire attendre. */
const ANIMATION_WAIT_MS = 6000;
const INSTANT_MS = 300;
const SUMMARY_DELAY_MS = 3500;
const STRIP_FILE = 'pack.webp';
const LOG_FEATURE = 'Mountain · Packs';

interface OpeningPack {
  id: string;
  tier: ExpeditionTier;
  cards: CardDraw[];
  revealed: number;
  busy: boolean;
  summary?: { container: ContainerBuilder; archived: ContainerBuilder; strip: Buffer | null };
  skipSummaryWait?: () => void;
}

type EditMessage = (options: WebhookMessageEditOptions) => Promise<unknown>;

interface CardView {
  index: number;
  animation?: string | null;
  blur?: number;
}

// Seul le dernier pack ouvert est en RAM, pour pouvoir le feuilleter — le pack non
// ouvert vit en base et les cartes sont débloquées dès l'ouverture. Un redémarrage
// ne coûte que la navigation, jamais une carte ni un pack payé.
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

function buildNavigationRow(pack: OpeningPack, userId: string, index: number): ActionRowBuilder<ButtonBuilder> {
  const total = pack.cards.length;
  const next = index + 1;
  const forward = new ButtonBuilder().setCustomId(packViewId(pack, userId, next)).setEmoji('▶️');

  if (next < pack.revealed) forward.setLabel(`Suivante (${next + 1}/${total})`).setStyle(ButtonStyle.Secondary);
  else if (next === total) forward.setLabel('Bilan du pack').setStyle(ButtonStyle.Success);
  else forward.setLabel(next === total - 1 ? 'Dernière carte' : `Révéler (${next + 1}/${total})`).setStyle(ButtonStyle.Primary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(packViewId(pack, userId, index - 1))
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(index === 0),
    forward,
  );
}

/** Avec une animation, le nom et la rareté sont incrustés dans l'image. */
function buildCardContainer(pack: OpeningPack, userId: string, { index, animation, blur = 0 }: CardView): ContainerBuilder {
  const card = pack.cards[index];
  const total = pack.cards.length;
  const { emoji, label, color } = RARITY_CONFIG[card.rarity];
  const hidden = blur > 0;

  const container = new ContainerBuilder().setAccentColor(color);

  if (!animation) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        hidden
          ? `## ❔ ???\n-# ${index === total - 1 ? 'La dernière carte…' : 'Révélation…'}`
          : `## ${emoji} ${card.mountain.mountainLabel} ${card.mountain.flags?.join(' ') ?? ''}\n-# ${label} · ${MountainService.getAltitude(card.mountain)}`,
      ),
    );
  }

  const image = animation
    ?? (hidden ? buildBlurredImageUrl(card.mountain.image, blur) : buildRarityImageUrl(card.mountain.image, card.rarity));
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image)));

  const status = card.isDuplicate ? `🔁 **Double** — +${card.fragmentsGained} 🧩` : '✅ **Nouvelle montagne !**';
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `${buildProgressBar(pack.revealed, total)}  \`${index + 1}/${total}\``,
        `-# ${buildRarityTally(pack.cards.slice(0, pack.revealed))}`,
        hidden ? '' : status,
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  );

  return hidden ? container : container.addActionRowComponents(buildNavigationRow(pack, userId, index));
}

function buildSummaryContainer(
  pack: OpeningPack,
  userId: string,
  doc: IUserMountainsDoc,
  hasStrip: boolean,
  withButtons: boolean,
): ContainerBuilder {
  const { label, emoji } = EXPEDITION_TIER_CONFIG[pack.tier];

  const fragments = pack.cards.reduce((sum, c) => sum + c.fragmentsGained, 0);
  const bonus = pack.cards.reduce((sum, c) => sum + c.expeditionsAwarded, 0);
  const fresh = pack.cards.filter(c => !c.isDuplicate).length;
  const owned = doc.unlockedMountains.length;
  const total = MountainService.count;

  const lines = [
    `## ${emoji} Bilan du pack ${label}\n-# par <@${userId}>`,
    `${buildRarityTally(pack.cards)}  ·  ✨ **${fresh}** nouvelle${fresh > 1 ? 's' : ''}  ·  collection **${owned}/${total}** (${Math.round((owned / total) * 100)}%)`,
  ];
  if (fragments > 0) lines.push(`🧩 +${fragments} fragments — ${doc.fragments}/${FRAGMENTS_PER_EXPEDITION}`);
  if (bonus > 0) lines.push(`🗺️ **+${bonus} expédition${bonus > 1 ? 's' : ''}** bonus ! ${pack.cards.map(c => c.expeditionsSummary).join('')}`);
  lines.push(formatExpeditionsLine(doc.sentierTickets, doc.falaiseTickets, doc.sommetTickets));

  const container = new ContainerBuilder()
    .setAccentColor(RARITY_CONFIG[highestRarity(pack.cards)].color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

  if (hasStrip) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${STRIP_FILE}`)),
    );
  }

  if (!withButtons) return container;

  const packsLeft = UserMountainsRepository.packsOf(doc, pack.tier);
  return container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(packViewId(pack, userId, pack.cards.length - 1))
        .setLabel('Revoir les cartes')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(packReopenId(pack, userId))
        .setLabel(packsLeft > 0 ? `Ouvrir un autre pack ${label} (${packsLeft} en stock)` : `Plus de pack ${label} en stock`)
        .setEmoji('🎁')
        .setStyle(packsLeft > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(packsLeft === 0),
    ),
  );
}

const stripFiles = (strip: Buffer | null | undefined) => (strip ? [new AttachmentBuilder(strip, { name: STRIP_FILE })] : []);

async function render(edit: EditMessage, pack: OpeningPack, userId: string, view: CardView): Promise<void> {
  await edit({ components: [buildCardContainer(pack, userId, view)], files: [], flags: MessageFlags.IsComponentsV2 });
}

async function renderSummary(edit: EditMessage, container: ContainerBuilder, strip: Buffer | null): Promise<void> {
  await edit({ components: [container], files: stripFiles(strip), flags: MessageFlags.IsComponentsV2 });
}

async function revealCard(edit: EditMessage, pack: OpeningPack, userId: string, index: number): Promise<string | null> {
  const card = pack.cards[index];
  const pending = ensureRevealAnimation(card.mountain, card.rarity);
  let animation = await Promise.race([pending, sleep(INSTANT_MS, null)]);
  if (!animation) {
    await render(edit, pack, userId, { index, blur: BLUR_FRAMES[0] });
    animation = await Promise.race([pending, sleep(ANIMATION_WAIT_MS, null)]);
  }

  if (animation) {
    await render(edit, pack, userId, { index, animation });
    return animation;
  }

  if (index === pack.cards.length - 1) {
    for (const blur of BLUR_FRAMES) {
      await render(edit, pack, userId, { index, blur });
      await sleep(BLUR_FRAME_MS);
    }
  }
  await render(edit, pack, userId, { index });
  return null;
}

async function showSummary(edit: EditMessage, pack: OpeningPack, userId: string, animation: string | null): Promise<void> {
  const skipped = new Promise<void>(resolve => (pack.skipSummaryWait = resolve));
  const [strip] = await Promise.all([
    renderPackStrip(pack.cards).catch(err => {
      console.error('[Peak Hunters] image du bilan de pack indisponible:', err);
      return null;
    }),
    Promise.race([sleep((animation ? REVEAL_ANIMATION_MS : 0) + SUMMARY_DELAY_MS), skipped]),
  ]);
  pack.skipSummaryWait = undefined;

  const doc = await UserMountainsRepository.getOrCreate(userId);
  pack.summary = {
    container: buildSummaryContainer(pack, userId, doc, strip !== null, true),
    archived: buildSummaryContainer(pack, userId, doc, strip !== null, false),
    strip,
  };
  await renderSummary(edit, pack.summary.container, pack.summary.strip);
}

async function revealNext(edit: EditMessage, pack: OpeningPack, userId: string): Promise<void> {
  pack.busy = true;
  try {
    const index = pack.revealed++;
    const animation = await revealCard(edit, pack, userId, index);
    if (pack.revealed === pack.cards.length) await showSummary(edit, pack, userId, animation);
  } finally {
    pack.busy = false;
  }
}

/** Les animations se génèrent une par une pendant que le joueur découvre les premières cartes. */
function prewarmAnimations(cards: CardDraw[]): void {
  void cards.reduce<Promise<unknown>>(
    (previous, card) => previous.then(() => ensureRevealAnimation(card.mountain, card.rarity)),
    Promise.resolve(),
  );
}

/**
 * Une ouverture se fait toujours devant tout le salon, et un bilan déjà affiché reste
 * dans le fil : depuis la boutique (éphémère) ou depuis un bilan, le pack part dans un
 * nouveau message public, ensuite édité en place.
 */
async function packMessage(interaction: ButtonInteraction, tier: ExpeditionTier, fromSummary: boolean): Promise<EditMessage> {
  if (!fromSummary && !interaction.message.flags.has(MessageFlags.Ephemeral)) return options => interaction.editReply(options);

  const { label, emoji } = EXPEDITION_TIER_CONFIG[tier];
  const message = await interaction.followUp({
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${emoji} Pack ${label}\n-# <@${interaction.user.id}> ouvre un pack…`),
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });
  return options => interaction.webhook.editMessage(message, options);
}

/** `fromPackId` : le bilan d'où part l'ouverture, qui perd ses boutons et reste dans le fil. */
async function openPack(interaction: ButtonInteraction, tier: ExpeditionTier, userId: string, fromPackId?: string): Promise<void> {
  if (!(await UserMountainsRepository.spendPack(userId, tier))) {
    await interaction.followUp({
      content: `❌ Tu n'as plus de pack ${EXPEDITION_TIER_CONFIG[tier].label} — passe par la boutique (\`/shop\`).`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cards = withRarestLast(await drawCards(userId, packTiers(tier)));
  if (cards.length === 0) {
    await UserMountainsRepository.addPacks(userId, tier, 1);
    await interaction.followUp({ content: '❌ Erreur lors du tirage, ton pack t\'a été rendu.', flags: MessageFlags.Ephemeral });
    return;
  }

  const previous = opening.get(userId);
  if (previous?.summary && previous.id === fromPackId) {
    await renderSummary(options => interaction.editReply(options), previous.summary.archived, previous.summary.strip);
  }

  const pack: OpeningPack = { id: Date.now().toString(36), tier, cards, revealed: 0, busy: false };
  opening.set(userId, pack);
  prewarmAnimations(cards);

  const { label, emoji } = EXPEDITION_TIER_CONFIG[tier];
  const list = cards.map(c => `${RARITY_CONFIG[c.rarity].emoji} ${c.mountain.mountainLabel}${c.isDuplicate ? ' 🔁' : ''}`).join(', ');
  await LogService.info(`<@${userId}> a ouvert un **pack ${label}** ${emoji}\n${list}`, {
    feature: LOG_FEATURE,
    title: `${emoji} Pack ${label} ouvert`,
  });

  await revealNext(await packMessage(interaction, tier, fromPackId !== undefined), pack, userId);
}

/** Revenir sur une carte déjà vue, révéler la suivante, ou retourner au bilan. */
async function navigate(interaction: ButtonInteraction, pack: OpeningPack, userId: string, index: number): Promise<void> {
  if (index === pack.cards.length && pack.skipSummaryWait) {
    pack.skipSummaryWait();
    return;
  }
  // Une révélation dure plusieurs secondes pendant lesquelles les boutons précédents restent cliquables.
  if (pack.busy || !Number.isInteger(index) || index < 0 || index > pack.revealed) return;

  const edit: EditMessage = options => interaction.editReply(options);
  if (index === pack.cards.length) {
    if (pack.summary) await renderSummary(edit, pack.summary.container, pack.summary.strip);
  } else if (index < pack.revealed) await render(edit, pack, userId, { index });
  else await revealNext(edit, pack, userId);
}

export async function handlePackButton(interaction: ButtonInteraction): Promise<void> {
  const [, , action, tier, ownerId, packId, index] = interaction.customId.split(':');

  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: "❌ Ce n'est pas ton pack !", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();

  if (action === 'open' || action === 'reopen') {
    await openPack(interaction, tier as ExpeditionTier, ownerId, action === 'reopen' ? packId : undefined);
    return;
  }

  const pack = opening.get(ownerId);
  if (action !== 'view' || pack?.id !== packId) {
    await interaction.followUp({
      content: '❌ Cette ouverture a expiré — tes cartes sont déjà dans ta collection (`/peak-hunters`).',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await navigate(interaction, pack, ownerId, Number(index));
}
