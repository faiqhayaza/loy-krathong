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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang, ReactionId, Wish } from '@/lib/data';
import { DESTINATIONS, REACTIONS, STAMP_ICON, flowerGlyph } from '@/lib/data';
import { calendar, calendarFromConfig, defaultDestination, isOpenDay } from '@/lib/festival';
import { shortDate, t } from '@/lib/i18n';
import SkyCanvas from '@/components/SkyCanvas';
import RiverCanvas from '@/components/RiverCanvas';
import Builder from '@/components/Builder';
import WishWall from '@/components/WishWall';
import SoundToggle from '@/components/SoundToggle';
import { audio } from '@/lib/audio';
import { useReactions } from '@/components/useReactions';
import IdentityDialog from '@/components/IdentityDialog';
import { collectLocalState, useFestivalState } from '@/components/useFestivalState';
import SecretDialog from '@/components/SecretDialog';
import SecretsPanel from '@/components/SecretsPanel';
import WelcomeDialog from '@/components/WelcomeDialog';
import JourneyCard from '@/components/JourneyCard';
import MyKrathong from '@/components/MyKrathong';
import { MilestoneCard, MissionsAll, MissionsPanel, panelDay, useMissionsVersion } from '@/components/Missions';
import { loadClaims, milestoneFor } from '@/lib/missions';
import { getIdentity, getVisitorId } from '@/lib/identity';
import { recordEvent } from '@/lib/events';
import { bangkokDay } from '@/lib/bangkok';
import { loadWelcomeDay } from '@/lib/welcome';
import { isSecretFound } from '@/lib/secrets';
import { journeyFor } from '@/lib/journey';
import { previewNight } from '@/lib/specials';
import { candleFlameToday } from '@/lib/candle';
import { hideWish, loadHiddenIds, unhideWish } from '@/lib/report';
import Specials from '@/components/Specials';
import QuizDialog from '@/components/QuizDialog';
import BlessDialog from '@/components/BlessDialog';
import GratitudeDialog from '@/components/GratitudeDialog';
import CandleDialog from '@/components/CandleDialog';
import FinaleOverlay from '@/components/FinaleOverlay';
import RiverMoments from '@/components/RiverMoments';

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
  // E1: the festival state (config, me, community) comes from the
  // server now — the calendar follows the organiser config (startDay,
  // mode, simDay) instead of the hardcoded defaults, and the passport
  // (stamps/visits) is dual-written to the server. While the state has
  // not loaded yet, the local calendar is the fallback.
  const fest = useFestivalState();
  const cal = fest.payload ? calendarFromConfig(fest.payload.config) : calendar();
  const opening = useOpeningCountdown(cal.firstDay);

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
  // Chunk A: the milestone stage drives the river scene (A4) and the
  // side panel. useMissionsVersion re-renders this page whenever the
  // event or claims store changes, so a claim updates the river too.
  // (`cal` above already follows the server config when it has loaded.)
  const missionsVersion = useMissionsVersion();
  void missionsVersion;
  const milestoneDay = panelDay(cal);
  const milestone = milestoneFor(milestoneDay, loadClaims());
  // E1: once the server state is live, adopt its passport — union with
  // the device-local one, so taps made while offline are kept and
  // stamps earned on another device arrive here. There is no stamp
  // removal, so a union can never resurrect anything deleted.
  const serverMe = fest.payload?.me;
  useEffect(() => {
    if (!serverMe) return;
    setStamps((current) => {
      const next = [...new Set([...current, ...serverMe.stamps])];
      if (next.length !== current.length) saveLocal('loy:stamps', next);
      return next.length === current.length ? current : next;
    });
    setVisits((current) => {
      const next = [...new Set([...current, ...serverMe.visits])];
      if (next.length !== current.length) saveLocal('loy:visits', next);
      return next.length === current.length ? current : next;
    });
  }, [serverMe]);
  // E4: when an organiser celebration starts, fire the river's
  // fireworks show (RiverCanvas listens for 'loy:celebrate'). The ref
  // remembers the celebration that already fired, so a re-render or a
  // re-poll does not restart the show.
  const celebratedUntilRef = useRef<number | null>(null);
  useEffect(() => {
    const until = fest.payload?.config.celebrateUntil ?? null;
    if (until && until > Date.now() && celebratedUntilRef.current !== until) {
      celebratedUntilRef.current = until;
      window.dispatchEvent(new Event('loy:celebrate'));
    }
  }, [fest.payload?.config.celebrateUntil, fest.celebrating]);
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
  // (Chunk B fix — pre-existing: the Builder stores `loy:my-wish` as
  // a raw id, not JSON, so JSON.parse throws on a bare uuid and this
  // was always null on a return visit, which hid the "Your krathong"
  // badge and broke the blessing dialog's own-wish rule. Accept both
  // shapes; the Builder now writes JSON going forward.)
  const [myWishId, setMyWishId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('loy:my-wish');
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as unknown;
        return typeof parsed === 'string' ? parsed : null;
      } catch {
        return raw;
      }
    } catch {
      return null;
    }
  });
  // Chunk B — the seven specials. `specialDialog` opens one dialog;
  // the finale is a scene, not a dialog, so it has its own flag.
  // `eventsTick` re-reads the event store (Specials done states) after
  // a dialog records an event. `blessTarget` pre-targets the blessing
  // dialog at one wish (from a wall card button).
  const [specialDialog, setSpecialDialog] = useState<'quiz' | 'bless' | 'gratitude' | 'candle' | null>(null);
  const [blessTarget, setBlessTarget] = useState<string | null>(null);
  const [finaleActive, setFinaleActive] = useState(false);
  const [finaleFlower, setFinaleFlower] = useState('lotus');
  const [eventsTick, setEventsTick] = useState(0);
  const riverRef = useRef<HTMLDivElement>(null);
  // Chunk F2 — wishes hidden on this device only (`loy:hidden`).
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => loadHiddenIds());

  // Chunk F1 — the river shows today's candle flame on the visitor's
  // own krathongs. The rebuild tracks one own wish (`loy:my-wish`),
  // so only that krathong retints; earlier same-day wishes keep the
  // flame they floated with. Wishes hidden on this device (F2) never
  // reach the canvas.
  const flameToday = candleFlameToday();
  const riverWishes = useMemo(
    () =>
      wishes
        .filter((w) => !hiddenIds.includes(w.id))
        .map((w) => (w.id === myWishId && flameToday ? { ...w, flame: flameToday } : w)),
    [wishes, hiddenIds, myWishId, flameToday],
  );
  // --- Chunk C state ---
  // The secret riddle dialog, by destination slug (null = closed).
  const [secretSlug, setSecretSlug] = useState<string | null>(null);
  // Bumped after a secret is found so the secrets list, the anchor
  // and the journey card re-read the stores.
  const [secretsVersion, setSecretsVersion] = useState(0);
  // The once-per-day welcome dialog (C3) and the journey card (C2).
  const [showWelcome, setShowWelcome] = useState(false);
  const [showJourney, setShowJourney] = useState(false);

  // Welcome dialog (C3): once per Bangkok day, on first visit that
  // day, after the identity gate has passed. The dialog itself records
  // the day when it closes.
  useEffect(() => {
    if (showIdentityGate !== false) return;
    if (loadWelcomeDay() !== bangkokDay()) setShowWelcome(true);
  }, [showIdentityGate]);

  // Tonight's secret: the glimmer anchor over the river shows while a
  // night is open and that night's secret is still unfound. Before the
  // festival there is no tonight, so there is no glimmer; in the
  // archive phase the latest destination's secret glimmers. Found
  // secrets stay reachable from the secrets list below.
  const tonightSecretOpen =
    cal.phase !== 'before' && !isSecretFound(riverDest.id);

  // Join the grand finale (B5): the server confirms night 7 is open,
  // the `finale` event records, then the 8.5 s scene plays.
  async function joinFinale() {
    try {
      const res = await fetch('/api/finale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getVisitorId() ? { 'x-visitor-id': getVisitorId() as string } : {}),
        },
        body: JSON.stringify({ ...(previewNight() !== null ? { previewNight: previewNight() } : {}) }),
      });
      if (!res.ok) return;
    } catch {
      return;
    }
    recordEvent('finale', 0);
    setEventsTick((n) => n + 1);
    try {
      const saved = JSON.parse(localStorage.getItem('loy:krathong') ?? '{}') as { flower?: string };
      if (typeof saved.flower === 'string') setFinaleFlower(saved.flower);
    } catch {
      // the default lotus stands
    }
    setFinaleActive(true);
  }

  function openSpecial(kind: 'quiz' | 'blessing' | 'gratitude' | 'finale' | 'candle') {
    if (kind === 'finale') {
      void joinFinale();
      return;
    }
    setBlessTarget(null);
    setSpecialDialog(kind === 'blessing' ? 'bless' : kind);
  }

  // Chunk F2 — hide / unhide a wish on this device only.
  function hideWishOnDevice(wishId: string) {
    hideWish(wishId);
    setHiddenIds(loadHiddenIds());
  }
  function unhideWishOnDevice(wishId: string) {
    unhideWish(wishId);
    setHiddenIds(loadHiddenIds());
  }

  function scrollToFloat() {
    document.getElementById('float')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function refreshWishesAfterBlessing() {
    const list = await fetchWishes();
    if (list) setWishes(list);
    setEventsTick((n) => n + 1);
  }

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

  // Reveal on scroll — re-runs after the identity gate passes, or a
  // first-time visitor would never see the .reveal sections (they are
  // not rendered until the gate passes, so the first observer run finds
  // nothing to observe).
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
    // E1: dual-write — the server copy is what follows the visitor to
    // another device; the local copy is the offline fallback.
    void fest.saveMe({ visits: next });
  }

  function collectStamp(id: string) {
    if (stamps.includes(id)) return;
    const next = [...stamps, id];
    setStamps(next);
    saveLocal('loy:stamps', next);
    void fest.saveMe({ stamps: next });
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
    // E1: the krathong that just floated is the visitor's saved one —
    // push it to the server with the float (C4 adds an explicit save
    // button later; until then the float is the save point).
    const local = collectLocalState();
    if (local.krathong) void fest.saveMe({ krathong: local.krathong });
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
  // E1: once the visitor passes the gate, refresh the festival state
  // at once — the hook's 30 s poll would otherwise take up to 30 s to
  // learn the visitor's ID, and the one-time migration (which runs off
  // the first live state) would wait with it.
  if (showIdentityGate !== false) {
    return (
      <IdentityDialog
        lang={lang}
        onDone={() => {
          setShowIdentityGate(false);
          void fest.refresh();
        }}
      />
    );
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

      {/* E1: the river could not be reached — keep showing the last
          update; the state hook retries on its own. */}
      {fest.status === 'down' && (
        <div className="phase-banner" role="status">
          <strong>⚠️ {s.serverDown}</strong>
          <span>{s.serverDownBody}</span>
        </div>
      )}
      {/* E3: the organisers set a pretend date for everyone. */}
      {fest.payload?.config.simDay && (
        <div className="phase-banner" role="status">
          <strong>🔍 Preview</strong>
          <span>{s.previewingAll(shortDate(fest.payload.config.simDay, lang))}</span>
        </div>
      )}
      {/* E4: rewards paused / celebration running, set by the organisers. */}
      {fest.payload?.config.paused && (
        <div className="phase-banner" role="status">
          <strong>⏸️ {s.pausedNote}</strong>
        </div>
      )}
      {fest.celebrating && (
        <div className="phase-banner" role="status">
          <strong>🎆 {s.celebration}</strong>
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

      {/* The river — full-width, directly under the hero: it is the
          heart of the night. The float form sits below it, and My
          Krathong follows the form, so the flow reads: see the river,
          float your krathong, find it on the river and in your panel. */}
      <section
        className="river-section reveal"
        id="river"
        aria-labelledby="river-title"
        onClick={(e) => {
          // Hidden fireworks easter egg: any click in the river area
          // counts — the canvas, the wish detail panel, the empty state.
          // The builder form (#float) is a sibling section now, so its
          // clicks never reach this handler; the guard stays as a
          // backstop. One physical click dispatches exactly one event;
          // the canvas itself counts nothing, so a click is never
          // counted twice.
          if ((e.target as HTMLElement).closest('#float')) return;
          window.dispatchEvent(new Event('loy:river-click'));
        }}
      >
        <div className="river-head">
          <p className="kicker">The river · Chao Phraya</p>
          <div className="section-head">
            <h2 id="river-title">{s.riverTitle}</h2>
            <span className="pill" aria-live="polite">
              {loading ? '…' : s.riverCount(wishes.length)}
            </span>
          </div>
          <p className="section-intro">{s.riverHint}</p>
        </div>
        <div className="river-wrap" ref={riverRef}>
          <RiverCanvas
            wishes={riverWishes}
            lang={lang}
            highlightId={highlightId}
            onHover={(wish, x, y) => setHover(wish ? { wish, x, y } : null)}
            onSelect={(wish) => setPinned(wish)}
            destinationId={riverDest.id}
            milestoneStage={milestone.stage}
          />
          {/* Tonight's secret (C1): one object glimmers slightly
              brighter than its surroundings — a hidden anchor over
              the water, where the temple's reflection meets the
              moon's path. Tapping it opens tonight's riddle. The
              click must not also set off the fireworks easter egg
              (the section counts river clicks), so it stops
              propagation. */}
          {tonightSecretOpen && (
            <button
              type="button"
              className="secret-anchor"
              aria-label={s.secretGlimmer}
              title={s.secretGlimmer}
              onClick={(e) => {
                e.stopPropagation();
                setSecretSlug(riverDest.id);
              }}
            >
              <span aria-hidden="true">✦</span>
            </button>
          )}
          {/* Chunk B — blessing lanterns rising, thanks lanterns drifting. */}
          <RiverMoments lang={lang} />
          <div className="river-bar">
            {pending.length > 0 && (
              <span className="pill gold" role="status">
                {s.newWishes(pending.length)}
                <button type="button" onClick={refreshRiver}>{s.refreshRiver}</button>
              </span>
            )}
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
      </section>

      {/* Float — below the river (Designer C): the builder on the left,
          tonight's missions and the milestone card in a rail on the
          right. The section owns the title and intro; the form itself
          starts with the stamps and the preview. */}
      <section className="float-section reveal" id="float" aria-labelledby="float-title">
        <p className="kicker">Float a krathong</p>
        <div className="section-head">
          <h2 id="float-title">{s.builderTitle}</h2>
        </div>
        <p className="section-intro">{s.builderIntro}</p>
        <div className="float-grid">
          <Builder lang={lang} onFloated={handleFloated} />
          <div className="float-rail">
            {/* Chunk A side panel: tonight's missions + the milestone card. */}
            <MissionsPanel lang={lang} cal={cal} />
            <MilestoneCard lang={lang} cal={cal} day={milestoneDay} />
          </div>
        </div>
      </section>

      {/* My Krathong (Chunk C4) + journey card (C2). */}
      <section className="section reveal" id="my-krathong" aria-labelledby="my-krathong-title">
        <p className="kicker">My krathong</p>
        <div className="section-head">
          <h2 id="my-krathong-title">{s.myKrathongTitle}</h2>
          <button type="button" className="btn ghost" onClick={() => setShowJourney(true)}>
            {s.journeyOpen}
          </button>
        </div>
        <p className="section-intro">{s.myKrathongIntro}</p>
        <MyKrathong lang={lang} wishes={wishes} />
      </section>

      {/* Seven destinations */}
      <section className="section reveal" id="destinations" aria-labelledby="dest-title">
        <p className="kicker">Seven nights · Seven rivers</p>
        <div className="section-head">
          <h2 id="dest-title">{s.destinationsTitle}</h2>
          <span className="hint">
            {lang === 'th'
              ? `${stamps.length} จาก 7 ตรา`
              : `${stamps.length} of 7 stamps`}
          </span>
        </div>
        <p className="section-intro">{s.destinationsHint}</p>
        <div className="dest-strip">
          {DESTINATIONS.map((d, i) => {
            const done = stamps.includes(d.id);
            const visited = visits.includes(d.id);
            const open = isOpenDay(cal, d.day);
            const state = done ? 'stamped' : !open ? 'locked' : visited ? 'visited' : 'open';
            return (
              <button
                key={d.id}
                type="button"
                className={`dest ${state}`}
                style={{ '--i': i } as React.CSSProperties}
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

      {/* Hidden secrets (Chunk C1): all seven, with found state. */}
      <section className="section reveal" aria-labelledby="secrets-title">
        <p className="kicker">Hidden secrets</p>
        <div className="section-head">
          <h2 id="secrets-title">{s.secretsTitle}</h2>
        </div>
        <p className="section-intro">{s.secretsIntro}</p>
        <SecretsPanel
          key={secretsVersion}
          lang={lang}
          cal={cal}
          onOpen={(slug) => {
            setSecretSlug(slug);
            riverRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      </section>

      {/* Chunk B — the seven specials, one per night. */}
      <Specials lang={lang} tick={eventsTick} onOpenDialog={openSpecial} onFloatScroll={scrollToFloat} />

      {/* Missions — all seven nights (chunk A; the Me tab lists these once C4 lands it there). */}
      <section className="section reveal" id="missions" aria-labelledby="missions-all-title">
        <p className="kicker">All seven nights</p>
        <div className="section-head">
          <h2 id="missions-all-title">{s.missionsAllTitle}</h2>
        </div>
        <MissionsAll lang={lang} cal={cal} />
      </section>

      {/* Wish wall */}
      <section className="section reveal" id="wishes" aria-labelledby="wall-title">
        <p className="kicker">Wishes floating</p>
        <div className="section-head">
          <h2 id="wall-title">{s.wallTitle}</h2>
        </div>
        <WishWall
          wishes={wishes}
          lang={lang}
          loading={loading}
          myWishId={myWishId}
          reacted={reacted}
          onReact={toggleReaction}
          onReacted={updateWishReactions}
          hiddenIds={hiddenIds}
          onHide={hideWishOnDevice}
          onUnhide={unhideWishOnDevice}
          onBless={(wishId) => {
            setBlessTarget(wishId);
            setSpecialDialog('bless');
          }}
        />
      </section>

      {/* Chunk B — the special dialogs and the finale scene. */}
      {specialDialog === 'quiz' && (
        <QuizDialog lang={lang} onClose={() => { setSpecialDialog(null); setEventsTick((n) => n + 1); }} />
      )}
      {specialDialog === 'bless' && (
        <BlessDialog
          lang={lang}
          wishes={wishes}
          myWishId={myWishId}
          targetId={blessTarget}
          onClose={() => { setSpecialDialog(null); setBlessTarget(null); setEventsTick((n) => n + 1); }}
          onSent={() => void refreshWishesAfterBlessing()}
        />
      )}
      {specialDialog === 'gratitude' && (
        <GratitudeDialog lang={lang} onClose={() => { setSpecialDialog(null); setEventsTick((n) => n + 1); }} />
      )}
      {specialDialog === 'candle' && (
        <CandleDialog lang={lang} onClose={() => { setSpecialDialog(null); setEventsTick((n) => n + 1); }} />
      )}
      {finaleActive && (
        <FinaleOverlay lang={lang} flower={finaleFlower} onClose={() => setFinaleActive(false)} />
      )}

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

      {/* Chunk C dialogs */}
      {secretSlug &&
        (() => {
          const dest = DESTINATIONS.find((d) => d.id === secretSlug);
          return dest ? (
            <SecretDialog
              lang={lang}
              destination={dest}
              onClose={() => setSecretSlug(null)}
              onFound={() => setSecretsVersion((v) => v + 1)}
            />
          ) : null;
        })()}
      {showWelcome && (
        <WelcomeDialog
          lang={lang}
          destination={riverDest}
          onLangChange={switchLang}
          onClose={() => setShowWelcome(false)}
        />
      )}
      {showJourney && (
        <JourneyCard lang={lang} cal={cal} journey={journeyFor(cal)} onClose={() => setShowJourney(false)} />
      )}
    </div>
  );
}
