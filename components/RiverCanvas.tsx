// The river: a living Bangkok night. Above the water — a deep sky with
// twinkling stars and a full moon, slow clouds, swifts crossing in loose
// flocks, the odd falling star, and a detailed Wat Arun illustration on
// the far bank (an SVG layered over the canvas, with warm lit windows and
// a soft reflection in the water). The weather follows the real Bangkok
// sky (Open-Meteo, refetched every 10 minutes; a gentle invented cycle
// takes over if the fetch fails), so rain, cloud and wind are what
// Bangkok is doing tonight — under a heavy overcast the clouds close
// into a deck and the moon and stars fade to a faint glow through it.
// On Loy Krathong night itself (24 Nov 2026, 19:00–23:59 Bangkok time)
// fireworks burst above the temple on their own and the swifts fly
// toward the spire. Five quick clicks anywhere on the
// canvas launch a short fireworks show — a hidden preview for the night.
//
// Below it all, real water: a photograph of a moonlit river, graded
// to the site's navy/gold palette and shipped locally
// (public/river-night.jpg — "Moonlight over the Chagres river", Brian
// Gratwicke, CC BY 2.0, see the credit under the river). Two rounds of
// hand-drawn water never read as a river in a still frame, so the
// photo carries the realism now — above all its real moon glitter
// path, which runs the full depth of the water and is shifted in code
// to sit under the canvas moon. The canvas layers on top are the life
// on it — the far bank with reeds at the water's edge, a soft glow
// where the temple meets the water, ripple arcs and moonlight that
// break and reform on the surface (restored in fix round 4: the
// photograph's own water is near-black away from the moon path, so
// the lower two-thirds need the drawn texture to read as water in a
// still frame), and one floating krathong per wish, name on a small
// tag above it. Hover (or tap) reads the wish; a click pins it open.

'use client';

import { useEffect, useRef } from 'react';
import type { Lang, Wish } from '@/lib/data';
import { boatColors, flameColor, flowerGlyph } from '@/lib/data';
import { audio } from '@/lib/audio';
import WatArunSvg from './WatArunSvg';

interface Sprite {
  id: string;
  x: number;
  row: number;
  speed: number;
  phase: number;
  scale: number;
  bornAt: number;
  fresh: boolean;
}

