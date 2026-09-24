import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  User,
} from 'discord.js';
import { BotClient } from '../../../../bot/client';
import { UserMountainsRepository } from '../../repositories/user-mountains.repository';
import { MountainService, MountainInfo, drawCard, drawCards, type CardDraw } from '../../services/mountain.service';
import { addCardSections, buildRarityOddsLine, highestRarity } from '../../services/card-render';
import { PACK_CARDS } from '../../constants/peak-hunters.constants';
import { packOpenId } from '../../services/pack.service';
import type { IUserMountainsDoc } from '../../models/user-mountains.model';
import { RARITY_CONFIG, FRAGMENTS_PER_EXPEDITION, EXPEDITION_TIER_CONFIG } from '../../constants/peak-hunters.constants';

import type { MountainRarity, ExpeditionTier } from '../../types/peak-hunters.types';
import { LogService } from '../../../../shared/logs/logs.service';
import { formatExpeditionsLine, formatExpeditionsLineText } from '../../services/expedition.service';

// customId format : mountain:expe:open:<tier>:<userId>
//                   mountain:expe:open5:<tier>:<userId>
export const EXPEDITION_BUTTON_PREFIX = 'mountain:expe';
const expeditionOpenId  = (tier: ExpeditionTier, userId: string) => `mountain:expe:open:${tier}:${userId}`;
const expeditionOpen5Id = (tier: ExpeditionTier, userId: string) => `mountain:expe:open5:${tier}:${userId}`;

const MULTI_EXPEDITION_COUNT = 5;
const BAR_IMAGE_URL =
  'https://cdn.discordapp.com/attachments/685655650923053122/1493313723744518237/Nouveau_projet_7.png?ex=69de8448&is=69dd32c8&hm=e784bdf98db6660531cbf89dbd522b7d3da94558972c1b3dde033b1ac0718726&';

function buildFragmentBar(fragments: number): string {
  const filled = Math.round((fragments / FRAGMENTS_PER_EXPEDITION) * 10);
  return '🟧'.repeat(filled) + '⬛'.repeat(10 - filled);
}

const PACK_TIERS: ExpeditionTier[] = ['sentier', 'falaise', 'sommet'];

/** Les packs achetés en boutique, retrouvables ici tant qu'ils ne sont pas ouverts. */
function addPackSections(container: ContainerBuilder, userId: string, doc: IUserMountainsDoc): void {
  const owned = PACK_TIERS.map(tier => ({ tier, count: UserMountainsRepository.packsOf(doc, tier) })).filter(p => p.count > 0);
  if (owned.length === 0) return;

  for (const { tier, count } of owned) {
    const { emoji, label } = EXPEDITION_TIER_CONFIG[tier];
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### 🎁 Pack ${label} ${emoji} — **${count}** en stock\n-# ${PACK_CARDS[tier]} cartes · ${buildRarityOddsLine(tier)}`),
        )
        .setButtonAccessory(
          new ButtonBuilder().setCustomId(packOpenId(tier, userId)).setLabel('Ouvrir').setEmoji('🎁').setStyle(ButtonStyle.Success),
        ),
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
}

