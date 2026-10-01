import { BarChart3, House, Mountain, Package, PartyPopper, type LucideIcon } from 'lucide-react';

export type SectionId = 'home' | 'packs' | 'parties' | 'stats' | 'collection';

export interface Section {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  tagline: string;
}

export const SECTIONS: Section[] = [
  { id: 'home', label: 'Accueil', icon: House, tagline: 'Ton camp de base' },
  { id: 'packs', label: 'Packs', icon: Package, tagline: 'Ouvre tes packs et découvre tes sommets' },
  { id: 'parties', label: 'Soirées', icon: PartyPopper, tagline: 'Les soirées vocales du serveur' },
  { id: 'stats', label: 'Stats', icon: BarChart3, tagline: 'Ton activité, tes classements, tes jeux' },
  { id: 'collection', label: 'Collection', icon: Mountain, tagline: 'Tous les sommets de Peak Hunters' },
];