interface Star { x: number; y: number; r: number; phase: number; speed: number }
interface Cloud { x: number; y: number; s: number }
interface BankPt { x: number; y: number }
interface ReedBlade { h: number; lean: number; w: number; head: boolean }
interface Tuft { x: number; y: number; blades: ReedBlade[] }
interface Shimmer { x: number; y: number; w: number; phase: number; speed: number }
interface RippleArc { x: number; y: number; w: number; sag: number; base: number; phase: number; speed: number; gold: boolean; twin: boolean }
interface SwiftBird { dx: number; dy: number; phase: number }
interface SwiftFlock {
  birds: SwiftBird[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  toTemple: boolean;
}
interface Meteor { x: number; y: number; vx: number; vy: number; life: number }
interface RainDrop { x: number; y: number; len: number; speed: number }
interface RippleRing { x: number; y: number; r: number; max: number; a: number }
interface Rocket { x: number; y: number; vy: number; targetY: number; color: string; wobble: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Flash { x: number; y: number; color: string; bornAt: number }

interface Props {
  wishes: Wish[];
  lang: Lang;
  highlightId: string | null;
  onHover: (wish: Wish | null, x: number, y: number) => void;
  onSelect: (wish: Wish) => void;
}

const ROWS = 4;
const SKY_FRAC = 0.28; // sky band height, as a fraction of canvas height

// Loy Krathong night: 24 Nov 2026, 19:00–23:59 Asia/Bangkok (UTC+7, no DST).
const FESTIVAL_START = Date.UTC(2026, 10, 24, 12, 0, 0);
const FESTIVAL_END = Date.UTC(2026, 10, 24, 16, 59, 59);

function isFestivalNight(now = Date.now()): boolean {
  return now >= FESTIVAL_START && now <= FESTIVAL_END;
}

// The original site's palette, kept.
const FIREWORK_COLORS = ['#ffd27a', '#ff7eb6', '#b8a8ff', '#ffffff'];

const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018' +
  '&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m';

/** Map a WMO weather code to rain intensity (0–1), fog, and storm. */
function codeToWeather(code: number): { rain: number; fog: boolean; storm: boolean } {
  if (code === 0) return { rain: 0, fog: false, storm: false };
  if (code === 45 || code === 48) return { rain: 0, fog: true, storm: false };
  if (code === 51) return { rain: 0.25, fog: false, storm: false };
  if (code === 53) return { rain: 0.4, fog: false, storm: false };
  if (code === 55) return { rain: 0.55, fog: false, storm: false };
  if (code === 56 || code === 57 || code === 66 || code === 67) return { rain: 0.5, fog: false, storm: false };
  if (code === 61) return { rain: 0.4, fog: false, storm: false };
  if (code === 63) return { rain: 0.6, fog: false, storm: false };
  if (code === 65) return { rain: 0.8, fog: false, storm: false };
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) {
    return { rain: 0.5, fog: false, storm: false }; // snow never falls in Bangkok; treat as rain
  }
  if (code === 80) return { rain: 0.5, fog: false, storm: false };
  if (code === 81) return { rain: 0.65, fog: false, storm: false };
  if (code === 82) return { rain: 0.85, fog: false, storm: false };
  if (code === 95 || code === 96 || code === 99) return { rain: 0.7, fog: false, storm: true };
  return { rain: 0, fog: false, storm: false };
}

/**
 * Heavy-overcast amount: 0 at ≤80% cloud cover, 1 at ≥100% — smoothstep,
 * so the sky veils gradually rather than switching. At high cover the
 * clouds grow into a deck, a grey-blue veil washes the sky, and the moon
 * and stars fade to a faint glow through the cloud.
 */
function overcastAmount(cloud: number): number {
  const t = Math.max(0, Math.min(1, (cloud - 80) / 20));
  return t * t * (3 - 2 * t);
}

/**
 * Cloud-sheet amount: 0 at ≤95% cloud cover, 1 at 100% — smoothstep.
 * The last few percent of cover close the remaining clear gaps over the
 * moon, so at 99–100% the moon is barely there instead of shining
 * through a hole in the deck.
 */
function sheetAmount(cloud: number): number {
  const t = Math.max(0, Math.min(1, (cloud - 95) / 5));
  return t * t * (3 - 2 * t);
}

/**
 * Fallback weather when the live fetch fails: a gentle 4-minute cycle —
 * clear (70s) → cloudy (70s) → light shower (55s) → clearing (45s).
 * Displayed values ease toward the targets, so the change is gradual.
 */
const FALLBACK_CYCLE_MS = 240000;
function fallbackTargets(elapsed: number): { rain: number; cloud: number; wind: number } {
  const phase = (elapsed % FALLBACK_CYCLE_MS) / FALLBACK_CYCLE_MS;
  if (phase < 0.29) return { rain: 0, cloud: 10, wind: 0.25 };
  if (phase < 0.58) return { rain: 0, cloud: 65, wind: 0.45 };
  if (phase < 0.81) return { rain: 0.35, cloud: 85, wind: 0.6 };
  return { rain: 0.06, cloud: 30, wind: 0.35 };
}

interface WeatherState {
  mode: 'live' | 'fallback' | 'forced';
  rain: number; // target rain intensity 0–1
  cloud: number; // target cloud cover 0–100
  wind: number; // target wind strength ~0.15 (calm) to ~1.4 (strong)
  dirX: number; // horizontal drift direction, -1 (westward) to 1 (eastward)
  fog: boolean;
  storm: boolean;
  rainShown: number; // displayed values, eased toward the targets
  cloudShown: number;
  windShown: number;
  fogShown: number;
}

export default function RiverCanvas({ wishes, lang, highlightId, onHover, onSelect }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Second canvas, layered ABOVE the temple SVG overlay: the name
  // tags are drawn here, never on the main canvas. A far-row boat
  // drifts right under the prangs, and a tag painted on the main
  // canvas is cut by the overlay sitting on top of it — on the tag
  // canvas every submitter's name stays fully readable, which is the
  // point of the river. It is purely visual (pointer events pass
  // through to the main canvas below) and it is sized and cleared in
  // lockstep with the main canvas.
  const tagRef = useRef<HTMLCanvasElement>(null);
  const wishesRef = useRef(wishes);
  wishesRef.current = wishes;
  const spritesRef = useRef<Map<string, Sprite>>(new Map());
  const hoverRef = useRef<string | null>(null);
  const cbRef = useRef({ onHover, onSelect });
  cbRef.current = { onHover, onSelect };
  const langRef = useRef(lang);
  langRef.current = lang;
  const highlightRef = useRef<string | null>(highlightId);
  highlightRef.current = highlightId;
  const weatherRef = useRef<WeatherState>({
    mode: 'fallback',
    rain: 0, cloud: 15, wind: 0.3, dirX: -0.6, fog: false, storm: false,
    rainShown: 0, cloudShown: 15, windShown: 0.3, fogShown: 0,
  });
  // Reduced motion: the scene is one static frame drawn inside the
  // effect below, so a second effect (after it) redraws that frame
  // whenever the wishes change — see the note there.
  const redrawRef = useRef<(() => void) | null>(null);

  // Live Bangkok weather, client-side. Never blocks the first paint: the
  // scene renders immediately on the gentle default above and adjusts
  // when the data arrives. Nothing in the UI mentions the source.
  useEffect(() => {
    // DEV-ONLY: ?cloud=NN forces the cloud cover (0–100) so the
    // overcast rendering can be checked without live weather — e.g.
    // ?cloud=97 for a near-total overcast. It only affects this
    // browser's view; there is no UI for it and nothing else reads it.
    // The live fetch never overrides it while it is set.
    const forced = new URLSearchParams(window.location.search).get('cloud');
    const forcedCloud =
      forced !== null && /^\d+$/.test(forced)
        ? Math.max(0, Math.min(100, Number(forced)))
        : null;
    if (forcedCloud !== null) {
      const wthr = weatherRef.current;
      wthr.mode = 'forced';
      wthr.cloud = forcedCloud;
      wthr.cloudShown = forcedCloud;
      wthr.rain = 0;
      wthr.fog = false;
      wthr.storm = false;
    }
    async function load() {
      if (weatherRef.current.mode === 'forced') return;
      const ctrl = new AbortController();
      const timeout = window.setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(WEATHER_URL, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`weather ${res.status}`);
        const data = (await res.json()) as {
          current?: {
            weather_code?: unknown;
            cloud_cover?: unknown;
            wind_speed_10m?: unknown;
            wind_direction_10m?: unknown;
          };
        };
        const c = data.current;
        if (
          !c ||
          typeof c.weather_code !== 'number' ||
          typeof c.cloud_cover !== 'number' ||
          typeof c.wind_speed_10m !== 'number' ||
          typeof c.wind_direction_10m !== 'number'
        ) {
          throw new Error('weather payload unusable');
        }
        const mapped = codeToWeather(c.weather_code);
        const wthr = weatherRef.current;
        wthr.rain = mapped.rain;
        wthr.cloud = Math.max(0, Math.min(100, c.cloud_cover));
        wthr.wind = 0.15 + Math.max(0, Math.min(80, c.wind_speed_10m)) / 40;
        // Wind direction is where the wind comes FROM (degrees, 0 = north);
        // the scene drifts toward the opposite bearing.
        const toward = ((c.wind_direction_10m + 180) % 360) * (Math.PI / 180);
        wthr.dirX = Math.sin(toward);
        wthr.fog = mapped.fog;
        wthr.storm = mapped.storm;
        wthr.mode = 'live';
      } catch {
        // Stay on (or return to) the invented cycle; the scene never stalls.
        weatherRef.current.mode = 'fallback';
      } finally {
        window.clearTimeout(timeout);
      }
    }
    load();
    const id = window.setInterval(load, 10 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // The tag canvas may be absent in an old render — if it is, the
    // tags fall back to the main canvas (the old behaviour) rather
    // than disappearing.
    const tagCanvas = tagRef.current;
    const tagCtx = tagCanvas?.getContext('2d') ?? null;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startTime = performance.now();
    let raf = 0;
    // The water is a real photograph (public/river-night.jpg), loaded
    // once. Until it arrives the old gradient stands in, so the first
    // paint is never blank; the animation loop picks the photo up the
    // moment it loads, and a reduced-motion frame redraws once on load.
    const waterImg = new Image();
    let waterImgLoaded = false;
    waterImg.onload = () => {
      waterImgLoaded = true;
      if (reduced && w > 0) draw(1200);
    };
    waterImg.src = '/river-night.jpg';
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sprites = spritesRef.current;

    const stars: Star[] = [];
    const clouds: Cloud[] = [];
    const drops: RainDrop[] = [];
    const bankPts: BankPt[] = [];
    const tufts: Tuft[] = [];
    const shimmers: Shimmer[] = [];
    const ripples: RippleArc[] = [];
    let flocks: SwiftFlock[] = [];
    let meteors: Meteor[] = [];
    let rings: RippleRing[] = [];
    let rockets: Rocket[] = [];
    let particles: Particle[] = [];
    let flashes: Flash[] = [];
    let nextMeteor = 5000;
    let nextFlock = 6000;
    let nextRocket = 2000;
    let nextShowRocket = 0;
    let nextAmbientRing = 2000;
    let lastNow = 0; // for the wall-clock delta the fireworks timers run on
    let nextBolt = 9000;
    let boltStart = -1;
    let boltX = 0;
    // Animation time (ms) since the hidden preview show started; -1 means
    // no show is running. The show's length is measured in this clock —
    // it advances by dt each frame — not in wall time, so a tab whose
    // frames pause or throttle doesn't eat the show: it resumes where it
    // left off instead of expiring silently with an empty sky.
    let showElapsed = -1;
    let colorIdx = 0; // fireworks cycle gold → pink → violet → white, in order
    const clickTimes: number[] = [];

    function horizon(): number {
      return h * SKY_FRAC;
    }
    function templeX(): number {
      return w * 0.3;
    }
    function templeTopY(): number {
      return horizon() - h * 0.17;
    }

    function rowY(row: number): number {
      // Row 0 is the far bank (small, high), row 3 the near bank (large, low).
      return h * (0.3 + row * 0.17);
    }
    function rowScale(row: number): number {
      return 0.62 + row * 0.22;
    }

    // Clouds are pre-rendered once to offscreen canvases: layered
    // radial-gradient puffs with soft edges, baked in — so each frame is
    // a cheap drawImage instead of dozens of fresh gradients.
    function makeCloudSprite(seed: number): HTMLCanvasElement {
      const c = document.createElement('canvas');
      c.width = 240;
      c.height = 110;
      const g = c.getContext('2d');
      if (!g) return c;
      let s = seed;
      const rnd = () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
      };
      // 7 puffs, denser in the middle, soft at the edges. Night clouds
      // are lit by the moon, so they are PALER than the sky — the old
      // sprites were dark navy on a dark navy sky and read as nothing
      // at all, which is why no cloud ever showed up.
      for (let i = 0; i < 7; i++) {
        const px = 40 + rnd() * 160;
        const py = 45 + (rnd() - 0.5) * 30;
        const pr = 26 + rnd() * 34;
        const grad = g.createRadialGradient(px, py, pr * 0.1, px, py, pr);
        grad.addColorStop(0, 'rgba(148, 162, 214, 0.6)');
        grad.addColorStop(0.7, 'rgba(148, 162, 214, 0.3)');
        grad.addColorStop(1, 'rgba(148, 162, 214, 0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(px, py, pr, 0, Math.PI * 2);
        g.fill();
      }
      // a faint moonlit top edge on the middle puffs
      for (let i = 0; i < 3; i++) {
        const px = 70 + rnd() * 100;
        const py = 38 + rnd() * 14;
        const pr = 20 + rnd() * 18;
        const grad = g.createRadialGradient(px, py, pr * 0.1, px, py, pr);
        grad.addColorStop(0, 'rgba(205, 214, 248, 0.4)');
        grad.addColorStop(1, 'rgba(205, 214, 248, 0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(px, py, pr, 0, Math.PI * 2);
        g.fill();
      }
      return c;
    }
    const cloudSprites = [makeCloudSprite(11), makeCloudSprite(47), makeCloudSprite(83)];

    function seedSky() {
      stars.length = 0;
      const n = Math.min(110, Math.floor((w * h) / 14000));
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * w,
          y: h * (0.015 + Math.random() * 0.24),
          r: Math.random() * 1.3 + 0.4,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 1.2,
        });
      }
      clouds.length = 0;
      for (let i = 0; i < 9; i++) {
        clouds.push({
          x: Math.random() * w,
          y: h * (0.04 + Math.random() * 0.18),
          s: 0.6 + Math.random() * 0.9,
        });
      }
      drops.length = 0;
      for (let i = 0; i < 120; i++) {
        drops.push({
          x: Math.random() * w,
          y: Math.random() * h,
          len: 8 + Math.random() * 7,
          speed: 5 + Math.random() * 4,
        });
      }
      // The far bank: an uneven shoreline, seeded once per resize so it
      // never jitters between frames.
      bankPts.length = 0;
      for (let i = 0; i <= 24; i++) {
        bankPts.push({
          x: (i / 24) * w,
          y: horizon() + Math.sin(i * 1.7) * 2.2 + Math.sin(i * 0.6 + 2) * 2.5,
        });
      }
      // Dark reeds and grass at the water's edge, kept clear of the
      // temple's centre so they never crowd it. They grow in clusters
      // with gaps between them — not a uniform comb — and every blade
      // has its own height, lean and thickness; about a third carry a
      // seed head, so they read as reeds, not matchsticks.
      tufts.length = 0;
      let clusters = 0;
      let guard = 0;
      while (clusters < 6 && guard < 40) {
        guard += 1;
        const cx = Math.random() * w;
        if (cx > w * 0.16 && cx < w * 0.44) continue;
        clusters += 1;
        const tuftCount = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < tuftCount; k++) {
          const blades: ReedBlade[] = [];
          const n = 3 + Math.floor(Math.random() * 4);
          for (let b = 0; b < n; b++) {
            blades.push({
              h: 11 + Math.random() * 19,
              lean: (Math.random() - 0.5) * 16,
              w: 1.4 + Math.random() * 1.2,
              head: Math.random() < 0.35,
            });
          }
          tufts.push({
            x: cx + (Math.random() - 0.5) * 26,
            y: horizon() + Math.random() * 3,
            blades,
          });
        }
      }
      // Moonlight on the water: a broad, broken path over the
      // photograph's own moon glitter, which it reinforces rather than
      // replaces. Forty dashes, wider toward the viewer, spread over
      // the FULL depth of the water — the old 14 faint dashes clustered
      // in the top half were invisible, and a moon with no reflection
      // reads as a mistake. Each has its own phase and a sideways
      // wobble, and the glow under the moon is a real column now, not
      // a whisper.
      shimmers.length = 0;
      for (let i = 0; i < 40; i++) {
        const depth = Math.pow(Math.random(), 0.7);
        shimmers.push({
          x: w * 0.78 + (Math.random() - 0.5) * (30 + depth * 190),
          // brightest near the far bank, breaking up toward the
          // viewer — never a ladder of bars, never only at the top
          y: h * (0.3 + depth * 0.62),
          w: 20 + Math.random() * 90,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.9,
        });
      }
      // Ripple arcs over the photograph — the lower water's texture.
      // The photograph's own water is near-black away from the moon
      // path, so without these the lower two-thirds are a void in a
      // still frame. Shallow upward curves, a pale highlight with a
      // dark shadow twin below on half of them; 38% cluster inside
      // the moon column, where the light breaks the water brightest.
      // They pulse gently but never fade below 60% of base alpha, so
      // a frozen frame still shows wave texture, and they run the
      // whole depth — including across the top, so there is no
      // horizontal seam where any reflection band ends.
      ripples.length = 0;
      const moonCX = w * 0.78;
      for (let i = 0; i < 90; i++) {
        const inMoon = Math.random() < 0.38;
        const depth = Math.random();
        ripples.push({
          x: inMoon ? moonCX + (Math.random() - 0.5) * 260 : Math.random() * w,
          y: horizon() + 12 + depth * (h - horizon() - 24),
          w: 30 + Math.random() * 90 + depth * 30,
          sag: 2 + Math.random() * 3,
          base: 0.1 + Math.random() * 0.16,
          phase: Math.random() * Math.PI * 2,
          speed: 0.3 + Math.random() * 0.8,
          gold: inMoon,
          twin: Math.random() < 0.5,
        });
      }
    }

