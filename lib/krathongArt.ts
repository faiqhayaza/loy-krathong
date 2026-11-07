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

/**
 * The inner markup of the krathong SVG (everything inside the <svg>
 * tag). `includeGlow` / `includeFlame` are false for the river image:
 * the canvas draws the glow and the flame itself, at the same
 * positions, so they can flicker with the wind. The DOM preview keeps
 * both (the flame flickers via the .flame-flicker CSS animation).
 */
export function krathongInnerMarkup(
  boat: string,
  flower: string,
  flame: string,
  opts: { includeGlow?: boolean; includeFlame?: boolean } = {},
): string {
  const { includeGlow = true, includeFlame = true } = opts;
  const [c1, c2] = boatColors(boat);
  const fc = flameColor(flame);
  const glyph = flowerGlyph(flower);
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
    `<text x="78" y="72" font-size="30" text-anchor="middle" font-family="${EMOJI_FONT}">${glyph}</text>`,
    `<text x="142" y="72" font-size="30" text-anchor="middle" font-family="${EMOJI_FONT}">${glyph}</text>`,
    `<path d="M22 74 Q110 58 198 74 L188 96 Q110 116 32 96 Z" fill="url(#boat-${boat})" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>`,
    `<path d="M22 74 Q110 58 198 74 Q110 92 22 74 Z" fill="rgba(255,255,255,0.18)"/>`,
    `<path d="M40 82 Q110 96 180 82" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>`,
    `<path d="M110 74 L110 104" stroke="rgba(0,0,0,0.16)" stroke-width="1.5"/>`,
    `<path d="M70 78 L62 100" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>`,
    `<path d="M150 78 L158 100" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>`,
    `<ellipse cx="110" cy="118" rx="86" ry="7" fill="rgba(255,255,255,0.07)"/>`,
  ].join('');
}

/**
 * The krathong as a standalone SVG document, ready to load as an
 * image (RiverCanvas). The glow and flame are left out — the canvas
 * draws those itself so they flicker with the wind.
 */
export function krathongSvgDocument(boat: string, flower: string, flame: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="136" viewBox="0 0 220 136">` +
    krathongInnerMarkup(boat, flower, flame, { includeGlow: false, includeFlame: false }) +
    `</svg>`
  );
}
