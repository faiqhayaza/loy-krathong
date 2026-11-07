// The seven specials (chunk B): one card per night, in the
// destinations strip's wake. Each card shows the night's special
// (title + detail from lib/destinations.ts), its state — done (an
// event exists), tonight, or locked until its night — and the action
// that opens it. Night 4's special is the daily candle (chunk F,
// components/CandleDialog.tsx); night 6's share is earned
// by saving the keepsake card (or sending a blessing lantern), so its
// action scrolls to the builder where the keepsake lives.
//
// The `tick` prop re-reads the event store after a dialog records an
// event, so a finished special flips to Done without a reload. The
// mission view (chunk A) will later route its `Go` buttons to these
// same dialogs.

'use client';

import { useMemo } from 'react';
import type { Lang } from '@/lib/data';
import { DESTINATIONS, SPECIAL_ICON } from '@/lib/data';
import { calendar } from '@/lib/festival';
import { shortDate, t } from '@/lib/i18n';
import { previewNight, specialDone, specialOpen, type SpecialKind } from '@/lib/specials';

interface Props {
  lang: Lang;
  tick: number;
  onOpenDialog: (kind: 'quiz' | 'blessing' | 'gratitude' | 'finale' | 'candle') => void;
  onFloatScroll: () => void;
}

export default function Specials({ lang, tick, onOpenDialog, onFloatScroll }: Props) {
  const s = t(lang);
  const cal = calendar();
  const preview = previewNight();

  // Done states are read from the event store; `tick` re-reads them
  // after a special records its event.
  const doneMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const d of DESTINATIONS) {
      map.set(d.special.kind, specialDone(d.special.kind as SpecialKind));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  function scrollToFloat() {
    onFloatScroll();
  }

  return (
    <section className="section reveal" aria-labelledby="specials-title" data-testid="specials">
      <p className="kicker">Seven specials</p>
      <div className="section-head">
        <h2 id="specials-title">{s.specialsTitle}</h2>
        {preview !== null && (
          <span className="pill gold" role="status">
            {lang === 'th'
              ? `กำลังดูตัวอย่างคืนที่ ${preview} (สำหรับทดสอบเท่านั้น)`
              : `Previewing night ${preview} (dev-only ?night=)`}
          </span>
        )}
      </div>
      <p className="section-intro">{s.specialsHint}</p>
      <div className="specials-grid">
        {DESTINATIONS.map((d, i) => {
          const kind = d.special.kind as SpecialKind;
          const open = specialOpen(cal, kind);
          const done = doneMap.get(kind) ?? false;
          const tonight = cal.liveDay === d.day;
          return (
            <article className={`special-card ${done ? 'done' : !open ? 'locked' : 'open'}${kind === 'finale' ? ' finale' : ''}`} key={d.id} data-testid={`special-${kind}`} style={{ '--i': i } as React.CSSProperties}>
              <span className="special-icon" aria-hidden="true">
                {SPECIAL_ICON[kind] ?? '✨'}
              </span>
              <span className="special-night">
                {s.destNight(d.day)}
                {tonight && !done && <span className="pill gold">{s.specialTonight}</span>}
              </span>
              <h3>
                {d.special.title[lang]}
                <span className="th" lang="th">
                  {d.special.title.th}
                </span>
              </h3>
              <p>{d.special.detail[lang]}</p>
              {done ? (
                <>
                  <span className="special-state" role="status">
                    {s.specialDone}
                  </span>
                  {/* A done special still opens its dialog — the quiz
                      shows the story + the right-answer banner, the
                      gratitude shows the set lantern (the HTML's side
                      panel keeps the button as "My lantern of thanks"),
                      and the candle shows today's flame so it can be
                      recoloured. Only the finale stays closed once
                      joined (the HTML disables its button after
                      joining). A blessing can go to another friend, a
                      share can be saved again, a float starts a new
                      day's krathong. */}
                  {kind === 'quiz' || kind === 'blessing' || kind === 'gratitude' || kind === 'candle' ? (
                    <button type="button" className="btn primary" onClick={() => onOpenDialog(kind)}>
                      {kind === 'gratitude' ? `🏮 ${s.thanksMine}` : d.special.title[lang]}
                    </button>
                  ) : (
                    (kind === 'float' || kind === 'share') && (
                      <button type="button" className="btn primary" onClick={scrollToFloat}>
                        {d.special.title[lang]}
                      </button>
                    )
                  )}
                </>
              ) : !open ? (
                <span className="special-state">{s.specialLocked(shortDate(cal.dates[d.day - 1], lang))}</span>
              ) : kind === 'quiz' || kind === 'blessing' || kind === 'gratitude' || kind === 'candle' ? (
                <button type="button" className="btn primary" onClick={() => onOpenDialog(kind)}>
                  {d.special.title[lang]}
                </button>
              ) : kind === 'finale' ? (
                <button type="button" className="btn primary" onClick={() => onOpenDialog('finale')}>
                  {`🎆 ${s.finaleButton}`}
                </button>
              ) : kind === 'float' ? (
                <>
                  <button type="button" className="btn primary" onClick={scrollToFloat}>
                    {d.special.title[lang]}
                  </button>
                  <span className="special-hint">{s.specialFloatHint}</span>
                </>
              ) : kind === 'share' ? (
                <>
                  <button type="button" className="btn primary" onClick={scrollToFloat}>
                    {d.special.title[lang]}
                  </button>
                  <span className="special-hint">{s.specialShareHint}</span>
                </>
              ) : (
                // Night 6's share is the last branch above; every
                // kind is handled, so this is unreachable.
                <span className="special-hint">{s.specialCandleSoon}</span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
