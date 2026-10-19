export interface MentionNames {
  users: Map<string, string>;
  channels: Map<string, string>;
  roles: Map<string, string>;
}

/**
 * Les messages de logs sont écrits en markup Discord (`<@id>`, `<#id>`, `<t:ts:R>`).
 * Le dashboard n'a pas de client Discord pour les résoudre : on le fait côté serveur.
 */
export function renderMentions(message: string, names: MentionNames): string {
  return message
    .replace(/<@&(\d+)>/g, (_, id) => `@${names.roles.get(id) ?? id}`)
    .replace(/<@!?(\d+)>/g, (_, id) => `@${names.users.get(id) ?? id}`)
    .replace(/<#(\d+)>/g, (_, id) => `#${names.channels.get(id) ?? id}`)
    .replace(/<t:(\d+)(?::[tTdDfFR])?>/g, (_, ts) =>
      new Date(Number(ts) * 1000).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
    );
}
