import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { IBet } from '../models/bet.model';
import { BetService } from '../services/bet.service';
import { rc } from '../../../shared/economy/currency';

const STATUS_LABELS: Record<string, string> = {
  open: '🟢 Ouvert',
  locked: '🔴 Paris fermés',
  closed: '🏁 Terminé',
  refunded: '↩️ Remboursé',
};

const STATUS_COLORS: Record<string, number> = {
  open: 0x2ecc71,
  locked: 0xe74c3c,
  closed: 0xf1c40f,
  refunded: 0x95a5a6,
};

const OPTION_EMOJIS = ['🔵', '🟠', '🟣', '🟡'];

export function buildBetMessage(bet: IBet): ContainerBuilder[] {
  const totalPot = bet.options.reduce((sum, o) => sum + o.totalAmount, 0);
  const betId = (bet as any)._id.toString();

  const headerLines = [
    `# 🎲 ${bet.title}`,
    `${STATUS_LABELS[bet.status]}  ·  Pot total : **${totalPot.toLocaleString('fr-FR')}** ${rc()}`,
  ];

  if (bet.status === 'closed' && bet.winnerIndex !== undefined) {
    headerLines.push(`\n🏆 Vainqueur : **${bet.options[bet.winnerIndex].name}**`);
  }
  if (bet.status === 'refunded') {
    headerLines.push('\n*Tous les paris ont été remboursés.*');
  }

  const showEntries = bet.status !== 'open';

  const optionLines = bet.options.flatMap((opt, i) => {
    const emoji = OPTION_EMOJIS[i] ?? '⚪';
    const odds = BetService.getOddsMultiplier(bet, i);
    const oddsLabel = totalPot === 0 ? '—' : `×${odds.toFixed(1)}`;
    const isWinner = bet.status === 'closed' && bet.winnerIndex === i;
    const header = `${isWinner ? '✅ ' : ''}${emoji} **${opt.name}** — ${opt.totalAmount.toLocaleString('fr-FR')} ${rc()} (${opt.entryCount} parieur${opt.entryCount !== 1 ? 's' : ''})  ·  cote ${oddsLabel}`;

    if (!showEntries) return [header];

    const entries = bet.entries.filter(e => e.optionIndex === i);
    const entriesLine = entries.length > 0
      ? `-# ${entries.map(e => `<@${e.userId}> ${e.amount.toLocaleString('fr-FR')} ${rc()}`).join('  ·  ')}`
      : '-# *Aucun pari*';

    return [header, entriesLine];
  });

  const container = new ContainerBuilder()
    .setAccentColor(STATUS_COLORS[bet.status] ?? 0x7289da)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerLines.join('\n')))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(optionLines.join('\n')));

  if (bet.status === 'open') {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`bet:place:${betId}`)
      .setPlaceholder('🎲 Choisir une option et miser...')
      .addOptions(
        bet.options.map((opt, i) => {
          const odds = BetService.getOddsMultiplier(bet, i);
          const oddsLabel = totalPot === 0 ? '—' : `×${odds.toFixed(1)}`;
          return new StringSelectMenuOptionBuilder()
            .setLabel(opt.name)
            .setValue(String(i))
            .setDescription(`${opt.totalAmount.toLocaleString('fr-FR')} 💰 misés · cote ${oddsLabel}`);
        }),
      );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
    container.addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }

  if (bet.status !== 'closed' && bet.status !== 'refunded') {
    const adminRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bet:lock:${betId}`)
        .setLabel('🔒 Stopper les paris')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(bet.status === 'locked'),
      new ButtonBuilder()
        .setCustomId(`bet:close:${betId}`)
        .setLabel('🏆 Terminer')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`bet:refund:${betId}`)
        .setLabel('↩ Rembourser')
        .setStyle(ButtonStyle.Danger),
    );
    container.addActionRowComponents(adminRow);
  }

  return [container];
}
