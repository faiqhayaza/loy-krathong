// "My journey card" (Chunk C2): a summary view + a downloadable
// 1080×1350 PNG, drawn on a client canvas in the same pattern as
// components/Keepsake.ts.
//
// The card shows the visitor's krathong (flower + boat), a
// 7-destination stamp grid (visited dimmed, stamped gold), and the
// lines from the plan: destinations visited, passport stamps, secrets
// found, nights on the river, River Light — plus the tagline. Saving
// it records a `share` event (B4: the night-6 special is earned by
// sharing) and shows "Card saved".
//
// Fields that belong to chunks not built yet (missions, gratitude
// card, daily candle) are shown as "Not yet" with the pending note,
// never invented.

'use client';

import { useState } from 'react';
import type { Lang } from '@/lib/data';
import { DESTINATIONS, STAMP_ICON, boatColors, flowerGlyph } from '@/lib/data';
import type { FestivalCalendar } from '@/lib/festival';
import { t } from '@/lib/i18n';
import type { Journey } from '@/lib/journey';
import { recordEvent } from '@/lib/events';
import { loadKrathongImage } from '@/lib/krathongArt';
import KrathongSvg from './KrathongSvg';

interface Props {
  lang: Lang;
  cal: FestivalCalendar;
  journey: Journey;
  onClose: () => void;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function downloadJourneyCard(journey: Journey, lang: Lang) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // The nested drawClassic/finish below do not inherit this narrowing,
  // so they draw through the captured non-null reference.
  const g = ctx;

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#070a1f');
  sky.addColorStop(0.55, '#1a2048');
  sky.addColorStop(1, '#0a1030');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255, 244, 214, ${0.3 + rand() * 0.7})`;
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H * 0.55, 0.8 + rand() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(232, 179, 75, 0.65)';
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = 'rgba(232, 179, 75, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f6d36b';
  ctx.font = '600 44px Prompt, Sarabun, sans-serif';
  ctx.fillText('My Seven Nights of Wishes', W / 2, 120);
  ctx.fillStyle = '#f2a0c0';
  ctx.font = '400 32px Prompt, Sarabun, sans-serif';
  ctx.fillText('เจ็ดค่ำคืนแห่งคำอธิษฐานของฉัน', W / 2, 168);

  // The krathong, in the chosen design (lib/krathongArt — the same
  // artwork the card's dialog shows), loaded as an image and drawn
  // large. The artwork (220×136) is drawn at 2× with its hull centre
  // (SVG 110,87) at (cx, 420): it clears the title above and the
  // stamp grid below. If it cannot load, the classic hull is drawn
  // by hand instead, so the card still downloads.
  const cx = W / 2;
  const cy = 420;
  const sc = 2.0;
  const k = journey.krathong;
  const [c1, c2] = boatColors(k.boat);

  function drawClassic() {
    g.font = `${Math.round(20 * sc)}px serif`;
    g.textBaseline = 'middle';
    g.fillText(flowerGlyph(k.flower), cx, cy - 4 * sc);
    g.fillStyle = c1;
    g.beginPath();
    g.ellipse(cx, cy + 6 * sc, 30 * sc, 9 * sc, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = c2;
    g.beginPath();
    g.ellipse(cx, cy + 8 * sc, 30 * sc, 7 * sc, 0, 0, Math.PI);
    g.fill();
  }

  // The stamp grid, the lines, the tagline and the download — once
  // the krathong is drawn (artwork or fallback), so the file is never
  // half a card.
  function finish() {
    g.textBaseline = 'alphabetic';
    // 7-destination stamp grid
    const cell = 120;
    const gap = 16;
    const gridW = 7 * cell + 6 * gap;
    const gx = (W - gridW) / 2;
    const gy = 560;
    DESTINATIONS.forEach((d, i) => {
      const x = gx + i * (cell + gap);
      const stamped = journey.stamps.includes(d.id);
      const visited = journey.visited.includes(d.id);
      g.fillStyle = stamped
        ? 'rgba(232, 179, 75, 0.28)'
        : visited
          ? 'rgba(239, 232, 216, 0.10)'
          : 'rgba(239, 232, 216, 0.04)';
      g.strokeStyle = stamped ? '#e8b34b' : 'rgba(239, 232, 216, 0.25)';
      g.lineWidth = stamped ? 3 : 1;
      g.beginPath();
      g.roundRect(x, gy, cell, cell, 14);
      g.fill();
      g.stroke();
      g.font = '44px serif';
      g.fillStyle = stamped ? '#f6d36b' : visited ? '#cfc8e8' : 'rgba(182, 176, 212, 0.5)';
      g.fillText(STAMP_ICON[d.id], x + cell / 2, gy + cell / 2 - 8);
      g.font = '600 20px Prompt, Sarabun, sans-serif';
      g.fillStyle = stamped ? '#f6d36b' : '#b6b0d4';
      g.fillText(`Night ${d.day}`, x + cell / 2, gy + cell - 18);
    });

    // the lines
    const s = t(lang);
    const lines = [
      s.journeyVisited(journey.visited.length),
      s.journeyStamps(journey.stamps.length),
      s.journeySecrets(journey.secrets.length),
      s.journeyDays(journey.participationDays),
      s.journeyRiverLight(journey.riverLight),
    ];
    g.fillStyle = '#f7f1e3';
    g.font = '500 40px Sarabun, Prompt, sans-serif';
    lines.forEach((line, i) => {
      g.fillText(line, W / 2, 800 + i * 64);
    });

    // tagline
    g.fillStyle = '#b6b0d4';
    g.font = '400 30px Sarabun, Prompt, sans-serif';
    const tag = wrapText(g, s.journeyTagline, W - 240);
    tag.forEach((line, i) => {
      g.fillText(line, W / 2, 1160 + i * 44);
    });
    g.fillStyle = '#b6b0d4';
    g.font = '400 26px Sarabun, Prompt, sans-serif';
    g.fillText('Loy Krathong · 24 November 2026 · Bangkok', W / 2, 1268);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-journey-card.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  loadKrathongImage(k.boat, k.flower, k.flame, k.design ?? 'classic')
    .then((img) => {
      g.drawImage(img, cx - 110 * sc, cy - 87 * sc, 220 * sc, 136 * sc);
      finish();
    })
    .catch(() => {
      drawClassic();
      finish();
    });
}

export default function JourneyCard({ lang, cal, journey, onClose }: Props) {
  const s = t(lang);
  const [saved, setSaved] = useState(false);

  function save() {
    downloadJourneyCard(journey, lang);
    // B4: saving the journey card is a share — the night-6 special's
    // evidence. recordEvent dedupes by day, so saving twice in a day
    // still counts once.
    recordEvent('share');
    setSaved(true);
  }

  return (
    <div className="dlg-overlay" role="dialog" aria-modal="true" aria-labelledby="journey-title">
      <div className="dlg journey-dlg">
        <div className="dlg-head">
          <h3 id="journey-title">{s.journeyCardTitle}</h3>
          <button type="button" className="btn small ghost" onClick={onClose}>
            {s.close}
          </button>
        </div>

        <div className="journey-krathong">
          <KrathongSvg
            boat={journey.krathong.boat}
            flower={journey.krathong.flower}
            flame={journey.krathong.flame}
            design={journey.krathong.design}
            name=""
            width={180}
          />
        </div>

        <div className="journey-grid" aria-label={s.journeyTitle}>
          {DESTINATIONS.map((d) => {
            const stamped = journey.stamps.includes(d.id);
            const visited = journey.visited.includes(d.id);
            const state = stamped ? 'stamped' : visited ? 'visited' : 'locked';
            return (
              <span key={d.id} className={`journey-cell ${state}`} title={d.name[lang]}>
                <span aria-hidden="true">{STAMP_ICON[d.id]}</span>
                <span className="journey-night">{s.welcomeNight(d.day)}</span>
                {stamped && <span className="journey-stamp">✓</span>}
              </span>
            );
          })}
        </div>
        {cal.phase === 'before' && <p className="hint">{s.missionsLockedNote}</p>}

        <ul className="journey-lines">
          <li>{s.journeyVisited(journey.visited.length)}</li>
          <li>{s.journeyStamps(journey.stamps.length)}</li>
          <li>{s.journeySecrets(journey.secrets.length)}</li>
          <li>{s.journeyDays(journey.participationDays)}</li>
          <li>{s.journeyRiverLight(journey.riverLight)}</li>
          {journey.quizDone && <li>✓ {s.journeyQuizDone}</li>}
          {journey.finaleJoined && <li>✓ {s.journeyFinaleJoined}</li>}
          {journey.floatedToday && <li>✓ {s.journeyFloatedToday}</li>}
          <li className="journey-notyet">
            {s.journeyNotYet} — {s.journeyPendingNote}
          </li>
        </ul>

        <p className="dlg-tagline">{s.journeyTagline}</p>

        <button type="button" className="btn primary" onClick={save}>
          {s.saveCard}
        </button>
        {saved && (
          <p className="hint" role="status">
            {s.cardSaved}
          </p>
        )}
      </div>
    </div>
  );
}
