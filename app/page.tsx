// Seven Nights of Wishes — one immersive page: night-sky hero with a live
// countdown, the seven-night passport strip, the shared river, the builder,
// and the wish wall. All wishes come from GET /api/wishes, shared by every
// visitor; the passport and language choice stay on this device only.
//
// The passport follows the Rules of the original site: a destination opens
// on its festival night (18–24 November, Bangkok day), a visit is recorded
// first, and only a visited destination can be stamped (collectStamp).
// Before the festival every destination is locked; in the archive phase
// (up to 14 days after the last night) they all stay open.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang, ReactionId, Wish } from '@/lib/data';
import { DESTINATIONS, REACTIONS, STAMP_ICON, flowerGlyph } from '@/lib/data';
import { calendar, defaultDestination, isOpenDay } from '@/lib/festival';
import { shortDate, t } from '@/lib/i18n';
import SkyCanvas from '@/components/SkyCanvas';
import RiverCanvas from '@/components/RiverCanvas';
import Builder from '@/components/Builder';
import WishWall from '@/components/WishWall';
import SoundToggle from '@/components/SoundToggle';
import { audio } from '@/lib/audio';
import { useReactions } from '@/components/useReactions';
import IdentityDialog from '@/components/IdentityDialog';
import { getIdentity } from '@/lib/identity';
import { recordEvent } from '@/lib/events';

const FESTIVAL_AT = Date.UTC(2026, 10, 24, 12, 0, 0); // 19:00 Asia/Bangkok

function useCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, FESTIVAL_AT - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor(diff / 3600000) % 24,
    mins: Math.floor(diff / 60000) % 60,
    secs: Math.floor(diff / 1000) % 60,
    tonight: diff === 0,
  };
}

/**
 * Countdown to the festival opening (first day, 00:00 Bangkok) for the
 * before-phase banner — the original site's renderBanner counts to the
 * opening, while the hero keeps counting to the full moon.
 */
function useOpeningCountdown(firstDay: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = Date.parse(`${firstDay}T00:00:00+07:00`);
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
  };
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // keepsake only; the river is unaffected
  }
}

/**
 * The passport stamps, with a one-time migration from the first version of
 * the strip: it stamped any destination on a tap, with a different set of
 * places. 'chiang-mai' becomes the original slug 'chiang_mai'; stamps for
 * places that were never festival destinations are dropped. Stamps that
 * survive are grandfathered in — and count as visits, so the state machine
 * stays coherent for them — while every new stamp follows the Rules.
 */
function loadStamps(): string[] {
  const raw = load<string[]>('loy:stamps', []);
  const valid = new Set(DESTINATIONS.map((d) => d.id));
  const mapped = [...new Set(raw.map((id) => (id === 'chiang-mai' ? 'chiang_mai' : id)).filter((id) => valid.has(id)))];
  if (mapped.length !== raw.length || mapped.some((id, i) => id !== raw[i])) {
    saveLocal('loy:stamps', mapped);
  }
  return mapped;
}

