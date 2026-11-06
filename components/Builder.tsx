// "Float my krathong": the builder panel. Live SVG preview, nickname, wish,
// a worry that never leaves the device, and flower / boat / flame pickers.
// The POST body contains name, wish, flower, boat, flame and lang only —
// the worry is deliberately never included.
//
// One float per day: the server enforces one float per Bangkok day per IP
// (429 daily_limit), and this panel remembers the day you floated in
// localStorage, so it shows a friendly "come back tomorrow" state instead
// of the form. Every day you float you automatically earn one of ten
// daily stamps (localStorage, loy:daily-stamps); the tenth earns
// full-page confetti.

'use client';

import { useState } from 'react';
import type { Lang, Wish } from '@/lib/data';
import {
  BOATS,
  DEFAULT_BOAT,
  DEFAULT_FLAME,
  DEFAULT_FLOWER,
  FLAMES,
  FLOWERS,
  MAX_NAME_CHARS,
  MAX_WISH_CHARS,
  MAX_WORRY_CHARS,
  containsBlocked,
  isAllowedCustomEmoji,
  isKnownFlower,
} from '@/lib/data';
import { bangkokDay } from '@/lib/bangkok';
import { replyLanguage, templateBlessing } from '@/lib/blessing';
import { CRISIS_MESSAGE, isCrisis } from '@/lib/crisis';
import { t } from '@/lib/i18n';
import KrathongSvg from './KrathongSvg';
import Confetti from './Confetti';
import { downloadKeepsake } from './Keepsake';

interface Props {
  lang: Lang;
  onFloated: (wish: Wish) => void;
}

const MAX_STAMPS = 10;
const FLOATED_DAY_KEY = 'loy:floated-day';
const DAILY_STAMPS_KEY = 'loy:daily-stamps';

function loadDailyStamps(): string[] {
  try {
    const raw = localStorage.getItem(DAILY_STAMPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Keep only well-formed Bangkok days, most recent ten.
    return parsed.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-MAX_STAMPS);
  } catch {
    return [];
  }
}

