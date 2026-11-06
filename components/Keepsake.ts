// Keepsake card: a 1080×1350 PNG drawn on a client canvas — night gradient,
// moon, the krathong in its own colours, the wish wrapped, the name, and the
// date. No server call, no images to load.

import type { Wish } from '@/lib/data';
import { boatColors, flameColor, flowerGlyph } from '@/lib/data';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function downloadKeepsake(wish: Wish, lang: 'en' | 'th') {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // night sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#070a1f');
  sky.addColorStop(0.55, '#1a2048');
  sky.addColorStop(1, '#0a1030');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // stars (seeded, so the card looks the same every time)
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255, 244, 214, ${0.3 + rand() * 0.7})`;
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H * 0.55, 0.8 + rand() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // moon + halo
  const mx = 800;
  const my = 210;
  const halo = ctx.createRadialGradient(mx, my, 20, mx, my, 260);
  halo.addColorStop(0, 'rgba(255, 240, 200, 0.4)');
  halo.addColorStop(1, 'rgba(255, 240, 200, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(mx, my, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fdf6d8';
  ctx.beginPath();
  ctx.arc(mx, my, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(190, 170, 120, 0.35)';
  for (const [cx, cy, cr] of [[-28, 10, 15], [24, -24, 11], [10, 34, 8]] as const) {
    ctx.beginPath();
    ctx.arc(mx + cx, my + cy, cr, 0, Math.PI * 2);
    ctx.fill();
  }

  // gold frame
  ctx.strokeStyle = 'rgba(232, 179, 75, 0.65)';
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = 'rgba(232, 179, 75, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  // headings
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f6d36b';
  ctx.font = '600 44px Prompt, Sarabun, sans-serif';
  ctx.fillText('Seven Nights of Wishes', W / 2, 120);
  ctx.fillStyle = '#f2a0c0';
  ctx.font = '400 34px Prompt, Sarabun, sans-serif';
  ctx.fillText('เจ็ดค่ำคืนแห่งคำอธิษฐาน', W / 2, 168);

  // water band
  const water = ctx.createLinearGradient(0, 900, 0, H);
  water.addColorStop(0, '#131a44');
  water.addColorStop(1, '#080d28');
  ctx.fillStyle = water;
  ctx.fillRect(48, 900, W - 96, H - 948);

  // krathong, drawn large
  const cx = W / 2;
  const cy = 1010;
  const sc = 3.4;
  const [c1, c2] = boatColors(wish.boat);
  const fc = flameColor(wish.flame);
  const glow = ctx.createRadialGradient(cx, cy - 26 * sc, 4, cx, cy - 26 * sc, 90);
  glow.addColorStop(0, fc);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy - 26 * sc, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f3e6c8';
  ctx.fillRect(cx - 8, cy - 16 * sc, 16, 30);
  ctx.fillStyle = fc;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 22 * sc, 12, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff8dc';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 18 * sc, 5, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${Math.round(20 * sc)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(flowerGlyph(wish.flower), cx, cy - 4 * sc);
  ctx.fillStyle = c1;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6 * sc, 30 * sc, 9 * sc, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8 * sc, 30 * sc, 7 * sc, 0, 0, Math.PI);
  ctx.fill();

  // wish text, wrapped
  ctx.fillStyle = '#f7f1e3';
  ctx.font = '500 46px Sarabun, Prompt, sans-serif';
  const lines = wrapText(ctx, `“${wish.wish}”`, W - 240);
  const startY = 470;
  lines.slice(0, 6).forEach((line, i) => {
    ctx.fillText(line, W / 2, startY + i * 62);
  });

  // name + date
  const name = wish.name.trim() || (lang === 'th' ? 'ใครคนหนึ่งในกรุงเทพฯ' : 'Someone in Bangkok');
  ctx.fillStyle = '#f6d36b';
  ctx.font = '600 36px Prompt, Sarabun, sans-serif';
  ctx.fillText(`— ${name}`, W / 2, 1180);
  ctx.fillStyle = '#b6b0d4';
  ctx.font = '400 28px Sarabun, Prompt, sans-serif';
  ctx.fillText('Loy Krathong · 24 November 2026 · Bangkok', W / 2, 1236);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-krathong-card.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
