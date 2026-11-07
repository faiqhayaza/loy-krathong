// The client side of the server-side passport (E1).
//
// `useFestivalState` polls GET /api/state every 30 s with ETag
// (`If-None-Match` → 304, no body) and the visitor's recovery ID as the
// `x-visitor-id` header. It exposes:
// - `payload`: the last state (config, wishes, me, community) or null
// - `status`: 'loading' | 'live' | 'down' | 'anonymous'
//   ('down' = the server could not be reached — the page shows the
//   `serverDown` banner and keeps the last update; 'anonymous' = no
//   identity on this device, so `me` is empty)
// - `serverOffset`: serverNow - Date.now() at the last poll, so the
//   client can agree with the server on the Bangkok day
// - `migrate()`: the one-time move of device-local state to the server
//   (POST /api/state/migrate), run once per device per identity
// - `saveMe(patch)`: incremental `me` updates (PATCH /api/state)
//
// After E1 the client keeps ONLY device preferences locally (language,
// sound, panels, welcome day — the PREFS_KEY set in the plan). The
// passport itself (stamps, visits, events, krathong) lives on the
// server; the local copies remain as the offline fallback and are
// dual-written while the migration settles.
//
// A worry is never part of any payload here and is never sent.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getVisitorId } from '@/lib/identity';
import { loadEvents } from '@/lib/events';
import { isCelebrating } from '@/lib/config';
import type { StatePayload, VisitorState } from '@/lib/festivalState';

export type FestivalStateStatus = 'loading' | 'live' | 'down' | 'anonymous';

const POLL_MS = 30_000;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** The device-local state E1 migrates, gathered from the old keys. */
export function collectLocalState(): Partial<VisitorState> {
  const krathong = loadJson<{ flower?: unknown; boat?: unknown }>('loy:krathong', {});
  const stamps = loadJson<string[]>('loy:stamps', []).filter((s) => typeof s === 'string');
  const visits = loadJson<string[]>('loy:visits', []).filter((s) => typeof s === 'string');
  return {
    krathong:
      typeof krathong.flower === 'string' && typeof krathong.boat === 'string'
        ? { flower: krathong.flower, boat: krathong.boat }
        : null,
    events: loadEvents(),
    stamps: [...new Set(stamps)],
    visits: [...new Set([...visits, ...stamps])],
    secrets: [],
    thanks: null,
    sent: [],
    received: {},
  };
}

export function useFestivalState() {
  const [payload, setPayload] = useState<StatePayload | null>(null);
  const [status, setStatus] = useState<FestivalStateStatus>('loading');
  const [serverOffset, setServerOffset] = useState(0);
  const etagRef = useRef<string | null>(null);
  const migratedRef = useRef(false);
  const payloadRef = useRef<StatePayload | null>(null);

  const fetchState = useCallback(async () => {
    const visitorId = getVisitorId();
    const headers: Record<string, string> = {};
    if (visitorId) headers['x-visitor-id'] = visitorId;
    if (etagRef.current) headers['If-None-Match'] = etagRef.current;
    let res: Response;
    try {
      res = await fetch('/api/state', { headers, cache: 'no-store' });
    } catch {
      setStatus('down');
      return null;
    }
    if (res.status === 304) {
      setStatus(visitorId ? 'live' : 'anonymous');
      return payloadRef.current;
    }
    if (!res.ok) {
      setStatus('down');
      return null;
    }
    const etag = res.headers.get('ETag');
    if (etag) etagRef.current = etag;
    const data = (await res.json()) as StatePayload;
    payloadRef.current = data;
    setPayload(data);
    setServerOffset(data.serverNow - Date.now());
    setStatus(visitorId ? 'live' : 'anonymous');
    return data;
  }, []);

  // Initial load + 30 s poll, same cadence as the old /api/wishes poll
  // (the Redis command budget in the plan, §3.9 — ETag/304 keeps idle
  // polling cheap).
  useEffect(() => {
    let alive = true;
    void fetchState();
    const id = setInterval(() => {
      if (alive) void fetchState();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [fetchState]);

  const migrate = useCallback(async () => {
    const visitorId = getVisitorId();
    if (!visitorId || migratedRef.current) return false;
    if (typeof window !== 'undefined') {
      try {
        if (localStorage.getItem(`loy:migrated:${visitorId}`) === '1') {
          migratedRef.current = true;
          return false;
        }
      } catch {
        // private mode: migrate anyway; the merge is idempotent
      }
    }
    try {
      const res = await fetch('/api/state/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-visitor-id': visitorId },
        body: JSON.stringify(collectLocalState()),
      });
      if (!res.ok) return false;
    } catch {
      return false;
    }
    migratedRef.current = true;
    try {
      localStorage.setItem(`loy:migrated:${visitorId}`, '1');
    } catch {
      // flag lost; the merge is idempotent, so a repeat is harmless
    }
    etagRef.current = null; // force a full re-read after the migration
    await fetchState();
    return true;
  }, [fetchState]);

  // Run the one-time migration as soon as the first live state lands.
  useEffect(() => {
    if (status === 'live' && !migratedRef.current) void migrate();
  }, [status, migrate]);

  const saveMe = useCallback(
    async (patch: Partial<VisitorState>) => {
      const visitorId = getVisitorId();
      if (!visitorId) return null;
      try {
        const res = await fetch('/api/state', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-visitor-id': visitorId },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { me: VisitorState };
        etagRef.current = null;
        await fetchState();
        return data.me;
      } catch {
        return null;
      }
    },
    [fetchState],
  );

  return {
    payload,
    status,
    serverOffset,
    celebrating: payload ? isCelebrating(payload.config) : false,
    migrate,
    saveMe,
    refresh: fetchState,
  };
}
