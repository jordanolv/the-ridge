import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import type { BotClient } from '../../../bot/client';
import { BotEventBus } from '../../../shared/events/bot-event-bus';
import { EXPEDITION_TIER_CONFIG, RARITY_CONFIG } from '../../peak-hunters/constants/peak-hunters.constants';
import type { PackOpenedEvent } from '../../peak-hunters/types/peak-hunters.types';
import { REACTIONS, type ActivityUser, type FeedEntry, type LiveClientMessage, type LiveServerMessage, type PackShow } from '../activity.types';
import { showEnd } from '../pack-show.timeline';
import { ActivityAuthService } from './activity-auth.service';
import { hexColor } from './hex-color';

export const LIVE_PATH = '/api/activity/live';

const JOIN_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;
const REACTION_COOLDOWN_MS = 250;
/** Laisse le temps à tous les écrans de recevoir l'ouverture avant qu'elle commence. */
const SHOW_LEAD_MS = 700;
const FEED_SIZE = 15;
const RARITY_RANK = ['common', 'rare', 'epic', 'legendary'];

interface Member {
  ws: WebSocket;
  user: ActivityUser;
  alive: boolean;
  lastReactionAt: number;
}

interface Room {
  members: Set<Member>;
  shows: PackShow[];
}

/** Une salle par Activity lancée (`instanceId` du SDK) : les joueurs d'un même salon vocal. */
const rooms = new Map<string, Room>();
const feed: FeedEntry[] = [];

const send = (ws: WebSocket, message: LiveServerMessage) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
};

function broadcast(room: Room, message: LiveServerMessage): void {
  for (const member of room.members) send(member.ws, message);
}

function participants(room: Room): ActivityUser[] {
  const byId = new Map<string, ActivityUser>();
  for (const member of room.members) byId.set(member.user.id, member.user);
  return [...byId.values()];
}

function pendingShows(room: Room): PackShow[] {
  const now = Date.now();
  room.shows = room.shows.filter(show => showEnd(show) > now);
  return room.shows;
}

/** Les ouvertures d'une salle passent l'une après l'autre : chacune commence à la fin de la précédente. */
function reschedule(room: Room): void {
  let cursor = Date.now() + SHOW_LEAD_MS;
  for (const show of pendingShows(room)) {
    if (show.startsAt > Date.now()) show.startsAt = Math.max(cursor, Date.now() + SHOW_LEAD_MS);
    cursor = showEnd(show);
  }
}

function parse(data: RawData): LiveClientMessage | null {
  try {
    return JSON.parse(data.toString()) as LiveClientMessage;
  } catch {
    return null;
  }
}

function handleMessage(room: Room, member: Member, message: LiveClientMessage): void {
  if (message.type === 'react' && REACTIONS.includes(message.emoji)) {
    const now = Date.now();
    if (now - member.lastReactionAt < REACTION_COOLDOWN_MS) return;
    member.lastReactionAt = now;
    broadcast(room, { type: 'reaction', reaction: { id: randomUUID(), user: member.user, emoji: message.emoji } });
    return;
  }

  if (message.type === 'skip') {
    const now = Date.now();
    const show = pendingShows(room).find(s => s.id === message.showId);
    if (!show || show.opener.id !== member.user.id || show.skippedAt !== null || show.startsAt > now) return;
    show.skippedAt = now;
    reschedule(room);
    broadcast(room, { type: 'shows', shows: room.shows });
  }
}

function join(ws: WebSocket, user: ActivityUser, instanceId: string): void {
  const room = rooms.get(instanceId) ?? { members: new Set(), shows: [] };
  rooms.set(instanceId, room);

  const member: Member = { ws, user, alive: true, lastReactionAt: 0 };
  room.members.add(member);
  send(ws, { type: 'welcome', serverNow: Date.now(), participants: participants(room), shows: pendingShows(room), feed });
  broadcast(room, { type: 'participants', participants: participants(room) });

  ws.on('pong', () => (member.alive = true));
  ws.on('message', data => {
    const message = parse(data);
    if (message) handleMessage(room, member, message);
  });
  ws.on('close', () => {
    room.members.delete(member);
    if (room.members.size === 0) rooms.delete(instanceId);
    else broadcast(room, { type: 'participants', participants: participants(room) });
  });
}

