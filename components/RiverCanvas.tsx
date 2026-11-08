// The river: a living Bangkok night, photo-forward (design variant A).
// The base is a real photograph of the illuminated Wat Arun on the Chao
// Phraya during Loi Krathong night (public/chao-phraya-night.webp),
// night-graded into the site's navy/gold palette: the black sky is
// lifted to deep indigo, the lit temple and city lights are kept gold by
// a warmth x brightness mask, and the dark water is lifted toward navy
// while its gold reflection columns survive. Source: Wikimedia Commons,
// "An illuminated ARUN WAT on the banks of the Chao Phraya river in
// Bangkok during the traditional Loi Krathong festival on Nov.11 night.",
// CC0 1.0 Universal (public-domain dedication, attribution not required;
// author not stated on the file page). Grade: lk-photo-replace/
// grade-photo-new.py (adapted from design A's grade-photo.py — the
// texture-gated preserve mask failed on this photo's smooth floodlit
// temple faces, so the mask here is warmth x brightness only). The
// photo's own temple replaces the WatArunSvg overlay (a real illuminated
// Wat Arun reads better than the drawing at desktop size, and the SVG
// would have put a second temple in the scene) — the SVG file stays in
// the tree for the record. The photo's waterline sits at 67% of the
// panel, so the sky is the top two-thirds and the water the bottom third;
// the boats float in that third, in four rows.
//
// Over the photo's water runs the attached scene's WebGL water shader
// (bangkok-river-animated.html): fbm current lanes, a warm temple
// reflection band and a cool moon band, rain texture, all weather-driven.
// It renders at partial opacity (u_blend), so the photograph's real
// ripple texture shows through the moving lanes instead of being painted
// over — if WebGL is unavailable the shader canvas stays transparent and
// the photo plus the drawn shimmer/ripple layers carry the water alone.
// Above it all, the existing canvas life: deep sky with twinkling stars
// and a full moon at 0.755w (the photograph carries no moon — the drawn
// moon sits in empty dark sky right of the temple, and the shader's moon
// band and the drawn moon path sit under it), slow clouds, the
// odd falling star, reeds at the far bank, and one floating krathong per
// wish with its name on a tag above the temple layer. The weather follows
// the real Bangkok sky (Open-Meteo, refetched every 10 minutes; a gentle
// invented cycle takes over if the fetch fails), so rain, cloud and wind
// are what Bangkok is doing tonight — under a heavy overcast the clouds
// close into a deck and the moon and stars fade to a faint glow through
// it. On Loy Krathong night itself (24 Nov 2026, 19:00-23:59 Bangkok
// time) fireworks burst above the temple on their own. Five quick clicks
// anywhere on the canvas launch a short fireworks show — a hidden preview
// for the night.
//
// One scene, per-night palette: the shader water colours shift subtly
// with the destination (NIGHT_PALETTES, derived from the original
// site's per-destination palettes) — a tint, not seven scenes.

'use client';

import { useEffect, useRef } from 'react';
import type { Lang, Wish } from '@/lib/data';
import { flameColor } from '@/lib/data';
import {
  KRATHONG_FLAME_BASE,
  KRATHONG_FLAME_CENTER,
  KRATHONG_FLAME_INNER_PATH,
  KRATHONG_FLAME_PATH,
  KRATHONG_HULL_CENTER_Y,
  KRATHONG_VIEWBOX,
  krathongSvgDocument,
} from '@/lib/krathongArt';
import { audio } from '@/lib/audio';

// The river boats are the SAME artwork as the builder preview
// (lib/krathongArt): the SVG markup, minus glow and flame, loaded as
// an image and drawn on the canvas. One image per boat|flower|design
// variant, cached for the session; the flame is drawn separately (below) so it
// can flicker with the wind. The image loads async — a boat whose
// image is not ready yet is skipped for that frame and appears once
// loaded, so no wish is ever drawn as the old procedural boat.
const krathongImageCache = new Map<string, HTMLImageElement>();
function krathongImage(boat: string, flower: string, flame: string, design: string = 'classic'): HTMLImageElement {
  const key = `${design}|${boat}|${flower}`;
  let img = krathongImageCache.get(key);
  if (!img) {
    img = new Image();
    img.src =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(krathongSvgDocument(boat, flower, flame, design));
    krathongImageCache.set(key, img);
  }
  return img;
}
let _flamePath2D: Path2D | null = null;
let _flameInnerPath2D: Path2D | null = null;
// Path2D is a browser API (no Path2D on the Node prerender), so the
// paths are built lazily on first use — drawKrathong only runs in the
// browser — never at module scope.
function flamePaths(): [Path2D, Path2D] {
  if (!_flamePath2D) {
    _flamePath2D = new Path2D(KRATHONG_FLAME_PATH);
    _flameInnerPath2D = new Path2D(KRATHONG_FLAME_INNER_PATH);
  }
  return [_flamePath2D, _flameInnerPath2D!];
}

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
interface Cloud { x: number; y: number; s: number; a: number }
interface ReedBlade { h: number; lean: number; w: number; head: boolean }
interface Tuft { x: number; y: number; blades: ReedBlade[] }
interface Shimmer { x: number; y: number; w: number; phase: number; speed: number; cool: boolean }
interface RippleArc { x: number; y: number; w: number; sag: number; base: number; phase: number; speed: number; gold: boolean; twin: boolean }
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
  /** Tonight's destination id — shifts the shader water tint only. */
  destinationId?: string;
  /**
   * Chunk A4 (reduced): tonight's milestone stage, 0–4. One scene only —
   * stage effects hang on it: a gold wash on the water that deepens with
   * the stage, the temple glowing gold at stage >= 3, fireworks at
   * stage >= 4. No per-destination scenes (see plan F4b).
   */
  milestoneStage?: number;
}

