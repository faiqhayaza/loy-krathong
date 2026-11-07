// The krathong artwork, as ONE source of truth.
//
// The builder preview (KrathongSvg) and the boats floating on the river
// (RiverCanvas drawKrathong) must show the SAME krathong — same hull,
// same flowers, same flame. They used to be drawn twice, by hand, in
// two places, and they drifted: the preview had two lotus flowers and
// a teardrop flame on a gradient hull, while the river drew one flower
// and a procedural ellipse boat. Faiq saw the mismatch live.
//
// This module owns the artwork. KrathongSvg renders the inner markup
// into the DOM; RiverCanvas loads the same markup (minus the glow and
// the flame, which it draws itself so they can flicker with the wind)
// as an image and draws it on the canvas. Change the artwork here and
// both places change together.
//
// The geometry is the hand-drawn krathong from the original site:
// a banana-leaf boat, the chosen flower, a candle flame.
//
// DESIGNS — one krathong, five shapes. Every design shares the same
// viewBox (220x136), the same candle (x 106-114, y 52-68) and the same
// flame (base 110,51; centre 110,34), and the same hull centre
// (y 87, the point the river anchors the boat by). Only the hull
// shape, the flower arrangement and the decoration change, so a
// design can be picked per float and every view — preview, river,
// journey card — shows the same boat. The classic design is the
// original artwork, unchanged.

import { boatColors, flameColor, flowerGlyph } from './data';

export const KRATHONG_VIEWBOX = { w: 220, h: 136 } as const;

/** The teardrop flame path (SVG coords, viewBox 220x136). */
export const KRATHONG_FLAME_PATH =
  'M110 18 C116 28 118 34 118 40 C118 47 114 51 110 51 C106 51 102 47 102 40 C102 34 104 28 110 18 Z';
/** The pale inner core of the flame. */
export const KRATHONG_FLAME_INNER_PATH =
  'M110 32 C113 37 114 40 114 43 C114 47 112 49 110 49 C108 49 106 47 106 43 C106 40 107 37 110 32 Z';
/** The flame's base point (where it meets the candle wick). */
export const KRATHONG_FLAME_BASE = { x: 110, y: 51 } as const;
/** The centre of the flame glow. */
export const KRATHONG_FLAME_CENTER = { x: 110, y: 34 } as const;
/** The hull's vertical centre (the point the river anchors the boat by). */
export const KRATHONG_HULL_CENTER_Y = 87;

/** The flower glyphs are emoji, so name the emoji fonts explicitly —
    an SVG loaded as an image has no page to fall back to, and without
    this the glyphs can render as tofu boxes. In the DOM the same
    fallback chain applies (the page font has no emoji glyphs). */
const EMOJI_FONT = "Apple Color Emoji, 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

/** One flower spot on a design: the glyph's position (x, baseline y) and size. */
interface FlowerSpot {
  x: number;
  y: number;
  size: number;
}

/** A krathong design: hull path, the highlight band on the hull, the
    detail strokes (veins, rim, trim, swan neck) and the flower spots.
    The candle and flame are the same for every design and are drawn
    separately. The details get the boat id so a design can reuse the
    boat's gradient (the swan's neck and head are the boat's colours). */
interface KrathongDesignGeometry {
  hull: string;
  highlight: string;
  details: (boat: string) => string[];
  flowers: FlowerSpot[];
}

/** The five designs. `classic` is the original artwork, byte for byte
    the markup it always produced — a new design must never change it. */
