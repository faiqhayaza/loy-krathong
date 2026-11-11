// "Float my krathong": the builder panel. Live SVG preview, nickname, wish,
// a worry that never leaves the device, and flower / boat / design pickers.
// The POST body contains name, wish, flower, boat, flame, design and lang
// only — the worry is deliberately never included.
//
// The flame is NOT picked here: the HTML float form has no flame picker
// — the flame comes from the daily candle (chunk F1). A krathong floats
// with today's candle flame when one is lit, else the default gold.
// (Plan F1(d) decision, recorded in VERIFICATION.md.)
//
//
// One float per day: the server enforces one float per Bangkok day per IP
// (429 daily_limit), and this panel remembers the day you floated in
// localStorage, so it shows a friendly "come back tomorrow" state instead
// of the form. Every day you float you automatically earn one of ten
// daily stamps (localStorage, loy:daily-stamps); the tenth earns
// full-page confetti.

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lang, Wish } from '@/lib/data';
import {
  BOATS,
  DEFAULT_DESIGN,
  EMPTY_REACTIONS,
  DEFAULT_FLAME,
  DEFAULT_FLOWER,
  DESIGNS,
  FLOWERS,
  MAX_NAME_CHARS,
  MAX_WISH_CHARS,
  MAX_WORRY_CHARS,
  containsBlocked,
  isAllowedCustomEmoji,
  isKnownFlower,
} from '@/lib/data';
import { bangkokDay } from '@/lib/bangkok';
import { candleFlameToday } from '@/lib/candle';
import { replyLanguage, templateBlessing } from '@/lib/blessing';
import { CRISIS_MESSAGE, isCrisis } from '@/lib/crisis';
import { getIdentity, getVisitorId } from '@/lib/identity';
import { audio } from '@/lib/audio';
import { recordEvent } from '@/lib/events';
import { t } from '@/lib/i18n';
import { loadKrathongChoice, saveKrathongChoice } from '@/lib/krathong';
import { destinationForNewWish, forgetMyWish, loadMyWishes, recordMyWish } from '@/lib/myWishes';
import KrathongSvg from './KrathongSvg';
import Confetti from './Confetti';
import { downloadKeepsake } from './Keepsake';

