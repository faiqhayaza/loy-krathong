// Types for the server-side passport state (E1, `GET /api/state`).
//
// `me` is the requesting visitor's own state, keyed server-side by their
// recovery ID (`loy:visitor:<id>` in lib/store.ts). Nothing in `me` is
// ever shown to another visitor: api/state only ever returns the `me`
// for the ID in the request's `x-visitor-id` header, and the admin
// summary/backup never include raw visitor IDs (backup hashes them).
//
// Fields mirror the HTML shared mode's `data.me` / `data.community`
// (RESTORATION-PLAN §E1), extended with the rebuild's own systems:
// - `stamps` / `visits`: the passport (device-local `loy:stamps` /
//   `loy:visits` today) — migrated to the server by E1, so stamps
//   survive a device change once the visitor signs in with their ID.
// - `myWishes`: the visitor's own wishes (matched server-side by the
//   recovery ID stored on each wish at float time — never exposed to
//   other visitors; other visitors see the public river without it).
// - `claims`: mission claims `{day, slot, rl, at}` (A2 writes these;
//   E1 only stores and returns them).
// - `secrets`: found secret slugs (C1); `thanks`: the gratitude lantern
//   (B3); `sent`: blessing lanterns sent (B2); `received`: blessing
//   lanterns received, keyed by wish id (B2).
// - `krathong`: the visitor's saved krathong (C4 saves it here).

import type { FestivalEvent } from './events';
import type { Wish } from './data';
import type { FestivalConfig } from './config';

export interface VisitorClaim {
  day: string; // 'YYYY-MM-DD' Bangkok day the claim counts toward
  slot: string; // mission slot ('visit' | 'special' | 'kindness') or 'secret-<slug>'
  rl: number; // River Light earned
  at: number; // epoch ms the claim was made
}

export interface VisitorKrathong {
  flower: string;
  boat: string;
}

export interface VisitorThanks {
  card: number; // gratitude card id (1–6, B3)
  note: string; // short note, max 60 chars (B3)
  at: number;
}

export interface SentBlessing {
  wishId: string;
  message: number; // blessing template id (B2)
  at: number;
}

export interface ReceivedBlessing {
  message: number; // blessing template id (B2)
  from: string; // sender's nickname (display-only)
  at: number;
}

/** The server-side per-visitor document (`loy:visitor:<recovery-id>`). */
export interface VisitorState {
  krathong: VisitorKrathong | null;
  events: FestivalEvent[];
  claims: VisitorClaim[];
  stamps: string[]; // destination slugs
  visits: string[]; // destination slugs
  secrets: string[]; // found secret slugs
  thanks: VisitorThanks | null;
  sent: SentBlessing[];
  received: Record<string, ReceivedBlessing[]>; // wish id -> lanterns
}

export function emptyVisitorState(): VisitorState {
  return {
    krathong: null,
    events: [],
    claims: [],
    stamps: [],
    visits: [],
    secrets: [],
    thanks: null,
    sent: [],
    received: {},
  };
}

/** A wish as returned to a visitor: `hidden` wishes are flagged and their
 * text redacted (except the visitor's own — an owner sees their own wish
 * as under review, with its text). */
export type StateWish = Wish & { hidden: boolean };

export interface CommunityState {
  dayLight: Record<string, number>; // Bangkok day -> claimed River Light
  candles: number; // candles lit in the chain today (F1)
  gratitude: Record<string, number>; // gratitude card id -> lanterns today (B3)
  thanks: VisitorThanks[]; // thanks lanterns floating today (B3)
  sky: { id: string; message: number; to: string }[]; // blessing lanterns in the sky (B2)
  blessings: number; // blessing lanterns sent today (B2)
}

export function emptyCommunity(): CommunityState {
  return { dayLight: {}, candles: 0, gratitude: {}, thanks: [], sky: [], blessings: 0 };
}

export interface StatePayload {
  app: 'loy-krathong';
  today: string; // Bangkok day the server is using (config.simDay wins)
  serverNow: number; // epoch ms; client computes offset = serverNow - Date.now()
  config: FestivalConfig;
  wishes: StateWish[];
  me: VisitorState & { myWishes: StateWish[] };
  community: CommunityState;
  isAdmin: boolean; // a valid admin token was presented with this request
  kiosk: boolean; // config.kiosk, echoed for the client
  authorVisible: boolean; // organisers can see who floated each wish (== isAdmin)
}
