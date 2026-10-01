import { useSyncExternalStore } from 'react';
import type { ActivityUser, FeedEntry, LiveClientMessage, LiveReaction, LiveServerMessage, PackShow, ReactionEmoji } from '../../../src/features/activity/activity.types';
import { showEnd } from '../../../src/features/activity/pack-show.timeline';
import { SAMPLE_FEED } from './sample';
import type { Session } from './session';

export interface LiveState {
  status: 'preview' | 'connecting' | 'online' | 'offline';
  participants: ActivityUser[];
  shows: PackShow[];
  feed: FeedEntry[];
  reactions: LiveReaction[];
}

const REACTION_LIFETIME_MS = 2600;
const MAX_RECONNECT_DELAY_MS = 15_000;

let state: LiveState = { status: 'connecting', participants: [], shows: [], feed: [], reactions: [] };
const listeners = new Set<() => void>();
/** Écart entre l'horloge du serveur et la nôtre : toutes les ouvertures se calent sur le serveur. */
let clockOffset = 0;
let socket: WebSocket | null = null;
let me: ActivityUser | null = null;

function update(patch: Partial<LiveState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export const serverNow = () => Date.now() + clockOffset;

const byStart = (shows: PackShow[]) => shows.filter(show => showEnd(show) > serverNow()).sort((a, b) => a.startsAt - b.startsAt);

/** Garde une ouverture reçue par l'API même si le direct est coupé ; le serveur reste la référence. */
export function addShow(show: PackShow): void {
  if (state.shows.some(s => s.id === show.id)) return;
  update({ shows: byStart([...state.shows, show]) });
}

function addReaction(reaction: LiveReaction): void {
  update({ reactions: [...state.reactions.slice(-30), reaction] });
  setTimeout(() => update({ reactions: state.reactions.filter(r => r.id !== reaction.id) }), REACTION_LIFETIME_MS);
}

function receive(message: LiveServerMessage): void {
  switch (message.type) {
    case 'welcome':
      clockOffset = message.serverNow - Date.now();
      update({ status: 'online', participants: message.participants, shows: byStart(message.shows), feed: message.feed });
      break;
    case 'participants':
      update({ participants: message.participants });
      break;
    case 'shows': {
      const local = state.shows.filter(show => !message.shows.some(s => s.id === show.id) && show.opener.id === me?.id && show.skippedAt === null);
      update({ shows: byStart([...message.shows, ...local]) });
      break;
    }
    case 'reaction':
      addReaction(message.reaction);
      break;
    case 'feed':
      update({ feed: [message.entry, ...state.feed.filter(e => e.id !== message.entry.id)].slice(0, 15) });
      break;
  }
}

function send(message: LiveClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function react(emoji: ReactionEmoji): void {
  if (state.status === 'preview' && me) addReaction({ id: crypto.randomUUID(), user: me, emoji });
  else send({ type: 'react', emoji });
}

export function skip(show: PackShow): void {
  if (state.status === 'preview') {
    update({ shows: state.shows.map(s => (s.id === show.id ? { ...s, skippedAt: serverNow() } : s)) });
    return;
  }
  send({ type: 'skip', showId: show.id });
}

export function startLive(session: Session, user: ActivityUser): () => void {
  me = user;
  if (session.mode === 'preview') {
    update({ status: 'preview', participants: [user], feed: SAMPLE_FEED });
    return () => undefined;
  }

  let stopped = false;
  let attempt = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    update({ status: 'connecting' });
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/activity/live`);
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      ws.send(JSON.stringify({ type: 'join', token: session.accessToken, instanceId: session.instanceId } satisfies LiveClientMessage));
    };
    ws.onmessage = event => receive(JSON.parse(event.data as string) as LiveServerMessage);
    ws.onclose = () => {
      if (stopped) return;
      update({ status: 'offline' });
      retry = setTimeout(open, Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** attempt++));
    };
  };

  open();
  return () => {
    stopped = true;
    clearTimeout(retry);
    socket?.close();
    socket = null;
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useLive = () => useSyncExternalStore(subscribe, () => state);
