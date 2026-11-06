// The river: dark reflective water with a moonlit shimmer, gentle ripples,
// and one floating krathong per wish. Each krathong is drawn — leaf boat in
// its colour, flower, flickering candle — with the person's name on a small
// tag above it. Hover (or tap) reads the wish; a click pins it open.

'use client';

import { useEffect, useRef } from 'react';
import type { Lang, Wish } from '@/lib/data';
import { boatColors, flameColor, flowerGlyph } from '@/lib/data';

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

interface Props {
  wishes: Wish[];
  lang: Lang;
  highlightId: string | null;
  onHover: (wish: Wish | null, x: number, y: number) => void;
  onSelect: (wish: Wish) => void;
}

const ROWS = 4;

export default function RiverCanvas({ wishes, lang, highlightId, onHover, onSelect }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
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

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sprites = spritesRef.current;

    function rowY(row: number): number {
      // Row 0 is the far bank (small, high), row 3 the near bank (large, low).
      return h * (0.3 + row * 0.17);
    }
    function rowScale(row: number): number {
      return 0.62 + row * 0.22;
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
            // New krathongs splash in at the near bank; the rest spread out.
            x: fresh ? w * (0.3 + Math.random() * 0.4) : Math.random() * w,
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
      syncSprites();
      draw(performance.now());
    }

    function drawKrathong(wish: Wish, s: Sprite, t: number) {
      const y = rowY(s.row) + Math.sin(t / 1100 + s.phase) * 3;
      const sc = s.scale;
      const [c1, c2] = boatColors(wish.boat);
      const fc = flameColor(wish.flame);
      const age = t - s.bornAt;

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

      // flame glow
      const flick = 1 + 0.14 * Math.sin(t / 170 + s.phase * 3);
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

      // rising lantern for a fresh krathong
      if (s.fresh && age < 4000) {
        const lp = age / 4000;
        const lx = s.x + Math.sin(age / 500) * 6;
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

      // name tag
      const name = wish.name.trim() || (langRef.current === 'th' ? 'ใครคนหนึ่งในกรุงเทพฯ' : 'Someone in Bangkok');
      const font = `600 ${Math.round(12 * sc + 1)}px Prompt, Sarabun, sans-serif`;
      ctx!.font = font;
      const tw = ctx!.measureText(name).width;
      const tagW = tw + 16;
      const tagH = 20;
      const tagX = s.x - tagW / 2;
      const tagY = y - 52 * sc - tagH;
      ctx!.fillStyle = 'rgba(7, 10, 31, 0.72)';
      ctx!.beginPath();
      ctx!.roundRect(tagX, tagY, tagW, tagH, 10);
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(232, 179, 75, 0.55)';
      ctx!.lineWidth = 1;
      ctx!.stroke();
      ctx!.fillStyle = '#f7f1e3';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(name, s.x, tagY + tagH / 2 + 0.5);
    }

    function draw(t: number) {
      // water
      const water = ctx!.createLinearGradient(0, 0, 0, h);
      water.addColorStop(0, '#131a44');
      water.addColorStop(0.5, '#0c1233');
      water.addColorStop(1, '#080d28');
      ctx!.fillStyle = water;
      ctx!.fillRect(0, 0, w, h);

      // moon reflection column
      const mx = w * 0.78;
      for (let i = 0; i < 26; i++) {
        const yy = h * (0.06 + (i / 26) * 0.9);
        const spread = 14 + (yy / h) * 46;
        const a = 0.05 + 0.1 * Math.abs(Math.sin(t / 900 + i * 1.7));
        ctx!.strokeStyle = `rgba(246, 211, 107, ${a.toFixed(3)})`;
        ctx!.lineWidth = 1.4;
        ctx!.beginPath();
        ctx!.moveTo(mx - spread / 2 + Math.sin(t / 1400 + i) * 6, yy);
        ctx!.lineTo(mx + spread / 2 + Math.sin(t / 1400 + i) * 6, yy);
        ctx!.stroke();
      }

      // drifting ripple lines
      ctx!.strokeStyle = 'rgba(180, 200, 255, 0.08)';
      ctx!.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const yy = h * (0.16 + i * 0.12);
        const off = (t / 60 + i * 90) % (w + 200) - 100;
        ctx!.beginPath();
        ctx!.moveTo(off, yy);
        ctx!.lineTo(off + 90, yy);
        ctx!.stroke();
      }

      // far bank silhouette
      ctx!.fillStyle = '#05071a';
      ctx!.fillRect(0, 0, w, h * 0.055);

      // krathongs, far rows first
      const list = wishesRef.current;
      const ordered = [...sprites.values()].sort((a, b) => a.row - b.row);
      for (const s of ordered) {
        const wish = list.find((x) => x.id === s.id);
        if (wish) drawKrathong(wish, s, t);
      }
    }

    function frame(t: number) {
      syncSprites();
      for (const s of sprites.values()) {
        s.x += s.speed;
        if (s.x > w + 50) {
          s.x = -50;
          s.row = Math.floor(Math.random() * ROWS);
          s.scale = rowScale(s.row);
        }
        if (performance.now() - s.bornAt > 5000) s.fresh = false;
      }
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
    // touch: tap = select
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
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} aria-label="River of krathongs" role="img" />;
}
