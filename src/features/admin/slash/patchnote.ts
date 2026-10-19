import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { withCurrency } from '../../../shared/economy/currency';

type SectionType = 'new' | 'update' | 'fix';

interface PatchBlock {
  title: string;
  items: string[];
}

interface PatchSection {
  type: SectionType;
  blocks: PatchBlock[];
}

interface Patchnote {
  version: string;
  timestamp: number;
  sections: PatchSection[];
}

/** Discord refuse un message Components V2 dont le texte dépasse 4 000 caractères au total. */
const MESSAGE_TEXT_LIMIT = 4000;

const SECTION_CONFIG: Record<SectionType, { label: string; color: number }> = {
  new:    { label: '✅ Nouveautés', color: 0x2ecc71 },
  update: { label: '🔄 Updates',    color: 0x3498db },
  fix:    { label: '🔧 Correctifs', color: 0xe67e22 },
};

export function buildPatchnoteContainers(note: Patchnote): ContainerBuilder[] {
  const containers: ContainerBuilder[] = [];

  const header = new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 📋 Patchnote  \`v${note.version}\``),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `📅 <t:${note.timestamp}:D>  ·  🕐 <t:${note.timestamp}:t>`,
      ),
    );

  containers.push(header);

  for (const section of note.sections) {
    const { label, color } = SECTION_CONFIG[section.type];

    const container = new ContainerBuilder()
      .setAccentColor(color)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### ${label}`),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    for (let i = 0; i < section.blocks.length; i++) {
      const block = section.blocks[i];
      const itemLines = block.items.map(item => `- ${withCurrency(item)}`).join('\n');

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${block.title}**\n${itemLines}`),
      );

      if (i < section.blocks.length - 1) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
      }
    }

    containers.push(container);
  }

  return containers;
}

function textLength(container: ContainerBuilder): number {
  return container.components.reduce(
    (sum, component) => sum + (component instanceof TextDisplayBuilder ? component.data.content?.length ?? 0 : 0),
    0,
  );
}

export function packIntoMessages(containers: ContainerBuilder[]): ContainerBuilder[][] {
  const messages: ContainerBuilder[][] = [];
  let current: ContainerBuilder[] = [];
  let length = 0;

  for (const container of containers) {
    const size = textLength(container);
    if (current.length && length + size > MESSAGE_TEXT_LIMIT) {
      messages.push(current);
      current = [];
      length = 0;
    }
    current.push(container);
    length += size;
  }
  if (current.length) messages.push(current);
  return messages;
}

async function loadPatchnotes(): Promise<Patchnote[]> {
  const srcPath = path.resolve(process.cwd(), 'src', 'features', 'admin', 'data', 'patchnotes.json');
  const distPath = path.resolve(process.cwd(), 'dist', 'features', 'admin', 'data', 'patchnotes.json');

  try {
    return JSON.parse(await fs.readFile(srcPath, 'utf-8'));
  } catch {
    return JSON.parse(await fs.readFile(distPath, 'utf-8'));
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('patchnote')
    .setDescription('Envoie le dernier patchnote dans ce channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    let notes: Patchnote[];

    try {
      notes = await loadPatchnotes();
    } catch {
      await interaction.reply({ content: '❌ Impossible de charger les patchnotes.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!notes.length) {
      await interaction.reply({ content: '❌ Aucun patchnote trouvé.', flags: MessageFlags.Ephemeral });
      return;
    }

    const latest = notes[notes.length - 1];
    const messages = packIntoMessages(buildPatchnoteContainers(latest));

    await interaction.reply({ content: '📨 Envoyé !', flags: MessageFlags.Ephemeral });

    const channel = interaction.channel as TextChannel;
    for (const components of messages) {
      await channel.send({ components, flags: MessageFlags.IsComponentsV2 });
    }
  },
};