interface Props {
  lang: Lang;
  onFloated: (wish: Wish) => void;
  /** Browse-first: no identity yet — open the gate instead of floating. */
  onNeedIdentity?: () => void;
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

export default function Builder({ lang, onFloated, onNeedIdentity }: Props) {
  const s = t(lang);
  const [name, setName] = useState('');
  const [wish, setWish] = useState('');
  const [worry, setWorry] = useState('');
  const [flower, setFlower] = useState(() => loadKrathongChoice().flower);
  const [boat, setBoat] = useState(() => loadKrathongChoice().boat);
  // The krathong's shape (one of DESIGNS) — picked per float, so every
  // float can be a different design. Saved with the flower and boat, so
  // a return visit finds the same design picked.
  const [design, setDesign] = useState(() => loadKrathongChoice().design);
  // The flame comes from the daily candle (chunk F1), not a picker:
  // today's candle flame when one is lit, else the default gold.
  const flame = candleFlameToday() ?? DEFAULT_FLAME;
  const [submitting, setSubmitting] = useState(false);
  // A second click before React re-renders and disables the button
  // would send a second POST: the first claims today's slot (201),
  // the second meets the daily limit (429) — and the 429 handler
  // leaves the panel in "already floated" with no ledger entry and no
  // way to delete. The ref updates synchronously, so it closes that
  // gap; the disabled button is the visible half.
  const submittingRef = useRef(false);
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
  // The visitor's own krathong, once floated: the recovery-ID copy and
  // the owner-delete. These lived in the My Krathong panel, which was
  // removed (it duplicated this form); they now sit with the floated
  // krathong here, where the visitor is. Two-tap delete, like before:
  // the first tap arms it, the second removes it from the river.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removedNote, setRemovedNote] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [copied, setCopied] = useState(false);
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
  const [kalimbaOn, setKalimbaOn] = useState(() => audio.isEffectivelyOn());

  // Keep the krathong choices on this device, so a return visit finds
  // the same flower, boat and design picked. The flame saved here is
  // today's candle flame (or the default gold) — the builder never picks one.
  useEffect(() => {
    saveKrathongChoice({ flower, boat, flame, design });
  }, [flower, boat, flame, design]);

  useEffect(() => {
    const reload = () => {
      const saved = loadKrathongChoice();
      setFlower((f) => (f === saved.flower ? f : saved.flower));
      setBoat((b) => (b === saved.boat ? b : saved.boat));
      setDesign((d) => (d === saved.design ? d : saved.design));
    };
    window.addEventListener('loy:krathong-changed', reload);
    return () => window.removeEventListener('loy:krathong-changed', reload);
  }, []);

  // Re-read the daily stamps on mount: the state initializer runs
  // during the server render (no localStorage there), so a return
  // visit must not trust it alone — the readout has to show the stamp
  // earned today, not "0 of 10".
  useEffect(() => {
    setStamps(loadDailyStamps());
  }, []);

  // Pre-fill the name from the nickname the visitor entered at sign-up
  // (the identity gate stores it on this device) — editable, never
  // locked: the visitor can change it before floating. Client-only
  // (useEffect runs after mount), so the server render stays empty and
  // there is no hydration mismatch. A name already typed wins.
  useEffect(() => {
    setName((current) => {
      if (current.trim() !== '') return current;
      return getIdentity()?.nickname ?? '';
    });
  }, []);

  // When the visitor removes their own krathong (from the floated state
  // below), reopen the float form: clear the floated-day marker and reset
  // the floated state, so they can float again the same day (the server
  // released today's daily slot as part of the delete).
  useEffect(() => {
    const onRemoved = () => {
      setFloated(null);
      setFloatedToday(false);
      setBlessing('');
      setCrisis(false);
      setKeepsakeDone(false);
      // The wish text is cleared so a re-float starts empty (the name
      // stays pre-filled — it is the visitor's nickname, not the wish).
      setWish('');
      try {
        localStorage.removeItem(FLOATED_DAY_KEY);
      } catch {
        // private mode: the state reset still shows the form
      }
    };
    window.addEventListener('loy:wish-removed', onRemoved);
    return () => window.removeEventListener('loy:wish-removed', onRemoved);
  }, []);

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

  // Copy the recovery ID (the key that proves this device floated the
  // krathong) — it lives with the floated krathong, not in a panel.
  async function copyKey() {
    const identity = getIdentity();
    if (!identity) return;
    try {
      await navigator.clipboard.writeText(identity.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable: the key is still shown in full
    }
  }

  // Remove the visitor's own krathong from the river (owner-delete):
  // the server checks the recovery ID, clears today's daily slot so
  // they can float again, and the ledger forgets the wish. The
  // `loy:wish-removed` event reopens the form (see the listener above).
  async function removeWish(id: string) {
    const identity = getIdentity();
    if (!identity) return;
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    setRemovingId(id);
    setRemoveError('');
    try {
      const res = await fetch(`/api/wishes?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-visitor-id': identity.id },
      });
      if (!res.ok) throw new Error('delete failed');
      forgetMyWish(id);
      setRemovedNote(s.deleteRemoved);
      window.dispatchEvent(new Event('loy:wish-removed'));
    } catch {
      setRemoveError(s.deleteError);
    } finally {
      setRemovingId(null);
    }
  }

  // The visitor's own row under a floated krathong: the recovery-ID
  // copy and the owner-delete. `id` is the wish to delete.
  function ownRow(id: string) {
    const identity = getIdentity();
    return (
      <div className="floated-own">
        {identity ? (
          <span>
            {s.myKeyLabel}: <code>{identity.id}</code>
          </span>
        ) : (
          <span>{s.myKeyLabel}</span>
        )}
        <span className="own-actions">
          {identity && (
            <button type="button" className="btn small ghost" onClick={() => void copyKey()}>
              {copied ? s.copiedKey : s.copyKey}
            </button>
          )}
          <button
            type="button"
            className="btn small ghost"
            disabled={removingId === id}
            onClick={() => void removeWish(id)}
          >
            {confirmId === id ? s.deleteConfirm : s.deleteWish}
          </button>
        </span>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    const text = wish.trim();
    if (!text) {
      submittingRef.current = false;
      setError(s.errorNeedWish);
      return;
    }
    if (blocked) {
      submittingRef.current = false;
      setError(s.errorRejected);
      return;
    }
    // Browse-first: floating needs a nickname and key, so a visitor
    // who skipped the gate is asked to sign in instead of floating
    // anonymously. (Also fixes the early returns above, which used to
    // leave submittingRef set and the form dead until a reload.)
    if (!getIdentity()) {
      submittingRef.current = false;
      setError(s.errorNeedIdentity);
      onNeedIdentity?.();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The recovery ID lets the server record the float events
          // (B6) against this visitor; without it the device-local
          // record below is the only evidence. Never a name or a worry.
          ...(getVisitorId() ? { 'x-visitor-id': getVisitorId() as string } : {}),
        },
        // NOTE: no `worry` field here, ever. It lives only in this browser.
        body: JSON.stringify({ name: name.trim(), wish: text, flower, boat, flame, design, lang }),
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
      setRemovedNote('');
      // B6 (night-1 special evidence): the float records the
      // once-per-day slot and the float itself (wish id as ref). The
      // server records the same two when the recovery ID was sent; the
      // server log dedupes, so nothing double-counts.
      recordEvent('float_slot', 0);
      recordEvent('float', data.wish.id);
      // The worry is discarded the moment the krathong floats.
      setWorry('');
      try {
        localStorage.setItem(FLOATED_DAY_KEY, today);
        // JSON, like every other `loy:*` key the page reads back with
        // JSON.parse (a raw id broke the read — see page.tsx).
        localStorage.setItem('loy:my-wish', JSON.stringify(data.wish.id));
      } catch {
        // private mode: the river still works without it
      }
      // Chunk C4: this device's ledger of the visitor's own wishes —
      // the My wishes list and the journey card's `floated` map read
      // it. The destination tag follows the D3 rule (tonight's
      // destination if there is a live night, else null).
      recordMyWish({
        id: data.wish.id,
        destination: destinationForNewWish(),
        flower,
        boat,
        flame,
        design,
        name: name.trim(),
        wish: text,
      });
      setFloatedToday(true);
      awardStamp(today);
      onFloated(data.wish);
    } catch {
      setError(s.errorGeneric);
    } finally {
      submittingRef.current = false;
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
          {`${stamps.length} of ${MAX_STAMPS}`}
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
          <KrathongSvg boat={floated.boat} flower={floated.flower} flame={floated.flame} design={floated.design} name={floated.name} />
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
            // B4 (night-6 share evidence): saving the keepsake card is
            // sharing — it records a `share` event. A blessing lantern
            // counts the same way (its event kind is `blessing`).
            recordEvent('share', 0);
          }}
        >
          {s.keepsake}
        </button>
        {keepsakeDone && <p className="hint" role="status">{s.keepsakeSaved}</p>}
        {!kalimbaOn && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              audio.setEnabled(true);
              setKalimbaOn(true);
            }}
          >
            🎵 {s.listenKalimba}
          </button>
        )}
        {ownRow(floated.id)}
        {removeError && <p className="err" role="alert">{removeError}</p>}
      </div>
    );
  }

  if (floatedToday) {
    // A return visit after floating: the ledger knows today's krathong,
    // so it shows here with its Delete, keepsake and Copy — the same
    // controls as the just-floated state. (Floated from another browser
    // on the same network, the ledger has no entry and there is nothing
    // to delete.)
    const todayEntry = loadMyWishes().find((e) => e.day === bangkokDay());
    // The keepsake needs a Wish: the ledger carries the krathong and
    // the wish text (recorded at float time), so a return visit can
    // still download its card.
    const todayWish: Wish | null = todayEntry
      ? {
          id: todayEntry.id,
          name: todayEntry.name,
          wish: todayEntry.wish,
          flower: todayEntry.flower,
          boat: todayEntry.boat,
          flame: todayEntry.flame,
          design: todayEntry.design,
          lang,
          createdAt: todayEntry.at,
          reactions: { ...EMPTY_REACTIONS },
        }
      : null;
    return (
      <div className="builder" aria-live="polite">
        <h2>{s.builderTitle}</h2>
        <div className="already">
          <strong>{s.alreadyFloatedTitle}</strong>
          <p>{s.alreadyFloatedBody}</p>
        </div>
        {todayEntry && (
          <div className="preview">
            <KrathongSvg
              boat={todayEntry.boat}
              flower={todayEntry.flower}
              flame={todayEntry.flame}
              design={todayEntry.design}
              name={todayEntry.name}
            />
            <span className="preview-tag">{todayEntry.name || s.anonymous}</span>
          </div>
        )}
        {todayWish && (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              downloadKeepsake(todayWish, lang);
              setKeepsakeDone(true);
              // B4 (night-6 share evidence): saving the keepsake card is
              // sharing, same as in the just-floated state.
              recordEvent('share', 0);
            }}
          >
            {s.keepsake}
          </button>
        )}
        {keepsakeDone && <p className="hint" role="status">{s.keepsakeSaved}</p>}
        {todayEntry && ownRow(todayEntry.id)}
        {removeError && <p className="err" role="alert">{removeError}</p>}
        {stampStrip}
      </div>
    );
  }

  return (
    <form className="builder" onSubmit={submit} noValidate>
      {stampStrip}
      {removedNote && <p className="hint" role="status">{removedNote}</p>}

      <div className="preview" aria-hidden="true">
        <KrathongSvg boat={boat} flower={flower} flame={flame} design={design} name={name} />
        <span className="preview-tag">{name.trim() || s.anonymous}</span>
      </div>

      <div className="step">
        <p className="step-kicker">01 · Your wish</p>
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
      </div>

      <div className="step">
        <p className="step-kicker">02 · Flower</p>
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
      </div>

      <div className="step">
        <p className="step-kicker">03 · Boat</p>
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
      </div>

      <div className="step">
        <p className="step-kicker">04 · Design</p>
        <div>
          <p className="picker-label" id="design-label">{s.designLabel}</p>
          <div className="design-tiles" role="group" aria-labelledby="design-label">
            {DESIGNS.map((d) => (
              <button
                key={d.id}
                type="button"
                className="design-tile"
                aria-pressed={design === d.id}
                aria-label={d.label[lang]}
                onClick={() => setDesign(d.id)}
              >
                <KrathongSvg boat={boat} flower={flower} flame={flame} design={d.id} width={110} />
                <span className="tlabel">{d.label[lang]}</span>
              </button>
            ))}
          </div>
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
