// Full-page confetti for the tenth daily stamp — gold, pink and white,
// the site's own palette. A single canvas, fixed over the page, falling
// pieces with a little sway and tumble. Lightweight: ~160 pieces, no
// dependencies, removes itself after the fall. Only ever mounted when
// the tenth stamp is newly earned, never on an ordinary float.

'use client';

import { useEffect, useRef } from 'react';

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  sway: number;
  phase: number;
  round: boolean;
}

const COLORS = ['#e8b34b', '#f6d36b', '#ff7eb6', '#f2a0c0', '#fff8dc', '#ffffff'];

export default function Confetti({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone();
      return;
    }
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pieces: Piece[] = [];
    for (let i = 0; i < 160; i++) {
      pieces.push({
        x: Math.random() * w,
        // Start above the viewport in three waves, so the fall keeps coming.
        y: -20 - Math.random() * h * 0.7,
        vx: (Math.random() - 0.5) * 0.9,
        vy: 1.6 + Math.random() * 2.4,
        size: 5 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.12,
        sway: 0.6 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        round: Math.random() < 0.3,
      });
    }

    const start = performance.now();
    const DURATION_MS = 6000;
    let raf = 0;
    let done = false;

    function frame(t: number) {
      const age = t - start;
      const fade = age > DURATION_MS - 1200 ? Math.max(0, (DURATION_MS - age) / 1200) : 1;
      ctx!.clearRect(0, 0, w, h);
      for (const p of pieces) {
        p.x += p.vx + Math.sin(t / 500 + p.phase) * p.sway * 0.6;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > h + 20) continue;
        ctx!.save();
        ctx!.globalAlpha = fade;
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.fillStyle = p.color;
        if (p.round) {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx!.fill();
        } else {
          ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx!.restore();
      }
      if (age < DURATION_MS) {
        raf = requestAnimationFrame(frame);
      } else if (!done) {
        done = true;
        onDone();
      }
    }
    raf = requestAnimationFrame(frame);

    function onResize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [onDone]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 60,
      }}
    />
  );
}
