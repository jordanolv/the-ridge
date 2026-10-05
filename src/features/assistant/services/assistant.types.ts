export interface PartyBrief {
  id: string;
  name: string;
  game: string;
  description?: string;
  dateTime: Date;
  maxSlots: number;
  participants: number;
  status: string;
  image?: string;
}

/** Ce que l'assistant peut lire du reste du bot, fourni par la couche web. */
export interface AssistantContext {
  upcomingParties(): Promise<PartyBrief[]>;
}

export type Attachment =
  | { kind: 'message'; label: string; content: string }
  | { kind: 'image'; label: string; url: string };
