// The grand finale overlay (night 7 special, B5).
//
// Joining (the POST + the `finale` event happen in the caller, before
// this opens) starts an 8.5 s finale (FINALE_MS in the HTML): the
// visitor's krathong drifts to the centre of the lake, the finale
// crowd gathers (up to 110 krathongs, the HTML's finaleCrowd), the
// royal golden lotus glides across the lake, and fireworks play —
// fired through the river canvas via a `loy:finale-show` event, which
// starts its 60 s show (the same show the hidden 5-click preview
// starts). Afterwards the finale message appears
// (`finaleMessage` + `finaleWishes`) with a button to the journey
// card.
//
// The journey card is chunk C's (C2), built in parallel: this overlay
// degrades gracefully when it is not there yet — the button only
// appears once the card sets `window.__loyJourneyCardReady` (chunk C
// owns that flag); until then a line says the card is on its way.
// Recorded dependency: B5 → C2.

'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/data';
import { flowerGlyph } from '@/lib/data';
import { t } from '@/lib/i18n';

export const FINALE_MS = 8500;

/** Deterministic 0–1 hash, same shape as the HTML scene's hash(i, seed). */
function hash(i: number, seed: number): number {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const CROWD_FLOWERS = ['🪷', '🌸', '🌺', '🌹', '🌼', '🌷', '💮'];

declare global {
  interface Window {
    __loyJourneyCardReady?: boolean;
  }
}

interface Props {
  lang: Lang;
  flower: string;
  onClose: () => void;
}

export default function FinaleOverlay({ lang, flower, onClose }: Props) {
  const s = t(lang);
  const [phase, setPhase] = useState<'scene' | 'message'>('scene');
  const [journeyReady, setJourneyReady] = useState(false);

  useEffect(() => {
    // Fireworks over the lake, via the river canvas.
    window.dispatchEvent(new Event('loy:finale-show'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => setPhase('message'), reduced ? 0 : FINALE_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (phase === 'message') setJourneyReady(window.__loyJourneyCardReady === true);
  }, [phase]);

  function openJourney() {
    window.dispatchEvent(new CustomEvent('loy:open-journey'));
  }

  if (phase === 'message') {
    return (
      <div className="finale-overlay" role="dialog" aria-modal="true" aria-label={s.finaleButton} data-testid="finale-message">
        <div className="dlg-card finale-msg">
          <h2>🌕 {s.finaleMessage}</h2>
          <p>{s.finaleWishes}</p>
          {journeyReady ? (
            <button type="button" className="btn primary" onClick={openJourney}>
              {`💌 ${s.journeyCard}`}
            </button>
          ) : (
            <p className="hint">{s.journeyCardSoon}</p>
          )}
          <button type="button" className="btn ghost" onClick={onClose}>
            {s.close}
          </button>
        </div>
      </div>
    );
  }

  // The crowd gathers over the 8.5 s: each krathong fades in on a
  // stagger (the HTML's `shown = n * min(1, p * 1.4)`), arranged in
  // the same ellipse the HTML draws (radius 0.16–1.0, depth 0.42–0.86).
  const crowd = Array.from({ length: 110 }, (_, i) => {
    const a = hash(i, 61) * Math.PI * 2;
    const r = 0.16 + Math.sqrt(hash(i, 62)) * 0.84;
    const d = Math.min(0.86, Math.max(0.06, 0.42 + Math.sin(a) * r * 0.3));
    const x = 50 + Math.cos(a) * r * 47;
    const y = 56 + d * 38;
    const size = 12 + (1 - d) * 22;
    return { i, x, y, size, glyph: CROWD_FLOWERS[i % CROWD_FLOWERS.length], delay: i * 0.04 };
  });

  return (
    <div className="finale-overlay finale-scene" aria-hidden="true" data-testid="finale-scene">
      <p className="finale-caption">{s.finaleGoldenLotus}</p>
      <div className="finale-crowd">
        {crowd.map((c) => (
          <span
            key={c.i}
            className="finale-krathong"
            style={{ left: `${c.x}%`, top: `${c.y}%`, fontSize: c.size, animationDelay: `${c.delay}s` }}
          >
            {c.glyph}
          </span>
        ))}
      </div>
      <span className="finale-mine" role="img" aria-label={s.yourKrathong}>
        {flowerGlyph(flower)}
      </span>
      <span className="finale-lotus" role="img" aria-label="🪷">
        🪷
      </span>
    </div>
  );
}
