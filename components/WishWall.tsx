// The wish wall: searchable, newest-first cards with reaction buttons.
// One reaction per wish per visitor (Rules: toggleReaction) — the choice
// lives in the useReactions hook, shared with the pinned wish panel.

'use client';

import { useMemo, useState } from 'react';
import type { Lang, ReactionId, Wish } from '@/lib/data';
import { REACTIONS, flowerGlyph } from '@/lib/data';
import { t, timeAgo } from '@/lib/i18n';

interface Props {
  wishes: Wish[];
  lang: Lang;
  myWishId: string | null;
  reacted: Record<string, ReactionId>;
  onReact: (wishId: string, reaction: ReactionId) => Promise<Wish['reactions'] | null>;
  onReacted: (id: string, counts: Wish['reactions']) => void;
}

export default function WishWall({ wishes, lang, myWishId, reacted, onReact, onReacted }: Props) {
  const s = t(lang);
  const [query, setQuery] = useState('');
  const [showTranslation, setShowTranslation] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wishes;
    return wishes.filter(
      (w) =>
        w.wish.toLowerCase().includes(q) ||
        (w.translation ?? '').toLowerCase().includes(q) ||
        w.name.toLowerCase().includes(q),
    );
  }, [wishes, query]);

  async function react(wish: Wish, reaction: ReactionId) {
    const counts = await onReact(wish.id, reaction);
    if (counts) onReacted(wish.id, counts);
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

      {filtered.length === 0 ? (
        <p className="hint">{query.trim() ? s.searchEmpty(query.trim()) : s.riverEmpty}</p>
      ) : (
        <div className="wall">
          {filtered.map((w) => {
            const showingTranslation = !!showTranslation[w.id] && !!w.translation;
            const mine = reacted[w.id] ?? null;
            return (
              <article className="wish-card" key={w.id}>
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