const DESIGNS: Record<string, KrathongDesignGeometry> = {
  classic: {
    hull: 'M22 74 Q110 58 198 74 L188 96 Q110 116 32 96 Z',
    highlight: 'M22 74 Q110 58 198 74 Q110 92 22 74 Z',
    details: () => [
      '<path d="M40 82 Q110 96 180 82" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>',
      '<path d="M110 74 L110 104" stroke="rgba(0,0,0,0.16)" stroke-width="1.5"/>',
      '<path d="M70 78 L62 100" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>',
      '<path d="M150 78 L158 100" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>',
    ],
    flowers: [
      { x: 78, y: 72, size: 30 },
      { x: 142, y: 72, size: 30 },
    ],
  },
  lotus: {
    // A lotus in bloom: the hull's top edge scallops into five petal
    // bumps, and four flowers ring the candle — two large at the
    // sides, two small flanking it.
    hull: 'M20 78 Q34 60 48 72 Q62 56 78 70 Q94 56 110 68 Q126 56 142 70 Q158 56 172 72 Q186 60 200 78 L190 98 Q110 118 30 98 Z',
    highlight:
      'M20 78 Q34 60 48 72 Q62 56 78 70 Q94 56 110 68 Q126 56 142 70 Q158 56 172 72 Q186 60 200 78 Q110 94 20 78 Z',
    details: () => [
      '<path d="M110 72 L110 104" stroke="rgba(0,0,0,0.16)" stroke-width="1.5"/>',
      '<path d="M66 76 L60 100" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>',
      '<path d="M154 76 L160 100" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>',
    ],
    flowers: [
      { x: 56, y: 70, size: 26 },
      { x: 86, y: 74, size: 20 },
      { x: 134, y: 74, size: 20 },
      { x: 164, y: 70, size: 26 },
    ],
  },
  swan: {
    // A swan boat: a long, low hull with the prow rising into a swan's
    // neck and head at the front (right). One large flower by the neck,
    // one small at the stern.
    hull: 'M14 82 Q60 72 110 74 Q160 76 196 70 L190 92 Q110 110 28 94 Z',
    highlight: 'M14 82 Q60 72 110 74 Q160 76 196 70 Q110 82 14 82 Z',
    details: (boat) => [
      // The neck rises from the prow, drawn as a thick stroked curve in
      // the boat's own gradient, with a head, an eye and a beak.
      `<path d="M192 72 Q202 64 200 52 Q199 46 194 47" fill="none" stroke="url(#boat-${boat})" stroke-width="7" stroke-linecap="round"/>`,
      `<circle cx="195" cy="46" r="5" fill="url(#boat-${boat})"/>`,
      '<circle cx="197" cy="44" r="1.6" fill="rgba(0,0,0,0.4)"/>',
      '<path d="M199 44 L206 47 L199 50 Z" fill="#f8a65b"/>',
      '<path d="M20 86 Q110 78 190 74" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>',
      '<path d="M110 78 L110 100" stroke="rgba(0,0,0,0.14)" stroke-width="1.5"/>',
    ],
    flowers: [
      { x: 64, y: 76, size: 22 },
      { x: 162, y: 72, size: 28 },
    ],
  },
  basket: {
    // A flower basket: a deep rounded bowl with a woven rim (a darker
    // band at the top, with short vertical weave dashes across it),
    // carrying two large flowers.
    hull: 'M44 72 Q110 60 176 72 L172 96 Q110 122 48 96 Z',
    highlight: 'M44 72 Q110 60 176 72 Q110 82 44 72 Z',
    details: () => [
      '<path d="M44 72 Q110 60 176 72 L176 79 Q110 69 44 79 Z" fill="rgba(0,0,0,0.15)"/>',
      '<path d="M70 70 L70 78 M95 67 L95 75 M125 67 L125 75 M150 70 L150 78" stroke="rgba(0,0,0,0.25)" stroke-width="1.5"/>',
      '<path d="M110 80 L110 112" stroke="rgba(0,0,0,0.14)" stroke-width="1.5"/>',
    ],
    flowers: [
      { x: 72, y: 72, size: 32 },
      { x: 148, y: 72, size: 32 },
    ],
  },
  canoe: {
    // A leaf canoe: long, narrow, pointed at both ends, with leaf
    // veins along the hull and a small flower near each tip.
    hull: 'M12 84 Q110 70 208 84 Q110 102 12 84 Z',
    highlight: 'M12 84 Q110 70 208 84 Q110 88 12 84 Z',
    details: () => [
      '<path d="M22 84 Q110 78 198 84" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1.5"/>',
      '<path d="M110 78 L110 96" stroke="rgba(0,0,0,0.14)" stroke-width="1.5"/>',
      '<path d="M60 82 L56 94 M160 82 L164 94" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>',
    ],
    flowers: [
      { x: 60, y: 78, size: 24 },
      { x: 160, y: 78, size: 24 },
    ],
  },
};

