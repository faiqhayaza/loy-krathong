// "My Krathong" panel + My wishes list (Chunk C4).
//
// (i) A krathong editor — flower / boat pickers + a custom emoji —
// with an explicit "Save my krathong" button. The builder auto-saves
// the same `loy:krathong` key on every change; this panel stages its
// edits as a draft and only writes on Save, and both sides listen for
// `loy:krathong-changed` so the two editors never show different
// colours. The server save (POST api/krathong) comes with E1 — for now
// the krathong lives on this device. The flame is NOT picked here:
// since F1 the flame comes from the daily candle (night 4+; default
// gold before that), so this panel shows today's flame read-only and
// the preview burns it too.
//
// (ii) A My wishes list, matched to the visitor by the recovery ID in
// spirit: device-locally it is the `loy:my-wishes` ledger (C4) — the
// wishes floated from this device under this identity. Each entry
// shows its krathong, date, `floatedOn` place, reactions received
// (chips), and received blessing lanterns (B2 — none can arrive yet,
// so the count is 0 with a note). A Delete button removes the
// visitor's OWN krathong only: it calls DELETE /api/wishes with the
// recovery ID (two taps — arm, then confirm), the server 403s any
// wish that is not theirs, and on success the ledger entry is
// forgotten and the builder reopens so they can float again.
//
// Wishes hidden or under review (F2/E5 status) have no field to read
// yet — the list shows every ledger wish that is still on the river.

'use client';

import { useEffect, useState } from 'react';
import type { Lang, Wish } from '@/lib/data';
import {
  BOATS,
  DEFAULT_BOAT,
  DEFAULT_FLAME,
  DEFAULT_FLOWER,
  FLAMES,
  FLOWERS,
  REACTIONS,
  boatColors,
  flameColor,
  flowerGlyph,
  isAllowedCustomEmoji,
  isKnownFlower,
} from '@/lib/data';
import { candleFlameToday } from '@/lib/candle';
import { DESTINATIONS } from '@/lib/destinations';
import { shortDate, t } from '@/lib/i18n';
import { getIdentity } from '@/lib/identity';
import { loadKrathongChoice, saveKrathongChoice, type KrathongChoice } from '@/lib/krathong';
import { forgetMyWish, loadMyWishes } from '@/lib/myWishes';
import KrathongSvg from './KrathongSvg';

interface Props {
  lang: Lang;
  wishes: Wish[];
}

