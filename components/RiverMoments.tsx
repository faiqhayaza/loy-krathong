// The river's special moments (chunk B): the small scene pieces the
// specials add, rendered as a DOM layer over the river canvas — NOT
// inside the canvas engine, so the canvas stays one writer's file.
//
// - A sent blessing lantern rises through the sky for 11 s (LANTERN_S)
//   when a `loy:blessing-sent` event arrives.
// - Lanterns of thanks drift on the water: everyone else's from
//   GET /api/thanks (max 30, the HTML's thanksLanterns), and this
//   device's own, which releases onto the water over 16 s
//   (THANKS_RELEASE_S) when a `loy:thanks-set` event arrives and then
//   keeps drifting. Hovering one shows what it thanks (thanksFor +
//   the note, the HTML's lantern tooltip).
// - (Chunk F1) A lit daily candle glows and rises for 8 s
//   (CANDLE_GLOW_S) when a `loy:candle-lit` event arrives — the
//   candle's visual moment, in the flame colour just chosen.
//
// Device-local first: other visitors' thanks lanterns arrive from the
// server list; before E1 there is no per-visitor received-lantern feed,
// so the sky only shows lanterns this device sent.

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '@/lib/data';
import { flameColor } from '@/lib/data';
import { t } from '@/lib/i18n';
import { LANTERN_S } from '@/lib/blessings';
import {
  CARD_COLOR,
  THANKS_RELEASE_S,
  gratitudeCardById,
  loadThanks,
  type Thanks,
} from '@/lib/gratitude';

/** Seconds the daily candle glows and rises after lighting (chunk F1). */
export const CANDLE_GLOW_S = 8;

interface CommunityThanks {
  card: number;
  note: string | null;
  at: number;
}

/** Deterministic 0–1 hash, same shape as the HTML scene's hash(i, seed). */
function hash(i: number, seed: number): number {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function RiverMoments({ lang }: { lang: Lang }) {
  const s = t(lang);
  const [rising, setRising] = useState<number | null>(null);
  const [thanks, setThanks] = useState<CommunityThanks[]>([]);
  const [mine, setMine] = useState<Thanks | null>(() => loadThanks());
  const [releasing, setReleasing] = useState(false);
  // Chunk F1: the daily candle's visual moment.
  const [candle, setCandle] = useState<{ at: number; flame: string } | null>(null);

  const refreshThanks = useCallback(async () => {
    try {
      const res = await fetch('/api/thanks', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { thanks?: CommunityThanks[] };
      if (Array.isArray(data.thanks)) setThanks(data.thanks.slice(0, 30));
    } catch {
      // the river still works without the thanks list
    }
  }, []);

  useEffect(() => {
    refreshThanks();
    const id = window.setInterval(refreshThanks, 30000);
    return () => window.clearInterval(id);
  }, [refreshThanks]);

  useEffect(() => {
    const onBlessing = () => {
      setRising(Date.now());
      window.setTimeout(() => setRising(null), LANTERN_S * 1000);
    };
    const onThanks = () => {
      setMine(loadThanks());
      setReleasing(true);
      window.setTimeout(() => setReleasing(false), THANKS_RELEASE_S * 1000);
      refreshThanks();
    };
    const onCandle = (e: Event) => {
      const flame = (e as CustomEvent<{ flame?: string }>).detail?.flame ?? 'gold';
      setCandle({ at: Date.now(), flame });
      window.setTimeout(() => setCandle(null), CANDLE_GLOW_S * 1000);
    };
    window.addEventListener('loy:blessing-sent', onBlessing);
    window.addEventListener('loy:thanks-set', onThanks);
    window.addEventListener('loy:candle-lit', onCandle);
    return () => {
      window.removeEventListener('loy:blessing-sent', onBlessing);
      window.removeEventListener('loy:thanks-set', onThanks);
      window.removeEventListener('loy:candle-lit', onCandle);
    };
  }, [refreshThanks]);

  function thanksTitle(card: number, note: string | null): string {
    const c = gratitudeCardById(card);
    const base = c ? s.thanksFor(c.label[lang]) : s.gratitudeTitle;
    return note ? `${base} — “${note}”` : base;
  }

  return (
    <div className="river-moments" aria-hidden="true">
      {rising !== null && (
        <span key={rising} className="rising-lantern" role="img" aria-label="🏮">
          🏮
        </span>
      )}
      {candle !== null && (
        <span
          key={candle.at}
          className="candle-glow"
          role="img"
          aria-label="🕯️"
          style={{ filter: `drop-shadow(0 0 12px ${flameColor(candle.flame)})` }}
        >
          🕯️
        </span>
      )}
      {thanks.map((l, i) => (
        <span
          key={`${l.at}-${i}`}
          className="thanks-lantern"
          title={thanksTitle(l.card, l.note)}
          style={{
            left: `${8 + hash(i, 172) * 84}%`,
            top: `${68 + hash(i, 171) * 24}%`,
            background: CARD_COLOR[l.card] ?? '#fff2d6',
            boxShadow: `0 0 14px ${CARD_COLOR[l.card] ?? '#fff2d6'}`,
            animationDuration: `${36 + hash(i, 173) * 36}s`,
            animationDelay: `${-hash(i, 174) * 40}s`,
          }}
        />
      ))}
      {mine && (
        <span
          className={`thanks-lantern mine ${releasing ? 'releasing' : ''}`}
          title={thanksTitle(mine.card, mine.note)}
          style={{
            left: '40%',
            top: '82%',
            background: CARD_COLOR[mine.card] ?? '#fff2d6',
            boxShadow: `0 0 16px ${CARD_COLOR[mine.card] ?? '#fff2d6'}`,
          }}
        />
      )}
    </div>
  );
}
