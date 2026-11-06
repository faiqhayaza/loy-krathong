// The blessing a floated krathong answers with, ported from the Rules
// block of the original site (templateBlessing, with THEMES, OPENINGS,
// CLOSINGS, GENERIC and WISH_LINE). It is composed here, in the
// visitor’s own browser, from the wish and the worry they typed: the
// worry is read only to pick the theme lines, and never leaves the
// device. The reply is in the language the visitor wrote in.

import type { Lang } from './data';

interface Theme { keywords: string[]; en: string; th: string }

const THEMES: Theme[] = [
  {
    "keywords": [
      "work",
      "job",
      "career",
      "boss",
      "deadline",
      "promo",
      "promotion",
      "perf",
      "burnout",
      "overwhelm",
      "busy",
      "workload",
      "shift",
      "queue",
      "target",
      "งาน",
      "หัวหน้า",
      "เหนื่อย",
      "ภาระ"
    ],
    "en": "Work has asked a great deal of you, and carrying it quietly is the heaviest part. Tonight the river takes that weight — you do not have to hold it past this moment.",
    "th": "งานเรียกร้องจากคุณไปมาก และการแบกมันไว้คนเดียวคือส่วนที่หนักที่สุด คืนนี้สายน้ำรับน้ำหนักนั้นไปแล้ว คุณไม่ต้องถือมันต่อ"
  },
  {
    "keywords": [
      "health",
      "sick",
      "illness",
      "pain",
      "tired",
      "sleep",
      "anxious",
      "anxiety",
      "stress",
      "body",
      "hospital",
      "สุขภาพ",
      "ป่วย",
      "เครียด",
      "นอน",
      "กังวล"
    ],
    "en": "A body or a mind that is unwell makes every other thing louder. May the coming days be gentler with you than the last ones were.",
    "th": "เมื่อร่างกายหรือใจไม่ไหว ทุกอย่างรอบตัวก็ดังขึ้น ขอให้วันข้างหน้าอ่อนโยนกับคุณมากกว่าวันที่ผ่านมา"
  },
  {
    "keywords": [
      "family",
      "mother",
      "father",
      "mom",
      "dad",
      "parent",
      "child",
      "kid",
      "son",
      "daughter",
      "home",
      "brother",
      "sister",
      "ครอบครัว",
      "แม่",
      "พ่อ",
      "ลูก",
      "บ้าน"
    ],
    "en": "The people we love are also the people we worry hardest about. That worry is love wearing a heavier coat.",
    "th": "คนที่เรารักคือคนที่เราห่วงที่สุด ความห่วงนั้นก็คือความรักที่สวมเสื้อหนาอีกชั้น"
  },
  {
    "keywords": [
      "money",
      "debt",
      "salary",
      "pay",
      "rent",
      "afford",
      "loan",
      "bill",
      "financial",
      "เงิน",
      "หนี้",
      "ค่าเช่า",
      "เงินเดือน"
    ],
    "en": "Counting and recounting what is not yet enough is exhausting work that no one sees. Set the ledger down for one night.",
    "th": "การนับแล้วนับอีกในสิ่งที่ยังไม่พอ เป็นงานที่เหนื่อยและไม่มีใครเห็น วางบัญชีนั้นลงสักคืนหนึ่ง"
  },
  {
    "keywords": [
      "love",
      "partner",
      "lonely",
      "alone",
      "heart",
      "breakup",
      "relationship",
      "marry",
      "รัก",
      "เหงา",
      "คนเดียว",
      "แฟน"
    ],
    "en": "The heart keeps its own calendar and will not be hurried. Let the water carry what you were not able to say.",
    "th": "หัวใจมีปฏิทินของตัวเองและเร่งไม่ได้ ให้สายน้ำพาสิ่งที่คุณพูดไม่ได้ไปเสีย"
  },
  {
    "keywords": [
      "future",
      "unknown",
      "change",
      "move",
      "decision",
      "exam",
      "study",
      "school",
      "visa",
      "contract",
      "renew",
      "อนาคต",
      "เปลี่ยน",
      "สอบ",
      "เรียน",
      "ตัดสินใจ"
    ],
    "en": "Not knowing what comes next is its own kind of tiredness. You have walked into unclear places before and still arrived.",
    "th": "การไม่รู้ว่าอะไรจะเกิดขึ้นต่อไปก็เป็นความเหนื่อยแบบหนึ่ง คุณเคยเดินเข้าไปในที่ที่ไม่ชัดเจนมาก่อน และคุณก็มาถึงได้"
  },
  {
    "keywords": [
      "loss",
      "lost",
      "grief",
      "miss",
      "passed",
      "died",
      "death",
      "goodbye",
      "สูญเสีย",
      "คิดถึง",
      "จาก"
    ],
    "en": "Some things are not let go of, only carried more kindly. Tonight the candle stands in for what cannot be said aloud.",
    "th": "บางสิ่งไม่ได้ถูกปล่อย เพียงถูกถือไว้อย่างอ่อนโยนขึ้น คืนนี้เทียนเล่มนี้ยืนแทนสิ่งที่พูดออกมาไม่ได้"
  },
  {
    "keywords": [
      "myself",
      "confidence",
      "enough",
      "fail",
      "failure",
      "mistake",
      "regret",
      "doubt",
      "compare",
      "ตัวเอง",
      "ไม่ดีพอ",
      "ผิดพลาด",
      "เสียใจ"
    ],
    "en": "You have been a harsher judge of yourself than anyone else would dare to be. Let the river hold that verdict instead.",
    "th": "คุณตัดสินตัวเองรุนแรงกว่าที่ใครจะกล้าทำ ให้สายน้ำรับคำตัดสินนั้นไปแทน"
  }
];

