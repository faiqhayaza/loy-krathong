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
  /** The other-language text, only on the eight seed wishes. */
  translation?: string;
  /** True for the eight opening wishes that ship with the river. */
  isSeed?: boolean;
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
  { id: 'gold', color: '#ffb347', label: { en: 'Gold', th: 'ทอง' } },
  { id: 'rose', color: '#ff7a9e', label: { en: 'Rose', th: 'ชมพู' } },
  { id: 'violet', color: '#b18cff', label: { en: 'Violet', th: 'ม่วง' } },
  { id: 'teal', color: '#4dd0c4', label: { en: 'Teal', th: 'เขียวน้ำทะเล' } },
  { id: 'blue', color: '#6aa9ff', label: { en: 'Blue', th: 'น้ำเงิน' } },
  { id: 'white', color: '#fff3c4', label: { en: 'White', th: 'ขาว' } },
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
 * Small blocklist for the public river: common English and Thai slurs and
 * profanity, plus the blocked-emoji set. This is a first pass, not a
 * guarantee — the admin delete route exists for anything it misses.
 */
const BLOCKED_WORDS = [
  // English
  'fuck', 'shit', 'bitch', 'bastard', 'cunt', 'dick', 'pussy', 'whore', 'slut',
  'damn you', 'kill yourself', 'kys',
  // Thai (common profanity / insults)
  'เหี้ย', 'ควย', 'หี', 'สัส', 'ไอ้เหี้ย', 'ไอ้สัส', 'มึง', 'กู', 'เย็ด', 'จัญไร',
  'ชิบหาย', 'ตายห่า',
];

export function containsBlocked(text: string): boolean {
  const lower = text.toLowerCase();
  if (BLOCKED_WORDS.some((w) => lower.includes(w))) return true;
  for (const e of BLOCKED_EMOJI) {
    if (text.includes(e)) return true;
  }
  return false;
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