const ROWS = 4;
// The photograph's waterline: measured from the pixels of the shipped
// webp, the warm temple/bank ends at ~0.70 of the photo height, the
// water surface (with the temple's reflection columns) begins at
// ~0.72-0.75 and the open water at ~0.82. The animated waterline sits
// at 0.78 — just below the photo's displayed waterline at the
// viewports the site serves (the taller wrap keeps the panel close to
// the photo's 16:9, so the photo is barely cropped at desktop and
// height-constrained on mobile, and the displayed waterline lands at
// ~0.75-0.78), so the animated water starts in the water, never over
// the land. The earlier 0.67 put the waterline inside the temple and
// flooded the bank. At very wide viewports the photo's water is
// cropped out of frame, so a residual flood band remains there —
// the waterline cannot track a waterline the photo no longer shows.
const RIVER_FRAC = 0.78;
// Moon and temple, as fractions of panel width/height — measured from
// the photograph's pixels (temple centre 0.50, its reflection column
// 0.59, spire top 0.20; the photo has no moon, so the drawn moon keeps
// the attached scene's 0.755, in empty sky right of the temple).
const MOON_X = 0.755;
const MOON_Y_FRAC = 0.19;
const TEMPLE_X_FRAC = 0.50;
const TEMPLE_REFLECT_FRAC = 0.59;
const TEMPLE_TOP_FRAC = 0.20;

// Per-night water tints for the shader — one scene, a tint per
// destination, derived from the original site's per-destination palettes
// (water darkened to night, glow kept as the warm reflection colour).
// Bangkok is the default; unknown ids fall back to it.
interface NightPalette { waterTop: string; waterMid: string; waterDeep: string; warm: string; cool: string }
const NIGHT_PALETTES: Record<string, NightPalette> = {
  bangkok: { waterTop: '#2e4a68', waterMid: '#16324e', waterDeep: '#061a30', warm: '#ffd27a', cool: '#b6d5dc' },
  sukhothai: { waterTop: '#31496b', waterMid: '#173049', waterDeep: '#071a2e', warm: '#ffc96e', cool: '#b6d5dc' },
  chiang_mai: { waterTop: '#2c4766', waterMid: '#152e47', waterDeep: '#061830', warm: '#ffb35c', cool: '#b6d5dc' },
  tak: { waterTop: '#2b4869', waterMid: '#162f4b', waterDeep: '#061a30', warm: '#ffcf70', cool: '#b6d5dc' },
  ayutthaya: { waterTop: '#2f4a6c', waterMid: '#173049', waterDeep: '#071a2e', warm: '#f5c87a', cool: '#b6d5dc' },
  amphawa: { waterTop: '#2a4a6a', waterMid: '#153049', waterDeep: '#061a2e', warm: '#d8ff8a', cool: '#b6d5dc' },
  roi_et: { waterTop: '#30496e', waterMid: '#173049', waterDeep: '#071b30', warm: '#ffd98a', cool: '#b6d5dc' },
};
// Weather states from the attached scene's palettes (night/overcast/rain/storm).
const WEATHER_PALETTES: Record<'night' | 'overcast' | 'rain' | 'storm', NightPalette> = {
  night: NIGHT_PALETTES.bangkok,
  overcast: { waterTop: '#506a76', waterMid: '#1e465a', waterDeep: '#091f35', warm: '#ba9891', cool: '#b6d5dc' },
  rain: { waterTop: '#496975', waterMid: '#1a465c', waterDeep: '#071e34', warm: '#9a7f83', cool: '#b6d5dc' },
  storm: { waterTop: '#3c5b69', waterMid: '#143a50', waterDeep: '#051a2e', warm: '#82757b', cool: '#b6d5dc' },
};