export function buildExpeditionContainer(user: User, doc: IUserMountainsDoc): ContainerBuilder {
  const { sentierTickets: sentier, falaiseTickets: falaise, sommetTickets: sommet, fragments } = doc;
  const { emoji: sEmoji, label: sLabel } = EXPEDITION_TIER_CONFIG.sentier;
  const { emoji: fEmoji, label: fLabel } = EXPEDITION_TIER_CONFIG.falaise;
  const { emoji: eEmoji, label: eLabel } = EXPEDITION_TIER_CONFIG.sommet;

  const container = new ContainerBuilder()
    .setAccentColor(0x1e8d73)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🗺️ Expéditions\n-# par <@${user.id}>`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🧩 ${buildFragmentBar(fragments)}  \`${fragments}/${FRAGMENTS_PER_EXPEDITION}\``))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 64 }))),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  addPackSections(container, user.id, doc);

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${sEmoji} ${sLabel} — **${sentier}** disponible${sentier !== 1 ? 's' : ''}\n-# ${buildRarityOddsLine('sentier')}`))

  if (sentier > 0) container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(expeditionOpenId('sentier', user.id)).setLabel('🥾 Lancer 1').setStyle(ButtonStyle.Secondary),
      ...(sentier > 1 ? [new ButtonBuilder().setCustomId(expeditionOpen5Id('sentier', user.id)).setLabel(`🥾 Lancer ${Math.min(sentier, MULTI_EXPEDITION_COUNT)}`).setStyle(ButtonStyle.Secondary)] : []),
    ),
  );

  container
    .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${fEmoji} ${fLabel} — **${falaise}** disponible${falaise !== 1 ? 's' : ''}\n-# ${buildRarityOddsLine('falaise')}`));

  if (falaise > 0) container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(expeditionOpenId('falaise', user.id)).setLabel('🥾 Lancer 1').setStyle(ButtonStyle.Secondary),
      ...(falaise > 1 ? [new ButtonBuilder().setCustomId(expeditionOpen5Id('falaise', user.id)).setLabel(`🥾 Lancer ${Math.min(falaise, MULTI_EXPEDITION_COUNT)}`).setStyle(ButtonStyle.Secondary)] : []),
    ),
  );

  container
    .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${eEmoji} ${eLabel} — **${sommet}** disponible${sommet !== 1 ? 's' : ''}\n-# ${buildRarityOddsLine('sommet')}`));

  if (sommet > 0) container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(expeditionOpenId('sommet', user.id)).setLabel('🥾 Lancer 1').setStyle(ButtonStyle.Danger),
    ),
  );

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL('https://res.cloudinary.com/theridge-bot/image/upload/q_auto/f_auto/v1776241629/the-ridge/discord/logo/ph-banner.png'),
    ),
  );

  return container;
}

function buildRevealEmbed(
  mountain: MountainInfo,
  rarity: MountainRarity,
  tier: ExpeditionTier,
  isDuplicate: boolean,
  fragmentsGained: number,
  totalFragments: number,
  sentier: number,
  falaise: number,
  sommet: number,
  expeditionsFromFragments: number,
  expeditionsFromFragmentsSummary: string,
  user: User,
): EmbedBuilder {
  const { emoji, label, color } = RARITY_CONFIG[rarity];
  const tierCfg = EXPEDITION_TIER_CONFIG[tier];

  let resultText: string;
  if (isDuplicate) {
    resultText = `**Double !** Tu possèdes déjà cette montagne.\n→ **+${fragmentsGained} fragment${fragmentsGained > 1 ? 's' : ''}** 🧩 (\`${totalFragments}/${FRAGMENTS_PER_EXPEDITION}\`)`;
    if (expeditionsFromFragments > 0) {
      resultText += `\n🗺️ **+${expeditionsFromFragments} expédition${expeditionsFromFragments > 1 ? 's' : ''}** bonus ! ${expeditionsFromFragmentsSummary}`;
    }
  } else {
    resultText = '**Nouvelle montagne débloquée !** ✅';
  }

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL() })
    .setThumbnail('https://res.cloudinary.com/theridge-bot/image/upload/q_auto/f_auto/v1776241636/the-ridge/discord/logo/ph-logo.png')
    .setTitle(`${emoji} ${mountain.mountainLabel}`)
    .addFields(
      { name: '🌍 Pays', value: MountainService.getCountryDisplay(mountain), inline: true },
      { name: '📏 Altitude', value: MountainService.getAltitude(mountain), inline: true },
      { name: '✨ Rareté', value: `${emoji} **${label}**`, inline: true },
    )
    .setDescription(resultText)
    .setImage(mountain.image)
    .setFooter({ text: `Expédition ${tierCfg.label}  |  ${formatExpeditionsLineText(sentier, falaise, sommet)}` });
}