/**
 * The inner markup of the krathong SVG (everything inside the <svg>
 * tag). `includeGlow` / `includeFlame` are false for the river image:
 * the canvas draws the glow and the flame itself, at the same
 * positions, so they can flicker with the wind. The DOM preview keeps
 * both (the flame flickers via the .flame-flicker CSS animation).
 * `design` picks one of the five shapes (default 'classic'); an
 * unknown design falls back to classic, so old wishes without a
 * design still draw.
 */
export function krathongInnerMarkup(
  boat: string,
  flower: string,
  flame: string,
  opts: { includeGlow?: boolean; includeFlame?: boolean; design?: string } = {},
): string {
  const { includeGlow = true, includeFlame = true, design = 'classic' } = opts;
  const geo = DESIGNS[design] ?? DESIGNS.classic;
  const [c1, c2] = boatColors(boat);
  const fc = flameColor(flame);
  const glyph = flowerGlyph(flower);
  const flowerMarkup = geo.flowers
    .map(
      (f) =>
        `<text x="${f.x}" y="${f.y}" font-size="${f.size}" text-anchor="middle" font-family="${EMOJI_FONT}">${glyph}</text>`,
    )
    .join('');
  return [
    `<defs>`,
    `<linearGradient id="boat-${boat}" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${c1}"/>`,
    `<stop offset="100%" stop-color="${c2}"/>`,
    `</linearGradient>`,
    `<radialGradient id="glow-${flame}" cx="0.5" cy="0.5" r="0.5">`,
    `<stop offset="0%" stop-color="${fc}" stop-opacity="0.85"/>`,
    `<stop offset="100%" stop-color="${fc}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `</defs>`,
    includeGlow
      ? `<ellipse cx="110" cy="42" rx="34" ry="30" fill="url(#glow-${flame})"/>`
      : '',
    `<rect x="106" y="52" width="8" height="16" rx="2" fill="#f3e6c8"/>`,
    `<rect x="106" y="52" width="8" height="5" rx="2" fill="#d9c48f"/>`,
    includeFlame
      ? `<g class="flame-flicker">` +
        `<path d="${KRATHONG_FLAME_PATH}" fill="${fc}"/>` +
        `<path d="${KRATHONG_FLAME_INNER_PATH}" fill="#fff8dc"/>` +
        `</g>`
      : '',
    flowerMarkup,
    `<path d="${geo.hull}" fill="url(#boat-${boat})" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>`,
    `<path d="${geo.highlight}" fill="rgba(255,255,255,0.18)"/>`,
    ...geo.details(boat),
    `<ellipse cx="110" cy="118" rx="86" ry="7" fill="rgba(255,255,255,0.07)"/>`,
  ].join('');
}

/**
 * The krathong as a standalone SVG document, ready to load as an
 * image (RiverCanvas). The glow and flame are left out — the canvas
 * draws those itself so they flicker with the wind.
 */
export function krathongSvgDocument(boat: string, flower: string, flame: string, design: string = 'classic'): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="136" viewBox="0 0 220 136">` +
    krathongInnerMarkup(boat, flower, flame, { includeGlow: false, includeFlame: false, design }) +
    `</svg>`
  );
}

/**
 * The krathong as a standalone SVG document WITH the glow and the
 * flame — the complete artwork, as the builder preview shows it.
 * The keepsake card and the journey card download this (as an image)
 * so the PNG shows the chosen design, not a hand-drawn classic hull.
 * (krathongSvgDocument leaves both out: the river draws them itself
 * so they can flicker with the wind.)
 */
export function krathongSvgDocumentFull(
  boat: string,
  flower: string,
  flame: string,
  design: string = 'classic',
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="136" viewBox="0 0 220 136">` +
    krathongInnerMarkup(boat, flower, flame, { includeGlow: true, includeFlame: true, design }) +
    `</svg>`
  );
}

/**
 * Load the full krathong artwork as an image (for canvas downloads).
 * Resolves with the image once it loads; rejects if the SVG cannot
 * be loaded, so the caller can fall back to its hand-drawn boat.
 * The SVG is self-contained (all markup inline, system emoji fonts
 * named explicitly), so a data URL is enough — no network, no fetch.
 */
export function loadKrathongImage(
  boat: string,
  flower: string,
  flame: string,
  design: string = 'classic',
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('krathong image failed to load'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      krathongSvgDocumentFull(boat, flower, flame, design),
    )}`;
  });
}