function hexRgb(hex: string): [number, number, number] {
  const q = hex.replace('#', '');
  return [parseInt(q.slice(0, 2), 16) / 255, parseInt(q.slice(2, 4), 16) / 255, parseInt(q.slice(4, 6), 16) / 255];
}
function mixHex(a: string, b: string, t: number): string {
  const aa = hexRgb(a).map((v) => v * 255);
  const bb = hexRgb(b).map((v) => v * 255);
  return '#' + aa.map((v, i) => Math.round(v + (bb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// --- WebGL water shader, ported from bangkok-river-animated.html --------
// fbm current lanes, a warm temple reflection band and a cool moon band,
// glints, rain texture. Two changes from the original: u_blend (the
// shader renders at partial opacity so the photograph's real water
// texture shows through the moving lanes) and u_top driven by the
// panel's waterline instead of the attached file's 0.672. Returns null
// when WebGL is unavailable — the caller then leaves the shader canvas
// transparent and the photo + drawn layers carry the water.
export interface WaterRenderOpts {
  t: number; riverY: number; h: number; wind: number; cloud: number; rain: number;
  reflectX: number; moonX: number; colors: NightPalette; blend: number;
}
function createWaterRenderer(canvas: HTMLCanvasElement): { render: (o: WaterRenderOpts) => void } | null {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false });
  if (!gl) return null;
  const vertex = `attribute vec2 a_position; varying vec2 v_uv; void main(){ v_uv=a_position*.5+.5; gl_Position=vec4(a_position,0.,1.); }`;
  const fragment = `
      precision highp float;
      varying vec2 v_uv;
      uniform float u_time,u_top,u_wind,u_cloud,u_rain,u_reflect,u_moon,u_aspect,u_blend;
      uniform vec3 u_waterTop,u_waterMid,u_waterDeep,u_warm,u_cool;
      float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float noise2(vec2 p){
        vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
      }
      float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<4;i++){v+=a*noise2(p);p=p*2.02+vec2(13.7,9.2);a*=.5;} return v; }
      void main(){
        float sy=1.0-v_uv.y;
        if(sy<u_top) discard;
        float d=clamp((sy-u_top)/(1.0-u_top),0.0,1.0);
        float x=v_uv.x;
        float t=u_time;
        float current=.075+u_wind*.009+u_rain*.035;
        float n0=fbm(vec2(x*3.1-t*current,d*28.0+t*current*.16));
        float n1=fbm(vec2(x*8.0-t*current*1.65,d*61.0-t*current*.24)+vec2(n0*.55,n0*.18));
        float n2=fbm(vec2(x*16.0-t*current*2.2,d*105.0+t*current*.38)+vec2(n0*.31,n1*.27));
        float warp=(n0-.5)*(.014+d*.032)+(n1-.5)*(.006+d*.014);
        float lateral=.016*sin(d*8.0-t*.45+n0*4.0)+.012*sin(d*17.0+t*.34+n1*3.0);
        float flowX=x+warp+lateral;
        float broadRidge=1.0-abs(2.0*n0-1.0);
        float fineRidge=1.0-abs(2.0*n1-1.0);
        float sparkleRidge=1.0-abs(2.0*n2-1.0);
        float broad=smoothstep(.58,.92,broadRidge);
        float fine=smoothstep(.65,.95,fineRidge);
        float sparkle=smoothstep(.76,.98,sparkleRidge);
        vec3 col=mix(u_waterTop,u_waterMid,smoothstep(.015,.48,d));
        col=mix(col,u_waterDeep,smoothstep(.43,1.0,d));
        float horizonGlow=exp(-d*7.0)*(1.0-u_cloud*.003);
        col=mix(col,u_warm,.09*horizonGlow);
        col+=vec3(.035,.105,.12)*broad*(.32+.9*d);
        col+=vec3(.035,.11,.13)*fine*(.17+.55*d)*(1.0-u_cloud*.0016);
        col+=vec3(.10,.18,.17)*sparkle*(.03+.13*d);
        float bend=(n0-.5)*(.022+d*.052)+.009*sin(d*8.5-t*.42+n1*3.0);
        float templeX=u_reflect+bend;
        float templeWidth=.009+d*.078;
        float templeBand=exp(-pow((flowX-templeX)/templeWidth,2.0));
        float breakUp=.34+.66*smoothstep(.12,.9,.5+.5*sin(d*24.0+n1*5.0-t*(.76+u_wind*.025)));
        float textureBreak=.38+.62*smoothstep(.20,.88,broadRidge+n2*.17);
        // Warm-band gain reduced at the lower water (merge fix: the
        // photo's gold columns ran hot on mobile) — .30+.45*d, was .32+.56*d.
        col+=u_warm*templeBand*breakUp*textureBreak*(.30+.45*d)*(1.0-u_cloud*.002);
        float moonBend=(n1-.5)*(.040+d*.075)+.012*sin(d*12.0-t*.31+n0*4.0);
        float moonX=u_moon+moonBend;
        float moonBand=exp(-pow((flowX-moonX)/(.012+d*.078),2.0));
        // A smooth vertical column, not a ladder: the break is a slow
        // shimmer (one gentle wave over the whole depth, floor .62 so
        // no dark gaps chop it into horizontal dashes) and the column
        // dims with the moon — the cloud factor tracks the disc, so
        // when the moon goes grey under cloud the path goes grey with
        // it instead of staying bright on the water.
        float moonBreak=.62+.38*smoothstep(.20,.90,.5+.5*sin(d*5.0+n0*2.0-t*.40));
        col+=u_cool*moonBand*moonBreak*(.28+.48*d)*(1.0-u_cloud*.95);
        float glint=pow(max(0.0,sparkleRidge),5.0)*(0.08+.16*d);
        col+=vec3(.15,.20,.19)*glint;
        float rainTexture=(n2-.5)*u_rain*(.025+.075*d);
        col+=vec3(.05,.09,.10)*rainTexture;
        gl_FragColor=vec4(clamp(col,0.0,1.0)*u_blend,u_blend);
      }`;
  function compile(type: number, src: string): WebGLShader | null {
    const sh = gl!.createShader(type);
    if (!sh) return null;
    gl!.shaderSource(sh, src);
    gl!.compileShader(sh);
    if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
      console.warn('Water shader:', gl!.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }
  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Water program:', gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const names = ['u_time', 'u_top', 'u_wind', 'u_cloud', 'u_rain', 'u_reflect', 'u_moon', 'u_aspect', 'u_blend', 'u_waterTop', 'u_waterMid', 'u_waterDeep', 'u_warm', 'u_cool'];
  const loc: Record<string, WebGLUniformLocation | null> = {};
  for (const n of names) loc[n] = gl.getUniformLocation(program, n);
  return {
    render(o: WaterRenderOpts) {
      gl!.viewport(0, 0, canvas.width, canvas.height);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.useProgram(program);
      gl!.uniform1f(loc.u_time, o.t);
      gl!.uniform1f(loc.u_top, o.riverY / o.h);
      gl!.uniform1f(loc.u_wind, o.wind);
      gl!.uniform1f(loc.u_cloud, o.cloud);
      gl!.uniform1f(loc.u_rain, o.rain);
      gl!.uniform1f(loc.u_reflect, o.reflectX);
      gl!.uniform1f(loc.u_moon, o.moonX);
      gl!.uniform1f(loc.u_aspect, canvas.width / Math.max(1, canvas.height));
      gl!.uniform1f(loc.u_blend, o.blend);
      const uniforms: [WebGLUniformLocation | null, string][] = [
        [loc.u_waterTop, o.colors.waterTop], [loc.u_waterMid, o.colors.waterMid],
        [loc.u_waterDeep, o.colors.waterDeep], [loc.u_warm, o.colors.warm], [loc.u_cool, o.colors.cool],
      ];
      for (const [u, c] of uniforms) {
        const [r, g, b] = hexRgb(c);
        gl!.uniform3f(u, r, g, b);
      }
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    },
  };
}

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

export default function RiverCanvas({ wishes, lang, highlightId, onHover, onSelect, destinationId = 'bangkok', milestoneStage = 0 }: Props) {
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
  // WebGL water layer (the shader canvas below the main canvas).
  const waterRef = useRef<HTMLCanvasElement>(null);
  const waterRendererRef = useRef<ReturnType<typeof createWaterRenderer>>(null);
  // The shader palette, eased toward its target each frame so a weather
  // or per-night change arrives as a slow tint shift, never a jump.
  const paletteRef = useRef<NightPalette>({ ...NIGHT_PALETTES.bangkok });
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
  // Chunk A4: the milestone stage, read through a ref because the scene
  // effect below runs once — the value stays live as claims land.
  const stageRef = useRef(0);
  stageRef.current = Math.max(0, Math.min(4, Math.floor(milestoneStage)));
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
    // The water's base is the photograph in the DOM below this canvas
    // (an <img>, so it paints even before any canvas work runs); the
    // WebGL shader canvas sits between the two. No photo is loaded here.
    const waterCanvas = waterRef.current;
    if (waterCanvas && !waterRendererRef.current) {
      waterRendererRef.current = createWaterRenderer(waterCanvas);
    }
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sprites = spritesRef.current;

    const stars: Star[] = [];
    const clouds: Cloud[] = [];
    const drops: RainDrop[] = [];
    const tufts: Tuft[] = [];
    const shimmers: Shimmer[] = [];
    const ripples: RippleArc[] = [];
    let meteors: Meteor[] = [];
    let rings: RippleRing[] = [];
    let rockets: Rocket[] = [];
    let particles: Particle[] = [];
    let flashes: Flash[] = [];
    let nextMeteor = 5000;
    let nextRocket = 2000;
    let nextStageRocket = 0; // A4: fireworks while the milestone is complete
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
      return h * RIVER_FRAC;
    }
    function templeX(): number {
      return w * TEMPLE_X_FRAC;
    }
    function templeTopY(): number {
      return h * TEMPLE_TOP_FRAC;
    }

    function rowY(row: number): number {
      // Row 0 is the far bank (small, high), row 3 the near bank (large,
      // low). The rows pack into the water below the waterline, with a
      // margin at the bottom so the nearest krathong (and its splash
      // rings) never clips the panel edge.
      return horizon() + 14 + (row * (h - horizon() - 58)) / (ROWS - 1);
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
      // 7 puffs, denser in the middle, soft at the edges — each with
      // its own size, peak opacity and squash, so no two clouds read
      // as the same cotton-wool blob. Thinner than the variant (peak
      // 0.28–0.48, was a flat 0.6) and desaturated (158,164,198, was
      // a bluer 148,162,214), so more of the photo sky shows through.
      // Irregular edges: each puff is a squashed ellipse, aspect
      // varies per puff, instead of a uniform circle.
      for (let i = 0; i < 7; i++) {
        const px = 40 + rnd() * 160;
        const py = 45 + (rnd() - 0.5) * 30;
        const pr = 18 + rnd() * 36;
        const peak = 0.28 + rnd() * 0.2;
        g.save();
        g.translate(px, py);
        g.scale(1, 0.55 + rnd() * 0.3);
        const grad = g.createRadialGradient(0, 0, pr * 0.1, 0, 0, pr);
        grad.addColorStop(0, `rgba(158, 164, 198, ${peak.toFixed(2)})`);
        grad.addColorStop(0.7, `rgba(158, 164, 198, ${(peak * 0.45).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(158, 164, 198, 0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(0, 0, pr, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      // a faint moonlit top edge on the middle puffs
      for (let i = 0; i < 3; i++) {
        const px = 70 + rnd() * 100;
        const py = 38 + rnd() * 14;
        const pr = 20 + rnd() * 18;
        const grad = g.createRadialGradient(px, py, pr * 0.1, px, py, pr);
        grad.addColorStop(0, 'rgba(208, 212, 228, 0.22)');
        grad.addColorStop(1, 'rgba(208, 212, 228, 0)');
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
          y: h * (0.015 + Math.random() * 0.4),
          r: Math.random() * 1.3 + 0.4,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 1.2,
        });
      }
      clouds.length = 0;
      for (let i = 0; i < 9; i++) {
        clouds.push({
          x: Math.random() * w,
          y: h * (0.03 + Math.random() * 0.3),
          s: 0.6 + Math.random() * 0.9,
          // Per-cloud opacity, so the deck is never uniformly dense.
          a: 0.55 + Math.random() * 0.4,
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
      // Dark reeds and grass at the water's edge, kept clear of the
      // temple's centre (0.50w in the photograph) so they never crowd
      // it. They grow in clusters with gaps between them — not a uniform
      // comb — and every blade has its own height, lean and thickness;
      // about a third carry a seed head, so they read as reeds, not
      // matchsticks. (The far bank itself is the photograph's shoreline
      // now — no drawn bank strip; the reeds are the only drawn bank.)
      tufts.length = 0;
      let clusters = 0;
      let guard = 0;
      while (clusters < 4 && guard < 40) {
        guard += 1;
        const cx = Math.random() * w;
        if (cx > w * 0.45 && cx < w * 0.8) continue;
        clusters += 1;
        const tuftCount = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < tuftCount; k++) {
          const blades: ReedBlade[] = [];
          const n = 3 + Math.floor(Math.random() * 4);
          for (let b = 0; b < n; b++) {
            blades.push({
              h: 6 + Math.random() * 8,
              lean: (Math.random() - 0.5) * 12,
              w: 1.0 + Math.random() * 0.8,
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
      // a whisper. Live defect 2026-11-07: the path was still fainter
      // than the temple reflection (moon 70.3 vs temple 78.4), so the
      // column was strengthened — brighter glow, brighter/longer
      // dashes, stronger shader band — until the moon path is the
      // brightest thing on the water.
      shimmers.length = 0;
      for (let i = 0; i < 10; i++) {
        const depth = Math.pow(Math.random(), 0.7);
        shimmers.push({
          x: w * MOON_X + (Math.random() - 0.5) * (30 + depth * 140),
          // brightest near the far bank, breaking up toward the
          // viewer — never a ladder of bars, never only at the top;
          // the column runs the full depth of the water, which is
          // the bottom third of the panel now
          y: horizon() + 8 + depth * (h - horizon() - 16),
          w: 90 + Math.random() * 90,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.9,
          cool: Math.random() < 0.35,
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
      const moonCX = w * MOON_X;
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
        // Start the boat artwork loading now, so it is ready by the
        // first draw frame (see drawKrathong).
        krathongImage(wish.boat, wish.flower, wish.flame, wish.design);
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
      // The shader canvas shares the box at the same devicePixelRatio
      // as the main canvas: at 1.75x it rendered 683px wide on a 390px
      // mobile screen (DSF 2, 780 physical px) and the browser upscaled
      // it ~1.14x, which read as a soft river. Full DPR costs more
      // shader pixels, but the water is the bottom third of the scene.
      if (waterCanvas) {
        const wdpr = Math.min(window.devicePixelRatio || 1, 2);
        waterCanvas.width = Math.max(1, Math.round(w * wdpr));
        waterCanvas.height = Math.max(1, Math.round(h * wdpr));
      }
      seedSky();
      syncSprites();
      draw(performance.now());
    }

    // --- fireworks --------------------------------------------------------
    // launchRocket(fast): the first rocket of a 5-click preview is
    // fast-fused — vy ~9 instead of ~5 and a higher burst height — so
    // the first burst lands ~1–2 s after the clicks instead of ~9 s.
    // A climbs from the waterline to the sky, a long fuse at the
    // normal speed; the fast fuse only shortens that first climb, the
    // rest of the show keeps the normal rockets.
    function launchRocket(fast = false) {
      if (rockets.length >= 6) return;
      rockets.push({
        x: w * (0.12 + Math.random() * 0.7),
        y: horizon() + 2,
        vy: fast ? 9 + Math.random() * 1.5 : 4.5 + Math.random() * 1.5,
        targetY: fast ? h * (0.05 + Math.random() * 0.06) : h * (0.05 + Math.random() * 0.16),
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
    // tagRect measures where a tag would land (dy shifts it up, for the
    // de-collision pass in draw()); drawNameTag draws it there. Ported
    // from variant B's tagRect, extended in the draw() pass so a tag
    // also steps up when it would cover another boat's sprite/flame.
    function tagRect(g: CanvasRenderingContext2D, wish: Wish, s: Sprite, y: number, sc: number, dy = 0) {
      const name = wish.name.trim() || (langRef.current === 'th' ? 'ใครคนหนึ่งในกรุงเทพฯ' : 'Someone in Bangkok');
      const font = `600 ${Math.round(12 * sc + 1)}px Prompt, Sarabun, sans-serif`;
      g.font = font;
      const tw = g.measureText(name).width;
      const tagW = tw + 16;
      const tagH = 20;
      const tagCx = Math.max(tagW / 2 + 6, Math.min(w - tagW / 2 - 6, s.x));
      return { x: tagCx - tagW / 2, y: y - 52 * sc - tagH + dy, w: tagW, h: tagH, cx: tagCx, name };
    }
    function drawNameTag(g: CanvasRenderingContext2D, wish: Wish, s: Sprite, y: number, sc: number, dy = 0, alpha = 1) {
      const r = tagRect(g, wish, s, y, sc, dy);
      const tagX = r.x;
      const tagY = r.y;
      const tagW = r.w;
      const tagH = r.h;
      const tagCx = r.cx;
      const name = r.name;
      g.save();
      g.globalAlpha = alpha;
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
      g.restore();
    }

    function drawKrathong(wish: Wish, s: Sprite, t: number) {
      const y = rowY(s.row) + Math.sin(t / 1100 + s.phase) * 3;
      const sc = s.scale;
      const fc = flameColor(wish.flame);
      const age = t - s.bornAt;
      const wind = weatherRef.current.windShown;

      // The boat is the builder's krathong artwork (lib/krathongArt) as
      // an image — the wish's own design (hull, candle, flowers, rim
      // and veins), exactly as the preview shows it. It loads async;
      // until it is ready the boat is skipped for that frame and
      // appears once loaded.
      const img = krathongImage(wish.boat, wish.flower, wish.flame, wish.design);
      if (!img.complete || img.naturalWidth === 0) return;
      const w = 66 * sc;
      const h = (w * KRATHONG_VIEWBOX.h) / KRATHONG_VIEWBOX.w;
      const left = s.x - w / 2;
      const top = y + 7 * sc - (KRATHONG_HULL_CENTER_Y / KRATHONG_VIEWBOX.h) * h;
      const k = w / KRATHONG_VIEWBOX.w; // SVG units -> canvas px
      const flameCx = left + KRATHONG_FLAME_CENTER.x * k;
      const flameCy = top + KRATHONG_FLAME_CENTER.y * k;
      const flameBaseX = left + KRATHONG_FLAME_BASE.x * k;
      const flameBaseY = top + KRATHONG_FLAME_BASE.y * k;

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
      const glow = ctx!.createRadialGradient(flameCx, flameCy, 1, flameCx, flameCy, 26 * sc);
      glow.addColorStop(0, fc + 'cc');
      glow.addColorStop(1, fc + '00');
      ctx!.fillStyle = glow;
      ctx!.beginPath();
      ctx!.arc(flameCx, flameCy, 26 * sc, 0, Math.PI * 2);
      ctx!.fill();

      // the artwork itself: hull, candle, flowers, rim, veins, shimmer
      ctx!.drawImage(img, left, top, w, h);

      // flame — the same teardrop as the preview, flickering with the wind
      const [flamePath2D, flameInnerPath2D] = flamePaths();
      ctx!.save();
      ctx!.translate(flameBaseX, flameBaseY);
      ctx!.scale(k, k * flick);
      ctx!.translate(-KRATHONG_FLAME_BASE.x, -KRATHONG_FLAME_BASE.y);
      ctx!.fillStyle = fc;
      ctx!.fill(flamePath2D);
      ctx!.fillStyle = '#fff8dc';
      ctx!.fill(flameInnerPath2D);
      ctx!.restore();

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

    // One shader frame, in step with the main canvas frame (and once
    // for a reduced-motion static frame). The shader canvas sits BELOW
    // this canvas, so this only paints the water layer; the moon column,
    // ripples and boats below are drawn over it.
    function renderWater(t: number) {
      const renderer = waterRendererRef.current;
      if (!renderer || w === 0 || h === 0) return;
      const wthr = weatherRef.current;
      const night = NIGHT_PALETTES[destinationId] ?? NIGHT_PALETTES.bangkok;
      const target = wthr.storm
        ? WEATHER_PALETTES.storm
        : wthr.rainShown > 0.15
          ? WEATHER_PALETTES.rain
          : wthr.cloudShown > 70
            ? WEATHER_PALETTES.overcast
            : night;
      const cur = paletteRef.current;
      for (const k of ['waterTop', 'waterMid', 'waterDeep', 'warm', 'cool'] as const) {
        cur[k] = mixHex(cur[k], target[k], 0.02);
      }
      renderer.render({
        t: t / 1000,
        riverY: horizon(),
        h,
        wind: wthr.windShown,
        cloud: wthr.cloudShown / 100,
        rain: wthr.rainShown > 0.15 ? 1 : 0,
        reflectX: TEMPLE_REFLECT_FRAC,
        moonX: MOON_X,
        colors: cur,
        // Partial opacity: the photograph's real ripple texture shows
        // through the shader's moving lanes.
        blend: 0.5,
      });
    }

    function draw(t: number) {
      renderWater(t);
      // The canvas is transparent where the photograph shows through
      // (there is no opaque sky fill any more), so it must be cleared
      // every frame — without this, every translucent layer (moon halo,
      // clouds, shimmer dashes) accumulates over hundreds of frames
      // into solid discs and a gold thatch. Found while verifying: the
      // first stills showed exactly that.
      ctx!.clearRect(0, 0, w, h);
      const wthr = weatherRef.current;
      const skyH = horizon();
      const overcast = overcastAmount(wthr.cloudShown);
      // At ≥95% cover a continuous cloud sheet closes the last clear gaps
      // over the moon (see below); the disc fades to ~0.15 at full cover.
      const sheet = sheetAmount(wthr.cloudShown);
      // Clouds dim stars and moon; a heavy overcast veils them almost
      // fully — the moon stays faintly visible, never bright.
      const dim = (1 - 0.6 * (wthr.cloudShown / 100)) * (1 - 0.85 * overcast);
      // The moon's path on the water dims WITH the moon but far more
      // gently: the disc can veil to near-invisible (dim ~0.08 at
      // ?cloud=97) while its reflection stays readable — a ~40% cut at
      // full cover, never the disc's ~92%. Using `dim` here made the
      // column vanish under cloud (live defect, 2026-11-07).
      const colDim = 0.6 + 0.4 * dim;

      // sky — the photograph IS the sky now (night-graded indigo with
      // the lit temple), so nothing is painted here: stars, moon,
      // clouds and fireworks below are drawn straight over it. The
      // overcast veil and sheet further down still wash it when the
      // real cloud cover closes in.

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
      const mx = w * MOON_X;
      const my = h * MOON_Y_FRAC;
      // ~10% smaller than the variant (0.045, was 0.05) — the disc read
      // slightly oversized and pasted against the photo sky.
      const mr = Math.min(w, h) * 0.045;
      const halo = ctx!.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 2.3);
      halo.addColorStop(0, `rgba(255, 240, 200, ${(0.15 * dim).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx!.fillStyle = halo;
      ctx!.beginPath();
      ctx!.arc(mx, my, mr * 2.3, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.save();
      ctx!.globalAlpha = (1 - overcast * 0.6) * (1 - sheet * 0.62);
      // Feathered rim: the gradient fades to transparent over the last
      // 15% of the radius instead of ending on a crisp circle, so the
      // disc sits in the photograph's sky texture rather than on it.
      const moon = ctx!.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.2, mx, my, mr);
      moon.addColorStop(0, '#fffbe8');
      moon.addColorStop(0.8, '#f6e7b4');
      moon.addColorStop(0.92, '#f2dfa0');
      moon.addColorStop(1, 'rgba(242, 223, 160, 0)');
      ctx!.fillStyle = moon;
      ctx!.beginPath();
      ctx!.arc(mx, my, mr, 0, Math.PI * 2);
      ctx!.fill();
      // Craters at half the old contrast, smaller, so they read as
      // shading rather than pasted dots.
      ctx!.fillStyle = 'rgba(190, 170, 120, 0.18)';
      for (const [cx, cy, cr] of [[-0.3, 0.1, 0.13], [0.25, -0.25, 0.1], [0.1, 0.35, 0.08]] as const) {
        ctx!.beginPath();
        ctx!.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, Math.PI * 2);
        ctx!.fill();
      }
      // Faint grain inside the disc (fixed-seed specks, clipped to the
      // disc) so the moon carries a little of the photo's texture.
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(mx, my, mr * 0.98, 0, Math.PI * 2);
      ctx!.clip();
      let gs = 7;
      const grnd = () => {
        gs = (gs * 16807) % 2147483647;
        return gs / 2147483647;
      };
      for (let i = 0; i < 42; i++) {
        const ga = (grnd() - 0.5) * 2;
        const gb = (grnd() - 0.5) * 2;
        if (ga * ga + gb * gb > 1) continue;
        ctx!.fillStyle = grnd() < 0.5 ? 'rgba(190, 170, 120, 0.06)' : 'rgba(255, 251, 232, 0.07)';
        ctx!.beginPath();
        ctx!.arc(mx + ga * mr, my + gb * mr, 0.5 + grnd() * 0.9, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();
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
        ctx!.globalAlpha = (0.5 + overcast * 0.25) * c.a;
        ctx!.drawImage(sprite, c.x - 55 * cs, c.y - 25 * cs, 110 * cs, 50 * cs);
        ctx!.globalAlpha = 1;
      }

      // At ≥95% cover a continuous thin cloud sheet lies over the whole
      // sky band — over the moon, the stars and the cloud tops alike —
      // so no clear gap is left for the moon to shine through. It sits
      // under the temple, and never touches the water or
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

      // A4 (reduced): at milestone stage >= 3 the temple glows gold — a
      // warm halo around the spire, painted over the sky before the water.
      if (stageRef.current >= 3) {
        const tx = templeX();
        const ty = h * TEMPLE_TOP_FRAC + 40;
        const halo = ctx!.createRadialGradient(tx, ty, 10, tx, ty, 190);
        halo.addColorStop(0, 'rgba(246, 211, 107, 0.20)');
        halo.addColorStop(1, 'rgba(246, 211, 107, 0)');
        ctx!.fillStyle = halo;
        ctx!.fillRect(tx - 190, ty - 190, 380, 380);
      }

      // water — the base is the photograph in the DOM below this canvas
      // (night-graded Chao Phraya water, real ripple texture across the
      // whole surface) with the WebGL shader's moving lanes over it (see
      // renderWater, called at the top of draw). Nothing is painted as a
      // water base here: a drawn gradient would cover the photograph. A
      // faint navy wash seats the photo + shader with the drawn sky
      // elements, deeper toward the near water; under a heavy overcast a
      // veil dims the water the way the sky is veiled.
      const waterH = h - skyH;
      const seat = ctx!.createLinearGradient(0, skyH, 0, h);
      seat.addColorStop(0, 'rgba(10, 16, 48, 0.08)');
      seat.addColorStop(1, 'rgba(3, 4, 12, 0.16)');
      ctx!.fillStyle = seat;
      ctx!.fillRect(0, skyH, w, waterH);
      if (overcast > 0.01) {
        ctx!.fillStyle = `rgba(24, 30, 62, ${(overcast * 0.22).toFixed(3)})`;
        ctx!.fillRect(0, skyH, w, waterH);
      }

      // A4 (reduced): the milestone stage washes the water gold — deeper
      // with each stage, over the photograph, never instead of it.
      if (stageRef.current >= 1) {
        const washA = [0, 0.05, 0.09, 0.14, 0.2][stageRef.current];
        const gold = ctx!.createLinearGradient(0, skyH, 0, h);
        gold.addColorStop(0, `rgba(232, 179, 75, ${(washA * 0.6).toFixed(3)})`);
        gold.addColorStop(1, `rgba(232, 179, 75, ${washA.toFixed(3)})`);
        ctx!.fillStyle = gold;
        ctx!.fillRect(0, skyH, w, waterH);
      }

      // reeds at the water's edge (the far bank itself is the
      // photograph's shoreline — no drawn bank strip, no waterline
      // stroke; both would sit on top of the real shore and read as
      // pasted). The tufts are seeded clear of the temple's centre.
      for (const tf of tufts) {
        for (let b = 0; b < tf.blades.length; b++) {
          const bl = tf.blades[b];
          const bx = tf.x + (b - (tf.blades.length - 1) / 2) * 3;
          const tipX = bx + bl.lean + (b - (tf.blades.length - 1) / 2) * 2.4;
          const tipY = tf.y - bl.h;
          ctx!.strokeStyle = 'rgba(18, 34, 40, 0.55)';
          ctx!.lineWidth = bl.w;
          ctx!.beginPath();
          ctx!.moveTo(bx, tf.y + 2);
          ctx!.quadraticCurveTo(bx + bl.lean * 0.45, tf.y - bl.h * 0.6, tipX, tipY);
          ctx!.stroke();
          if (bl.head) {
            // a cattail seed head on the tip
            ctx!.fillStyle = 'rgba(18, 34, 40, 0.55)';
            ctx!.beginPath();
            ctx!.ellipse(tipX, tipY - 2, 1.8, 4.5, bl.lean * 0.03, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      }

      // the temple's reflection: a soft glow column under the bank,
      // fading with depth — never hard lines. The photograph's water
      // already carries its own reflections, and drawn fan lines on
      // top of them read as little gold fans. A4: at stage >= 3 the
      // column burns brighter with the temple above it.
      const tGlow = ctx!.createLinearGradient(0, skyH, 0, skyH + 110);
      tGlow.addColorStop(0, stageRef.current >= 3 ? 'rgba(246, 211, 107, 0.22)' : 'rgba(246, 211, 107, 0.05)');
      tGlow.addColorStop(1, 'rgba(246, 211, 107, 0)');
      ctx!.fillStyle = tGlow;
      ctx!.fillRect(templeX() - 70, skyH, 140, 110);

      // moonlight on the water — a real column under the moon, over
      // the photograph's own glitter path, which it reinforces: a
      // wide soft glow, then dashes that break and reform down the
      // full depth of the water, each with its own phase and a
      // sideways wobble. Overcast-robust: the column dims with the
      // moon through `colDim` (a ~40% cut at full cover, not the
      // disc's ~92%) — the moon disc in the sky still veils, but its
      // path on the water stays readable, the brightest thing there.
      // The core is bright enough (0.30) to read as one smooth column
      // over the photograph's ripples and the temple's light streaks;
      // at 0.16 it was drowned out (live defect, 2026-11-07).
      const moonX = w * MOON_X;
      const coreBand = ctx!.createLinearGradient(moonX - 45, 0, moonX + 45, 0);
      coreBand.addColorStop(0, 'rgba(246, 211, 107, 0)');
      coreBand.addColorStop(0.5, `rgba(246, 211, 107, ${(0.3 * colDim).toFixed(3)})`);
      coreBand.addColorStop(1, 'rgba(246, 211, 107, 0)');
      ctx!.fillStyle = coreBand;
      ctx!.fillRect(moonX - 45, skyH, 90, h - skyH);
      const glowCol = ctx!.createLinearGradient(moonX - 130, 0, moonX + 130, 0);
      glowCol.addColorStop(0, 'rgba(246, 211, 107, 0)');
      glowCol.addColorStop(0.5, `rgba(246, 211, 107, ${(0.18 * colDim).toFixed(3)})`);
      glowCol.addColorStop(1, 'rgba(246, 211, 107, 0)');
      ctx!.fillStyle = glowCol;
      ctx!.fillRect(moonX - 130, skyH, 260, h - skyH);
      const washCol = ctx!.createLinearGradient(moonX - 240, 0, moonX + 240, 0);
      washCol.addColorStop(0, 'rgba(246, 211, 107, 0)');
      washCol.addColorStop(0.5, `rgba(246, 211, 107, ${(0.07 * colDim).toFixed(3)})`);
      washCol.addColorStop(1, 'rgba(246, 211, 107, 0)');
      ctx!.fillStyle = washCol;
      ctx!.fillRect(moonX - 240, skyH, 480, h - skyH);
      for (const sh of shimmers) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin((t / 1000) * sh.speed + sh.phase));
        const a = (0.08 + 0.12 * tw) * colDim;
        const wx = sh.x + Math.sin((t / 1300) * sh.speed + sh.phase) * 7;
        ctx!.strokeStyle = sh.cool
          ? `rgba(205, 214, 248, ${a.toFixed(3)})`
          : `rgba(246, 211, 107, ${a.toFixed(3)})`;
        ctx!.lineWidth = 3;
        ctx!.lineCap = 'round';
        ctx!.beginPath();
        ctx!.moveTo(wx - sh.w / 2, sh.y);
        ctx!.lineTo(wx + sh.w / 2, sh.y);
        ctx!.stroke();
      }
      ctx!.lineCap = 'butt';

      // ripple arcs over the photograph — the lower water's texture
      // (see the seed comment). They never fade below 60% of base
      // alpha, so a frozen frame still shows wave texture; fainter
      // under a heavy overcast, like the rest of the moonlight.
      const arcDim = 1 - overcast * 0.5;
      for (const rp of ripples) {
        const tw = 0.6 + 0.4 * Math.abs(Math.sin((t / 1000) * rp.speed + rp.phase));
        const a = rp.base * tw * arcDim * (rp.gold ? 0.7 : 1);
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
      // Overcast dims the water itself: the photograph's gold glitter
      // does not dim with the moon, so under a heavy overcast it stays
      // bright while the moon goes grey. A dark veil over the water
      // band — drawn after the ripples and rain, before the boats, so
      // the boats stay lit — brings the whole column down with the
      // moon. (The shader path already tracks the moon; this covers
      // the photo's own reflection, which the shader cannot reach.)
      if (overcast > 0) {
        ctx!.fillStyle = `rgba(4, 6, 20, ${(overcast * 0.3).toFixed(3)})`;
        ctx!.fillRect(0, skyH, w, h - skyH);
      }
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
        // Tags de-collide: two boats drifting close together used to
        // have their tags drawn on top of each other (one name half
        // hidden behind the other), and a tag could sit on another
        // boat's flame. A tag that would overlap one already placed,
        // or another boat's sprite/flame box, steps UP by 28px, up to
        // three times, so every name stays fully readable; up, never
        // down, so a shifted tag can never cover its own boat's flame.
        // (Ported from variant B, extended from tags-only to boats —
        // and strengthened: B's 24px/up-to-twice left a tag overlapping
        // in a live 6-boat cluster, where a stepped tag can land on
        // the next placed tag up the chain and run out of attempts.)
        const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
          a.x < b.x + b.w + 6 && a.x + a.w + 6 > b.x && a.y < b.y + b.h + 6 && a.y + a.h + 6 > b.y;
        // One exclusion box per boat: the leaf boat, candle and flame.
        const boatBoxes = [...sprites.values()].map((bs) => {
          const by = rowY(bs.row) + Math.sin(t / 1100 + bs.phase) * 3;
          const hw = 34 * bs.scale + 6;
          return { id: bs.id, x: bs.x - hw, y: by - 32 * bs.scale, w: hw * 2, h: 48 * bs.scale };
        });
        const placed: { x: number; y: number; w: number; h: number }[] = [];
        for (const s of ordered) {
          const wish = list.find((x) => x.id === s.id);
          if (!wish) continue;
          const ty = rowY(s.row) + Math.sin(t / 1100 + s.phase) * 3;
          // Orphan fade: boats wrap at w+50 → −50 while tags clamp
          // inside, so a tag used to outlive its boat at the panel
          // edge. A tag now fades out as its boat leaves the frame
          // (gone by 40px off-frame) instead of lingering boatless.
          const off = s.x < 0 ? -s.x : s.x > w ? s.x - w : 0;
          const tagAlpha = off <= 0 ? 1 : Math.max(0, 1 - off / 40);
          if (tagAlpha <= 0) continue;
          let dy = 0;
          let r = tagRect(tagG, wish, s, ty, s.scale, dy);
          for (let attempt = 0; attempt < 3; attempt++) {
            const hitTag = placed.some((p) => overlaps(r, p));
            const hitBoat = boatBoxes.some((b) => b.id !== s.id && overlaps(r, b));
            if (!hitTag && !hitBoat) break;
            dy -= 28;
            r = tagRect(tagG, wish, s, ty, s.scale, dy);
          }
          placed.push(r);
          drawNameTag(tagG, wish, s, ty, s.scale, dy, tagAlpha);
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
            y: horizon() + 8 + Math.random() * (h - horizon() - 16),
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
      // A4 (reduced): a completed milestone (stage 4) celebrates with
      // fireworks of its own — slower than the festival-night show, so
      // the sky is festive without being constant.
      if (stageRef.current >= 4) {
        nextStageRocket -= dt;
        if (nextStageRocket <= 0) {
          nextStageRocket = 2600 + Math.random() * 1600;
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
        // First burst fast: one fast-fused rocket leaves at once, so
        // the preview shows a burst within a couple of seconds.
        launchRocket(true);
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
    // Chunk B: the grand finale fires the same 60-second fireworks
    // show through a dedicated event, so the finale overlay never has
    // to fake the hidden 5-click trigger above.
    const onFinaleShow = () => {
      showElapsed = 0;
      nextShowRocket = 0;
      launchRocket(true);
    };
    window.addEventListener('loy:finale-show', onFinaleShow);
    // E4 celebrate: when the organisers trigger a celebration
    // (config.celebrateUntil), the page dispatches 'loy:celebrate' and
    // the same 60-second fireworks show starts — identical to the
    // hidden 5-click preview, just started by the organisers instead.
    // Dispatching it again while a show runs restarts the 60 s.
    const onCelebrate = () => {
      showElapsed = 0;
      nextShowRocket = 0;
      launchRocket(true);
    };
    window.addEventListener('loy:celebrate', onCelebrate);
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
      window.removeEventListener('loy:finale-show', onFinaleShow);
      window.removeEventListener('loy:celebrate', onCelebrate);
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

  // Layers, bottom to top: the night-graded Chao Phraya photograph
  // (its own lit Wat Arun is the temple now — no SVG overlay), the
  // WebGL water canvas, the main canvas (sky life + water overlays +
  // boats), and the name-tag canvas. The photograph and the water
  // canvas never take pointer input.
  return (
    <div className="river-scene">
      <img
        className="river-backdrop"
        src="/chao-phraya-night.webp"
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <canvas ref={waterRef} className="river-water" aria-hidden="true" />
      <canvas ref={ref} aria-label="River of krathongs" role="img" />
      {/* Name tags, above the temple overlay — purely visual, the names
          are already in the wish wall and panel. */}
      <canvas ref={tagRef} className="river-tags" aria-hidden="true" />
    </div>
  );
}
