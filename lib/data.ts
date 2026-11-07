// Shared content for Seven Nights of Wishes — ported from the original
// single-file site (loy-krathong-seven-nights__1.html) and kept as plain data
// so copy stays an easy edit. Every user-visible string lives in lib/i18n.ts.

export type Lang = 'en' | 'th';
export type ReactionId = 'sathu' | 'love' | 'hug' | 'care' | 'peace';

export interface ReactionCounts {
  sathu: number;
  love: number;
  hug: number;
  care: number;
  peace: number;
}

export interface Wish {
  id: string;
  name: string;
  wish: string;
  flower: string;
  boat: string;
  flame: string;
  lang: Lang;
  createdAt: number;
  reactions: ReactionCounts;
  /** Blessing lanterns sent to this wish (chunk B; merged at read time, like reactions). */
  blessings?: number;
  /** The other-language text, only on the eight seed wishes. */
  translation?: string;
  /** True for the eight opening wishes that ship with the river. */
  isSeed?: boolean;
  /**
   * Moderation status (E5/F2): 'approved' (on the river), 'reported'
   * (hidden after reports — REPORT_THRESHOLD in lib/store.ts), 'hidden'
   * (hidden by an organiser). Absent means approved.
   */
  status?: 'approved' | 'reported' | 'hidden';
  /** How many visitors reported this wish (F2). */
  reports?: number;
  /**
   * Server-only: the recovery ID of the visitor who floated it (E1 —
   * keys My wishes matching and the "people floated" count). It is
   * stored with the wish but NEVER sent to any client: listWishes and
   * listStoredWishes strip it, and api/state only uses it to match the
   * requesting visitor's own wishes.
   */
  visitorId?: string;
}

export const MAX_WISH_CHARS = 280;
export const MAX_WORRY_CHARS = 1000;
export const MAX_NAME_CHARS = 40;

export const EMPTY_REACTIONS: ReactionCounts = {
  sathu: 0,
  love: 0,
  hug: 0,
  care: 0,
  peace: 0,
};

export interface Flower {
  id: string;
  glyph: string;
  label: { en: string; th: string };
}

export const FLOWERS: Flower[] = [
  { id: 'lotus', glyph: '🪷', label: { en: 'Lotus', th: 'ดอกบัว' } },
  { id: 'cherry_blossom', glyph: '🌸', label: { en: 'Cherry blossom', th: 'ซากุระ' } },
  { id: 'hibiscus', glyph: '🌺', label: { en: 'Hibiscus', th: 'ชบา' } },
  { id: 'rosette', glyph: '🏵️', label: { en: 'Rosette', th: 'พุดตาน' } },
  { id: 'blossom', glyph: '🌼', label: { en: 'Blossom', th: 'ดอกไม้' } },
  { id: 'marigold', glyph: '🌻', label: { en: 'Marigold', th: 'ดาวเรือง' } },
  { id: 'bouquet', glyph: '💐', label: { en: 'Bouquet', th: 'ช่อดอกไม้' } },
  { id: 'tulip', glyph: '🌷', label: { en: 'Tulip', th: 'ทิวลิป' } },
  { id: 'rose', glyph: '🌹', label: { en: 'Rose', th: 'กุหลาบ' } },
  { id: 'hyacinth', glyph: '🪻', label: { en: 'Hyacinth', th: 'ไฮยาซินท์' } },
  { id: 'white_flower', glyph: '💮', label: { en: 'White flower', th: 'ดอกไม้ขาว' } },
  { id: 'elephant', glyph: '🐘', label: { en: 'Elephant', th: 'ช้าง' } },
  { id: 'moon', glyph: '🌕', label: { en: 'Full moon', th: 'พระจันทร์เต็มดวง' } },
  { id: 'star', glyph: '🌟', label: { en: 'Star', th: 'ดาว' } },
  { id: 'heart', glyph: '💖', label: { en: 'Heart', th: 'หัวใจ' } },
];
export const DEFAULT_FLOWER = 'lotus';

export interface Boat {
  id: string;
  colors: [string, string];
  label: { en: string; th: string };
}

export const BOATS: Boat[] = [
  { id: 'leaf', colors: ['#5c9a45', '#2e5a25'], label: { en: 'Banana leaf', th: 'ใบตอง' } },
  { id: 'lotus_pink', colors: ['#f29cc0', '#b8487a'], label: { en: 'Lotus pink', th: 'ชมพูบัว' } },
  { id: 'gold', colors: ['#f6d36b', '#b8862b'], label: { en: 'Yellow gold', th: 'เหลืองทอง' } },
  { id: 'orange', colors: ['#f8a65b', '#c2611f'], label: { en: 'Orange', th: 'ส้ม' } },
  { id: 'purple', colors: ['#a98ad8', '#5e3c99'], label: { en: 'Royal purple', th: 'ม่วง' } },
  { id: 'sky', colors: ['#7cc4f0', '#2f6fa8'], label: { en: 'Sky blue', th: 'ฟ้า' } },
  { id: 'red', colors: ['#f07a6a', '#a8302a'], label: { en: 'Festival red', th: 'แดง' } },
];
export const DEFAULT_BOAT = 'leaf';

