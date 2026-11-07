// The daily candle dialog (night 4 special, F1).
//
// "From Tak's night to the last night, light a candle for your
// krathong": pick one of the 7 flames and light it — the candle joins
// the chain, and the visitor's own krathongs burn that colour for the
// rest of today. Lighting again the same day recolours it (the HTML
// overwrites the existing `candle` event's ref; this dialog removes
// today's old candle event and records the new one, so the D1 store
// still holds exactly one candle event per day).
//
// The button label follows the HTML's candle card: `candleButton`
// ("Light a candle") when nothing is lit, `flameChange` ("Change my
// flame colour") when a different colour is picked, `candleLit`
// ("Your candle is part of the chain tonight.") — disabled — when the
// picked colour is already today's. The community chain count
// (`candles`) comes from GET /api/candle. On lighting, the dialog
// dispatches `loy:candle-lit` so the river shows the candle's visual
// moment (components/RiverMoments.tsx, a DOM overlay — the canvas
// engine is untouched).

'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/data';
import { FLAMES, flameColor } from '@/lib/data';
import { calendar } from '@/lib/festival';
import { shortDate, t } from '@/lib/i18n';
import { getVisitorId } from '@/lib/identity';
import { previewNight, specialOpen } from '@/lib/specials';
import { recordEvent, removeEvent } from '@/lib/events';
import { loadCandleToday, saveCandle, type Candle } from '@/lib/candle';
import SpecialDialog from './SpecialDialog';

export default function CandleDialog({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const s = t(lang);
  const cal = calendar();
  const open = specialOpen(cal, 'candle');
  const [mine, setMine] = useState<Candle | null>(() => loadCandleToday());
  const [flame, setFlame] = useState<string>(() => loadCandleToday()?.flame ?? 'gold');
  const [candles, setCandles] = useState<number | null>(null);
  const [lighting, setLighting] = useState(false);
  const [outcome, setOutcome] = useState<'error' | null>(null);
  const [justLit, setJustLit] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/candle', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data && typeof data.candles === 'number') setCandles(data.candles as number);
      })
      .catch(() => {
        // the count stays hidden; the picker still works
      });
    return () => {
      alive = false;
    };
  }, []);

  const lit = mine !== null;
  const sameFlame = lit && mine.flame === flame;
  const picked = FLAMES.find((f) => f.id === flame) ?? FLAMES[0];

  async function light() {
    if (lighting || sameFlame) return;
    setLighting(true);
    setOutcome(null);
    try {
      const res = await fetch('/api/candle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getVisitorId() ? { 'x-visitor-id': getVisitorId() as string } : {}),
        },
        body: JSON.stringify({
          flame,
          ...(previewNight() !== null ? { previewNight: previewNight() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        outcome?: string;
        candles?: number;
      };
      if (data.outcome === 'lit') {
        // Recolour: replace today's old candle event (whatever its
        // flame) with the new one — one candle event per day.
        if (mine && mine.flame !== flame) removeEvent('candle', mine.flame);
        recordEvent('candle', flame);
        saveCandle(flame);
        setMine({ day: mine?.day ?? '', flame, at: Date.now() });
        if (typeof data.candles === 'number') setCandles(data.candles);
        setJustLit(true);
        window.dispatchEvent(new CustomEvent('loy:candle-lit', { detail: { flame } }));
      } else {
        setOutcome('error');
      }
    } catch {
      setOutcome('error');
    } finally {
      setLighting(false);
    }
  }

  return (
    <SpecialDialog
      lang={lang}
      title={`🕯️ ${s.candleTitle}`}
      subtitle={lit ? undefined : s.candleExplain}
      onClose={onClose}
      testId="candle-dialog"
    >
      {!open ? (
        <>
          <p className="hint">{s.specialLocked(shortDate(cal.dates[3], lang))}</p>
          <button type="button" className="btn primary" onClick={onClose}>
            {s.done}
          </button>
        </>
      ) : (
        <>
          {lit && (
            <p className="banner success" role="status">
              {s.candleLit}
            </p>
          )}
          {lit && (
            <p className="hint" data-testid="flame-today">
              {s.flameToday((FLAMES.find((f) => f.id === mine.flame) ?? FLAMES[0]).label[lang])}
            </p>
          )}
          {justLit && (
            <p className="hint" role="status">
              {s.candleWatch}
            </p>
          )}
          <div>
            <p className="picker-label" id="candle-flame-label">{s.flameLabel}</p>
            <div className="swatches" role="group" aria-labelledby="candle-flame-label">
              {FLAMES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="flame-btn"
                  aria-pressed={flame === f.id}
                  aria-label={f.label[lang]}
                  title={f.label[lang]}
                  style={{ background: f.color }}
                  onClick={() => setFlame(f.id)}
                >
                  <span aria-hidden="true">🕯️</span>
                </button>
              ))}
            </div>
            <p className="hint">
              {s.flamePick}: {picked.label[lang]}
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: flameColor(flame),
                  marginLeft: 6,
                  verticalAlign: '-1px',
                }}
              />
            </p>
          </div>
          {candles !== null && (
            <p className="hint" data-testid="candle-count">
              {`🕯️ ${s.candles(candles)}`}
            </p>
          )}
          {outcome === 'error' && (
            <p className="banner error" role="alert">
              {s.errorGeneric}
            </p>
          )}
          <button
            type="button"
            className="btn primary"
            disabled={lighting || sameFlame}
            onClick={light}
            data-testid="light-candle"
          >
            {`🕯️ ${!lit ? s.candleButton : sameFlame ? s.candleLit : s.flameChange}`}
          </button>
        </>
      )}
    </SpecialDialog>
  );
}