/** '24 Nov' / '24 พ.ย.' for a stored YYYY-MM-DD Bangkok day. */
function formatStampDate(day: string, lang: Lang): string {
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

export default function Builder({ lang, onFloated }: Props) {
  const s = t(lang);
  const [name, setName] = useState('');
  const [wish, setWish] = useState('');
  const [worry, setWorry] = useState('');
  const [flower, setFlower] = useState(DEFAULT_FLOWER);
  const [boat, setBoat] = useState(DEFAULT_BOAT);
  const [flame, setFlame] = useState(DEFAULT_FLAME);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [floated, setFloated] = useState<Wish | null>(null);
  // The blessing is composed in this browser from the wish and the worry
  // (Rules: templateBlessing) at the moment the krathong floats; the worry
  // is discarded right after, exactly as the form promises. When the worry
  // or the wish needs a real person instead of a poem (Rules: isCrisis),
  // the crisis message takes its place. The wish floats either way.
  const [blessing, setBlessing] = useState('');
  const [crisis, setCrisis] = useState(false);
  const [keepsakeDone, setKeepsakeDone] = useState(false);
  const [floatedToday, setFloatedToday] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(FLOATED_DAY_KEY) === bangkokDay();
    } catch {
      return false;
    }
  });
  const [stamps, setStamps] = useState<string[]>(() => loadDailyStamps());
  const [celebrate, setCelebrate] = useState(false);

  const blocked = containsBlocked(wish) || containsBlocked(name);

  function awardStamp(today: string) {
    if (stamps.includes(today)) return;
    const next = [...stamps, today].slice(-MAX_STAMPS);
    setStamps(next);
    try {
      localStorage.setItem(DAILY_STAMPS_KEY, JSON.stringify(next));
    } catch {
      // stamps are a keepsake; the river is unaffected
    }
    if (next.length === MAX_STAMPS) setCelebrate(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const text = wish.trim();
    if (!text) {
      setError(s.errorNeedWish);
      return;
    }
    if (blocked) {
      setError(s.errorRejected);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // NOTE: no `worry` field here, ever. It lives only in this browser.
        body: JSON.stringify({ name: name.trim(), wish: text, flower, boat, flame, lang }),
      });
      const data = (await res.json().catch(() => ({}))) as { wish?: Wish; error?: string };
      if (!res.ok) {
        if (res.status === 429 && data.error === 'daily_limit') {
          // Already floated today (this browser or another one on the
          // same network): remember the day, show the friendly state.
          const today = bangkokDay();
          try {
            localStorage.setItem(FLOATED_DAY_KEY, today);
          } catch {
            // private mode: the message still shows
          }
          setFloatedToday(true);
          setError(s.errorDaily);
        } else if (res.status === 429) {
          setError(s.errorRateLimited);
        } else if (data.error === 'blocked_content') {
          setError(s.errorRejected);
        } else {
          setError(s.errorGeneric);
        }
        return;
      }
      if (!data.wish) {
        setError(s.errorGeneric);
        return;
      }
      const today = bangkokDay();
      const worryText = worry.trim();
      // The worry is read here — in this browser only — to write the
      // blessing and to check the crisis rail, then discarded.
      if (isCrisis(worryText, text)) {
        setCrisis(true);
        setBlessing('');
      } else {
        setCrisis(false);
        setBlessing(
          templateBlessing({ lang: replyLanguage(worryText, text, lang), worry: worryText, wish: text }),
        );
      }
      setFloated(data.wish);
      setKeepsakeDone(false);
      // The worry is discarded the moment the krathong floats.
      setWorry('');
      try {
        localStorage.setItem(FLOATED_DAY_KEY, today);
        localStorage.setItem('loy:my-wish', data.wish.id);
      } catch {
        // private mode: the river still works without it
      }
      setFloatedToday(true);
      awardStamp(today);
      onFloated(data.wish);
    } catch {
      setError(s.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  // (No "float another" button here: a successful float means today is
  // done — the panel below says so once this view is left.)  // The stamps strip: ten slots, earned ones filled gold with the date,
  // empty ones an outline with their number. Always visible, in every
  // state of the panel, so progress reads at a glance.
  const stampStrip = (
    <div className="stamps" aria-label={`${s.dailyStampsTitle} — ${stamps.length} / ${MAX_STAMPS}`}>
      <div className="stamps-head">
        <h3>{s.dailyStampsTitle}</h3>
        <span className="stamps-count">
          {stamps.length} / {MAX_STAMPS}
        </span>
      </div>
      <div className="stamp-row">
        {Array.from({ length: MAX_STAMPS }, (_, i) => {
          const day = stamps[i];
          return day ? (
            <span key={i} className="stamp-slot earned" title={s.dailyStampEarned(formatStampDate(day, lang))}>
              <span className="stamp-glyph" aria-hidden="true">🪷</span>
              <span className="stamp-date">{formatStampDate(day, lang)}</span>
            </span>
          ) : (
            <span key={i} className="stamp-slot" aria-hidden="true">
              <span className="stamp-num">{i + 1}</span>
            </span>
          );
        })}
      </div>
      <p className="stamps-hint">{s.dailyStampsHint}</p>
      {stamps.length === MAX_STAMPS && (
        <p className="stamps-complete" role="status">{s.allStampsTitle}</p>
      )}
    </div>
  );

  if (celebrate) {
    return (
      <div className="builder" aria-live="polite">
        <Confetti onDone={() => setCelebrate(false)} />
        <h2>{s.allStampsTitle}</h2>
        <p className="hint">{s.allStampsBody}</p>
        {stampStrip}
        <button type="button" className="btn primary" onClick={() => setCelebrate(false)}>
          {lang === 'th' ? 'กลับไปที่สายน้ำ' : 'Back to the river'}
        </button>
      </div>
    );
  }

  if (floated) {
    const crisisMessage = CRISIS_MESSAGE[lang];
    return (
      <div className="builder" aria-live="polite">
        <h2>{s.floatedTitle}</h2>
        <div className="preview">
          <KrathongSvg boat={floated.boat} flower={floated.flower} flame={floated.flame} name={floated.name} />
          <span className="preview-tag">{floated.name || s.anonymous}</span>
        </div>
        {crisis ? (
          <div className="crisis" role="alert">
            <strong>{crisisMessage.heading}</strong>
            {crisisMessage.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : (
          <div className="success">
            <strong>“{floated.wish}”</strong>
            <p>{blessing}</p>
          </div>
        )}
        {stampStrip}
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            downloadKeepsake(floated, lang);
            setKeepsakeDone(true);
          }}
        >
          {s.keepsake}
        </button>
        {keepsakeDone && <p className="hint" role="status">{s.keepsakeSaved}</p>}
      </div>
    );
  }

  if (floatedToday) {
    return (
      <div className="builder" aria-live="polite">
        <h2>{s.builderTitle}</h2>
        <div className="already">
          <strong>{s.alreadyFloatedTitle}</strong>
          <p>{s.alreadyFloatedBody}</p>
        </div>
        {stampStrip}
      </div>
    );
  }

  return (
    <form className="builder" onSubmit={submit} noValidate>
      <div>
        <h2>{s.builderTitle}</h2>
        <p className="hint">{s.builderIntro}</p>
      </div>

      {stampStrip}

      <div className="preview" aria-hidden="true">
        <KrathongSvg boat={boat} flower={flower} flame={flame} name={name} />
        <span className="preview-tag">{name.trim() || s.anonymous}</span>
      </div>

      <div className="field">
        <label htmlFor="bk-name">{s.nameLabel}</label>
        <input
          id="bk-name"
          type="text"
          value={name}
          maxLength={MAX_NAME_CHARS}
          placeholder={s.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="bk-wish">{s.wishLabel}</label>
        <textarea
          id="bk-wish"
          value={wish}
          maxLength={MAX_WISH_CHARS}
          placeholder={s.wishPlaceholder}
          onChange={(e) => setWish(e.target.value)}
          aria-invalid={wish.trim().length === 0 && error === s.errorNeedWish}
          aria-describedby="bk-wish-hint bk-wish-count"
        />
        <span className="hint" id="bk-wish-hint">{s.wishHint}</span>
        <span className="count" id="bk-wish-count">
          {wish.length}/{MAX_WISH_CHARS}
        </span>
      </div>

      <div className="field">
        <label htmlFor="bk-worry">{s.worryLabel}</label>
        <textarea
          id="bk-worry"
          value={worry}
          maxLength={MAX_WORRY_CHARS}
          placeholder={s.worryPlaceholder}
          onChange={(e) => setWorry(e.target.value)}
          aria-describedby="bk-worry-hint"
        />
        <span className="hint" id="bk-worry-hint">{s.worryHint}</span>
      </div>

      <div>
        <p className="picker-label" id="flower-label">{s.flowerLabel}</p>
        <div className="tiles" role="group" aria-labelledby="flower-label">
          {FLOWERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="tile"
              aria-pressed={flower === f.id}
              aria-label={f.label[lang]}
              onClick={() => setFlower(f.id)}
            >
              <span className="glyph" aria-hidden="true">{f.glyph}</span>
              <span className="tlabel">{f.label[lang]}</span>
            </button>
          ))}
        </div>
        {/* One emoji of your own (Rules: isAllowedCustomEmoji) — it becomes
            the krathong flower. Anything that is not one allowed emoji is
            never stored: the preview and the server both fall back to lotus. */}
        <div className="custom-flower">
          <label htmlFor="bk-flower-custom">{s.flowerCustomLabel}</label>
          <input
            id="bk-flower-custom"
            type="text"
            value={isKnownFlower(flower) ? '' : flower}
            maxLength={16}
            placeholder={s.flowerCustomPlaceholder}
            onChange={(e) => setFlower(e.target.value.trim() === '' ? DEFAULT_FLOWER : e.target.value)}
            autoComplete="off"
            className={!isKnownFlower(flower) && isAllowedCustomEmoji(flower) ? 'active' : ''}
          />
          <span className="hint">{s.flowerCustomHint}</span>
        </div>
      </div>

      <div>
        <p className="picker-label" id="boat-label">{s.boatLabel}</p>
        <div className="swatches" role="group" aria-labelledby="boat-label">
          {BOATS.map((b) => (
            <button
              key={b.id}
              type="button"
              className="swatch-btn"
              aria-pressed={boat === b.id}
              aria-label={b.label[lang]}
              title={b.label[lang]}
              onClick={() => setBoat(b.id)}
            >
              <span
                className="sw"
                style={{ background: `linear-gradient(180deg, ${b.colors[0]}, ${b.colors[1]})` }}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="picker-label" id="flame-label">{s.flameLabel}</p>
        <div className="swatches" role="group" aria-labelledby="flame-label">
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
      </div>

      {blocked && <p className="err" role="alert">{s.badWordWarning}</p>}
      {error && <p className="err" role="alert">{error}</p>}

      <button type="submit" className="btn primary" disabled={submitting || blocked}>
        {submitting ? s.submitting : `${s.submit} 🪷`}
      </button>
    </form>
  );
}
