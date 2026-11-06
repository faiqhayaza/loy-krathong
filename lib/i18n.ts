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
      'Tap a destination to stamp your passport. It stays on this device — just a keepsake of the journey.',
    stamped: 'Stamped',
    stampCollect: 'Collect stamp',
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
    boatLabel: 'Choose your boat colour',
    flameLabel: 'Choose your flame',
    submit: 'Float my krathong',
    submitting: 'Floating…',
    floatedTitle: 'Your krathong is on the water',
    blessingLine: 'May what weighs on you drift away with the current.',
    blessingLineNoWorry: 'May your wish find its way home.',
    keepsake: 'Save my krathong card',
    keepsakeSaved: 'Saved to your downloads.',
    errorNeedWish: 'Write a wish first.',
    errorGeneric: 'Something went wrong on our side. Your krathong was not floated — please try again.',
    errorRejected: 'That wish or name cannot go on the public river. Please reword it and try again.',
    errorRateLimited: 'You have floated a few krathongs already. Give the river a moment and try again shortly.',
    errorDaily: 'You already floated a krathong today. You can float another — the river has room.',
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
    privacyTitle: 'A quiet word on privacy',
    privacyBody:
      'Wishes are public, with only the nickname you type. Your worry never leaves this device — it is never sent, never stored, and is cleared the moment your krathong floats. No sign-in, no tracking, no ads.',
    footerLine: 'Made for the full moon of 24 November 2026 · Bangkok',
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
    destinationsHint: 'แตะจุดหมายเพื่อประทับตราลงพาสปอร์ต เก็บไว้ในอุปกรณ์นี้เท่านั้น — เป็นที่ระลึกของการเดินทาง',
    stamped: 'ประทับแล้ว',
    stampCollect: 'เก็บตราประทับ',
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
    boatLabel: 'เลือกสีกระทง',
    flameLabel: 'เลือกสีเปลวเทียน',
    submit: 'ลอยกระทงของฉัน',
    submitting: 'กำลังลอย…',
    floatedTitle: 'กระทงของคุณอยู่บนสายน้ำแล้ว',
    blessingLine: 'ขอให้ความหนักในใจลอยไปกับสายน้ำ',
    blessingLineNoWorry: 'ขอให้คำอธิษฐานของคุณเป็นจริง',
    keepsake: 'บันทึกการ์ดกระทงของฉัน',
    keepsakeSaved: 'บันทึกลงในดาวน์โหลดแล้ว',
    errorNeedWish: 'กรุณาเขียนคำอธิษฐานก่อน',
    errorGeneric: 'เกิดข้อผิดพลาดทางฝั่งเรา กระทงของคุณยังไม่ได้ลอย กรุณาลองอีกครั้ง',
    errorRejected: 'คำอธิษฐานหรือชื่อนี้ไม่สามารถแสดงบนสายน้ำได้ กรุณาแก้ไขข้อความแล้วลองอีกครั้ง',
    errorRateLimited: 'คุณลอยกระทงไปหลายใบแล้ว พักให้สายน้ำสักครู่ แล้วลองอีกครั้งนะ',
    errorDaily: 'วันนี้คุณลอยกระทงไปแล้ว แต่ลอยอีกใบก็ได้ — สายน้ำมีที่ว่างเสมอ',
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
    privacyTitle: 'เรื่องความเป็นส่วนตัว',
    privacyBody:
      'คำอธิษฐานจะแสดงต่อสาธารณะพร้อมเฉพาะชื่อเล่นที่คุณกรอก ความกังวลของคุณไม่เคยออกจากอุปกรณ์นี้ — ไม่ถูกส่ง ไม่ถูกบันทึก และจะถูกลบทันทีที่กระทงของคุณลอยออกไป ไม่ต้องสมัครสมาชิก ไม่มีการติดตาม ไม่มีโฆษณา',
    footerLine: 'เพื่อคืนพระจันทร์เต็มดวง 24 พฤศจิกายน 2569 · กรุงเทพฯ',
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
