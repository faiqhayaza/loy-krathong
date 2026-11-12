// Client IP for rate limits and daily limits — one copy, used by every
// API route (it used to be pasted verbatim into ~17 route files).
//
// Which header to trust, and why the old "first x-forwarded-for entry"
// was the wrong thing to reach for blindly:
//
// - Vercel overwrites `x-forwarded-for` and does not forward external
//   values ("Request headers", Vercel docs — the restriction exists to
//   prevent IP spoofing), so on Vercel directly the first entry IS the
//   real client IP. The old code happened to be safe there.
// - But if anything ever sits on top of Vercel (another proxy, a
//   preview behind a tunnel), `x-forwarded-for` CAN be overwritten by
//   that proxy, while `x-vercel-forwarded-for` cannot — Vercel sets it
//   to the same value and no upstream proxy touches it. So prefer it.
// - `x-real-ip` is identical to `x-forwarded-for` on Vercel and is the
//   last fallback for non-Vercel runs (local `next start` behind a
//   reverse proxy).
//
// Every candidate is validated as a bare IP before it is used: a
// forged header must never smuggle commas, spaces, ports or junk into
// the rate-limit keys. Anything that fails validation is skipped, and
// the function returns 'unknown' rather than trusting attacker input.

import type { NextRequest } from 'next/server';

const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function normaliseIp(raw: string): string | null {
  let ip = raw.trim();
  if (!ip) return null;
  // Bracketed IPv6 ("[2001:db8::1]" or "[::1]:443").
  if (ip.startsWith('[')) {
    const close = ip.indexOf(']');
    if (close === -1) return null;
    ip = ip.slice(1, close);
  } else if (IPV4.test(ip)) {
    return ip;
  } else if (ip.includes(':')) {
    // Bare IPv6, possibly with a zone id ("%eth0") — strip the zone.
    ip = ip.split('%')[0];
  } else {
    return null;
  }
  if (IPV4.test(ip)) return ip;
  // IPv6: only hex digits, colons and (for v4-mapped) dots.
  if (ip.includes(':') && /^[0-9a-fA-F:.]+$/.test(ip)) return ip.toLowerCase();
  return null;
}

export function clientIp(req: NextRequest): string {
  // 1. Vercel's own header — set by Vercel, untouched by any proxy
  //    sitting on top of it. Single value, no chain to parse.
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) {
    const ip = normaliseIp(vercel.split(',')[0]);
    if (ip) return ip;
  }
  // 2. x-forwarded-for — Vercel overwrites this, so the first entry is
  //    platform-set on Vercel. Elsewhere, only the first entry is the
  //    client; everything after it is a proxy hop.
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = normaliseIp(forwarded.split(',')[0]);
    if (ip) return ip;
  }
  // 3. x-real-ip — same value as x-forwarded-for on Vercel.
  const real = req.headers.get('x-real-ip');
  if (real) {
    const ip = normaliseIp(real);
    if (ip) return ip;
  }
  return 'unknown';
}