export default function MyKrathong({ lang, wishes }: Props) {
  const s = t(lang);
  const identity = getIdentity();

  // --- editor (draft until Save) ---
  const [draft, setDraft] = useState<KrathongChoice>(() => loadKrathongChoice());
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  // Remove-your-own-krathong (fix round, 2026-11-07): the Delete button
  // arms on first tap (a confirm step — there is no undo), then calls
  // DELETE /api/wishes with the recovery ID. Only the owner's own wish
  // can be removed; the server 403s anything else.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [removeError, setRemoveError] = useState(false);

  // The builder auto-saves the same key: when it changes under us,
  // reload the draft — unless the visitor is mid-edit here, in which
  // case their draft wins until they Save.
  useEffect(() => {
    const reload = () => {
      if (!dirty) setDraft(loadKrathongChoice());
    };
    window.addEventListener('loy:krathong-changed', reload);
    return () => window.removeEventListener('loy:krathong-changed', reload);
  }, [dirty]);

  // The flame is not picked here (F1): it comes from today's daily
  // candle, or default gold when none is lit yet. Refresh when a
  // candle is lit (the dialog dispatches `loy:candle-lit`).
  const [flameToday, setFlameToday] = useState<string>(() => candleFlameToday() ?? DEFAULT_FLAME);
  const [hasCandle, setHasCandle] = useState<boolean>(() => candleFlameToday() !== null);
  useEffect(() => {
    const onCandle = (e: Event) => {
      const f = (e as CustomEvent<{ flame?: string }>).detail?.flame ?? candleFlameToday();
      if (f) {
        setFlameToday(f);
        setHasCandle(true);
      }
    };
    window.addEventListener('loy:candle-lit', onCandle);
    return () => window.removeEventListener('loy:candle-lit', onCandle);
  }, []);
  const flameLabel = FLAMES.find((f) => f.id === flameToday)?.label[lang] ?? flameToday;

  function pick(patch: Partial<KrathongChoice>) {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
    setSaved(false);
  }

  function save() {
    // The saved flame is always today's candle flame now (F1): the
    // builder no longer reads a picked flame.
    if (saveKrathongChoice({ ...draft, flame: flameToday })) {
      setDirty(false);
      setSaved(true);
    }
  }

  async function copyKey() {
    if (!identity) return;
    try {
      await navigator.clipboard.writeText(identity.id);
      setCopied(true);
    } catch {
      // clipboard unavailable: the key stays visible to copy by hand
    }
  }

  async function removeWish(id: string) {
    const visitorId = identity?.id;
    if (!visitorId || removingId) return;
    setRemovingId(id);
    setRemoveError(false);
    try {
      const res = await fetch(`/api/wishes?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-visitor-id': visitorId },
      });
      if (!res.ok) {
        setRemoveError(true);
        setConfirmId(null);
        return;
      }
      // The river is clear: forget the device ledger entry and tell
      // the builder to reopen the float form (it clears its own
      // floated-day marker and resets its state). `mine` re-derives on
      // the re-render below, so the wish leaves this list at once; the
      // river and wall follow on the page's next poll.
      forgetMyWish(id);
      setConfirmId(null);
      setRemoved(true);
      window.dispatchEvent(new CustomEvent('loy:wish-removed', { detail: { id } }));
    } catch {
      setRemoveError(true);
      setConfirmId(null);
    } finally {
      setRemovingId(null);
    }
  }

  // --- my wishes ---
  const ledger = loadMyWishes();
  const byId = new Map(wishes.map((w) => [w.id, w]));
  const mine = ledger
    .map((entry) => ({ entry, wish: byId.get(entry.id) }))
    .filter((row): row is { entry: (typeof ledger)[number]; wish: Wish } => row.wish != null);

  // The "removed" status belongs to the wish just taken down: once a
  // new wish is on the list it no longer applies.
  const mineCount = mine.length;
  useEffect(() => {
    if (mineCount > 0) setRemoved(false);
  }, [mineCount]);

  return (
    <div className="my-krathong">
      <div className="mk-identity">
        <span>
          <strong>{identity?.nickname ?? s.anonymous}</strong>
          {' · '}
          {s.myKeyLabel}: <code>{identity?.id ?? '—'}</code>
        </span>
        {identity && (
          <button type="button" className="btn small ghost" onClick={copyKey}>
            {copied ? s.copiedKey : s.copyKey}
          </button>
        )}
      </div>

      <div className="mk-editor">
        <div className="preview" aria-hidden="true">
          <KrathongSvg boat={draft.boat} flower={draft.flower} flame={flameToday} name={identity?.nickname ?? ''} />
          <span className="preview-tag">{identity?.nickname ?? s.anonymous}</span>
        </div>
        <div className="mk-pickers">
          <p className="picker-label">{s.flowerLabel}</p>
          <div className="tiles" role="group" aria-label={s.flowerLabel}>
            {FLOWERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="tile"
                aria-pressed={draft.flower === f.id}
                aria-label={f.label[lang]}
                onClick={() => pick({ flower: f.id })}
              >
                <span className="glyph" aria-hidden="true">{f.glyph}</span>
                <span className="tlabel">{f.label[lang]}</span>
              </button>
            ))}
          </div>
          <div className="custom-flower">
            <label htmlFor="mk-flower-custom">{s.flowerCustomLabel}</label>
            <input
              id="mk-flower-custom"
              type="text"
              value={isKnownFlower(draft.flower) ? '' : draft.flower}
              maxLength={16}
              placeholder={s.flowerCustomPlaceholder}
              onChange={(e) =>
                pick({ flower: e.target.value.trim() === '' ? DEFAULT_FLOWER : e.target.value })
              }
              autoComplete="off"
              className={!isKnownFlower(draft.flower) && isAllowedCustomEmoji(draft.flower) ? 'active' : ''}
            />
            <span className="hint">{s.flowerCustomHint}</span>
          </div>

          <p className="picker-label">{s.boatLabel}</p>
          <div className="swatches" role="group" aria-label={s.boatLabel}>
            {BOATS.map((b) => (
              <button
                key={b.id}
                type="button"
                className="swatch-btn"
                aria-pressed={draft.boat === b.id}
                aria-label={b.label[lang]}
                title={b.label[lang]}
                onClick={() => pick({ boat: b.id })}
              >
                <span
                  className="sw"
                  style={{ background: `linear-gradient(180deg, ${b.colors[0]}, ${b.colors[1]})` }}
                />
              </button>
            ))}
          </div>

          <p className="picker-label">{s.flameLabel}</p>
          <div className="swatches" style={{ alignItems: 'center' }}>
            <span
              aria-hidden="true"
              title={flameLabel}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: flameColor(flameToday),
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
              }}
            >
              🕯️
            </span>
            <span className="hint">{hasCandle ? s.flameToday(flameLabel) : flameLabel}</span>
          </div>

          <button type="button" className="btn primary" onClick={save} disabled={!dirty && !saved}>
            {s.saveKrathong}
          </button>
          {saved && (
            <p className="hint" role="status">
              {s.krathongSaved}
            </p>
          )}
        </div>
      </div>

      <h3>{s.myWishes}</h3>
      {mine.length === 0 ? (
        <p className="hint">{s.noWishes}</p>
      ) : (
        <ul className="my-wishes">
          {mine.map(({ entry, wish }) => {
            const dest = DESTINATIONS.find((d) => d.id === entry.destination);
            const reactionTotal = Object.values(wish.reactions).reduce((a, b) => a + b, 0);
            const [c1] = boatColors(entry.boat);
            return (
              <li key={entry.id} className="my-wish">
                <span className="my-wish-krathong" aria-hidden="true" style={{ background: c1 }}>
                  {flowerGlyph(entry.flower)}
                </span>
                <span className="my-wish-info">
                  <span className="my-wish-text">“{wish.wish}”</span>
                  <span className="my-wish-meta">
                    {shortDate(entry.day, lang)}
                    {' · '}
                    {dest ? s.floatedOn(dest.name[lang], dest.river[lang]) : s.beforeFestival}
                  </span>
                  <span className="my-wish-meta">
                    {s.reactionsReceived(reactionTotal)}
                    {REACTIONS.filter((r) => wish.reactions[r.id] > 0).map((r) => (
                      <span key={r.id} className="my-wish-chip">
                        {r.glyph} {wish.reactions[r.id]}
                      </span>
                    ))}
                  </span>
                  <span className="my-wish-meta">
                    {s.lanternsReceived(0)} <span className="hint">{s.lanternsNote}</span>
                  </span>
                </span>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() =>
                    confirmId === entry.id ? void removeWish(entry.id) : setConfirmId(entry.id)
                  }
                  disabled={removingId === entry.id}
                >
                  {confirmId === entry.id ? s.deleteConfirm : s.deleteWish}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {removed && (
        <p className="hint" role="status">
          {s.deleteRemoved}
        </p>
      )}
      {removeError && (
        <p className="hint" role="status">
          {s.deleteError}
        </p>
      )}
    </div>
  );
}
