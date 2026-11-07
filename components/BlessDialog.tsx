// The blessing lantern dialog (night 3 special, B2).
//
// Flow (DIALOGS.bless in the HTML): pick a friend's krathong from a
// searchable list (max 30 shown), pick one of the 6 template blessings,
// send. Rules: your own krathong answers `blessingOwn`; a krathong you
// already blessed answers `blessingAgain`; otherwise the lantern is
// sent, the wish's count goes +1, the lantern rises in the scene for
// 11 s (LANTERN_S), and a `blessing` event is recorded — evidence for
// night 3 AND for the night-6 `share` mission.
//
// The dialog can be opened pre-targeted at one wish (the wall card's
// "Send a blessing lantern" button); "Choose someone else" goes back
// to the list.

'use client';

import { useMemo, useState } from 'react';
import type { Lang, Wish } from '@/lib/data';
import { flowerGlyph } from '@/lib/data';
import { calendar } from '@/lib/festival';
import { shortDate, t } from '@/lib/i18n';
import { BLESSINGS, addSentBlessing, hasSentBlessing } from '@/lib/blessings';
import { getIdentity, getVisitorId } from '@/lib/identity';
import { previewNight, specialOpen } from '@/lib/specials';
import { recordEvent } from '@/lib/events';
import SpecialDialog from './SpecialDialog';

interface Props {
  lang: Lang;
  wishes: Wish[];
  myWishId: string | null;
  targetId: string | null;
  onClose: () => void;
  onSent: () => void;
}

type Outcome = 'sent' | 'own_wish' | 'already' | 'error' | null;

export default function BlessDialog({ lang, wishes, myWishId, targetId, onClose, onSent }: Props) {
  const s = t(lang);
  const cal = calendar();
  const open = specialOpen(cal, 'blessing');
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(targetId);
  const [message, setMessage] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [sending, setSending] = useState(false);

  const target = pickedId ? wishes.find((w) => w.id === pickedId) ?? null : null;
  const already = target ? hasSentBlessing(target.id) : false;
  const own = target ? target.id === myWishId : false;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return wishes
      .filter(
        (w) =>
          q === '' ||
          w.wish.toLowerCase().includes(q) ||
          (w.translation ?? '').toLowerCase().includes(q) ||
          w.name.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [wishes, query]);

  async function send() {
    if (!target || message === null || sending) return;
    // Your own krathong: the HTML answers `blessingOwn` without a
    // server call (the server cannot know whose wish is whose yet).
    if (own) {
      setOutcome('own_wish');
      return;
    }
    setSending(true);
    setOutcome(null);
    try {
      const res = await fetch('/api/bless', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getVisitorId() ? { 'x-visitor-id': getVisitorId() as string } : {}),
        },
        body: JSON.stringify({
          wishId: target.id,
          message,
          from: getIdentity()?.nickname ?? '',
          ...(previewNight() !== null ? { previewNight: previewNight() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { outcome?: string };
      if (data.outcome === 'sent') {
        recordEvent('blessing', target.id);
        addSentBlessing(target.id, message);
        window.dispatchEvent(
          new CustomEvent('loy:blessing-sent', { detail: { wishId: target.id, message } }),
        );
        setOutcome('sent');
        onSent();
      } else if (data.outcome === 'already') {
        setOutcome('already');
      } else {
        setOutcome('error');
      }
    } catch {
      setOutcome('error');
    } finally {
      setSending(false);
    }
  }

  return (
    <SpecialDialog lang={lang} title={`🏮 ${s.blessingTitle}`} onClose={onClose} testId="bless-dialog">
      {!open ? (
        <>
          <p className="hint">{s.specialLocked(shortDate(cal.dates[2], lang))}</p>
          <button type="button" className="btn primary" onClick={onClose}>
            {s.done}
          </button>
        </>
      ) : outcome === 'sent' && target ? (
        <>
          <p className="banner success" role="status">
            {s.blessingOnWay(target.name.trim() || s.anonymous)}
          </p>
          <button type="button" className="btn primary" onClick={onClose}>
            {s.done}
          </button>
        </>
      ) : !target ? (
        <>
          <p className="dlg-question">{s.blessingPickFriend}</p>
          <div className="field">
            <label htmlFor="bless-search">{s.blessingSearch}</label>
            <input
              id="bless-search"
              type="search"
              value={query}
              maxLength={80}
              placeholder={s.searchPlaceholder}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="pick-list" id="bless-list">
            {list.length === 0 ? (
              <p className="hint">{query.trim() ? s.searchEmpty(query.trim()) : s.riverEmpty}</p>
            ) : (
              list.map((w) => {
                const sent = hasSentBlessing(w.id);
                return (
                  <div className="pick-row" key={w.id}>
                    <span className="pick-glyph" aria-hidden="true">
                      {flowerGlyph(w.flower)}
                    </span>
                    <span className="pick-text">
                      <strong>
                        {w.name.trim() || s.anonymous}
                        {w.id === myWishId && ` · ${s.yourKrathong}`}
                      </strong>
                      <span className="pick-sub">{w.wish}</span>
                    </span>
                    <button
                      type="button"
                      className="btn small ghost"
                      disabled={sent}
                      onClick={() => setPickedId(w.id)}
                    >
                      {sent ? `✓ ${s.blessingSent}` : s.blessingChoose}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <div className="pick-target">
            <span className="pick-glyph" aria-hidden="true">
              {flowerGlyph(target.flower)}
            </span>
            <span className="pick-text">
              <strong>{target.name.trim() || s.anonymous}</strong>
              <span className="pick-sub">{target.wish}</span>
            </span>
          </div>
          <p className="dlg-question">{s.blessingPick}</p>
          <div className="choice-grid">
            {BLESSINGS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`btn choice-btn ${message === b.id ? 'primary' : 'ghost'}`}
                aria-pressed={message === b.id}
                onClick={() => setMessage(b.id)}
              >
                {b.glyph} {b.text[lang]}
              </button>
            ))}
          </div>
          {outcome === 'own_wish' && (
            <p className="banner warning" role="status">
              {s.blessingOwn}
            </p>
          )}
          {(outcome === 'already' || already) && (
            <p className="banner info" role="status">
              {s.blessingAgain}
            </p>
          )}
          {outcome === 'error' && (
            <p className="banner error" role="alert">
              {s.errorGeneric}
            </p>
          )}
          <div className="dlg-actions">
            <button type="button" className="btn ghost" onClick={() => { setPickedId(null); setMessage(null); setOutcome(null); }}>
              {s.blessingChange}
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={message === null || already || sending}
              onClick={send}
            >
              {`🏮 ${s.blessingSend}`}
            </button>
          </div>
        </>
      )}
    </SpecialDialog>
  );
}
