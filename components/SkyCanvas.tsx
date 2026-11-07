// Hero night sky: deep indigo sky, twinkling stars, a large full moon with
// halo, drifting khom loi lanterns, the odd shooting star, fireflies, and a
// temple silhouette along the horizon. All drawn — no images to 404.

'use client';

import { useEffect, useRef } from 'react';

interface Star { x: number; y: number; r: number; phase: number; speed: number }
interface Lantern { x: number; y: number; speed: number; sway: number; scale: number; hue: number; top: number }
interface Firefly { x: number; y: number; phase: number; speed: number }
interface Meteor { x: number; y: number; vx: number; vy: number; life: number }

export default function SkyCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

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

    const stars: Star[] = [];
    const lanterns: Lantern[] = [];
    const fireflies: Firefly[] = [];
    let meteors: Meteor[] = [];
    let nextMeteor = 4000;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.max(1, Math.round(w * dpr));
      canvas!.height = Math.max(1, Math.round(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    // Lanterns stay out of the headline and the moon. They used to spawn
    // across the whole hero and rise through it — straight through the
    // headline text and across the moon disc. Now they rise only in two
    // safe lanes, each with its own ceiling: a clear-sky lane on the
    // right, where no copy sits, from 0.58h up (below the headline,
    // which ends around 0.55h, and far below the moon at 0.24h); and a
    // low lane on the left, deep enough that the copy's dark gradient
    // veils them to faint glows. A lantern recycles at its lane's
    // ceiling, never higher.
    function lanternLane(): { x: number; y: number; top: number } {
      if (Math.random() < 0.6) {
        return {
          x: w * (0.62 + Math.random() * 0.35),
          y: h * (0.58 + Math.random() * 0.42),
          top: h * 0.58,
        };
      }
      return {
        x: w * (0.03 + Math.random() * 0.5),
        y: h * (0.82 + Math.random() * 0.18),
        top: h * 0.82,
      };
    }
    function seedLanterns() {
      lanterns.length = 0;
      const ln = Math.max(4, Math.floor(w / 260));
      for (let i = 0; i < ln; i++) {
        const spot = lanternLane();
        lanterns.push({
          x: spot.x,
          y: spot.y,
          speed: 0.12 + Math.random() * 0.22,
          sway: Math.random() * Math.PI * 2,
          scale: 0.7 + Math.random() * 0.7,
          hue: 32 + Math.random() * 14,
          top: spot.top,
        });
      }
    }

    function seed() {
      stars.length = 0;
      const n = Math.floor((w * h) / 9000);
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h * 0.62,
          r: Math.random() * 1.3 + 0.4,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 1.2,
        });
      }
      seedLanterns();
      fireflies.length = 0;
      for (let i = 0; i < 14; i++) {
        fireflies.push({
          x: Math.random() * w,
          y: h * (0.72 + Math.random() * 0.26),
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random(),
        });
      }
    }

    function drawTemple() {
      // A low skyline: chedi spires and temple roofs along the horizon.
      const base = h * 0.86;
      ctx!.fillStyle = '#05071a';
      ctx!.beginPath();
      ctx!.moveTo(0, h);
      ctx!.lineTo(0, base + 6);
      // chedi spire
      ctx!.lineTo(w * 0.06, base + 6);
      ctx!.lineTo(w * 0.075, base - 34);
      ctx!.lineTo(w * 0.082, base - 52);
      ctx!.lineTo(w * 0.089, base - 34);
      ctx!.lineTo(w * 0.104, base + 6);
      // temple roof (multi-tier)
      ctx!.lineTo(w * 0.16, base + 6);
      ctx!.lineTo(w * 0.17, base - 12);
      ctx!.lineTo(w * 0.19, base - 12);
      ctx!.lineTo(w * 0.20, base - 26);
      ctx!.lineTo(w * 0.22, base - 26);
      ctx!.lineTo(w * 0.23, base - 12);
      ctx!.lineTo(w * 0.26, base - 12);
      ctx!.lineTo(w * 0.27, base + 6);
      // low roofs
      ctx!.lineTo(w * 0.55, base + 6);
      ctx!.lineTo(w * 0.56, base - 8);
      ctx!.lineTo(w * 0.62, base - 8);
      ctx!.lineTo(w * 0.63, base + 6);
      // second chedi
      ctx!.lineTo(w * 0.78, base + 6);
      ctx!.lineTo(w * 0.795, base - 26);
      ctx!.lineTo(w * 0.802, base - 40);
      ctx!.lineTo(w * 0.809, base - 26);
      ctx!.lineTo(w * 0.824, base + 6);
      ctx!.lineTo(w, base + 6);
      ctx!.lineTo(w, h);
      ctx!.closePath();
      ctx!.fill();
      // a few lit windows
      ctx!.fillStyle = 'rgba(246, 211, 107, 0.75)';
      for (const fx of [0.175, 0.205, 0.585, 0.605]) {
        ctx!.fillRect(w * fx, base - 4, 3, 4);
      }
    }

    function drawLantern(l: Lantern, t: number) {
      const s = l.scale;
      const swayX = Math.sin(t / 2400 + l.sway) * 8;
      const x = l.x + swayX;
      const y = l.y;
      const glow = ctx!.createRadialGradient(x, y, 2, x, y, 42 * s);
      glow.addColorStop(0, `hsla(${l.hue}, 90%, 65%, 0.5)`);
      glow.addColorStop(1, `hsla(${l.hue}, 90%, 65%, 0)`);
      ctx!.fillStyle = glow;
      ctx!.beginPath();
      ctx!.arc(x, y, 42 * s, 0, Math.PI * 2);
      ctx!.fill();
      // paper body
      ctx!.fillStyle = `hsl(${l.hue}, 88%, 62%)`;
      ctx!.beginPath();
      ctx!.moveTo(x - 11 * s, y - 8 * s);
      ctx!.quadraticCurveTo(x, y - 20 * s, x + 11 * s, y - 8 * s);
      ctx!.lineTo(x + 9 * s, y + 12 * s);
      ctx!.quadraticCurveTo(x, y + 19 * s, x - 9 * s, y + 12 * s);
      ctx!.closePath();
      ctx!.fill();
      ctx!.fillStyle = 'rgba(255,255,255,0.35)';
      ctx!.beginPath();
      ctx!.moveTo(x - 11 * s, y - 8 * s);
      ctx!.quadraticCurveTo(x, y - 20 * s, x + 11 * s, y - 8 * s);
      ctx!.lineTo(x + 11 * s, y - 2 * s);
      ctx!.lineTo(x - 11 * s, y - 2 * s);
      ctx!.closePath();
      ctx!.fill();
      // flame
      ctx!.fillStyle = '#fff3c4';
      ctx!.beginPath();
      ctx!.ellipse(x, y + 2 * s, 3.4 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx!.fill();
    }

    function draw(t: number) {
      // sky
      const sky = ctx!.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#070a1f');
      sky.addColorStop(0.45, '#12173d');
      sky.addColorStop(0.75, '#2a2358');
      sky.addColorStop(1, '#3d2b5e');
      ctx!.fillStyle = sky;
      ctx!.fillRect(0, 0, w, h);

      // stars
      for (const s of stars) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t / 1000 * s.speed + s.phase));
        ctx!.fillStyle = `rgba(255, 244, 214, ${a.toFixed(3)})`;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      // moon + halo
      const mx = w * 0.78;
      const my = h * 0.24;
      const mr = Math.min(w, h) * 0.085;
      const halo = ctx!.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.2);
      halo.addColorStop(0, 'rgba(255, 240, 200, 0.35)');
      halo.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx!.fillStyle = halo;
      ctx!.beginPath();
      ctx!.arc(mx, my, mr * 3.2, 0, Math.PI * 2);
      ctx!.fill();
      const moon = ctx!.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.2, mx, my, mr);
      moon.addColorStop(0, '#fffbe8');
      moon.addColorStop(1, '#f2dfa0');
      ctx!.fillStyle = moon;
      ctx!.beginPath();
      ctx!.arc(mx, my, mr, 0, Math.PI * 2);
      ctx!.fill();
      // craters
      ctx!.fillStyle = 'rgba(190, 170, 120, 0.35)';
      for (const [cx, cy, cr] of [[-0.3, 0.1, 0.16], [0.25, -0.25, 0.12], [0.1, 0.35, 0.09]] as const) {
        ctx!.beginPath();
        ctx!.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, Math.PI * 2);
        ctx!.fill();
      }

      // lanterns
      for (const l of lanterns) drawLantern(l, t);

      // meteors
      for (const m of meteors) {
        const grad = ctx!.createLinearGradient(m.x, m.y, m.x - m.vx * 12, m.y - m.vy * 12);
        grad.addColorStop(0, `rgba(255,255,255,${(m.life / 60).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.6;
        ctx!.beginPath();
        ctx!.moveTo(m.x, m.y);
        ctx!.lineTo(m.x - m.vx * 12, m.y - m.vy * 12);
        ctx!.stroke();
      }

      // fireflies
      for (const f of fireflies) {
        const a = 0.25 + 0.75 * Math.abs(Math.sin(t / 900 * f.speed + f.phase));
        const fx = f.x + Math.sin(t / 1600 + f.phase) * 14;
        const fy = f.y + Math.cos(t / 1300 + f.phase) * 6;
        ctx!.fillStyle = `rgba(190, 255, 170, ${a.toFixed(3)})`;
        ctx!.beginPath();
        ctx!.arc(fx, fy, 1.8, 0, Math.PI * 2);
        ctx!.fill();
      }

      drawTemple();

      // water shimmer at the very bottom
      const water = ctx!.createLinearGradient(0, h * 0.9, 0, h);
      water.addColorStop(0, 'rgba(10, 16, 48, 0)');
      water.addColorStop(1, 'rgba(10, 16, 48, 0.9)');
      ctx!.fillStyle = water;
      ctx!.fillRect(0, h * 0.9, w, h * 0.1);
      ctx!.strokeStyle = 'rgba(246, 211, 107, 0.25)';
      ctx!.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const yy = h * (0.92 + i * 0.016);
        const off = Math.sin(t / 1800 + i * 2) * 12;
        ctx!.beginPath();
        ctx!.moveTo(w * 0.7 + off, yy);
        ctx!.lineTo(w * 0.86 + off, yy);
        ctx!.stroke();
      }
    }

    function frame(t: number) {
      // drift lanterns upward, recycle at their lane's ceiling
      for (const l of lanterns) {
        l.y -= l.speed;
        if (l.y < l.top) {
          const spot = lanternLane();
          l.y = spot.y;
          l.x = spot.x;
          l.top = spot.top;
        }
      }
      // meteors
      nextMeteor -= 16;
      if (nextMeteor <= 0) {
        nextMeteor = 6000 + Math.random() * 9000;
        meteors.push({ x: w * (0.15 + Math.random() * 0.6), y: h * Math.random() * 0.2, vx: 7, vy: 3.2, life: 60 });
      }
      meteors = meteors.filter((m) => {
        m.x += m.vx;
        m.y += m.vy;
        m.life -= 1;
        return m.life > 0;
      });
      draw(t);
      raf = requestAnimationFrame(frame);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    if (reduced) {
      draw(1200);
    } else {
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" />;
}
