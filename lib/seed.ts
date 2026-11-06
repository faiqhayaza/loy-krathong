// The eight wishes the river opens with, verbatim from the original site,
// each with a translation for the other language tab. They are merged into
// every GET /api/wishes response but never written to Redis.

import type { Wish } from './data';
import { EMPTY_REACTIONS } from './data';

function seed(
  id: string,
  wish: string,
  translation: string,
  name: string | null,
  flower: string,
  lang: 'en' | 'th',
  day: number,
): Wish {
  return {
    id: `seed-${id}`,
    name: name ?? '',
    wish,
    translation,
    flower,
    boat: 'leaf',
    flame: 'gold',
    lang,
    // Staggered across the first week of November so the wall sorts
    // newest-first with real wishes (which carry today's timestamp) on top.
    createdAt: Date.UTC(2026, 10, day, 12, 0, 0),
    reactions: { ...EMPTY_REACTIONS },
    isSeed: true,
  };
}

export const SEED_WISHES: Wish[] = [
  seed('mother', 'That my mother’s test results come back clear.',
    'ขอให้ผลตรวจของแม่ออกมาปกติดี', null, 'lotus', 'en', 1),
  seed('team', 'ขอให้ทีมเราผ่านไตรมาสนี้ไปด้วยกัน',
    'May our team get through this quarter together.', null, 'marigold', 'th', 2),
  seed('rest', 'A year where I stop apologising for resting.', 'ขอให้ปีนี้เป็นปีที่ฉันเลิกขอโทษเวลาได้พักผ่อน',
    'Nan', 'cherry_blossom', 'en', 3),
  seed('brother', 'That my little brother gets into the school he wants.',
    'ขอให้น้องชายได้เข้าโรงเรียนที่เขาอยากเข้า', null, 'blossom', 'en', 4),
  seed('home', 'ขอให้ปีนี้ได้กลับบ้านบ่อยขึ้น',
    'May I get to go home more often this year.', null, 'hibiscus', 'th', 5),
  seed('quiet', 'Enough quiet to hear myself think again.',
    'ขอความเงียบมากพอที่จะได้ยินความคิดของตัวเองอีกครั้ง', null, 'rosette', 'en', 6),
  seed('shift', 'That the people on my shift know they are appreciated.',
    'ขอให้ทุกคนในกะของฉันรู้ว่ามีคนเห็นคุณค่าของพวกเขา', 'P’Toom', 'bouquet', 'en', 7),
  seed('health', 'ขอให้สุขภาพแข็งแรงทั้งบ้าน',
    'Good health for everyone at home.', null, 'lotus', 'th', 8),
];
