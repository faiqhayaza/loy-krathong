// One reaction per wish per visitor, like the original site
// (toggleReaction): the visitor holds at most one reaction on a wish, and
// tapping it again takes it back. The choice lives in localStorage
// (loy:reacted, wish id -> reaction id); the server only keeps counts.

'use client';

import { useCallback, useState } from 'react';
import type { ReactionId, Wish } from '@/lib/data';

const REACTED_KEY = 'loy:reacted';

/** Old shape (one array of reaction ids per wish) -> single reaction. */
function migrate(raw: unknown): Record<string, ReactionId> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, ReactionId> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') out[id] = value as ReactionId;
    else if (Array.isArray(value) && typeof value[0] === 'string') out[id] = value[0] as ReactionId;
  }
  return out;
}

function load(): Record<string, ReactionId> {
  try {
    return migrate(JSON.parse(localStorage.getItem(REACTED_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

export function useReactions() {
  const [reacted, setReacted] = useState<Record<string, ReactionId>>(load);

  /**
   * Toggle a reaction on a wish. Returns the server's new counts, or null
   * when the request failed (local state is left untouched then).
   */
  const toggleReaction = useCallback(
    async (wishId: string, reaction: ReactionId): Promise<Wish['reactions'] | null> => {
      const previous: ReactionId | null = reacted[wishId] ?? null;
      const next: ReactionId | null = previous === reaction ? null : reaction;
      try {
        const res = await fetch(`/api/wishes/${wishId}/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reaction: next, previous }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { reactions: Wish['reactions'] };
        const updated = { ...reacted };
        if (next) updated[wishId] = next;
        else delete updated[wishId];
        setReacted(updated);
        try {
          localStorage.setItem(REACTED_KEY, JSON.stringify(updated));
        } catch {
          // private mode: the reaction still counted
        }
        return data.reactions;
      } catch {
        return null;
      }
    },
    [reacted],
  );

  return { reacted, toggleReaction };
}
