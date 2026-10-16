import { ApplicationCommandType, EntryPointCommandHandlerType, InteractionContextType, ApplicationIntegrationType, Routes, type REST } from 'discord.js';

const ENTRY_POINT = {
  name: 'Camp de base',
  description: 'Ouvre le camp de base The Ridge',
  type: ApplicationCommandType.PrimaryEntryPoint,
  handler: EntryPointCommandHandlerType.DiscordLaunchActivity,
  contexts: [InteractionContextType.Guild],
  integration_types: [ApplicationIntegrationType.GuildInstall],
};

/**
 * La commande qui lance l'Activity depuis le lanceur Discord. Elle est forcément globale
 * et unique par application : on met à jour celle qui existe plutôt que d'en créer une seconde.
 */
export async function ensureActivityEntryPoint(rest: REST, clientId: string): Promise<void> {
  const commands = (await rest.get(Routes.applicationCommands(clientId))) as { id: string; type: number }[];
  const existing = commands.find(command => command.type === ApplicationCommandType.PrimaryEntryPoint);

  if (existing) await rest.patch(Routes.applicationCommand(clientId, existing.id), { body: ENTRY_POINT });
  else await rest.post(Routes.applicationCommands(clientId), { body: ENTRY_POINT });
}
