// Every user-visible string, in both languages. Copy stays a plain-data
// edit; nothing user-facing is hard-coded in a component.

import type { Lang } from './data';

export const STRINGS = {
  en: {
    festivalName: 'Seven Nights of Wishes',
    tagline: 'One krathong. Seven destinations. A river of wishes.',
    festivalDate: 'Loy Krathong · Tuesday 24 November 2026 · Bangkok',
    countdownLabel: 'until the full moon rises',
    countdownDays: 'days',
    countdownHours: 'hrs',
    countdownMins: 'min',
    countdownSecs: 'sec',
    countdownTonight: 'Tonight — the full moon is here',
    navRiver: 'River',
    navFloat: 'Float a krathong',
    navWishes: 'Wishes',
    heroIntro:
      'For seven nights, one river carries every wish we float. Make a krathong, write what you hope for, and set it on the water with everyone else’s.',
    heroCta: 'Float my krathong',
    heroSeeRiver: 'See the river',
    destinationsTitle: 'Seven nights, seven rivers',
    destinationsHint:
      'Each destination opens on its night, 18–24 November. Visit one to collect its stamp — it stays on this device, just a keepsake of the journey.',
    stamped: 'Stamped',
    stampCollect: 'Collect stamp',
    destNight: (n: number) => `Night ${n}`,
    destVisit: 'Visit',
    destVisited: 'Visited — collect your stamp',
    destOpens: (date: string) => `Opens ${date}`,
    destLocked: 'Not open yet',
    passportComplete: 'All seven stamps — your journey is complete.',
    riverTitle: 'The river tonight',
    riverHint: 'Hover over a krathong to read its wish. Tap one to send a reaction.',
    riverEmpty: 'The river is quiet. Be the first to float a krathong.',
    riverCount: (n: number) => (n === 1 ? '1 krathong floating tonight' : `${n} krathongs floating tonight`),
    newWishes: (n: number) => `${n} new ${n === 1 ? 'wish' : 'wishes'} floated — refresh the river`,
    refreshRiver: 'Refresh',
    builderTitle: 'Float my krathong',
    builderIntro: 'Your krathong joins the river for everyone to see.',
    nameLabel: 'Your nickname (optional)',
    namePlaceholder: 'e.g. Ploy, Nong Bee',
    wishLabel: 'A wish I’m floating tonight',
    wishPlaceholder: 'A hope for the year ahead…',
    wishHint: 'Shown on the river, with your nickname if you add one.',
    worryLabel: 'A worry I’m letting go',
    worryHint: 'Private — never shown, never stored. Only used on your device to write your blessing, then discarded.',
    worryPlaceholder: 'Something that has been sitting heavily with you…',
    flowerLabel: 'Choose your flower',
    flowerCustomLabel: 'Or one emoji of your own',
    flowerCustomPlaceholder: '😀',
    flowerCustomHint: 'A single emoji becomes your krathong flower.',
    boatLabel: 'Choose your boat colour',
    flameLabel: 'Choose your flame',
    submit: 'Float my krathong',
    submitting: 'Floating…',
    floatedTitle: 'Your krathong is on the water',
    keepsake: 'Save my krathong card',
    keepsakeSaved: 'Saved to your downloads.',
    errorNeedWish: 'Write a wish first.',
    errorGeneric: 'Something went wrong on our side. Your krathong was not floated — please try again.',
    errorRejected: 'That wish or name cannot go on the public river. Please reword it and try again.',
    errorRateLimited: 'You have floated a few krathongs already. Give the river a moment and try again shortly.',
    errorDaily: 'You already floated today — come back tomorrow for your next stamp.',
    alreadyFloatedTitle: 'Your krathong is already on the water today',
    alreadyFloatedBody: 'You already floated today — come back tomorrow for your next stamp.',
    dailyStampsTitle: 'Your daily stamps',
    dailyStampsHint: 'Float one krathong a day to collect all 10.',
    dailyStampEarned: (date: string) => `Stamped ${date}`,
    allStampsTitle: 'All ten stamps — the river celebrates you!',
    allStampsBody: 'Ten days of wishes, ten stamps. Thank you for keeping the river lit.',
    badWordWarning: 'This has a word that cannot go on the river. Please reword it before floating.',
    wallTitle: 'Wishes floating on the river',
    searchLabel: 'Search wishes',
    searchPlaceholder: 'Search by a friend’s name or a word',
    searchEmpty: (q: string) => `No krathong matches “${q}”.`,
    anonymous: 'Someone in Bangkok',
    reactionsLabel: 'React to this wish',
    showOriginal: 'Show original',
    showTranslation: 'Show translation',
    translatedNote: 'Translation',
    justNow: 'just now',
    minutesAgo: (n: number) => `${n}m ago`,
    hoursAgo: (n: number) => `${n}h ago`,
    daysAgo: (n: number) => `${n}d ago`,
    close: 'Close',
    yourKrathong: 'Your krathong',
    readWish: 'Read this wish',
  },
  th: {
    festivalName: 'เจ็ดค่ำคืนแห่งคำอธิษฐาน',
    tagline: 'หนึ่งกระทง เจ็ดจุดหมาย หนึ่งสายน้ำแห่งคำอธิษฐาน',
    festivalDate: 'วันลอยกระทง · วันอังคารที่ 24 พฤศจิกายน 2569 · กรุงเทพฯ',
    countdownLabel: 'จนถึงคืนพระจันทร์เต็มดวง',
    countdownDays: 'วัน',
    countdownHours: 'ชม.',
    countdownMins: 'นาที',
    countdownSecs: 'วินาที',
    countdownTonight: 'คืนนี้ — พระจันทร์เต็มดวงมาถึงแล้ว',
    navRiver: 'สายน้ำ',
    navFloat: 'ลอยกระทง',
    navWishes: 'คำอธิษฐาน',
    heroIntro:
      'เจ็ดค่ำคืน หนึ่งสายน้ำจะพาคำอธิษฐานของเราทุกคนไป ทำกระทงของคุณ เขียนสิ่งที่หวัง แล้วปล่อยลงน้ำไปพร้อมกับทุกคน',
    heroCta: 'ลอยกระทงของฉัน',
    heroSeeRiver: 'ดูสายน้ำ',
    destinationsTitle: 'เจ็ดค่ำคืน เจ็ดสายน้ำ',
    destinationsHint: 'แต่ละจุดหมายเปิดในคืนของมัน วันที่ 18–24 พฤศจิกายน มาเยือนเพื่อเก็บตราประทับ เก็บไว้ในอุปกรณ์นี้เท่านั้น — เป็นที่ระลึกของการเดินทาง',
    stamped: 'ประทับแล้ว',
    stampCollect: 'เก็บตราประทับ',
    destNight: (n: number) => `คืนที่ ${n}`,
    destVisit: 'มาเยือน',
    destVisited: 'มาเยือนแล้ว — เก็บตราประทับ',
    destOpens: (date: string) => `เปิด ${date}`,
    destLocked: 'ยังไม่เปิด',
    passportComplete: 'ครบเจ็ดตราแล้ว — การเดินทางของคุณสมบูรณ์แล้ว',
    riverTitle: 'สายน้ำคืนนี้',
    riverHint: 'ชี้ที่กระทงเพื่ออ่านคำอธิษฐาน แตะเพื่อส่งความรู้สึก',
    riverEmpty: 'สายน้ำยังเงียบอยู่ มาเป็นคนแรกที่ลอยกระทงกันไหม',
    riverCount: (n: number) => `${n} กระทงที่ลอยคืนนี้`,
    newWishes: (n: number) => `มีคำอธิษฐานใหม่ ${n} ใบ — รีเฟรชสายน้ำ`,
    refreshRiver: 'รีเฟรช',
    builderTitle: 'ลอยกระทงของฉัน',
    builderIntro: 'กระทงของคุณจะลอยไปพร้อมกับทุกคนบนสายน้ำ',
    nameLabel: 'ชื่อเล่นของคุณ (ไม่จำเป็น)',
    namePlaceholder: 'เช่น พลอย, น้องบี',
    wishLabel: 'คำอธิษฐานที่ฉันอยากลอยคืนนี้',
    wishPlaceholder: 'ความหวังสำหรับปีที่กำลังมาถึง…',
    wishHint: 'จะแสดงบนสายน้ำ พร้อมชื่อเล่นของคุณถ้าคุณกรอก',
    worryLabel: 'ความกังวลที่ฉันอยากปล่อยไป',
    worryHint: 'เป็นส่วนตัว — ไม่แสดงให้ใครเห็น และไม่ถูกบันทึกไว้ ใช้เฉพาะในอุปกรณ์ของคุณเพื่อเขียนคำอวยพร แล้วลบทิ้ง',
    worryPlaceholder: 'สิ่งที่หนักอยู่ในใจคุณ…',
    flowerLabel: 'เลือกดอกไม้',
    flowerCustomLabel: 'หรืออีโมจิของคุณเองหนึ่งตัว',
    flowerCustomPlaceholder: '😀',
    flowerCustomHint: 'อีโมจิเดียวจะกลายเป็นดอกไม้บนกระทงของคุณ',
    boatLabel: 'เลือกสีกระทง',
    flameLabel: 'เลือกสีเปลวเทียน',
    submit: 'ลอยกระทงของฉัน',
    submitting: 'กำลังลอย…',
    floatedTitle: 'กระทงของคุณอยู่บนสายน้ำแล้ว',
    keepsake: 'บันทึกการ์ดกระทงของฉัน',
    keepsakeSaved: 'บันทึกลงในดาวน์โหลดแล้ว',
    errorNeedWish: 'กรุณาเขียนคำอธิษฐานก่อน',
    errorGeneric: 'เกิดข้อผิดพลาดทางฝั่งเรา กระทงของคุณยังไม่ได้ลอย กรุณาลองอีกครั้ง',
    errorRejected: 'คำอธิษฐานหรือชื่อนี้ไม่สามารถแสดงบนสายน้ำได้ กรุณาแก้ไขข้อความแล้วลองอีกครั้ง',
    errorRateLimited: 'คุณลอยกระทงไปหลายใบแล้ว พักให้สายน้ำสักครู่ แล้วลองอีกครั้งนะ',
    errorDaily: 'วันนี้คุณลอยกระทงไปแล้ว พรุ่งนี้กลับมารับตราประทับใบต่อไปนะ',
    alreadyFloatedTitle: 'กระทงของวันนี้อยู่บนสายน้ำแล้ว',
    alreadyFloatedBody: 'วันนี้คุณลอยกระทงไปแล้ว พรุ่งนี้กลับมารับตราประทับใบต่อไปนะ',
    dailyStampsTitle: 'ตราประทับรายวันของคุณ',
    dailyStampsHint: 'ลอยกระทงวันละใบเพื่อสะสมให้ครบ 10 ตรา',
    dailyStampEarned: (date: string) => `ประทับแล้ว ${date}`,
    allStampsTitle: 'ครบสิบตราแล้ว — สายน้ำเฉลิมฉลองให้คุณ!',
    allStampsBody: 'สิบวันแห่งคำอธิษฐาน สิบตรา ขอบคุณที่ทำให้สายน้ำสว่างไสว',
    badWordWarning: 'มีคำที่ไม่เหมาะสำหรับสายน้ำ กรุณาเรียบเรียงใหม่ก่อนลอยกระทง',
    wallTitle: 'คำอธิษฐานที่ลอยอยู่บนสายน้ำ',
    searchLabel: 'ค้นหาคำอธิษฐาน',
    searchPlaceholder: 'ค้นหาจากชื่อเพื่อนหรือคำในคำอธิษฐาน',
    searchEmpty: (q: string) => `ไม่พบกระทงที่ตรงกับ “${q}”`,
    anonymous: 'ใครคนหนึ่งในกรุงเทพฯ',
    reactionsLabel: 'ส่งความรู้สึกให้คำอธิษฐานนี้',
    showOriginal: 'ดูต้นฉบับ',
    showTranslation: 'ดูคำแปล',
    translatedNote: 'คำแปล',
    justNow: 'เมื่อสักครู่',
    minutesAgo: (n: number) => `${n} นาทีที่แล้ว`,
    hoursAgo: (n: number) => `${n} ชม. ที่แล้ว`,
    daysAgo: (n: number) => `${n} วันที่แล้ว`,
    close: 'ปิด',
    yourKrathong: 'กระทงของคุณ',
    readWish: 'อ่านคำอธิษฐานนี้',
  },
} as const;

type Widen<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => R
  : T extends string
    ? string
    : T;

export type Strings = {
  [K in keyof (typeof STRINGS)['en']]: Widen<(typeof STRINGS)['en'][K]>;
};

export function t(lang: Lang): Strings {
  return STRINGS[lang] as Strings;
}

export function timeAgo(ts: number, lang: Lang): string {
  const s = t(lang);
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return s.justNow;
  if (mins < 60) return s.minutesAgo(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return s.hoursAgo(hours);
  return s.daysAgo(Math.floor(hours / 24));
}

/** '18 Nov' / '18 พ.ย.' for a YYYY-MM-DD Bangkok day. */
export function shortDate(day: string, lang: Lang): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1, 12);
  try {
    return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch {
    return day;
  }
}