function buildMultiRevealContainer(
  results: CardDraw[],
  tier: ExpeditionTier,
  totalFragmentsGained: number,
  totalExpeditionsFromFragments: number,
  totalExpeditionsFromFragmentsSummary: string,
  finalFragments: number,
  sentier: number,
  falaise: number,
  sommet: number,
  user: User,
): ContainerBuilder {
  const tierCfg = EXPEDITION_TIER_CONFIG[tier];
  const remaining = tier === 'falaise' ? falaise : tier === 'sommet' ? sommet : sentier;

  const headerLines: string[] = [
    `# ${tierCfg.emoji} Expédition x${results.length}\n-# par <@${user.id}>\n`,
  ];
  if (totalFragmentsGained > 0) {
    headerLines.push(`🧩 +${totalFragmentsGained} fragments — ${finalFragments}/${FRAGMENTS_PER_EXPEDITION}`);
  }
  if (totalExpeditionsFromFragments > 0) {
    headerLines.push(
      `🗺️ **+${totalExpeditionsFromFragments} expédition${totalExpeditionsFromFragments > 1 ? 's' : ''}** bonus depuis les fragments ! ${totalExpeditionsFromFragmentsSummary}`,
    );
  }
  headerLines.push(formatExpeditionsLine(sentier, falaise, sommet));

  const container = new ContainerBuilder()
    .setAccentColor(RARITY_CONFIG[highestRarity(results)].color)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerLines.join('\n')))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 64 }))),
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(BAR_IMAGE_URL),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  addCardSections(container, results);

  if (remaining > 0) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    if (tier === 'sommet') {
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(expeditionOpenId(tier, user.id)).setLabel('🥾 Lancer 1 autre').setStyle(ButtonStyle.Danger),
        ),
      );
    } else {
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(expeditionOpenId(tier, user.id)).setLabel('🥾 Lancer 1').setStyle(ButtonStyle.Secondary),
          ...(remaining > 1 ? [new ButtonBuilder().setCustomId(expeditionOpen5Id(tier, user.id)).setLabel(`🥾 Lancer ${Math.min(remaining, MULTI_EXPEDITION_COUNT)}`).setStyle(ButtonStyle.Secondary)] : []),
        ),
      );
    }
  }

  return container;
}

