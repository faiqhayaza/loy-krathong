// The gratitude lantern dialog (night 5 special, B3).
//
// "A lantern of thanks": pick one of the 6 gratitude cards, optionally
// add a short note (max 60 chars, denylist-checked — a rejected note
// answers `thanksRejected` and nothing is stored), set the lantern on
// the water. Once only: when a lantern already exists the dialog shows
// it (`thanksYours` + the note) and it cannot be changed. Setting it
// records a `gratitude` event (evidence for the night-5 special
// mission) and the lantern releases onto the water over 16 s
// (THANKS_RELEASE_S, rendered by components/RiverMoments.tsx).
//
// Community counts per card come from GET /api/thanks (server counts);
// this device's own lantern counts as 1 for its card in the solo-mode
// rule when the server has no record of it yet.

'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/data';
import { containsBlocked } from '@/lib/data';
import { calendar } from '@/lib/festival';
import { shortDate, t } from '@/lib/i18n';
import {
  GRATITUDE_CARDS,
  MAX_THANKS_CHARS,
  gratitudeCardById,
  loadThanks,
  saveThanks,
  type Thanks,
} from '@/lib/gratitude';
import { getVisitorId } from '@/lib/identity';
import { previewNight, specialOpen } from '@/lib/specials';
import { recordEvent } from '@/lib/events';
import SpecialDialog from './SpecialDialog';

export default function GratitudeDialog({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const s = t(lang);
  const cal = calendar();
  const open = specialOpen(cal, 'gratitude');
  const [mine, setMine] = useState<Thanks | null>(() => loadThanks());
  const [card, setCard] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<'rejected' | 'error' | null>(null);
  const [setting, setSetting] = useState(false);
  const [counts, setCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    let alive = true;
    fetch('/api/thanks', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data && typeof data.counts === 'object') setCounts(data.counts as Record<number, number>);
      })
      .catch(() => {
        // counts stay zero; the picker still works
      });
    return () => {
      alive = false;
    };
  }, []);

  const bad = containsBlocked(note);
  const done = mine !== null;

  async function setLantern() {
    if (card === null || bad || setting || done) return;
    setSetting(true);
    setOutcome(null);
    try {
      const res = await fetch('/api/thanks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getVisitorId() ? { 'x-visitor-id': getVisitorId() as string } : {}),
        },
        body: JSON.stringify({
          card,
          note: note.trim(),
          ...(previewNight() !== null ? { previewNight: previewNight() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { outcome?: string };
      if (data.outcome === 'shown') {
        // `already: true` means the server kept an earlier lantern from
        // this visitor (localStorage was cleared since); the posted
        // choice stands in for it in this dialog.
        const thanks: Thanks = { card, note: note.trim() === '' ? null : note.trim(), at: Date.now() };
        saveThanks(thanks);
        setMine(thanks);
        recordEvent('gratitude', card);
        window.dispatchEvent(new CustomEvent('loy:thanks-set', { detail: { card } }));
      } else if (data.outcome === 'rejected') {
        setOutcome('rejected');
      } else {
        setOutcome('error');
      }
    } catch {
      setOutcome('error');
    } finally {
      setSetting(false);
    }
  }

  return (
    <SpecialDialog
      lang={lang}
      title={`🙏 ${s.gratitudeTitle}`}
      subtitle={done ? undefined : s.gratitudeHint}
      onClose={onClose}
      testId="gratitude-dialog"
    >
      {!open ? (
        <>
          <p className="hint">{s.specialLocked(shortDate(cal.dates[4], lang))}</p>
          <button type="button" className="btn primary" onClick={onClose}>
            {s.done}
          </button>
        </>
      ) : done ? (
        <>
          <p className="banner success" role="status">
            {s.thanksYours}
          </p>
          {mine.note && <p className="dlg-quote">“{mine.note}”</p>}
          <p className="hint">
            {gratitudeCardById(mine.card)?.icon} {gratitudeCardById(mine.card)?.label[lang]}
          </p>
          <button type="button" className="btn primary" onClick={onClose}>
            {s.done}
          </button>
        </>
      ) : (
        <>
          <div className="choice-grid">
            {GRATITUDE_CARDS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`btn choice-btn ${card === c.id ? 'primary' : 'ghost'}`}
                aria-pressed={card === c.id}
                onClick={() => setCard(c.id)}
              >
                {c.icon} {c.label[lang]} · {s.gratitudeCount(counts[c.id] ?? 0)}
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="thanks-note">{s.thanksNoteLabel}</label>
            <span className="hint">{s.thanksNoteHint}</span>
            <textarea
              id="thanks-note"
              rows={2}
              maxLength={MAX_THANKS_CHARS}
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_THANKS_CHARS))}
            />
            <span className="count">
              {note.length}/{MAX_THANKS_CHARS}
            </span>
          </div>
          {bad ? (
            <p className="banner warning" role="alert">
              {s.badWordWarning}
            </p>
          ) : outcome === 'rejected' ? (
            <p className="banner warning" role="status">
              {s.thanksRejected}
            </p>
          ) : outcome === 'error' ? (
            <p className="banner error" role="alert">
              {s.errorGeneric}
            </p>
          ) : null}
          <button
            type="button"
            className="btn primary"
            disabled={card === null || bad || setting}
            onClick={setLantern}
            data-testid="thanks-set"
          >
            {`🏮 ${s.thanksSet}`}
          </button>
        </>
      )}
    </SpecialDialog>
  );
}