export interface Flame {
  id: string;
  color: string;
  label: { en: string; th: string };
}

export const FLAMES: Flame[] = [
  // The original site's seven flames, hexes and labels verbatim —
  // the rebuild had six and was missing ruby red.
  { id: 'gold', color: '#ffc36b', label: { en: 'Candle gold', th: 'ทองเทียน' } },
  { id: 'rose', color: '#ff6fa8', label: { en: 'Lotus pink', th: 'ชมพูบัว' } },
  { id: 'violet', color: '#b48cff', label: { en: 'Moonlight violet', th: 'ม่วงแสงจันทร์' } },
  { id: 'teal', color: '#5ee0a0', label: { en: 'Jade green', th: 'เขียวหยก' } },
  { id: 'blue', color: '#5ec8ff', label: { en: 'River blue', th: 'ฟ้าสายน้ำ' } },
  { id: 'ruby', color: '#ff5a4a', label: { en: 'Ruby red', th: 'แดงทับทิม' } },
  { id: 'white', color: '#f4f7ff', label: { en: 'Moon white', th: 'ขาวจันทรา' } },
];
export const DEFAULT_FLAME = 'gold';

export const REACTIONS: { id: ReactionId; glyph: string; label: { en: string; th: string } }[] = [
  { id: 'sathu', glyph: '🙏', label: { en: 'Sathu', th: 'สาธุ' } },
  { id: 'love', glyph: '❤️', label: { en: 'Love', th: 'รัก' } },
  { id: 'hug', glyph: '🤗', label: { en: 'Hug', th: 'กอด' } },
  { id: 'care', glyph: '🫶', label: { en: 'Care', th: 'ห่วงใย' } },
  { id: 'peace', glyph: '🕊️', label: { en: 'Peace', th: 'สงบสุข' } },
];

/** Emoji nobody can put on a krathong of their own. */
export const BLOCKED_EMOJI = new Set([
  '🖕', '🍆', '🍑', '💦', '💩', '🔫', '🔪', '🗡', '💣', '🧨', '☠', '💀', '🩸',
  '💊', '💉', '🚬', '🔞', '🤬', '🍺', '🍻', '🥃', '🍷', '🍸', '🍾', '🥂', '🍹',
  '👅',
]);

/**
 * The deterministic word list that screens a wish (and the name shown
 * with it) before it can reach the public river — ported verbatim from
 * the original single-file site (DenyList in
 * loy-krathong-seven-nights__1.html): the 66 terms and the layered
 * matcher alike. Pure, with no server imports, so the float form can
 * warn as someone types and the server can enforce the same list on
 * submit.
 *
 * Deliberately NOT in this list, although the rebuild's first list had
 * them: 'kill yourself', 'kys' and 'damn you'. The original never
 * blocked them, and blocking them rejected a suicidal user's wish
 * outright instead of letting it float with the crisis message
 * (hotline 1323) — which is the original's design.
 */
const DENY_TERMS = [
  // English profanity / sexual content
  'fuck',
  'shit',
  'cunt',
  'bitch',
  'whore',
  'slut',
  'dick',
  'cock',
  'pussy',
  'rape',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'kike',
  'chink',
  'tranny',
  'asshole',
  'arsehole',
  'bastard',
  'wanker',
  'twat',
  'bollocks',
  'dickhead',
  'douchebag',
  'jackass',
  'dumbass',
  'wtf',
  'stfu',
  'fck',
  'fuk',
  'phuck',
  'biatch',
  'piss',
  // Thai profanity written in Latin letters
  'kuay',
  'kuy',
  // Thai profanity / insults
  'ควย', // vulgar
  'หี', // vulgar
  'เย็ด', // vulgar
  'สัส',
  'สัตว์เดรัจฉาน',
  'ไอ้สัส',
  'เหี้ย',
  'ชิบหาย',
  'กะหรี่',
  'ดอกทอง',
  'แม่ง',
  'ไอ้เวร',
  'มึง',
  'ไอ้ควาย',
  'ระยำ',
  'จัญไร',
  'ส้นตีน',
  'ชาติหมา',
  'อีดอก',
  'ฉิบหาย',
  'เชี่ย',
  'เชี้ย',
  'สถุน',
  'ไอ้สัตว์',
  'อีสัตว์',
  'ไอ้เลว',
  'อีเลว',
  'ตอแหล',
  'ร่าน',
  'กระหรี่',
];

