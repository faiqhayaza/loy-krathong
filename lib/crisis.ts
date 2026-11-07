// The crisis rail, ported from the Rules block of the original site
// (Crisis.isCrisis: normalise / collapse, LATIN_TERMS, THAI_TERMS,
// COLLAPSED_TERMS). The detection terms are the original’s verbatim;
// the message shown is NOT the original’s — that one was written for
// Meta employees (Lyra EAP, internal links) and does not belong on a
// public site. This one points at public Thai help: the free
// mental-health hotline 1323 (24 hours) and emergency 1669 / 191.
//
// The check runs in the visitor’s own browser, on the worry and the
// wish they typed, at the moment the krathong floats. The text it is
// given is never logged, never sent, never stored — the worry never
// leaves the device, and the wish goes to the river exactly as usual.
// When it matches, the success panel shows this message instead of
// the poetic blessing. The wish still floats.

import type { Lang } from './data';

const CRISIS_TERMS: string[] = [
  "kill myself",
  "killing myself",
  "kill me",
  // Second-person form, added in the fix round (not in the original's
  // list, which has only first-person forms): unblocking 'kill
  // yourself' in the denylist must not leave it floating with a poem
  // instead of help — someone writing it is asking for the rail.
  "kill yourself",
  // "kys" shorthand (re-audit catch, 2026-11-06): same rail as
  // "kill yourself" — matched with word boundaries, no false positive.
  "kys",
  "end my life",
  "ending my life",
  "take my own life",
  "end it all",
  "want to die",
  "wanna die",
  "wish i was dead",
  "wish i were dead",
  "better off dead",
  "rather be dead",
  "suicide",
  "suicidal",
  "self harm",
  "self-harm",
  "selfharm",
  "hurt myself",
  "hurting myself",
  "harm myself",
  "cut myself",
  "cutting myself",
  "overdose",
  "no reason to live",
  "nothing to live for",
  "don't want to live",
  "dont want to live",
  "disappear forever",
  "abuse",
  "abused",
  "beaten",
  "assault",
  "abusive",
  "sexual assault",
  "sexually assaulted",
  "assaulted me",
  "raped",
  "rape",
  "molested",
  "domestic violence",
  "beats me",
  "beating me",
  "hits me",
  "hitting me",
  "threatened to kill",
  "stalking me",
  "stalked me",
  "ฆ่าตัวตาย",
  "อยากตาย",
  "ไม่อยากอยู่",
  "ไม่อยากมีชีวิตอยู่",
  "อยากหายไป",
  "จบชีวิต",
  "ทำร้ายตัวเอง",
  "ทำร้ายตนเอง",
  "กรีดข้อมือ",
  "กรีดแขน",
  "เชือดข้อมือ",
  "กินยาเกินขนาด",
  "ตายไปเลย",
  "อยู่ไปก็ไม่มีประโยชน์",
  "หมดกำลังใจจะอยู่",
  "ถูกข่มขืน",
  "ข่มขืน",
  "ถูกทำร้าย",
  "ถูกทุบตี",
  "ทุบตี",
  "ถูกล่วงละเมิด",
  "ล่วงละเมิดทางเพศ",
  "คุกคามทางเพศ",
  "ความรุนแรงในครอบครัว",
  "ขู่จะฆ่า",
  "ถูกคุกคาม"
];

/**
 * Lower-cases and strips the characters people use to slip past a
 * filter, so `s u i c i d e` and `s.u.i.c.i.d.e` match too. Thai is
 * left intact apart from the separator removal.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s._\-*|/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Same, but with every space removed, to catch `s u i c i d e`. */
function collapse(text: string): string {
  return normalise(text).replace(/ /g, '');
}

const THAI_CHARS = /[\u0E00-\u0E7F]/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The terms, pre-split by script and pre-compiled.
 *
 * Latin terms are matched on word boundaries, because substring
 * matching gives false positives that undermine the whole rail —
 * `rape` is in `grapes`, and showing a crisis message to someone who
 * wished for grapes teaches people the rail is noise. Thai terms stay
 * substring-matched: Thai is written without spaces, so there are no
 * word boundaries to anchor to.
 */
const LATIN_TERMS = CRISIS_TERMS.filter((term) => !THAI_CHARS.test(term)).map(
  (term) => new RegExp(`\\b${escapeRegExp(normalise(term))}\\b`),
);

const THAI_TERMS = CRISIS_TERMS.filter((term) => THAI_CHARS.test(term));

/**
 * Latin terms long enough to be matched against separator-stripped
 * text. Collapsing the text removes the boundaries, so this is
 * restricted to terms of six characters or more, where an accidental
 * substring hit is unlikely.
 */
const COLLAPSED_TERMS = CRISIS_TERMS.filter(
  (term) => !THAI_CHARS.test(term) && collapse(term).length >= 6,
).map((term) => collapse(term));

/** True when the text should route to the crisis rail. Never log the text it is given. */
export function isCrisis(...texts: (string | null | undefined)[]): boolean {
  for (const text of texts) {
    if (text == null || text === '') continue;
    const spaced = normalise(text);
    if (LATIN_TERMS.some((pattern) => pattern.test(spaced))) return true;
    if (THAI_TERMS.some((term) => spaced.includes(term))) return true;
    const collapsed = collapse(text);
    if (COLLAPSED_TERMS.some((term) => collapsed.includes(term))) return true;
  }
  return false;
}

/**
 * The message shown instead of the poetic blessing. Deliberately plain
 * and non-clinical: it does not diagnose, does not tell the person
 * what they are feeling, and does not promise anything. It names the
 * concrete things they can do next.
 */
export const CRISIS_MESSAGE: Record<Lang, { heading: string; body: string[] }> = {
  en: {
    heading: 'Thank you for writing that down.',
    body: [
      'What you shared sounds heavier than a river can carry, and you deserve a real person, not a poem.',
      'Please reach out to someone today — a person you trust, a friend, or family. You do not have to explain it well, and you do not have to have the words ready.',
      'Thailand’s free mental-health hotline is 1323, open 24 hours, every day. You can call and talk to someone who will listen.',
      'If you are in immediate danger, call emergency services now: 1669 for medical help, or 191 for the police in Thailand.',
      'Your wish has still been floated. You are not a burden for saying this out loud.',
    ],
  },
  th: {
    heading: 'ขอบคุณที่เขียนสิ่งนี้ออกมา',
    body: [
      'สิ่งที่คุณเล่าหนักเกินกว่าที่สายน้ำจะรับไหว และคุณควรได้คุยกับคนจริง ๆ ไม่ใช่บทกลอน',
      'กรุณาติดต่อใครสักคนวันนี้ — คนที่คุณไว้ใจ เพื่อน หรือครอบครัว ไม่ต้องอธิบายให้ดี และไม่ต้องเตรียมคำพูดไว้ก่อน',
      'สายด่วนสุขภาพจิต 1323 โทรฟรี เปิดตลอด 24 ชั่วโมงทุกวัน คุณสามารถโทรไปคุยกับคนที่จะรับฟังได้',
      'หากคุณกำลังตกอยู่ในอันตรายเฉพาะหน้า โทรหาหน่วยฉุกเฉินทันที 1669 สำหรับการแพทย์ หรือ 191 สำหรับตำรวจ',
      'กระทงของคุณถูกลอยไปแล้ว การพูดเรื่องนี้ออกมาไม่ได้ทำให้คุณเป็นภาระของใคร',
    ],
  },
};