/** Le premier message porte le jeton Discord : un navigateur ne peut pas ajouter d'en-tête à un WebSocket. */
function accept(ws: WebSocket): void {
  const timeout = setTimeout(() => ws.close(4001, 'join attendu'), JOIN_TIMEOUT_MS);

  ws.once('message', async data => {
    clearTimeout(timeout);
    const message = parse(data);
    if (message?.type !== 'join' || typeof message.instanceId !== 'string') return ws.close(4001, 'join attendu');

    const user = await ActivityAuthService.identify(message.token).catch(() => null);
    if (!user) return ws.close(4003, 'session invalide');
    join(ws, user, message.instanceId);
  });
}

async function toFeedEntry(client: BotClient, event: PackOpenedEvent): Promise<FeedEntry> {
  const discordUser = await client.users.fetch(event.userId).catch(() => null);
  const best = event.cards.reduce((a, b) => (RARITY_RANK.indexOf(b.rarity) > RARITY_RANK.indexOf(a.rarity) ? b : a));
  return {
    id: randomUUID(),
    at: Date.now(),
    user: {
      id: event.userId,
      username: discordUser?.username ?? 'inconnu',
      displayName: discordUser?.globalName ?? discordUser?.username ?? 'Un grimpeur',
    },
    tierLabel: EXPEDITION_TIER_CONFIG[event.tier].label,
    tierColor: hexColor(EXPEDITION_TIER_CONFIG[event.tier].color),
    best: { label: best.mountain.mountainLabel, rarityLabel: RARITY_CONFIG[best.rarity].label, color: hexColor(RARITY_CONFIG[best.rarity].color) },
    fresh: event.cards.filter(card => !card.isDuplicate).length,
    cards: event.cards.length,
  };
}

export class ActivityLiveService {
  static attach(server: Server, client: BotClient): void {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      if (new URL(request.url ?? '/', 'http://localhost').pathname !== LIVE_PATH) return socket.destroy();
      wss.handleUpgrade(request, socket, head, accept);
    });

    setInterval(() => {
      for (const room of rooms.values()) {
        for (const member of room.members) {
          if (!member.alive) member.ws.terminate();
          member.alive = false;
          member.ws.ping();
        }
      }
    }, HEARTBEAT_MS).unref();

    BotEventBus.on('peak-hunters:pack:opened', async event => {
      const entry = await toFeedEntry(client, event);
      feed.unshift(entry);
      feed.length = Math.min(feed.length, FEED_SIZE);
      for (const room of rooms.values()) broadcast(room, { type: 'feed', entry });
    });
  }

  /**
   * Place l'ouverture dans la file de la salle et la diffuse. Hors salle (joueur pas connecté
   * au direct), elle part tout de suite et seul l'ouvreur la verra.
   */
  static schedule(instanceId: string | null, show: Omit<PackShow, 'startsAt'>): PackShow {
    const room = instanceId ? rooms.get(instanceId) : undefined;
    const inRoom = room && [...room.members].some(member => member.user.id === show.opener.id);
    if (!room || !inRoom) return { ...show, startsAt: Date.now() + SHOW_LEAD_MS };

    const queue = pendingShows(room);
    const previousEnd = queue.length > 0 ? showEnd(queue[queue.length - 1]) : 0;
    const scheduled: PackShow = { ...show, startsAt: Math.max(Date.now() + SHOW_LEAD_MS, previousEnd) };
    room.shows.push(scheduled);
    broadcast(room, { type: 'shows', shows: room.shows });
    return scheduled;
  }
}
