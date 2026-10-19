import { BarChart3, House, Mountain, Package, PartyPopper, type LucideIcon } from 'lucide-react';

export type SectionId = 'home' | 'packs' | 'parties' | 'stats' | 'collection';

export interface Section {
  id: SectionId;
  label: string;
  icon: LucideIcon;
}

export const SECTIONS: Section[] = [
  { id: 'home', label: 'Accueil', icon: House },
  { id: 'packs', label: 'Packs', icon: Package },
  { id: 'parties', label: 'Soirées', icon: PartyPopper },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'collection', label: 'Collection', icon: Mountain },
];
