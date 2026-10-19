import type { Client } from 'discord.js';

const FALLBACK = '💰';
const EMOJI_NAME = 'ridgecoin';

let currency = FALLBACK;

/**
 * L'émote RidgeCoin. C'est une émote d'application : chaque bot (prod, staging, dev) a la
 * sienne, avec son propre id, d'où la résolution au démarrage. 💰 si elle manque.
 * Ne s'affiche que dans le texte d'un message : libellés de boutons, placeholders, titres
 * d'embed et logs du dashboard gardent 💰.
 */
export const rc = (): string => currency;

export async function loadCurrencyEmoji(client: Client): Promise<void> {
  const emojis = await client.application?.emojis.fetch().catch(() => null);
  const found = emojis?.find(emoji => emoji.name === EMOJI_NAME);
  if (found) currency = found.toString();
  else console.warn(`[Currency] Émote d'application « ${EMOJI_NAME} » introuvable, repli sur ${FALLBACK}`);
}

/** Pour les textes écrits à l'avance (patchnotes) : leurs 💰 deviennent l'émote. */
export const withCurrency = (text: string): string => text.split(FALLBACK).join(currency);
