// The wish wall: searchable, newest-first cards with reaction buttons.
// One reaction per type per wish per browser, guarded in localStorage; the
// server simply counts.

'use client';

import { useMemo, useState } from 'react';
import type { Lang, ReactionId, Wish } from '@/lib/data';
import { REACTIONS, flowerGlyph } from '@/lib/data';
import { t, timeAgo } from '@/lib/i18n';

interface Props {
  wishes: Wish[];
  lang: Lang;
  myWishId: string | null;
  onReacted: (id: string, counts: Wish['reactions']) => void;
}

export default function WishWall({ wishes, lang, myWishId, onReacted }: Props) {
  const s = t(lang);
  const [query, setQuery] = useState('');
  const [showTranslation, setShowTranslation] = useState<Record<string, boolean>>({});
  const [reacted, setReacted] = useState<Record<string, ReactionId[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem('loy:reacted') ?? '{}') as Record<string, ReactionId[]>;
    } catch {
      return {};
    }
  });

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
    const mine = reacted[wish.id] ?? [];
    if (mine.includes(reaction)) return;
    try {
      const res = await fetch(`/api/wishes/${wish.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { reactions: Wish['reactions'] };
      const next = { ...reacted, [wish.id]: [...mine, reaction] };
      setReacted(next);
      try {
        localStorage.setItem('loy:reacted', JSON.stringify(next));
      } catch {
        // private mode: the reaction still counted
      }
      onReacted(wish.id, data.reactions);
    } catch {
      // offline: leave the button as-is
    }
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
            const mine = reacted[w.id] ?? [];
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
                      aria-pressed={mine.includes(r.id)}
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
