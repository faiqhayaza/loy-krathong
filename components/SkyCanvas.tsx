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
      // Wat Arun on the horizon: one tall stepped prang at centre,
      // two smaller prangs flanking it, and multi-tier roofs with
      // upturned eaves — a temple skyline, not a row of triangles
      // (November audit: the old spires read as pyramids/tents).
      const base = h * 0.86;
      // low gold glow behind the temple, so the silhouette reads
      // against the sky instead of as a black cut-out.
      const glow = ctx!.createRadialGradient(w * 0.5, base, 4, w * 0.5, base, w * 0.42);
      glow.addColorStop(0, 'rgba(246, 211, 107, 0.14)');
      glow.addColorStop(1, 'rgba(246, 211, 107, 0)');
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, w, h);
      ctx!.fillStyle = '#05071a';
      // the ground the temple stands on
      ctx!.fillRect(0, base + 6, w, h - base - 6);
      // a stepped prang: stacked trapezoids narrowing to a slim
      // spire with a lotus-bud knob, like Wat Arun's central prang.
      function prang(cx: number, bw: number, top: number) {
        const tiers = 5;
        const bh = base + 6 - top;
        for (let i = 0; i < tiers; i++) {
          const y0 = base + 6 - (bh * i) / tiers;
          const y1 = base + 6 - (bh * (i + 1)) / tiers;
          const w0 = bw * (1 - i * 0.14);
          const w1 = bw * (1 - (i + 1) * 0.14);
          ctx!.beginPath();
          ctx!.moveTo(cx - w0 / 2, y0);
          ctx!.lineTo(cx - w1 / 2, y1);
          ctx!.lineTo(cx + w1 / 2, y1);
          ctx!.lineTo(cx + w0 / 2, y0);
          ctx!.closePath();
          ctx!.fill();
        }
        ctx!.beginPath();
        ctx!.moveTo(cx - 3, top);
        ctx!.lineTo(cx, top - 16);
        ctx!.lineTo(cx + 3, top);
        ctx!.closePath();
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(cx, top - 18, 2.5, 0, Math.PI * 2);
        ctx!.fill();
      }
      // a two-tier roof with flicked-up eave corners
      function roof(x0: number, x1: number, yTop: number) {
        for (const [ty, th] of [[yTop, 10], [yTop + 13, 8]] as const) {
          ctx!.beginPath();
          ctx!.moveTo(x0, ty + th);
          ctx!.lineTo(x0 + 5, ty);
          ctx!.lineTo(x1 - 5, ty);
          ctx!.lineTo(x1, ty + th);
          ctx!.lineTo(x1 - 7, ty + th - 3);
          ctx!.lineTo(x0 + 7, ty + th - 3);
          ctx!.closePath();
          ctx!.fill();
        }
        // posts under the roof
        ctx!.fillRect(x0 + 6, yTop + 21, 3, base + 6 - (yTop + 21));
        ctx!.fillRect(x1 - 9, yTop + 21, 3, base + 6 - (yTop + 21));
      }
      prang(w * 0.5, w * 0.085, base - 96);
      prang(w * 0.36, w * 0.045, base - 56);
      prang(w * 0.64, w * 0.045, base - 56);
      roof(w * 0.07, w * 0.24, base - 30);
      roof(w * 0.76, w * 0.93, base - 30);
      // a few lit windows
      ctx!.fillStyle = 'rgba(246, 211, 107, 0.75)';
      for (const fx of [0.1, 0.14, 0.21, 0.79, 0.83, 0.9]) {
        ctx!.fillRect(w * fx, base - 4, 3, 4);
      }
    }

    function drawLantern(l: Lantern, t: number) {
      const s = l.scale;
      const swayX = Math.sin(t / 2400 + l.sway) * 8;
      const x = l.x + swayX;
      const y = l.y;
      const glow = ctx!.createRadialGradient(x, y, 2, x, y, 30 * s);
      glow.addColorStop(0, `hsla(${l.hue}, 90%, 65%, 0.38)`);
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
      // rim: a dark band under the paper body, so the lantern reads as
      // a paper lamp with a basket, not a soft blob; and a rib down the
      // paper, so the body has shape instead of one flat fill.
      ctx!.fillStyle = `hsl(${l.hue}, 60%, 32%)`;
      ctx!.beginPath();
      ctx!.moveTo(x - 9 * s, y + 12 * s);
      ctx!.lineTo(x + 9 * s, y + 12 * s);
      ctx!.lineTo(x + 7 * s, y + 17 * s);
      ctx!.lineTo(x - 7 * s, y + 17 * s);
      ctx!.closePath();
      ctx!.fill();
      ctx!.strokeStyle = 'rgba(0, 0, 0, 0.10)';
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(x, y - 18 * s);
      ctx!.lineTo(x, y + 11 * s);
      ctx!.stroke();
      // flame BELOW the body, with its own glow — not a pale droplet
      // inside the paper (November audit).
      const fl = ctx!.createRadialGradient(x, y + 21 * s, 1, x, y + 21 * s, 10 * s);
      fl.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
      fl.addColorStop(1, 'rgba(255, 190, 90, 0)');
      ctx!.fillStyle = fl;
      ctx!.beginPath();
      ctx!.arc(x, y + 21 * s, 10 * s, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = '#fff3c4';
      ctx!.beginPath();
      ctx!.ellipse(x, y + 21 * s, 2.6 * s, 4 * s, 0, 0, Math.PI * 2);
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
      // craters, kept faint so they read as shading, not pasted dots
      ctx!.fillStyle = 'rgba(190, 170, 120, 0.2)';
      for (const [cx, cy, cr] of [[-0.3, 0.1, 0.16], [0.25, -0.25, 0.12], [0.1, 0.35, 0.09]] as const) {
        ctx!.beginPath();
        ctx!.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, Math.PI * 2);
        ctx!.fill();
      }
      // faint grain across the disc, so the moon carries texture
      // instead of reading as one flat pale disc.
      ctx!.fillStyle = 'rgba(190, 170, 120, 0.10)';
      for (const [gx, gy, gr] of [[-0.45, -0.3, 0.05], [-0.1, -0.5, 0.04], [0.4, -0.1, 0.06], [-0.35, 0.45, 0.05], [0.15, 0.55, 0.04], [0.5, 0.35, 0.05], [0.05, -0.05, 0.07], [-0.55, 0.15, 0.04], [0.3, 0.5, 0.03], [-0.2, 0.2, 0.05], [0.55, -0.35, 0.04], [0.0, 0.3, 0.03]] as const) {
        ctx!.beginPath();
        ctx!.arc(mx + gx * mr, my + gy * mr, gr * mr, 0, Math.PI * 2);
        ctx!.fill();
      }

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

      // lanterns — after the temple, so none is ever half-hidden
      // behind the silhouette (November audit: one was clipped by it).
      for (const l of lanterns) drawLantern(l, t);

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