    function syncSprites() {
      const list = wishesRef.current;
      const seen = new Set<string>();
      list.forEach((wish, i) => {
        seen.add(wish.id);
        if (!sprites.has(wish.id)) {
          const row = i % ROWS;
          const fresh = wish.id === highlightRef.current;
          sprites.set(wish.id, {
            id: wish.id,
            // New krathongs splash in at the near bank; the rest spread
            // out — inset from the panel edges, so a boat never spawns
            // half-clipped with its name tag cut off.
            x: fresh ? w * (0.3 + Math.random() * 0.4) : w * (0.09 + Math.random() * 0.82),
            row: fresh ? ROWS - 1 : row,
            speed: 0.08 + Math.random() * 0.16,
            phase: Math.random() * Math.PI * 2,
            scale: rowScale(fresh ? ROWS - 1 : row),
            bornAt: performance.now(),
            fresh,
          });
        }
      });
      for (const id of [...sprites.keys()]) {
        if (!seen.has(id)) sprites.delete(id);
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.max(1, Math.round(w * dpr));
      canvas!.height = Math.max(1, Math.round(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The tag canvas shares the main canvas's box exactly, so a tag
      // drawn at a sprite's coordinates lands on its boat.
      if (tagCanvas && tagCtx) {
        tagCanvas.width = Math.max(1, Math.round(w * dpr));
        tagCanvas.height = Math.max(1, Math.round(h * dpr));
        tagCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      seedSky();
      syncSprites();
      draw(performance.now());
    }

    // --- swifts -----------------------------------------------------------
    function spawnFlock(festival: boolean) {
      const n = 3 + Math.floor(Math.random() * 4);
      const birds: SwiftBird[] = [];
      for (let i = 0; i < n; i++) {
        birds.push({
          dx: (i - n / 2) * 16 + (Math.random() - 0.5) * 8,
          dy: (Math.random() - 0.5) * 14,
          phase: Math.random() * Math.PI * 2,
        });
      }
      if (festival) {
        // On the night itself the flocks head for the temple spire.
        const fromLeft = Math.random() < 0.5;
        const x = fromLeft ? -30 : w + 30;
        const y = h * (0.06 + Math.random() * 0.12);
        const dx = templeX() - x;
        const dy = templeTopY() - y;
        const len = Math.hypot(dx, dy) || 1;
        const sp = 0.7 + Math.random() * 0.3;
        flocks.push({ birds, x, y, vx: (dx / len) * sp, vy: (dy / len) * sp, alpha: 0, toTemple: true });
      } else {
        const dir = Math.random() < 0.5 ? 1 : -1;
        flocks.push({
          birds,
          x: dir > 0 ? -30 : w + 30,
          y: h * (0.05 + Math.random() * 0.17),
          vx: dir * (0.5 + Math.random() * 0.5),
          vy: (Math.random() - 0.5) * 0.15,
          alpha: 0,
          toTemple: false,
        });
      }
    }

    // A swift, not a stroke: a slim body, swept sickle wings and a forked
    // tail. The wings rise and fold on a real flap cycle — sin(t/110)
    // lifts the tips, and the blades sweep further back as they fall, so
    // the bird reads as flapping rather than bobbing. dir is the flight
    // direction (1 right, -1 left).
    function drawSwift(bx: number, by: number, t: number, phase: number, alpha: number, dir: number) {
      const flap = Math.sin(t / 110 + phase);
      const lift = 3 + flap * 4.5; // wing-tip height above the body
      const sweep = 2 + (1 - flap) * 2.5; // how far back the tips sweep
      ctx!.save();
      ctx!.translate(bx, by);
      ctx!.scale(dir, 1);
      ctx!.fillStyle = `rgba(5, 8, 26, ${alpha.toFixed(3)})`;
      // forked tail
      ctx!.beginPath();
      ctx!.moveTo(-4, 0);
      ctx!.lineTo(-11, -2.4);
      ctx!.lineTo(-9, 0);
      ctx!.lineTo(-11, 2.4);
      ctx!.closePath();
      ctx!.fill();
      // slim body
      ctx!.beginPath();
      ctx!.ellipse(0, 0, 6.5, 1.7, 0, 0, Math.PI * 2);
      ctx!.fill();
      // sickle wings: long blades curving back from the shoulder, tips
      // rising with the flap
      for (const side of [-1, 1]) {
        ctx!.beginPath();
        ctx!.moveTo(0, 0);
        ctx!.quadraticCurveTo(-2, side * (lift * 0.55), -4 - sweep, side * lift);
        ctx!.quadraticCurveTo(-1.5, side * (lift * 0.4), 1.5, 0);
        ctx!.closePath();
        ctx!.fill();
      }
      ctx!.restore();
    }

    // --- fireworks --------------------------------------------------------
    function launchRocket() {
      if (rockets.length >= 6) return;
      rockets.push({
        x: w * (0.12 + Math.random() * 0.7),
        y: horizon() + 2,
        vy: 4.5 + Math.random() * 1.5,
        targetY: h * (0.05 + Math.random() * 0.16),
        // Cycle the colours in order, so any few seconds of show always
        // shows several colours instead of a random run of one.
        color: FIREWORK_COLORS[colorIdx++ % FIREWORK_COLORS.length],
        wobble: Math.random() * 6,
      });
    }

    function burst(r: Rocket, now: number) {
      // One boom per burst (automatic show and 5-click preview alike).
      // Throttled inside lib/audio (~1 per 0.8 s) and gated on the sound
      // preference, so the call here is unconditional.
      audio.playFirework();
      const room = Math.max(0, 500 - particles.length);
      const count = Math.min(96 + Math.floor(Math.random() * 44), room);
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        const sp = 0.9 + Math.random() * 2.6;
        const life = 100 + Math.floor(Math.random() * 40);
        particles.push({
          x: r.x,
          y: r.y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life,
          max: life,
          color: r.color,
          size: 1.8 + Math.random() * 1.4,
        });
      }
      flashes.push({ x: r.x, y: r.y, color: r.color, bornAt: now });
    }

    // --- krathongs (unchanged behaviour) ----------------------------------
    // Name tag for one boat, drawn on the context passed in — normally
    // the tag canvas above the temple overlay (see tagRef), so a far-row
    // tag is never cut by a prang. Clamped inside the canvas, so a boat
    // drifting in from an edge never has its tag cut off (the tag centre
    // follows the clamp, so the name stays inside the tag).
    function drawNameTag(g: CanvasRenderingContext2D, wish: Wish, s: Sprite, y: number, sc: number) {
      const name = wish.name.trim() || (langRef.current === 'th' ? 'ใครคนหนึ่งในกรุงเทพฯ' : 'Someone in Bangkok');
      const font = `600 ${Math.round(12 * sc + 1)}px Prompt, Sarabun, sans-serif`;
      g.font = font;
      const tw = g.measureText(name).width;
      const tagW = tw + 16;
      const tagH = 20;
      const tagCx = Math.max(tagW / 2 + 6, Math.min(w - tagW / 2 - 6, s.x));
      const tagX = tagCx - tagW / 2;
      const tagY = y - 52 * sc - tagH;
      g.fillStyle = 'rgba(7, 10, 31, 0.72)';
      g.beginPath();
      g.roundRect(tagX, tagY, tagW, tagH, 10);
      g.fill();
      g.strokeStyle = 'rgba(232, 179, 75, 0.55)';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = '#f7f1e3';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(name, tagCx, tagY + tagH / 2 + 0.5);
    }

    function drawKrathong(wish: Wish, s: Sprite, t: number) {
      const y = rowY(s.row) + Math.sin(t / 1100 + s.phase) * 3;
      const sc = s.scale;
      const [c1, c2] = boatColors(wish.boat);
      const fc = flameColor(wish.flame);
      const age = t - s.bornAt;
      const wind = weatherRef.current.windShown;

      // splash rings for a fresh krathong
      if (s.fresh && age < 2600) {
        for (let i = 0; i < 2; i++) {
          const p = ((age - i * 500) / 1600) % 1;
          if (p < 0) continue;
          ctx!.strokeStyle = `rgba(246, 211, 107, ${(1 - p) * 0.5})`;
          ctx!.lineWidth = 1.5;
          ctx!.beginPath();
          ctx!.ellipse(s.x, y + 8 * sc, 14 * sc + p * 46, 5 * sc + p * 12, 0, 0, Math.PI * 2);
          ctx!.stroke();
        }
      }

      // flame glow — a stronger wind makes the flame dance harder
      const flick = 1 + (0.14 + wind * 0.1) * Math.sin(t / 170 + s.phase * 3);
      const glow = ctx!.createRadialGradient(s.x, y - 26 * sc, 1, s.x, y - 26 * sc, 26 * sc);
      glow.addColorStop(0, fc + 'cc');
      glow.addColorStop(1, fc + '00');
      ctx!.fillStyle = glow;
      ctx!.beginPath();
      ctx!.arc(s.x, y - 26 * sc, 26 * sc, 0, Math.PI * 2);
      ctx!.fill();

      // candle
      ctx!.fillStyle = '#f3e6c8';
      ctx!.fillRect(s.x - 2.5 * sc, y - 16 * sc, 5 * sc, 9 * sc);
      // flame
      ctx!.fillStyle = fc;
      ctx!.beginPath();
      ctx!.ellipse(s.x, y - 22 * sc, 3.4 * sc, 6 * sc * flick, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = '#fff8dc';
      ctx!.beginPath();
      ctx!.ellipse(s.x, y - 19 * sc, 1.6 * sc, 3 * sc * flick, 0, 0, Math.PI * 2);
      ctx!.fill();

      // flower
      ctx!.font = `${Math.round(20 * sc)}px serif`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(flowerGlyph(wish.flower), s.x, y - 4 * sc);

      // leaf boat
      ctx!.fillStyle = c1;
      ctx!.beginPath();
      ctx!.ellipse(s.x, y + 6 * sc, 30 * sc, 9 * sc, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = c2;
      ctx!.beginPath();
      ctx!.ellipse(s.x, y + 8 * sc, 30 * sc, 7 * sc, 0, 0, Math.PI);
      ctx!.fill();
      ctx!.fillStyle = 'rgba(255,255,255,0.16)';
      ctx!.beginPath();
      ctx!.ellipse(s.x, y + 3 * sc, 26 * sc, 5 * sc, 0, Math.PI, Math.PI * 2);
      ctx!.fill();

      // rising lantern for a fresh krathong — the wind carries it sideways
      if (s.fresh && age < 4000) {
        const lp = age / 4000;
        const lx = s.x + Math.sin(age / 500) * 6 + weatherRef.current.dirX * wind * lp * 24;
        const ly = y - 40 * sc - lp * 130;
        ctx!.fillStyle = `rgba(255, 190, 90, ${(1 - lp) * 0.9})`;
        ctx!.beginPath();
        ctx!.ellipse(lx, ly, 7, 9, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = `rgba(255, 243, 196, ${(1 - lp) * 0.9})`;
        ctx!.beginPath();
        ctx!.ellipse(lx, ly + 1, 2.4, 3.6, 0, 0, Math.PI * 2);
        ctx!.fill();
      }

      // (the name tag is drawn separately, on the tag canvas above the
      // temple overlay — see the krathong pass in draw())
    }

    function draw(t: number) {
      const wthr = weatherRef.current;
      const skyH = horizon();
      const overcast = overcastAmount(wthr.cloudShown);
      // At ≥95% cover a continuous cloud sheet closes the last clear gaps
      // over the moon (see below); the disc fades to ~0.15 at full cover.
      const sheet = sheetAmount(wthr.cloudShown);
      // Clouds dim stars and moon; a heavy overcast veils them almost
      // fully — the moon stays faintly visible, never bright.
      const dim = (1 - 0.6 * (wthr.cloudShown / 100)) * (1 - 0.85 * overcast);

      // sky
      const sky = ctx!.createLinearGradient(0, 0, 0, skyH);
      sky.addColorStop(0, '#06081c');
      sky.addColorStop(0.55, '#0d1132');
      sky.addColorStop(1, '#1e1b45');
      ctx!.fillStyle = sky;
      ctx!.fillRect(0, 0, w, skyH);

      // distant lightning — a soft glow, never a harsh flash
      if (!reduced && wthr.storm && boltStart >= 0) {
        const bp = (t - boltStart) / 450;
        if (bp < 1) {
          const env = bp < 0.15 ? bp / 0.15 : 1 - (bp - 0.15) / 0.85;
          const flicker = 0.7 + 0.3 * Math.sin(bp * 25);
          const la = 0.1 * env * flicker;
          const lg = ctx!.createRadialGradient(boltX, skyH * 0.4, 4, boltX, skyH * 0.4, w * 0.35);
          lg.addColorStop(0, `rgba(205, 215, 255, ${la.toFixed(3)})`);
          lg.addColorStop(1, 'rgba(205, 215, 255, 0)');
          ctx!.fillStyle = lg;
          ctx!.fillRect(0, 0, w, skyH);
        }
      }

      // stars
      for (const s of stars) {
        const a = (0.35 + 0.65 * Math.abs(Math.sin((t / 1000) * s.speed + s.phase))) * dim;
        ctx!.fillStyle = `rgba(255, 244, 214, ${a.toFixed(3)})`;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      // moon + halo, upper right — the reflection column below mirrors it.
      // Under a heavy overcast the disc itself is veiled, not shining.
      const mx = w * 0.78;
      const my = h * 0.13;
      const mr = Math.min(w, h) * 0.05;
      const halo = ctx!.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.2);
      halo.addColorStop(0, `rgba(255, 240, 200, ${(0.35 * dim).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx!.fillStyle = halo;
      ctx!.beginPath();
      ctx!.arc(mx, my, mr * 3.2, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.save();
      ctx!.globalAlpha = (1 - overcast * 0.6) * (1 - sheet * 0.62);
      const moon = ctx!.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.2, mx, my, mr);
      moon.addColorStop(0, '#fffbe8');
      moon.addColorStop(1, '#f2dfa0');
      ctx!.fillStyle = moon;
      ctx!.beginPath();
      ctx!.arc(mx, my, mr, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = 'rgba(190, 170, 120, 0.35)';
      for (const [cx, cy, cr] of [[-0.3, 0.1, 0.16], [0.25, -0.25, 0.12], [0.1, 0.35, 0.09]] as const) {
        ctx!.beginPath();
        ctx!.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();

      // heavy overcast: a translucent grey-blue veil over the sky band,
      // drawn over stars and moon but under the clouds themselves
      if (overcast > 0.01) {
        ctx!.fillStyle = `rgba(118, 132, 172, ${(overcast * 0.22).toFixed(3)})`;
        ctx!.fillRect(0, 0, w, skyH);
      }

      // clouds — soft, layered puffs with real edges, not flat ellipses.
      // How many, and how dark, follow the real cloud cover. Under a
      // heavy overcast they grow larger and denser into a deck that
      // covers most of the sky band.
      const activeClouds = Math.round((wthr.cloudShown / 100) * clouds.length);
      for (let i = 0; i < activeClouds; i++) {
        const c = clouds[i];
        const cs = c.s * (1 + overcast * 1.1);
        const sprite = cloudSprites[i % cloudSprites.length];
        ctx!.globalAlpha = 0.6 + overcast * 0.3;
        ctx!.drawImage(sprite, c.x - 55 * cs, c.y - 25 * cs, 110 * cs, 50 * cs);
        ctx!.globalAlpha = 1;
      }

      // At ≥95% cover a continuous thin cloud sheet lies over the whole
      // sky band — over the moon, the stars and the cloud tops alike —
      // so no clear gap is left for the moon to shine through. It sits
      // under the temple and the birds, and never touches the water or
      // the krathongs. The sheet is a gradient, dense at the top of the
      // band and thinning toward the horizon, and a couple of slow, soft
      // wisps keep it reading as cloud rather than a flat wash.
      if (sheet > 0.01) {
        const sg = ctx!.createLinearGradient(0, 0, 0, skyH);
        sg.addColorStop(0, `rgba(24, 30, 62, ${(sheet * 0.55).toFixed(3)})`);
        sg.addColorStop(1, `rgba(24, 30, 62, ${(sheet * 0.3).toFixed(3)})`);
        ctx!.fillStyle = sg;
        ctx!.fillRect(0, 0, w, skyH);
        ctx!.globalAlpha = sheet * 0.25;
        const wispX = ((t / 90 + w * 0.2) % (w + 400)) - 200;
        const wispX2 = ((t / 130 + w * 0.65) % (w + 400)) - 200;
        ctx!.drawImage(cloudSprites[1], wispX - 110, skyH * 0.3, 220, 100);
        ctx!.drawImage(cloudSprites[2], wispX2 - 90, skyH * 0.58, 180, 82);
        ctx!.globalAlpha = 1;
      }

      // falling stars — hidden behind a heavy overcast, like the real sky
      for (const m of meteors) {
        const grad = ctx!.createLinearGradient(m.x, m.y, m.x - m.vx * 12, m.y - m.vy * 12);
        grad.addColorStop(0, `rgba(255,255,255,${((m.life / 60) * (1 - overcast)).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.6;
        ctx!.beginPath();
        ctx!.moveTo(m.x, m.y);
        ctx!.lineTo(m.x - m.vx * 12, m.y - m.vy * 12);
        ctx!.stroke();
      }

      // swifts — in a still frame, three birds hold their place in the sky
      if (reduced) {
        drawSwift(w * 0.42, h * 0.1, 1200, 0, 0.9, 1);
        drawSwift(w * 0.45, h * 0.115, 1200, 1.3, 0.9, 1);
        drawSwift(w * 0.39, h * 0.12, 1200, 2.1, 0.9, 1);
      } else {
        for (const f of flocks) {
          for (const b of f.birds) {
            drawSwift(
              f.x + b.dx,
              f.y + b.dy + Math.sin(t / 700 + b.phase) * 2,
              t,
              b.phase,
              f.alpha,
              f.vx >= 0 ? 1 : -1,
            );
          }
        }
      }


      // fireworks above the temple — each rocket climbs with a glowing
      // trail, so the sky is never empty between bursts
      for (const r of rockets) {
        const trail = ctx!.createLinearGradient(r.x, r.y + 34, r.x, r.y);
        trail.addColorStop(0, 'rgba(255, 248, 220, 0)');
        trail.addColorStop(1, r.color);
        ctx!.strokeStyle = trail;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.moveTo(r.x, r.y + 34);
        ctx!.lineTo(r.x, r.y);
        ctx!.stroke();
        const hg = ctx!.createRadialGradient(r.x, r.y, 0.5, r.x, r.y, 9);
        hg.addColorStop(0, '#fffbe8');
        hg.addColorStop(0.35, r.color);
        hg.addColorStop(1, r.color + '00');
        ctx!.fillStyle = hg;
        ctx!.beginPath();
        ctx!.arc(r.x, r.y, 9, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = '#fff8dc';
        ctx!.beginPath();
        ctx!.arc(r.x, r.y, 2.6, 0, Math.PI * 2);
        ctx!.fill();
      }
      for (const f of flashes) {
        const age = t - f.bornAt;
        if (age < 0 || age > 900) continue;
        const fa = (1 - age / 900) * 0.3;
        const fg = ctx!.createRadialGradient(f.x, f.y, 2, f.x, f.y, 90);
        fg.addColorStop(0, f.color + Math.round(fa * 255).toString(16).padStart(2, '0'));
        fg.addColorStop(1, f.color + '00');
        ctx!.fillStyle = fg;
        ctx!.beginPath();
        ctx!.arc(f.x, f.y, 90, 0, Math.PI * 2);
        ctx!.fill();
      }
      for (const p of particles) {
        const a = Math.max(0, p.life / p.max);
        const tw = 0.75 + 0.25 * Math.sin(t / 90 + p.x);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = a * tw;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      // water — a real photograph of a moonlit river
      // (public/river-night.jpg), cover-fit into the water rect. The
      // photo is the water now: its own moon glitter path, ripple
      // texture and fall into darkness are what make a still frame read
      // as a river. Until it loads, the old gradient stands in. The
      // photo's moon path sits at PATH_FRAC of the asset width, so the
      // draw is shifted horizontally to land that path under the canvas
      // moon (0.78w) at any viewport — clamped so the photo still
      // covers the rect. Without the shift the path and the moon
      // disagree by up to a quarter of the panel. A faint navy wash
      // seats the photo in the scene with the drawn sky, deeper toward
      // the near water; under a heavy overcast a veil dims the water
      // the way the sky is veiled.
      const waterH = h - skyH;
      // The photo's moon glitter path, measured in the graded asset
      // (brightest 100px column band, centre x 1375 of 2200).
      const PATH_FRAC = 0.625;
      if (waterImgLoaded) {
        const iw = waterImg.naturalWidth;
        const ih = waterImg.naturalHeight;
        const scale = Math.max(w / iw, waterH / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        let dx = w * 0.78 - PATH_FRAC * dw;
        dx = Math.max(w - dw, Math.min(0, dx));
        ctx!.drawImage(waterImg, dx, skyH + (waterH - dh) / 2, dw, dh);
      } else {
        const water = ctx!.createLinearGradient(0, skyH, 0, h);
        water.addColorStop(0, '#2b3563');
        water.addColorStop(0.13, '#232c56');
        water.addColorStop(0.17, '#1a2348');
        water.addColorStop(0.46, '#141c3e');
        water.addColorStop(0.52, '#0e1432');
        water.addColorStop(0.78, '#080d26');
        water.addColorStop(1, '#03040c');
        ctx!.fillStyle = water;
        ctx!.fillRect(0, skyH, w, waterH);
      }
      const seat = ctx!.createLinearGradient(0, skyH, 0, h);
      seat.addColorStop(0, 'rgba(10, 16, 48, 0.08)');
      seat.addColorStop(1, 'rgba(3, 4, 12, 0.16)');
      ctx!.fillStyle = seat;
      ctx!.fillRect(0, skyH, w, waterH);
      if (overcast > 0.01) {
        ctx!.fillStyle = `rgba(24, 30, 62, ${(overcast * 0.22).toFixed(3)})`;
        ctx!.fillRect(0, skyH, w, waterH);
      }

      // the far bank: a low, uneven shoreline, not a straight strip —
      // dark reeds and grass stand at the water's edge, and a faint
      // waterline catches the light along the shore
      ctx!.fillStyle = '#070a18';
      ctx!.beginPath();
      ctx!.moveTo(0, skyH + 8);
      for (const p of bankPts) ctx!.lineTo(p.x, p.y);
      ctx!.lineTo(w, skyH + 8);
      ctx!.closePath();
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(150, 170, 220, 0.14)';
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(0, bankPts[0]?.y ?? skyH);
      for (const p of bankPts) ctx!.lineTo(p.x, p.y);
      ctx!.stroke();
      for (const tf of tufts) {
        for (let b = 0; b < tf.blades.length; b++) {
          const bl = tf.blades[b];
          const bx = tf.x + (b - (tf.blades.length - 1) / 2) * 3;
          const tipX = bx + bl.lean + (b - (tf.blades.length - 1) / 2) * 2.4;
          const tipY = tf.y - bl.h;
          ctx!.strokeStyle = 'rgba(10, 23, 18, 0.95)';
          ctx!.lineWidth = bl.w;
          ctx!.beginPath();
          ctx!.moveTo(bx, tf.y + 2);
          ctx!.quadraticCurveTo(bx + bl.lean * 0.45, tf.y - bl.h * 0.6, tipX, tipY);
          ctx!.stroke();
          if (bl.head) {
            // a cattail seed head on the tip
            ctx!.fillStyle = 'rgba(12, 20, 14, 0.95)';
            ctx!.beginPath();
            ctx!.ellipse(tipX, tipY - 2, 1.8, 4.5, bl.lean * 0.03, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      }

      // the temple's reflection: a soft glow column under the bank,
      // fading with depth — never hard lines. The photograph's water
      // already carries its own reflections, and drawn fan lines on
      // top of them read as little gold fans.
      const tGlow = ctx!.createLinearGradient(0, skyH, 0, skyH + 110);
      tGlow.addColorStop(0, 'rgba(246, 211, 107, 0.05)');
      tGlow.addColorStop(1, 'rgba(246, 211, 107, 0)');
      ctx!.fillStyle = tGlow;
      ctx!.fillRect(templeX() - 70, skyH, 140, 110);

      // moonlight on the water — a real column under the moon, over
      // the photograph's own glitter path, which it reinforces: a
      // wide soft glow, then dashes that break and reform down the
      // full depth of the water, each with its own phase and a
      // sideways wobble. Fainter under a heavy overcast, like the
      // veiled moon itself.
      const moonX = w * 0.78;
      const glowCol = ctx!.createLinearGradient(moonX - 130, 0, moonX + 130, 0);
      glowCol.addColorStop(0, 'rgba(246, 211, 107, 0)');
      glowCol.addColorStop(0.5, `rgba(246, 211, 107, ${(0.1 * (1 - overcast * 0.6)).toFixed(3)})`);
      glowCol.addColorStop(1, 'rgba(246, 211, 107, 0)');
      ctx!.fillStyle = glowCol;
      ctx!.fillRect(moonX - 130, skyH, 260, h - skyH);
      const washCol = ctx!.createLinearGradient(moonX - 240, 0, moonX + 240, 0);
      washCol.addColorStop(0, 'rgba(246, 211, 107, 0)');
      washCol.addColorStop(0.5, `rgba(246, 211, 107, ${(0.03 * (1 - overcast * 0.6)).toFixed(3)})`);
      washCol.addColorStop(1, 'rgba(246, 211, 107, 0)');
      ctx!.fillStyle = washCol;
      ctx!.fillRect(moonX - 240, skyH, 480, h - skyH);
      for (const sh of shimmers) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin((t / 1000) * sh.speed + sh.phase));
        const a = (0.08 + 0.2 * tw) * (1 - overcast * 0.5);
        const wx = sh.x + Math.sin((t / 1300) * sh.speed + sh.phase) * 7;
        ctx!.strokeStyle = `rgba(246, 211, 107, ${a.toFixed(3)})`;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.moveTo(wx - sh.w / 2, sh.y);
        ctx!.lineTo(wx + sh.w / 2, sh.y);
        ctx!.stroke();
      }

      // ripple arcs over the photograph — the lower water's texture
      // (see the seed comment). They never fade below 60% of base
      // alpha, so a frozen frame still shows wave texture; fainter
      // under a heavy overcast, like the rest of the moonlight.
      const arcDim = 1 - overcast * 0.5;
      for (const rp of ripples) {
        const tw = 0.6 + 0.4 * Math.abs(Math.sin((t / 1000) * rp.speed + rp.phase));
        const a = rp.base * tw * arcDim;
        const wx = rp.x + Math.sin((t / 1600) * rp.speed + rp.phase) * 5;
        ctx!.strokeStyle = rp.gold
          ? `rgba(246, 211, 107, ${a.toFixed(3)})`
          : `rgba(205, 214, 248, ${a.toFixed(3)})`;
        ctx!.lineWidth = 1.2;
        ctx!.beginPath();
        ctx!.moveTo(wx - rp.w / 2, rp.y);
        ctx!.quadraticCurveTo(wx, rp.y - rp.sag, wx + rp.w / 2, rp.y);
        ctx!.stroke();
        if (rp.twin) {
          ctx!.strokeStyle = `rgba(3, 4, 12, ${(a * 0.8).toFixed(3)})`;
          ctx!.beginPath();
          ctx!.moveTo(wx - rp.w / 2, rp.y + 2.5);
          ctx!.quadraticCurveTo(wx, rp.y + 2.5 - rp.sag, wx + rp.w / 2, rp.y + 2.5);
          ctx!.stroke();
        }
      }

      // firework glints on the water, like the original's reflection bar
      for (const f of flashes) {
        const age = t - f.bornAt;
        if (age < 0 || age > 900) continue;
        const fa = (1 - age / 900) * 0.18;
        ctx!.fillStyle = f.color;
        ctx!.globalAlpha = fa;
        ctx!.fillRect(f.x - 12, skyH + (skyH - f.y) * 0.22, 24, 2);
      }
      ctx!.globalAlpha = 1;

      // rain rings where drops hit the water
      for (const r of rings) {
        ctx!.strokeStyle = `rgba(180, 200, 255, ${(r.a * 0.25).toFixed(3)})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.ellipse(r.x, r.y, r.r, r.r * 0.32, 0, 0, Math.PI * 2);
        ctx!.stroke();
      }

      // rain streaks — light, slanted with the wind, never over the tags
      const rain = wthr.rainShown;
      if (rain > 0.03) {
        const count = Math.min(110, Math.floor(rain * 120));
        const slant = wthr.dirX * wthr.windShown * 4 - 2;
        ctx!.strokeStyle = `rgba(220, 230, 255, ${(0.28 * Math.min(rain, 0.8)).toFixed(3)})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        for (let i = 0; i < count; i++) {
          const d = drops[i];
          ctx!.moveTo(d.x, d.y);
          ctx!.lineTo(d.x + slant, d.y + d.len);
        }
        ctx!.stroke();
      }

      // mist over the water on foggy nights
      if (wthr.fogShown > 0.03) {
        const mg = ctx!.createLinearGradient(0, skyH, 0, skyH + h * 0.12);
        mg.addColorStop(0, `rgba(180, 195, 230, ${(0.09 * wthr.fogShown).toFixed(3)})`);
        mg.addColorStop(1, 'rgba(180, 195, 230, 0)');
        ctx!.fillStyle = mg;
        ctx!.fillRect(0, skyH, w, h * 0.12);
      }

      // krathongs, far rows first
      const list = wishesRef.current;
      const ordered = [...sprites.values()].sort((a, b) => a.row - b.row);
      for (const s of ordered) {
        const wish = list.find((x) => x.id === s.id);
        if (wish) drawKrathong(wish, s, t);
      }

      // name tags, last of all and on the tag canvas above the temple
      // overlay — so no tag is ever occluded by a prang, and a nearer
      // boat never covers a farther boat's tag either. The tag canvas
      // is cleared each frame (the main canvas is fully repainted by
      // the sky and water, so it needs no clear). If the tag canvas is
      // somehow absent, the tags fall back to the main canvas.
      const tagG = tagCtx ?? ctx;
      if (tagG) {
        if (tagCtx) tagCtx.clearRect(0, 0, w, h);
        for (const s of ordered) {
          const wish = list.find((x) => x.id === s.id);
          if (!wish) continue;
          const ty = rowY(s.row) + Math.sin(t / 1100 + s.phase) * 3;
          drawNameTag(tagG, wish, s, ty, s.scale);
        }
      }
    }

    function frame(t: number) {
      const now = performance.now();
      // Real elapsed time since the last frame (clamped so a tab that was
      // hidden doesn't jump the timers). The fireworks launchers run on
      // this wall-clock delta, not on a fixed 16ms-per-frame assumption:
      // at anything below 60fps the old fixed decrement advanced the
      // rocket timers far slower than real time, so the 25s show ran out
      // of wall clock with only ~10s of rockets launched.
      const dt = Math.min(50, Math.max(0, now - lastNow));
      lastNow = now;
      const wthr = weatherRef.current;
      const festival = isFestivalNight();

      // weather: live targets, or the fallback cycle; displayed values ease
      if (wthr.mode === 'forced') {
        // DEV-ONLY (?cloud=NN): the cover stays exactly where it was
        // put; no rain, no storm, gentle wind.
        wthr.rain = 0;
        wthr.fog = false;
        wthr.storm = false;
        wthr.wind = 0.3;
      } else if (wthr.mode === 'fallback') {
        const fb = fallbackTargets(now - startTime);
        wthr.rain = fb.rain;
        wthr.cloud = fb.cloud;
        wthr.wind = fb.wind;
        wthr.fog = false;
        wthr.storm = false;
        wthr.dirX += (-0.6 - wthr.dirX) * 0.002;
      }
      const ease = 0.02;
      wthr.rainShown += (wthr.rain - wthr.rainShown) * ease;
      wthr.cloudShown += (wthr.cloud - wthr.cloudShown) * ease;
      wthr.windShown += (wthr.wind - wthr.windShown) * ease;
      wthr.fogShown += ((wthr.fog ? 1 : 0) - wthr.fogShown) * ease;

      syncSprites();
      const drift = 0.75 + wthr.windShown * 0.5;
      for (const s of sprites.values()) {
        s.x += s.speed * drift;
        if (s.x > w + 50) {
          s.x = -50;
          s.row = Math.floor(Math.random() * ROWS);
          s.scale = rowScale(s.row);
        }
        if (now - s.bornAt > 5000) s.fresh = false;
      }

      // faint rings where krathongs sit, coming and going — the water
      // answers the boats, not just the rain
      nextAmbientRing -= 16;
      if (nextAmbientRing <= 0) {
        nextAmbientRing = 1400 + Math.random() * 2200;
        const arr = [...sprites.values()];
        if (arr.length > 0 && rings.length < 28) {
          const s = arr[Math.floor(Math.random() * arr.length)];
          rings.push({
            x: s.x,
            y: rowY(s.row) + 8 * s.scale,
            r: 3,
            max: 14 + Math.random() * 12,
            a: 0.22,
          });
        }
      }
      // clouds drift with the wind
      const cloudVx = wthr.dirX * (0.08 + wthr.windShown * 0.25);
      for (const c of clouds) {
        c.x += cloudVx * c.s;
        if (c.x < -90) c.x = w + 80;
        if (c.x > w + 90) c.x = -80;
      }

      // rain falls; drops recycle at the top
      if (wthr.rainShown > 0.03) {
        for (const d of drops) {
          d.y += d.speed * (0.8 + wthr.rainShown);
          d.x += wthr.dirX * wthr.windShown * 1.5;
          if (d.y > h) {
            d.y = -10;
            d.x = Math.random() * w;
          }
        }
        if (Math.random() < wthr.rainShown * 0.25 && rings.length < 28) {
          rings.push({
            x: Math.random() * w,
            y: h * (0.3 + Math.random() * 0.62),
            r: 2,
            max: 10 + Math.random() * 14,
            a: 0.3,
          });
        }
      }
      rings = rings.filter((r) => {
        r.r += 0.6;
        r.a -= 0.008;
        return r.a > 0 && r.r < r.max;
      });

      // swifts — a flock every little while, never an empty sky for long
      nextFlock -= 16;
      if (nextFlock <= 0) {
        nextFlock = 9000 + Math.random() * 12000;
        spawnFlock(festival);
      }
      flocks = flocks.filter((f) => {
        f.x += f.vx * (0.8 + wthr.windShown * 0.3);
        f.y += f.vy + Math.sin(t / 900 + f.x) * 0.05;
        f.alpha = Math.min(0.9, f.alpha + 0.01);
        if (f.toTemple) {
          const d = Math.hypot(templeX() - f.x, templeTopY() - f.y);
          if (d < 70) f.alpha -= 0.03;
        }
        if (f.alpha <= 0) return false;
        return f.x > -80 && f.x < w + 80;
      });

      // falling stars
      nextMeteor -= 16;
      if (nextMeteor <= 0) {
        nextMeteor = 6000 + Math.random() * 9000;
        if (meteors.length < 3) {
          meteors.push({
            x: w * (0.15 + Math.random() * 0.6),
            y: h * Math.random() * 0.18,
            vx: 7,
            vy: 3.2,
            life: 60,
          });
        }
      }
      meteors = meteors.filter((m) => {
        m.x += m.vx;
        m.y += m.vy;
        m.life -= 1;
        return m.life > 0;
      });

      // distant lightning in a storm
      if (wthr.storm) {
        nextBolt -= 16;
        if (nextBolt <= 0) {
          nextBolt = 9000 + Math.random() * 11000;
          boltStart = t;
          boltX = w * (0.1 + Math.random() * 0.8);
        }
      }

      // fireworks — automatic on the night itself, or during a preview show
      if (festival) {
        nextRocket -= dt;
        if (nextRocket <= 0) {
          nextRocket = 1200 + Math.random() * 1400;
          launchRocket();
        }
      }
      // Preview show — measured in animation time, not wall time (see
      // showElapsed): while it runs, each frame adds dt, so a paused or
      // throttled tab stretches the show in wall time instead of cutting
      // it short.
      if (showElapsed >= 0) {
        showElapsed += dt;
        if (showElapsed < 60000) {
          nextShowRocket -= dt;
          if (nextShowRocket <= 0) {
            // a rocket every ~0.5–0.8 s, and sometimes two at once, so the
            // sky is rarely empty during the show
            nextShowRocket = 500 + Math.random() * 300;
            launchRocket();
            if (Math.random() < 0.3) launchRocket();
          }
        } else {
          showElapsed = -1;
        }
      }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y -= r.vy;
        r.x += Math.sin(now / 300 + r.wobble) * 0.3;
        r.vy *= 0.985;
        if (r.y <= r.targetY || r.vy < 0.5) {
          burst(r, t);
          rockets.splice(i, 1);
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += 0.02;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        if (p.life <= 0) particles.splice(i, 1);
      }
      flashes = flashes.filter((f) => t - f.bornAt < 900);

      draw(t);
      raf = requestAnimationFrame(frame);
    }

    function spriteAt(cx: number, cy: number): Sprite | null {
      let best: Sprite | null = null;
      let bestRow = -1;
      for (const s of sprites.values()) {
        const y = rowY(s.row);
        const dx = Math.abs(cx - s.x);
        const dy = Math.abs(cy - y);
        if (dx < 34 * s.scale + 8 && dy < 46 * s.scale + 10 && s.row >= bestRow) {
          best = s;
          bestRow = s.row;
        }
      }
      return best;
    }

    // Five unhurried clicks anywhere in the river area (within ~6
    // seconds) launch the 60-second fireworks show. Nothing in the UI
    // hints at it. Clicks arrive via the 'loy:river-click' event the
    // river section dispatches — never counted here directly, so one
    // physical click is counted exactly once.
    function noteClick() {
      const now = performance.now();
      clickTimes.push(now);
      while (clickTimes.length > 0 && now - clickTimes[0] > 6000) clickTimes.shift();
      if (clickTimes.length >= 5) {
        clickTimes.length = 0;
        showElapsed = 0;
        nextShowRocket = 0;
      }
    }

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const s = spriteAt(cx, cy);
      if (s) {
        const wish = wishesRef.current.find((x) => x.id === s.id);
        if (wish) {
          hoverRef.current = s.id;
          cbRef.current.onHover(wish, cx, cy);
          canvas!.style.cursor = 'pointer';
          return;
        }
      }
      if (hoverRef.current) {
        hoverRef.current = null;
        cbRef.current.onHover(null, 0, 0);
      }
      canvas!.style.cursor = 'crosshair';
    }

    function onClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const s = spriteAt(e.clientX - rect.left, e.clientY - rect.top);
      if (s) {
        const wish = wishesRef.current.find((x) => x.id === s.id);
        if (wish) cbRef.current.onSelect(wish);
      }
    }

    function onLeave() {
      hoverRef.current = null;
      cbRef.current.onHover(null, 0, 0);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mouseleave', onLeave);
    // Hidden show trigger: the river section dispatches one
    // 'loy:river-click' per physical click anywhere in the river area
    // (canvas, wish panel, empty state — not the builder form), so a
    // click that opens the wish panel still counts, and a click that
    // lands on the canvas is never counted twice.
    const onRiverClick = () => noteClick();
    window.addEventListener('loy:river-click', onRiverClick);
    // touch: tap = select. The tap's synthetic click bubbles to the river
    // section and counts toward the hidden show exactly once.
    canvas.addEventListener('touchend', (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const rect = canvas!.getBoundingClientRect();
      const s = spriteAt(touch.clientX - rect.left, touch.clientY - rect.top);
      if (s) {
        const wish = wishesRef.current.find((x) => x.id === s.id);
        if (wish) cbRef.current.onSelect(wish);
      }
    });

    if (reduced) {
      draw(1200);
    } else {
      raf = requestAnimationFrame(frame);
    }
    // Static-frame redraw for the reduced-motion effect below: sync the
    // sprites to the latest wishes and draw one frozen frame.
    redrawRef.current = () => {
      syncSprites();
      draw(1200);
    };
    return () => {
      cancelAnimationFrame(raf);
      redrawRef.current = null;
      ro.disconnect();
      window.removeEventListener('loy:river-click', onRiverClick);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // Reduced motion: the scene is a single static frame, drawn once by
  // the effect above — but the wishes arrive after the first paint
  // (fetched from /api/wishes), and nothing redrew the frame, so
  // reduced-motion users saw an empty river while the header counted
  // the krathongs. Redraw the frozen frame whenever the wishes change.
  // The animated path redraws every frame anyway, so this is a no-op
  // there. (Found while verifying fix round 4; pre-existing since the
  // photo round.)
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (reducedMotion) redrawRef.current?.();
  }, [wishes, reducedMotion]);

  // The temple is a detailed SVG illustration layered over the canvas at
  // the far bank — the same spot the canvas silhouette stood, so the
  // swifts still fly to it and the fireworks still rise above it. Pointer
  // events pass through to the canvas.
  return (
    <div className="river-scene">
      <canvas ref={ref} aria-label="River of krathongs" role="img" />
      <div className="temple-overlay" aria-hidden="true">
        <WatArunSvg />
      </div>
      {/* Name tags, above the temple overlay — purely visual, the names
          are already in the wish wall and panel. */}
      <canvas ref={tagRef} className="river-tags" aria-hidden="true" />
    </div>
  );
}
