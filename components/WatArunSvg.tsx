// Wat Arun at night, drawn as an inline SVG illustration — the detailed
// temple the river scene's far bank carries, replacing the flat black
// canvas silhouette.
//
// Geometry: viewBox 0 0 600 380; the base (the far bank, the horizon) is
// y = 200, the central prang rises to y = 29, and its reflection runs to
// y = 371. The overlay box this sits in (see .temple-overlay in
// globals.css) is positioned so y = 200 lands exactly on the canvas
// horizon (28% of the canvas height) and the temple centre lands at
// 30% of the river width — the same spot the canvas temple stood, so the
// swifts still fly to it and the fireworks still rise above it.
//
// The central prang is drawn from the real thing: a stepped pyramidal
// base, a long shaft whose outline curves inward as it rises — the concave
// lotus-bud profile — a bud dome and a trident finial, with four smaller
// satellite prangs stepping down on either side. Nothing is flat black:
// the stone is a deep indigo-blue with a porcelain-mosaic pattern (small
// light and dark tiles, as on the real prang), arched niches glow warm
// gold, and the tiered sala roofs carry a gold eave line.

export default function WatArunSvg() {
  return (
    <svg
      viewBox="0 0 600 380"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Porcelain mosaic: small tiles in slightly varied tones, the
            pale ones a hint of the real prang's porcelain. */}
        <pattern id="wat-mosaic" width="7" height="7" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="#20294f" />
          <rect x="0" y="0" width="3.2" height="3.2" fill="#28315c" />
          <rect x="3.5" y="3.5" width="3.2" height="3.2" fill="#1b2342" />
          <rect x="3.5" y="0" width="3.2" height="3.2" fill="#d9c48f" opacity="0.16" />
          <rect x="0" y="3.5" width="3.2" height="3.2" fill="#8b9cc9" opacity="0.22" />
        </pattern>
        <radialGradient id="wat-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#f6d36b" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#f6d36b" stopOpacity="0" />
        </radialGradient>
        {/* The reflection fades as it sinks: bright at the bank, gone by
            the time it would reach the near water. */}
        <linearGradient id="wat-fade" gradientUnits="userSpaceOnUse" x1="0" y1="200" x2="0" y2="345">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id="wat-refl-mask">
          <rect x="0" y="200" width="600" height="180" fill="url(#wat-fade)" />
        </mask>
        {/* One prang, unit size: base half-width 45, height 171, base at
            y = 0, tip at y = -171. The satellites are <use>s of this,
            scaled down. */}
        <g id="wat-prang">
          {/* stepped base + concave lotus-bud shaft + bud dome */}
          <path
            d="M -45 0 L -45 -22 L -36 -22 L -36 -44 L -28 -44 L -28 -65 L -22.5 -65
               Q -9 -106 -5.9 -144 Q -4 -152 0 -159 Q 4 -152 5.9 -144 Q 9 -106 22.5 -65
               L 28 -65 L 28 -44 L 36 -44 L 36 -22 L 45 -22 L 45 0 Z"
            fill="#1c2447"
          />
          <path
            d="M -45 0 L -45 -22 L -36 -22 L -36 -44 L -28 -44 L -28 -65 L -22.5 -65
               Q -9 -106 -5.9 -144 Q -4 -152 0 -159 Q 4 -152 5.9 -144 Q 9 -106 22.5 -65
               L 28 -65 L 28 -44 L 36 -44 L 36 -22 L 45 -22 L 45 0 Z"
            fill="url(#wat-mosaic)"
            opacity="0.5"
          />
          {/* gold rim light on the moonlit edge */}
          <path
            d="M 22.5 -65 Q 9 -106 5.9 -144 Q 4 -152 0 -159"
            fill="none"
            stroke="#f6d36b"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
          {/* arched niches, warm and lit */}
          <path d="M -3.5 -78 L -3.5 -86 Q 0 -89.5 3.5 -86 L 3.5 -78 Z" fill="#f6d36b" />
          <path d="M -3 -108 L -3 -115 Q 0 -118 3 -115 L 3 -108 Z" fill="#f6d36b" opacity="0.85" />
          <path d="M -2.5 -132 L -2.5 -138 Q 0 -140.5 2.5 -138 L 2.5 -132 Z" fill="#f6d36b" opacity="0.7" />
          {/* trident finial */}
          <rect x="-1.2" y="-171" width="2.4" height="13" fill="#d9c48f" />
          <path
            d="M 0 -171 L -4.5 -165 M 0 -171 L 4.5 -165"
            stroke="#d9c48f"
            strokeWidth="1.2"
            fill="none"
          />
          {/* miniature spires on the top terrace corners */}
          <path d="M -31 -65 L -28 -72 L -25 -65 Z" fill="#1c2447" />
          <path d="M 25 -65 L 28 -72 L 31 -65 Z" fill="#1c2447" />
        </g>
      </defs>

      {/* faint warm glow behind the central prang */}
      <ellipse cx="283" cy="150" rx="180" ry="120" fill="url(#wat-glow)" />

      {/* base platform, with its own small lit niches */}
      <rect x="55" y="197" width="470" height="6" fill="#10152c" />
      <rect x="55" y="197" width="470" height="1" fill="#f6d36b" opacity="0.25" />
      <g fill="#f6d36b">
        <rect className="temple-window" x="120" y="199" width="2.4" height="3.4" style={{ animationDelay: '0s' }} />
        <rect className="temple-window" x="180" y="199" width="2.4" height="3.4" style={{ animationDelay: '0.9s' }} />
        <rect className="temple-window" x="240" y="199" width="2.4" height="3.4" style={{ animationDelay: '1.7s' }} />
        <rect className="temple-window" x="330" y="199" width="2.4" height="3.4" style={{ animationDelay: '0.4s' }} />
        <rect className="temple-window" x="390" y="199" width="2.4" height="3.4" style={{ animationDelay: '1.3s' }} />
        <rect className="temple-window" x="450" y="199" width="2.4" height="3.4" style={{ animationDelay: '2.1s' }} />
      </g>

      {/* tiered sala roofs at the flanks, eaves flicking up, gold edge */}
      <g fill="#151b36" stroke="#f6d36b" strokeOpacity="0.35" strokeWidth="0.8">
        <path d="M 0 200 Q 3 186 15.2 185 L 64.8 185 Q 77 186 80 200 Z" />
        <path d="M 15.2 185 Q 17.6 172.5 26.4 171 L 53.6 171 Q 62.4 172.5 64.8 185 Z" />
        <path d="M 36 171 L 40 152.5 L 44 171 Z" />
        <path d="M 516 200 Q 519 187.4 531.2 186.5 L 580.8 186.5 Q 593 187.4 596 200 Z" />
        <path d="M 531.2 186.5 Q 533.6 175.25 542.4 173.9 L 569.6 173.9 Q 578.4 175.25 580.8 186.5 Z" />
        <path d="M 552 173.9 L 556 157.25 L 560 173.9 Z" />
      </g>
      <circle cx="40" cy="151" r="1.6" fill="#f6d36b" opacity="0.8" />
      <circle cx="556" cy="155.5" r="1.6" fill="#f6d36b" opacity="0.8" />

      {/* four satellite prangs, stepping down away from the centre */}
      <use href="#wat-prang" transform="translate(99, 200) scale(0.4)" />
      <use href="#wat-prang" transform="translate(486, 200) scale(0.4)" />
      <use href="#wat-prang" transform="translate(169, 200) scale(0.61)" />
      <use href="#wat-prang" transform="translate(397, 200) scale(0.61)" />
      {/* the central prang */}
      <use href="#wat-prang" transform="translate(283, 200)" />

      {/* soft reflection in the water: the temple flipped and squashed,
          fading as it sinks, under a few still gold streaks */}
      <g mask="url(#wat-refl-mask)" opacity="0.3">
        <g transform="translate(0, 350) scale(1, -0.75)">
          <use href="#wat-prang" transform="translate(99, 200) scale(0.4)" />
          <use href="#wat-prang" transform="translate(486, 200) scale(0.4)" />
          <use href="#wat-prang" transform="translate(169, 200) scale(0.61)" />
          <use href="#wat-prang" transform="translate(397, 200) scale(0.61)" />
          <use href="#wat-prang" transform="translate(283, 200)" />
          <rect x="55" y="197" width="470" height="6" fill="#10152c" />
        </g>
      </g>
      <g fill="#f6d36b" opacity="0.1">
        <rect x="230" y="216" width="106" height="2" rx="1" />
        <rect x="245" y="232" width="76" height="2" rx="1" />
        <rect x="258" y="248" width="50" height="2" rx="1" />
      </g>
    </svg>
  );
}