export default function Page() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    return load<Lang>('loy:lang', 'en') === 'th' ? 'th' : 'en';
  });
  const s = t(lang);
  const cd = useCountdown();
  const opening = useOpeningCountdown('2026-11-18');

  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Wish[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ wish: Wish; x: number; y: number } | null>(null);
  const [pinned, setPinned] = useState<Wish | null>(null);
  const [stamps, setStamps] = useState<string[]>(() => loadStamps());
  // Visits are the other half of the passport rule: a stamp can only be
  // collected after the destination has been visited. Grandfathered stamps
  // count as visits (see loadStamps).
  const [visits, setVisits] = useState<string[]>(() => [
    ...new Set([...load<string[]>('loy:visits', []), ...loadStamps()]),
  ]);
  const cal = calendar();
  // Tonight's destination: the river's shader water tint follows it.
  const riverDest = defaultDestination(cal);
  const { reacted, toggleReaction } = useReactions();
  // Identity gate (D1, full first page): null = not yet decided — the
  // gate renders on its own until the check runs, so the site is never
  // visible, not even for a frame, to a visitor who has not passed it.
  // null renders the gate on the server too, so SSR and the first client
  // paint agree (no hydration mismatch, no flash of the river). Once the
  // check runs, a stored identity opens the site; otherwise the gate
  // stays and the site is not rendered at all.
  // (The identity itself is read via getIdentity() when a chunk needs it.)
  const [showIdentityGate, setShowIdentityGate] = useState<boolean | null>(null);
  useEffect(() => {
    setShowIdentityGate(!getIdentity());
  }, []);
  const [myWishId, setMyWishId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : load<string | null>('loy:my-wish', null),
  );
  const riverRef = useRef<HTMLDivElement>(null);

  const fetchWishes = useCallback(async () => {
    try {
      const res = await fetch('/api/wishes', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = (await res.json()) as { wishes: Wish[] };
      return data.wishes;
    } catch {
      return null;
    }
  }, []);

  // Initial load
  useEffect(() => {
    let alive = true;
    fetchWishes().then((list) => {
      if (alive && list) setWishes(list);
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [fetchWishes]);

  // Poll every 30s; new wishes wait behind a pill instead of yanking the river.
  useEffect(() => {
    const id = setInterval(async () => {
      const list = await fetchWishes();
      if (!list) return;
      setWishes((current) => {
        const known = new Set(current.map((w) => w.id));
        const fresh = list.filter((w) => !known.has(w.id));
        if (fresh.length > 0) {
          setPending((p) => [...fresh, ...p.filter((w) => !list.some((x) => x.id === w.id))]);
          // Keep reaction counts current on wishes already shown.
          const byId = new Map(list.map((w) => [w.id, w]));
          return current.map((w) => byId.get(w.id) ?? w);
        }
        return list;
      });
    }, 30000);
    return () => clearInterval(id);
  }, [fetchWishes]);

  // Reveal on scroll. The effect must also re-run when the identity
  // gate closes: for a first-time visitor the page (and its .reveal
  // sections) only renders after sign-in, long after `loading` flipped
  // — with [loading] alone the observer was never attached and every
  // section stayed at opacity 0. (Found while verifying Chunk C; the
  // delivered tree has the same bug.)
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [loading, showIdentityGate]);

  // Ambient audio: browsers block sound before the visitor interacts, so
  // the kalimba starts on the first pointerdown/keydown anywhere on the
  // page and fades in (lib/audio). ensureStarted is idempotent, so the
  // listeners can stay mounted. The music also pauses while the tab is
  // hidden and resumes when visible.
  useEffect(() => {
    audio.bindVisibility();
    const start = () => audio.ensureStarted();
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, []);

  function switchLang(next: Lang) {
    setLang(next);
    try {
      localStorage.setItem('loy:lang', JSON.stringify(next));
    } catch {
      // language still switches for this visit
    }
  }

  // Passport, per the Rules: visit first (recordVisit), then collect
  // (collectStamp) — and only while the destination's night is open.
  // D1: a visit also records a `visit_place` event (ref = day number),
  // the evidence the visit mission reads. It records even when the
  // destination is already in `loy:visits` (grandfathered or re-tapped):
  // recordEvent dedupes by day+kind+ref, so a repeat is a no-op.
  function visit(id: string) {
    const d = DESTINATIONS.find((x) => x.id === id);
    if (d && isOpenDay(cal, d.day)) recordEvent('visit_place', d.day);
    if (visits.includes(id)) return;
    const next = [...visits, id];
    setVisits(next);
    saveLocal('loy:visits', next);
  }

  function collectStamp(id: string) {
    if (stamps.includes(id)) return;
    const next = [...stamps, id];
    setStamps(next);
    saveLocal('loy:stamps', next);
  }

  function onDestination(d: (typeof DESTINATIONS)[number]) {
    if (!isOpenDay(cal, d.day) || stamps.includes(d.id)) return;
    if (!visits.includes(d.id)) visit(d.id);
    else collectStamp(d.id);
  }

  function refreshRiver() {
    setWishes((current) => {
      const merged = [...pending, ...current];
      const seen = new Set<string>();
      return merged.filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true)));
    });
    setPending([]);
  }

  function handleFloated(wish: Wish) {
    setWishes((current) => [wish, ...current]);
    setMyWishId(wish.id);
    setHighlightId(wish.id);
    setPinned(wish);
    riverRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setHighlightId(null), 5000);
  }

  function updateWishReactions(id: string, counts: Wish['reactions']) {
    setWishes((current) => current.map((w) => (w.id === id ? { ...w, reactions: counts } : w)));
    setPinned((p) => (p && p.id === id ? { ...p, reactions: counts } : p));
  }

  async function reactPinned(wish: Wish, reaction: ReactionId) {
    const counts = await toggleReaction(wish.id, reaction);
    if (counts) updateWishReactions(wish.id, counts);
  }

  // The gate is the whole first page: while it is up (or undecided),
  // the site is not rendered at all — no hero, no passport, no river,
  // no wall — and there is no way past it except signing up or signing in.
  if (showIdentityGate !== false) {
    return <IdentityDialog lang={lang} onDone={() => setShowIdentityGate(false)} />;
  }

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true">🪷</span>
          <span>
            <span className="brand-name">{s.festivalName}</span>
            <br />
            <span className="brand-sub">{s.festivalDate}</span>
          </span>
        </a>
        <nav className="topnav" aria-label="Sections">
          <a href="#river">{s.navRiver}</a>
          <a href="#float">{s.navFloat}</a>
          <a href="#wishes">{s.navWishes}</a>
          <span className="top-controls">
            <span className="lang-toggle" role="group" aria-label="Language / ภาษา">
              <button type="button" aria-pressed={lang === 'en'} onClick={() => switchLang('en')}>
                EN
              </button>
              <button type="button" aria-pressed={lang === 'th'} onClick={() => switchLang('th')}>
                ไทย
              </button>
            </span>
            <SoundToggle lang={lang} />
          </span>
        </nav>
      </header>

      {/* Phase banner — the original site's renderBanner: before the
          festival it counts down to the opening (18 November); in the
          archive and closed phases it says so plainly. The hero keeps
          counting to the full moon. */}
      {cal.phase === 'before' && (
        <div className="phase-banner" role="status">
          <strong>🌙 {s.phaseBeforeTitle}</strong>
          <span>{s.phaseCountdown(opening.days, opening.hours)}</span>
        </div>
      )}
      {cal.phase === 'opening' && (
        <div className="phase-banner" role="status">
          <strong>{s.phaseOpeningTitle}</strong>
          <span>{s.phaseOpeningBody}</span>
        </div>
      )}
      {cal.phase === 'archive' && (
        <div className="phase-banner" role="status">
          <strong>{s.phaseArchiveTitle}</strong>
          <span>{s.phaseArchiveBody}</span>
        </div>
      )}
      {cal.phase === 'closed' && (
        <div className="phase-banner" role="status">
          <strong>{s.phaseClosedTitle}</strong>
        </div>
      )}

      {/* Hero */}
      <section className="hero" id="top">
        <SkyCanvas />
        <div className="hero-copy">
          <span className="eyebrow">Loy Krathong · 24 November 2026</span>
          <h1>
            Seven Nights of Wishes
            <span className="th" lang="th">เจ็ดค่ำคืนแห่งคำอธิษฐาน</span>
          </h1>
          <p className="lede">{s.heroIntro}</p>
          <div className="countdown" aria-live="off">
            {cd.tonight ? (
              <span className="cd-note">{s.countdownTonight}</span>
            ) : (
              <>
                <span className="cd-cell"><span className="cd-num">{cd.days}</span><br /><span className="cd-lab">{s.countdownDays}</span></span>
                <span className="cd-cell"><span className="cd-num">{cd.hours}</span><br /><span className="cd-lab">{s.countdownHours}</span></span>
                <span className="cd-cell"><span className="cd-num">{cd.mins}</span><br /><span className="cd-lab">{s.countdownMins}</span></span>
                <span className="cd-cell"><span className="cd-num">{cd.secs}</span><br /><span className="cd-lab">{s.countdownSecs}</span></span>
                <span className="cd-note">{s.countdownLabel}</span>
              </>
            )}
          </div>
          <div className="hero-actions">
            <a className="btn primary" href="#float">{s.heroCta} 🪷</a>
            <a className="btn ghost" href="#river">{s.heroSeeRiver}</a>
          </div>
        </div>
      </section>

      {/* Seven destinations */}
      <section className="section reveal" aria-labelledby="dest-title">
        <div className="section-head">
          <h2 id="dest-title">{s.destinationsTitle}</h2>
          <span className="hint">
            {stamps.length} / 7 {lang === 'th' ? 'ตรา' : 'stamps'}
          </span>
        </div>
        <p className="section-intro">{s.destinationsHint}</p>
        <div className="dest-strip">
          {DESTINATIONS.map((d) => {
            const done = stamps.includes(d.id);
            const visited = visits.includes(d.id);
            const open = isOpenDay(cal, d.day);
            const state = done ? 'stamped' : !open ? 'locked' : visited ? 'visited' : 'open';
            return (
              <button
                key={d.id}
                type="button"
                className={`dest ${state}`}
                disabled={!open || done}
                aria-label={`${d.name[lang]} — ${state === 'stamped' ? s.stamped : state === 'locked' ? s.destOpens(shortDate(cal.dates[d.day - 1], lang)) : state === 'visited' ? s.destVisited : s.destVisit}`}
                onClick={() => onDestination(d)}
              >
                <span className="dest-top">
                  <span className="dest-icon" aria-hidden="true">{STAMP_ICON[d.id]}</span>
                  <span className="dest-night">{s.destNight(d.day)}</span>
                </span>
                {done && <span className="dest-stamp">{s.stamped}</span>}
                <span className="dest-name">
                  {d.name[lang]}
                  <span className="th" lang="th">{d.name.th}</span>
                </span>
                <span className="dest-river">{d.river[lang]}</span>
                <span className="dest-note">{d.theme[lang]}</span>
                <span className="dest-cta">
                  {done ? '✓' : !open ? s.destOpens(shortDate(cal.dates[d.day - 1], lang)) : visited ? s.stampCollect : s.destVisit}
                </span>
              </button>
            );
          })}
        </div>
        {stamps.length === 7 && <p className="hint" role="status">{s.passportComplete}</p>}
      </section>

      {/* River + builder */}
      <section
        className="section reveal"
        id="river"
        aria-labelledby="river-title"
        onClick={(e) => {
          // Hidden fireworks easter egg: any click in the river area
          // counts — the canvas, the wish detail panel, the empty state.
          // The builder form (#float) is excluded, so composing a wish
          // never sets it off by accident. One physical click dispatches
          // exactly one event; the canvas itself counts nothing, so a
          // click is never counted twice.
          if ((e.target as HTMLElement).closest('#float')) return;
          window.dispatchEvent(new Event('loy:river-click'));
        }}
      >
        <div className="section-head">
          <h2 id="river-title">{s.riverTitle}</h2>
          <span className="pill" aria-live="polite">
            {loading ? '…' : s.riverCount(wishes.length)}
          </span>
        </div>
        <p className="section-intro">{s.riverHint}</p>
        <div className="layout">
          <div>
            <div className="river-wrap" ref={riverRef}>
              <RiverCanvas
                wishes={wishes}
                lang={lang}
                highlightId={highlightId}
                onHover={(wish, x, y) => setHover(wish ? { wish, x, y } : null)}
                onSelect={(wish) => setPinned(wish)}
                destinationId={riverDest.id}
              />
              <div className="river-bar">
                {pending.length > 0 && (
                  <span className="pill gold" role="status">
                    {s.newWishes(pending.length)}
                    <button type="button" onClick={refreshRiver}>{s.refreshRiver}</button>
                  </span>
                )}
              </div>
              <div className="river-credit">
                River photograph: Wat Arun on the Chao Phraya, Bangkok —{' '}
                <a
                  href="https://commons.wikimedia.org/wiki/File:An_illuminated_ARUN_WAT_on_the_banks_of_the_Chao_Phraya_river_in_Bangkok_during_the_traditional_Loi_Krathong_festival_on_Nov.11_night..JPG"
                  target="_blank"
                  rel="noreferrer"
                >
                  Wikimedia Commons
                </a>
                , CC0
              </div>
              {wishes.length === 0 && !loading && (
                <div className="river-empty">{s.riverEmpty}</div>
              )}
              {hover && (
                <div className="tip-card" style={{ left: hover.x, top: hover.y }} role="tooltip">
                  {hover.wish.wish}
                  <span className="tip-name">
                    {hover.wish.name.trim() || s.anonymous} · {flowerGlyph(hover.wish.flower)}
                  </span>
                </div>
              )}
            </div>

            {pinned && (
              <div className="pinned" aria-live="polite">
                <div className="pinned-head">
                  <span className="wc-glyph" aria-hidden="true">{flowerGlyph(pinned.flower)}</span>
                  <button type="button" className="btn small ghost" onClick={() => setPinned(null)}>
                    {s.close}
                  </button>
                </div>
                <p className="pinned-wish">“{pinned.wish}”</p>
                <span className="pinned-name">
                  {pinned.name.trim() || s.anonymous}
                  {pinned.translation ? ` · ${s.translatedNote}: “${pinned.translation}”` : ''}
                </span>
                <div className="reactions" role="group" aria-label={s.reactionsLabel}>
                  {REACTIONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="react-btn"
                      aria-pressed={reacted[pinned.id] === r.id}
                      aria-label={`${r.label[lang]} — ${pinned.reactions[r.id]}`}
                      onClick={() => reactPinned(pinned, r.id)}
                    >
                      <span aria-hidden="true">{r.glyph}</span>
                      <span className="n">{pinned.reactions[r.id]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div id="float">
            <Builder lang={lang} onFloated={handleFloated} />
          </div>
        </div>
      </section>

      {/* Wish wall */}
      <section className="section reveal" id="wishes" aria-labelledby="wall-title">
        <div className="section-head">
          <h2 id="wall-title">{s.wallTitle}</h2>
        </div>
        <WishWall wishes={wishes} lang={lang} myWishId={myWishId} reacted={reacted} onReact={toggleReaction} onReacted={updateWishReactions} />
      </section>

      {/* Closing footer — the page used to end abruptly after the wish
          wall. No privacy text here (that block stays removed); just a
          proper ending. */}
      <footer className="site-footer">
        <span>
          <span aria-hidden="true">🪷 </span>
          {s.festivalName}
        </span>
        <span>{s.festivalDate}</span>
      </footer>
    </div>
  );
}
