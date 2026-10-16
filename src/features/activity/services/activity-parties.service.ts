import type { PartyEvent } from '../../party/models/party-event.model';
import { PartyService } from '../../party/services/party.service';
import { UserRepository } from '../../user/services/user.repository';
import { UserService } from '../../user/services/user.service';
import type { PartiesSummary, PartyCard } from '../activity.types';

const PAST_LIMIT = 6;
const users = new UserRepository();

export const partyImagePath = (partyId: string) => `/api/activity/parties/${partyId}/image`;

const time = (date: Date | undefined) => (date ? new Date(date).getTime() : null);

function toPartyCard(event: PartyEvent, names: Map<string, string>, userId: string): PartyCard {
  const id = event._id.toString();
  const { eventInfo } = event;
  const rewarded = event.status === 'ended' && (event.rewardAmount || event.xpAmount || event.expeditionAmount);

  return {
    id,
    name: eventInfo.name,
    game: eventInfo.game,
    description: eventInfo.description?.trim() || null,
    status: event.status,
    startsAt: new Date(eventInfo.dateTime).getTime(),
    startedAt: time(event.startedAt),
    endedAt: time(event.endedAt),
    color: eventInfo.color,
    image: eventInfo.image ? partyImagePath(id) : null,
    maxSlots: eventInfo.maxSlots,
    participants: event.participants.map(participantId => ({ id: participantId, name: names.get(participantId) ?? 'Joueur' })),
    attended: event.attendedParticipants.length,
    joined: event.participants.includes(userId),
    rewards: rewarded ? { money: event.rewardAmount ?? 0, xp: event.xpAmount ?? 0, expeditions: event.expeditionAmount ?? 0 } : null,
  };
}

async function toPartyCards(events: PartyEvent[], userId: string): Promise<PartyCard[]> {
  const names = await users.namesOf([...new Set(events.flatMap(e => e.participants))]);
  return events.map(event => toPartyCard(event, names, userId));
}

export class ActivityPartiesService {
  static async summary(userId: string): Promise<PartiesSummary> {
    const [active, past, account] = await Promise.all([
      PartyService.getActiveEvents(),
      PartyService.getPastEvents(PAST_LIMIT),
      UserService.getUserByDiscordId(userId),
    ]);
    const [activeCards, pastCards] = await Promise.all([toPartyCards(active, userId), toPartyCards(past, userId)]);

    return {
      live: activeCards.filter(p => p.status === 'started'),
      upcoming: activeCards.filter(p => p.status === 'pending'),
      past: pastCards,
      attendedCount: account?.stats?.partyParticipated ?? 0,
    };
  }

  /** La soirée en cours, sinon la prochaine : c'est elle que l'accueil met en avant. */
  static async next(userId: string): Promise<PartyCard | null> {
    const active = await PartyService.getActiveEvents();
    const next = active.find(e => e.status === 'started') ?? active[0];
    return next ? (await toPartyCards([next], userId))[0] : null;
  }

  static async imageUrl(partyId: string): Promise<string | null> {
    const event = await PartyService.getEventById(partyId);
    return event?.eventInfo.image ?? null;
  }
}