/**
 * Collapses separators to a single space rather than deleting them, so
 * word boundaries survive for the Latin matcher below.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s._\-*|/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const THAI_CHARS = /[\u0E00-\u0E7F]/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Latin deny terms are matched on word boundaries, for the same reason
 * the crisis list is: `rape` is a deny term and it is inside `grapes`,
 * so a substring match would reject "I wish for a grape harvest" and
 * tell the person to reword a perfectly good wish. Thai terms stay
 * substring-matched because Thai is written without spaces.
 */
const LATIN_DENY = DENY_TERMS.filter((term) => !THAI_CHARS.test(term)).map(
  (term) => new RegExp(`\\b${escapeRegExp(normalise(term))}\\b`),
);

const THAI_DENY = DENY_TERMS.filter((term) => THAI_CHARS.test(term)).map((term) =>
  normalise(term),
);

/**
 * Terms that must NOT be matched against separator-stripped text,
 * because they appear inside ordinary words once the spaces are gone:
 *   rape -> g·rape·s        dick -> Dick·son        cock -> cock·pit
 * Everything else is safe to collapse-match, which is what catches
 * `f u c k` and `f.u.c.k`.
 *
 * Keep this list in mind when adding a short term to DENY_TERMS: if
 * the letters could fall inside a real word, add it here too.
 */
const NOT_COLLAPSE_SAFE = new Set([
  'rape',
  'dick',
  'cock',
  'kike',
  'chink',
  'asshole', // glass hole
  'fuk', // Fukuoka
  'piss', // Mississippi
  'twat',
  'wtf',
  'kuy',
  'kuay',
]);

/**
 * Number and symbol look-alikes, undone before the separator-stripped
 * match so `sh1t`, `fvck` and `$h!t` are caught too. Only that match
 * uses them: a number in an ordinary wish never becomes a word on its own.
 */
const LOOKALIKES: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  $: 's',
  '7': 't',
  '+': 't',
  v: 'u',
};

/**
 * Ordinary Thai words that contain a deny term, removed before the Thai
 * match: `หีบ` (a chest, a box) contains `หี`.
 */
const THAI_BENIGN = ['หีบ'];

const COLLAPSED_DENY = DENY_TERMS.filter(
  (term) => !THAI_CHARS.test(term) && !NOT_COLLAPSE_SAFE.has(term),
).map((term) => normalise(term).replace(/ /g, ''));

/** Layer 1. True when the text must be rejected outright. */
export function containsBlocked(text: string): boolean {
  const normalised = normalise(text);
  if (LATIN_DENY.some((pattern) => pattern.test(normalised))) return true;
  const thai = THAI_BENIGN.reduce(
    (out, word) => out.split(word).join(' '),
    normalised,
  );
  if (THAI_DENY.some((term) => thai.includes(term))) return true;
  const collapsed = normalised.replace(/ /g, '');
  if (COLLAPSED_DENY.some((term) => collapsed.includes(term))) return true;
  const unmasked = collapsed.replace(/[0-9!@$+v]/g, (c) => LOOKALIKES[c] ?? c);
  return COLLAPSED_DENY.some((term) => unmasked.includes(term));
}

export function isKnownFlower(id: string): boolean {
  return FLOWERS.some((f) => f.id === id);
}
export function isKnownBoat(id: string): boolean {
  return BOATS.some((b) => b.id === id);
}
export function isKnownFlame(id: string): boolean {
  return FLAMES.some((f) => f.id === id);
}
export function isKnownReaction(id: string): id is ReactionId {
  return REACTIONS.some((r) => r.id === id);
}

/**
 * One picture emoji that is allowed on a krathong (Rules: isAllowedCustomEmoji
 * in the original site). Exactly one grapheme, pictographic, no letters or
 * numbers, and not on the blocked list.
 */
export function isAllowedCustomEmoji(value: string): boolean {
  const text = value.trim();
  if (text === '' || text.length > 16) return false;
  let graphemes: number;
  try {
    graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;
  } catch {
    graphemes = Array.from(text).length;
  }
  if (graphemes !== 1) return false;
  if (!/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(text)) return false;
  if (/[\p{L}\p{N}]/u.test(text)) return false;
  const base = text
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')
    .split('\uFE0F')
    .join('');
  return !BLOCKED_EMOJI.has(base);
}

export function flowerGlyph(id: string): string {
  const flower = FLOWERS.find((f) => f.id === id);
  if (flower) return flower.glyph;
  return isAllowedCustomEmoji(id) ? id.trim() : '🪷';
}
export function boatColors(id: string): [string, string] {
  return BOATS.find((b) => b.id === id)?.colors ?? BOATS[0].colors;
}
export function flameColor(id: string): string {
  return FLAMES.find((f) => f.id === id)?.color ?? '#ffb347';
}

// The seven destinations live in lib/destinations.ts, ported verbatim from
// the original site. They are re-exported here so existing imports keep
// working.
export { DESTINATIONS, SPECIAL_ICON, STAMP_ICON } from './destinations';
export type { Destination } from './destinations';
