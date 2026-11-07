// The wish wall: searchable, newest-first cards with reaction buttons.
// One reaction per wish per visitor (Rules: toggleReaction) — the choice
// lives in the useReactions hook, shared with the pinned wish panel.
//
// Chunk F2 — report / hideWish: every card that is not the visitor's
// own has a Report button (shared rule: POST /api/report; at 3 distinct
// reports the wish leaves the river) and a Hide button (solo rule:
// hidden on this device only, `loy:hidden`). After reporting, the card
// shows `reported` ("Thanks. An admin will take a look.") in place of
// the buttons — the HTML's wall keeps the card with that note until the
// river refresh hides it. Hidden-on-this-device wishes are filtered
// out of the list (the river filters hidden wishes out); a line under
// the tools counts them and offers to show them again, greyed, with an
// Unhide button.

'use client';

import { useMemo, useState } from 'react';
import type { Lang, ReactionId, Wish } from '@/lib/data';
import { REACTIONS, flowerGlyph } from '@/lib/data';
import { t, timeAgo } from '@/lib/i18n';
import { getVisitorId } from '@/lib/identity';
import { reportWish } from '@/lib/report';

interface Props {
  wishes: Wish[];
  lang: Lang;
  myWishId: string | null;
  reacted: Record<string, ReactionId>;
  onReact: (wishId: string, reaction: ReactionId) => Promise<Wish['reactions'] | null>;
  onReacted: (id: string, counts: Wish['reactions']) => void;
  /** Open the blessing dialog pre-targeted at a wish (chunk B). */
  onBless?: (wishId: string) => void;
  /** Wish ids hidden on this device (`loy:hidden`, chunk F2). */
  hiddenIds: string[];
  /** Hide a wish on this device only (the HTML's `hideWish`). */
  onHide: (wishId: string) => void;
  /** Show a wish hidden on this device again. */
  onUnhide: (wishId: string) => void;
}

export default function WishWall({ wishes, lang, myWishId, reacted, onReact, onReacted, onBless, hiddenIds, onHide, onUnhide }: Props) {
  const s = t(lang);
  const [query, setQuery] = useState('');
  const [showTranslation, setShowTranslation] = useState<Record<string, boolean>>({});
  // Wishes this device reported, this visit (the HTML's `U.reported`
  // set): the card shows the `reported` note in place of the buttons.
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = wishes.filter((w) => {
      if (hiddenIds.includes(w.id) && !showHidden) return false;
      if (!q) return true;
      return (
        w.wish.toLowerCase().includes(q) ||
        (w.translation ?? '').toLowerCase().includes(q) ||
        w.name.toLowerCase().includes(q)
      );
    });
    return list;
  }, [wishes, query, hiddenIds, showHidden]);

  async function react(wish: Wish, reaction: ReactionId) {
    const counts = await onReact(wish.id, reaction);
    if (counts) onReacted(wish.id, counts);
  }

  async function report(wish: Wish) {
    if (reportedIds.has(wish.id)) return;
    await reportWish(wish.id, getVisitorId());
    setReportedIds((prev) => new Set(prev).add(wish.id));
  }

  return (
    <div>
      <div className="wall-tools">
        <div className="field">
          <label htmlFor="wall-search">{s.searchLabel}</label>
          <input
            id="wall-search"
            type="search"
            value={query}
            placeholder={s.searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="pill gold" aria-live="polite">{s.riverCount(wishes.length)}</span>
      </div>

      {hiddenIds.length > 0 && (
        <p className="hint" role="status">
          {s.hiddenLine(hiddenIds.length)}{' '}
          <button type="button" className="btn small ghost" onClick={() => setShowHidden((v) => !v)}>
            {showHidden ? s.hideHidden : s.showHidden}
          </button>
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="hint">{query.trim() ? s.searchEmpty(query.trim()) : s.riverEmpty}</p>
      ) : (
        <div className="wall">
          {filtered.map((w) => {
            const showingTranslation = !!showTranslation[w.id] && !!w.translation;
            const mine = reacted[w.id] ?? null;
            const hiddenHere = hiddenIds.includes(w.id);
            const reported = reportedIds.has(w.id);
            return (
              <article className={`wish-card ${hiddenHere ? 'hidden-here' : ''}`} key={w.id}>
                <div className="wc-top">
                  <span className="wc-glyph" aria-hidden="true">{flowerGlyph(w.flower)}</span>
                  <span className="wc-name">{w.name.trim() || s.anonymous}</span>
                  {w.id === myWishId && <span className="mine-badge">{s.yourKrathong}</span>}
                  <span className="wc-time">{timeAgo(w.createdAt, lang)}</span>
                </div>
                <p className="wc-text">{showingTranslation ? w.translation : w.wish}</p>
                {w.translation && (
                  <p className="wc-trans">
                    <button
                      type="button"
                      onClick={() => setShowTranslation((prev) => ({ ...prev, [w.id]: !prev[w.id] }))}
                    >
                      {showingTranslation ? s.showOriginal : s.showTranslation} · {s.translatedNote}
                    </button>
                  </p>
                )}
                {hiddenHere ? (
                  <div className="wc-report">
                    <span className="muted">{s.hiddenHere}</span>
                    <button type="button" className="btn small ghost" onClick={() => onUnhide(w.id)}>
                      {s.unhide}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="reactions" role="group" aria-label={s.reactionsLabel}>
                      {REACTIONS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="react-btn"
                          aria-pressed={mine === r.id}
                          aria-label={`${r.label[lang]} — ${w.reactions[r.id]}`}
                          onClick={() => react(w, r.id)}
                        >
                          <span aria-hidden="true">{r.glyph}</span>
                          <span className="n">{w.reactions[r.id]}</span>
                        </button>
                      ))}
                    </div>
                    {/* Chunk B: blessing lanterns on the wall. A count shows
                        on every card that has one; a friend's card gets a
                        "Send a blessing lantern" button that opens the
                        dialog pre-targeted at that wish. */}
                    {((w.blessings ?? 0) > 0 || (onBless && w.id !== myWishId)) && (
                      <div className="wc-bless">
                        {(w.blessings ?? 0) > 0 && (
                          <span className="wc-lanterns" aria-label={s.lanternsReceived(w.blessings ?? 0)}>
                            {s.lanternsCount(w.blessings ?? 0)}
                          </span>
                        )}
                        {onBless && w.id !== myWishId && (
                          <button type="button" className="btn small ghost" onClick={() => onBless(w.id)}>
                            {`🏮 ${s.blessingButton}`}
                          </button>
                        )}
                      </div>
                    )}
                    {/* Chunk F2: report + hide. Not the visitor's own
                        krathong. After reporting, the card shows the
                        `reported` note in place of the buttons. */}
                    {w.id !== myWishId && (
                      <div className="wc-report">
                        {reported ? (
                          <span className="muted" role="status">{s.reported}</span>
                        ) : (
                          <>
                            <button type="button" className="btn small ghost" onClick={() => void report(w)}>
                              {s.reportButton}
                            </button>
                            <button type="button" className="btn small ghost" onClick={() => onHide(w.id)}>
                              {s.hideButton}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