const OPENINGS: Record<Lang, string[]> = {
  "en": [
    "Tonight the water is still, and it is listening.",
    "The moon is full, and the river is patient.",
    "The candle is lit, and the current is ready."
  ],
  "th": [
    "คืนนี้สายน้ำสงบ และมันกำลังฟังอยู่",
    "พระจันทร์เต็มดวง และสายน้ำก็ใจเย็นพอ",
    "เทียนถูกจุดแล้ว และกระแสน้ำพร้อมแล้ว"
  ]
};

const CLOSINGS: Record<Lang, string[]> = {
  "en": [
    "May the next good thing arrive sooner than you expect.",
    "May this year be kinder to you than it has to be.",
    "Go gently. The river has your part of it now."
  ],
  "th": [
    "ขอให้สิ่งดี ๆ ครั้งต่อไปมาถึงเร็วกว่าที่คุณคาด",
    "ขอให้ปีนี้ใจดีกับคุณมากกว่าที่จำเป็น",
    "ไปอย่างเบา ๆ สายน้ำรับส่วนของคุณไว้แล้ว"
  ]
};

const GENERIC: Record<Lang, string> = {
  "en": "Whatever you set on the water tonight, you no longer have to hold alone.",
  "th": "ไม่ว่าคุณวางอะไรไว้บนสายน้ำคืนนี้ คุณไม่ต้องถือมันไว้คนเดียวอีกแล้ว"
};

const WISH_LINE: Record<Lang, string> = {
  "en": "And the wish you floated — may it find you, in a form you can recognise.",
  "th": "และคำอธิษฐานที่คุณลอยไป ขอให้มันมาถึงคุณ ในรูปแบบที่คุณจะจำได้"
};

function pick(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)];
}

/** Thai script anywhere in the text means the reply is in Thai. */
export function replyLanguage(worry: string, wish: string, lang: Lang): Lang {
  return /[\u0E00-\u0E7F]/.test(`${worry} ${wish}`) ? 'th' : lang;
}

/**
 * One blessing, built from an opening, up to two theme lines matched
 * against the worry and wish (or a generic line when nothing matches),
 * the wish line, and a closing. Pure function of its inputs; the worry
 * it is given never leaves this browser.
 */
export function templateBlessing({ lang, worry, wish }: { lang: Lang; worry: string; wish: string }): string {
  const text = `${worry} ${wish}`.toLowerCase();
  const themeLines = THEMES.filter((theme) =>
    theme.keywords.some((keyword) => text.includes(keyword)),
  )
    .slice(0, 2)
    .map((theme) => theme[lang]);
  const parts = [
    pick(OPENINGS[lang]),
    ...(themeLines.length > 0 ? themeLines : [GENERIC[lang]]),
  ];
  if (wish.trim() !== '') {
    parts.push(WISH_LINE[lang]);
  }
  parts.push(pick(CLOSINGS[lang]));
  return `${parts.join(' ')} 🪷`;
}
