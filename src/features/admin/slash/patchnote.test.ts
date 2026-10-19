import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Client, ContainerBuilder } from 'discord.js';
import { TextDisplayBuilder } from 'discord.js';
import { buildPatchnoteContainers, packIntoMessages } from './patchnote';
import { loadCurrencyEmoji } from '../../../shared/economy/currency';
import patchnotes from '../data/patchnotes.json';

const textOf = (containers: ContainerBuilder[]) =>
  containers.flatMap(c => c.components).reduce((n, c) => n + (c instanceof TextDisplayBuilder ? c.data.content?.length ?? 0 : 0), 0);

test('chaque message du dernier patchnote tient sous la limite de texte de Discord', async () => {
  const emoji = { name: 'ridgecoin', toString: () => '<:ridgecoin:1561702060137648199>' };
  await loadCurrencyEmoji({ application: { emojis: { fetch: async () => [emoji] } } } as unknown as Client);

  const latest = patchnotes[patchnotes.length - 1] as Parameters<typeof buildPatchnoteContainers>[0];
  const containers = buildPatchnoteContainers(latest);
  const messages = packIntoMessages(containers);

  assert.equal(messages.flat().length, containers.length);
  for (const message of messages) assert.ok(textOf(message) <= 4000, `${textOf(message)} caractères`);
});
