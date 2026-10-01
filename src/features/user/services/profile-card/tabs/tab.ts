import type { GuildMember, User } from 'discord.js';
import type { IUser } from '../../../models/user.model';
import type { Layout } from '../engine/backdrop';
import type { CardNode } from '../engine/elements';
import type { ProfileTheme } from '../engine/themes';

export interface TabTarget {
  user: User;
  member: GuildMember | null;
  account: IUser;
}

/**
 * Un onglet de /me : ses cadres (pour le fond flouté), ses données, sa mise en page.
 * `load` fait les requêtes et télécharge les images, `build` reste une fonction pure.
 */
export interface ProfileTab<Data> {
  id: string;
  label: string;
  emoji: string;
  layout: Layout;
  load(target: TabTarget): Promise<Data>;
  build(data: Data, theme: ProfileTheme): CardNode;
  /** Ressources communes à tous les joueurs, chargées au démarrage plutôt qu'au premier clic. */
  prepare?(): Promise<void>;
}

export const defineTab = <Data>(tab: ProfileTab<Data>) => tab;