async function openExpeditionMulti(interaction: ButtonInteraction, tier: ExpeditionTier): Promise<void> {
  const userId = interaction.user.id;
  const docBefore = await UserMountainsRepository.getOrCreate(userId);
  const available = tier === 'falaise' ? docBefore.falaiseTickets : tier === 'sommet' ? docBefore.sommetTickets : docBefore.sentierTickets;

  if (available <= 1) {
    await interaction.editReply({ content: "❌ Tu n'as pas assez d'expéditions !" });
    return;
  }

  const count = Math.min(available, MULTI_EXPEDITION_COUNT);
  await UserMountainsRepository.spendExpeditions(userId, count, tier);

  const results = await drawCards(userId, Array<ExpeditionTier>(count).fill(tier));
  const totalFragmentsGained = results.reduce((sum, r) => sum + r.fragmentsGained, 0);
  const totalExpeditionsFromFragments = results.reduce((sum, r) => sum + r.expeditionsAwarded, 0);
  const totalExpeditionsFromFragmentsSummary = results.map(r => r.expeditionsSummary).join('');

  const doc = await UserMountainsRepository.getOrCreate(userId);
  const tierCfg = EXPEDITION_TIER_CONFIG[tier];

  const container = buildMultiRevealContainer(
    results, tier, totalFragmentsGained, totalExpeditionsFromFragments, totalExpeditionsFromFragmentsSummary,
    doc.fragments, doc.sentierTickets, doc.falaiseTickets, doc.sommetTickets, interaction.user,
  );

  await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });

  const newList = results.filter(r => !r.isDuplicate).map(r => `${RARITY_CONFIG[r.rarity].emoji} ${r.mountain.mountainLabel}`).join(', ') || '—';
  const dupList = results.filter(r => r.isDuplicate).map(r => `${RARITY_CONFIG[r.rarity].emoji} ${r.mountain.mountainLabel}`).join(', ') || '—';
  await LogService.info(
    `<@${userId}> a lancé **${count} expéditions ${tierCfg.label}** ${tierCfg.emoji} · ${formatExpeditionsLineText(doc.sentierTickets, doc.falaiseTickets, doc.sommetTickets)}\n✅ ${newList}\n🔁 ${dupList}${totalFragmentsGained > 0 ? `\n🧩 +${totalFragmentsGained} fragments → \`${doc.fragments}/${FRAGMENTS_PER_EXPEDITION}\`` : ''}`,
    { feature: 'Mountain · Expéditions', title: `🗺️ Expéditions ${tierCfg.label} lancées` },
  );
}

async function openExpedition(interaction: ButtonInteraction, tier: ExpeditionTier): Promise<void> {
  const userId = interaction.user.id;

  const spent = await UserMountainsRepository.spendExpedition(userId, tier);
  if (!spent) {
    await interaction.editReply({ content: "❌ Tu n'as plus d'expéditions ! Passe du temps en vocal pour en gagner." });
    return;
  }

  const card = await drawCard(userId, tier);
  if (!card) {
    await interaction.editReply({ content: '❌ Erreur lors du tirage.' });
    return;
  }

  const { mountain, rarity, isDuplicate, fragmentsGained, expeditionsAwarded: expeditionsFromFragments, expeditionsSummary: expeditionsFromFragmentsSummary } = card;

  const doc = await UserMountainsRepository.getOrCreate(userId);
  const tierCfg = EXPEDITION_TIER_CONFIG[tier];
  const remaining = tier === 'falaise' ? doc.falaiseTickets : tier === 'sommet' ? doc.sommetTickets : doc.sentierTickets;

  const embed = buildRevealEmbed(
    mountain, rarity, tier, isDuplicate, fragmentsGained, doc.fragments,
    doc.sentierTickets, doc.falaiseTickets, doc.sommetTickets, expeditionsFromFragments, expeditionsFromFragmentsSummary, interaction.user,
  );

  const components = remaining > 0
    ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(expeditionOpenId(tier, userId))
          .setLabel('🥾 Lancer une autre expédition')
          .setStyle(tier === 'sommet' ? ButtonStyle.Danger : ButtonStyle.Success),
      )]
    : [];

  await interaction.editReply({ embeds: [embed], components });

  const { emoji, label } = RARITY_CONFIG[rarity];
  const resultText = isDuplicate ? `🔁 double +${fragmentsGained}🧩${expeditionsFromFragments > 0 ? ` +${expeditionsFromFragments}🗺️ ${expeditionsFromFragmentsSummary}` : ''}` : '✅ nouveau';
  await LogService.info(
    `<@${userId}> a lancé une expédition **${tierCfg.label}** ${tierCfg.emoji} · ${emoji} **${mountain.mountainLabel}** (${label}) — ${resultText} · ${formatExpeditionsLineText(doc.sentierTickets, doc.falaiseTickets, doc.sommetTickets)}`,
    { feature: 'Mountain · Expéditions', title: `${tierCfg.emoji} Expédition ${tierCfg.label} lancée` },
  );
}

export async function handleExpeditionButton(interaction: ButtonInteraction, _client: BotClient): Promise<void> {
  // customId: mountain:expe:open:<tier>:<userId> ou mountain:expe:open5:<tier>:<userId>
  const parts = interaction.customId.split(':');
  const action = parts[2]; // 'open' ou 'open5'
  const tier = parts[3] as ExpeditionTier;
  const ownerId = parts[4];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: "❌ Ce n'est pas ton expédition !", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  if (action === 'open') {
    await openExpedition(interaction, tier);
  } else if (action === 'open5') {
    await openExpeditionMulti(interaction, tier);
  }
}

export async function executeExpedition(interaction: ChatInputCommandInteraction | ButtonInteraction, _client: BotClient): Promise<void> {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const doc = await UserMountainsRepository.getOrCreate(userId);
  const container = buildExpeditionContainer(interaction.user, doc);
  await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}
