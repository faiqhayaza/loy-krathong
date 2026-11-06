// A hand-drawn krathong as inline SVG: a banana-leaf boat in the chosen
// colours, the chosen flower, and a candle flame that flickers (CSS).

import { boatColors, flameColor, flowerGlyph } from '@/lib/data';

interface Props {
  boat: string;
  flower: string;
  flame: string;
  name?: string;
  width?: number;
}

export default function KrathongSvg({ boat, flower, flame, name, width = 220 }: Props) {
  const [c1, c2] = boatColors(boat);
  const fc = flameColor(flame);
  const glyph = flowerGlyph(flower);
  const label = name?.trim() ? name.trim() : '';

  return (
    <svg
      width={width}
      height={width * 0.62}
      viewBox="0 0 220 136"
      role="img"
      aria-label={label ? `Krathong for ${label}` : 'Krathong preview'}
    >
      <defs>
        <linearGradient id={`boat-${boat}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
        <radialGradient id={`glow-${flame}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={fc} stopOpacity="0.85" />
          <stop offset="100%" stopColor={fc} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* flame glow */}
      <ellipse cx="110" cy="42" rx="34" ry="30" fill={`url(#glow-${flame})`} />

      {/* candle */}
      <rect x="106" y="52" width="8" height="16" rx="2" fill="#f3e6c8" />
      <rect x="106" y="52" width="8" height="5" rx="2" fill="#d9c48f" />

      {/* flame */}
      <g className="flame-flicker">
        <path
          d="M110 18 C116 28 118 34 118 40 C118 47 114 51 110 51 C106 51 102 47 102 40 C102 34 104 28 110 18 Z"
          fill={fc}
        />
        <path
          d="M110 32 C113 37 114 40 114 43 C114 47 112 49 110 49 C108 49 106 47 106 43 C106 40 107 37 110 32 Z"
          fill="#fff8dc"
        />
      </g>

      {/* flower, tucked behind the candle */}
      <text x="78" y="72" fontSize="30" textAnchor="middle">{glyph}</text>
      <text x="142" y="72" fontSize="30" textAnchor="middle">{glyph}</text>

      {/* banana-leaf boat: folded leaf rim + hull */}
      <path
        d="M22 74 Q110 58 198 74 L188 96 Q110 116 32 96 Z"
        fill={`url(#boat-${boat})`}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="1"
      />
      <path d="M22 74 Q110 58 198 74 Q110 92 22 74 Z" fill="rgba(255,255,255,0.18)" />
      <path d="M40 82 Q110 96 180 82" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="2" />
      {/* leaf veins */}
      <path d="M110 74 L110 104" stroke="rgba(0,0,0,0.16)" strokeWidth="1.5" />
      <path d="M70 78 L62 100" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />
      <path d="M150 78 L158 100" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />

      {/* waterline shimmer */}
      <ellipse cx="110" cy="118" rx="86" ry="7" fill="rgba(255,255,255,0.07)" />
    </svg>
  );
}
