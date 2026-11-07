// Ambient audio for the river: a calming kalimba loop, plus a firework
// boom on each burst during the shows.
//
// The music is a real recording, shipped locally:
//   public/audio/kalimba-thai-cover.mp3 — a Thai kalimba cover by "nid",
//   supplied by Faiq (original: workspace/user/files/
//   kalimba-cover-by-nid-ndtdf-1.mp3, 99 s, 48 kHz stereo). Measured
//   before shipping (Faiq's numbers, confirmed): continuous playing for
//   the whole 99 s (no silent gaps), first 1 s mean −15.6 dB / max
//   −7.5 dB with the first 0.56 s silent below −50 dB (silence 0 → 0.564 s),
//   last 1 s mean −17.6 dB / max −4.8 dB — the music is still playing loud
//   at the very end, a hard cut, no fade-out in the last 3 s. A plain
//   loop=true on the raw file would click every 99 s (hard cut, then
//   0.56 s of silence, then restart), so the shipped file is NOT the raw
//   recording — it is a seamless loop baked with ffmpeg (see
//   VERIFICATION.md, "Kalimba swap — Thai cover, seamless loop"):
//   leading silence trimmed (0.564 s), level matched to the previous
//   track (−11.08 dB, now RMS −23.5 dB / −21.0 LUFS, same as before),
//   and the last 2.5 s of the tail crossfaded over the head with
//   acrossfade (equal-power qsin), so the file loops with a plain
//   loop=true and no audible seam. The previous track
//   (public/audio/kalimba-calm.mp3 — "Kalimba Atmosphere" by soramoosic,
//   CC0 via Freesound) is still in the tree for now.
// The firework sound is also CC0 via Freesound:
//   public/audio/firework.mp3 — "fireworks exploding 1" by soundmary,
//   one 5.5 s explosion (loud at once, then crackle decay), which maps
//   one-to-one onto a burst.
//
// Browser autoplay policy: no sound may start before the visitor
// interacts, so the music starts on the first pointerdown/keydown
// anywhere on the page and fades in. The toggle (topbar) mutes
// everything and the preference persists in localStorage (default ON).
// The music pauses while the tab is hidden and resumes when visible.

const SOUND_KEY = 'loy:sound';
const MUSIC_URL = '/audio/kalimba-thai-cover.mp3';
const FIREWORK_URL = '/audio/firework.mp3';
const MUSIC_VOLUME = 0.25;
const FIREWORK_VOLUME = 0.4;
const FIREWORK_MIN_GAP_MS = 800;
const FIREWORK_POOL = 3;

type Listener = (enabled: boolean) => void;

class AudioManager {
  private music: HTMLAudioElement | null = null;
  private fireworks: HTMLAudioElement[] = [];
  private fwIdx = 0;
  private lastFwAt = 0;
  private started = false;
  private fadeTimer: number | null = null;
  private listeners = new Set<Listener>();
  private visibilityBound = false;

  isEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch {
      return true;
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    const on = this.isEnabled();
    for (const fn of this.listeners) fn(on);
  }

  private getMusic(): HTMLAudioElement {
    if (!this.music) {
      const a = new Audio(MUSIC_URL);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      // Appended (hidden) so the element is queryable in devtools and
      // in automated checks; audio plays the same either way.
      a.style.display = 'none';
      document.body.appendChild(a);
      this.music = a;
    }
    return this.music;
  }

  private getFirework(): HTMLAudioElement {
    if (this.fireworks.length < FIREWORK_POOL) {
      const a = new Audio(FIREWORK_URL);
      a.preload = 'auto';
      a.volume = FIREWORK_VOLUME;
      a.style.display = 'none';
      document.body.appendChild(a);
      this.fireworks.push(a);
    }
    const el = this.fireworks[this.fwIdx % this.fireworks.length];
    this.fwIdx += 1;
    return el;
  }

  // Start the music. Safe to call repeatedly; only the first call that
  // follows a user gesture does anything (browsers reject play() before
  // one, and the rejection resets `started` so a later gesture retries).
  ensureStarted() {
    if (typeof window === 'undefined' || this.started || !this.isEnabled()) return;
    this.started = true;
    const a = this.getMusic();
    a.volume = 0;
    const p = a.play();
    if (p) {
      p.then(() => this.fadeIn()).catch(() => {
        this.started = false;
      });
    }
  }

  private fadeIn() {
    if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
    const a = this.music;
    if (!a) return;
    const step = MUSIC_VOLUME / 20;
    this.fadeTimer = window.setInterval(() => {
      if (!this.music || !this.isEnabled()) {
        this.stopFade();
        return;
      }
      if (document.hidden) return; // resume the ramp when visible again
      a.volume = Math.min(MUSIC_VOLUME, a.volume + step);
      if (a.volume >= MUSIC_VOLUME) this.stopFade();
    }, 100);
  }

  private stopFade() {
    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  setEnabled(on: boolean) {
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {
      // preference just doesn't persist for this visit
    }
    if (on) {
      // The toggle click is itself a gesture, so starting here is allowed.
      this.ensureStarted();
      if (this.music && this.music.paused && this.started && !document.hidden) {
        this.music.play().catch(() => {});
      }
    } else {
      this.stopFade();
      if (this.music) this.music.pause();
    }
    this.emit();
  }

  // One boom per firework burst. Throttled to ~1 per 0.8 s so the
  // preview show (rockets every ~0.5–0.8 s) doesn't stack booms, and
  // gated on the sound preference. The pool round-robins so a new boom
  // never cuts off the tail of the previous one.
  playFirework() {
    if (typeof window === 'undefined' || !this.isEnabled()) return;
    const now = performance.now();
    if (now - this.lastFwAt < FIREWORK_MIN_GAP_MS) return;
    this.lastFwAt = now;
    const el = this.getFirework();
    try {
      el.currentTime = 0;
    } catch {
      // element not ready yet — play from wherever it is
    }
    el.play().catch(() => {});
  }

  // Pause the music while the tab is hidden, resume when visible (only
  // if sound is on and the music had started).
  bindVisibility() {
    if (typeof window === 'undefined' || this.visibilityBound) return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.music || !this.started) return;
      if (document.hidden) {
        this.music.pause();
      } else if (this.isEnabled()) {
        this.music.play().catch(() => {});
      }
    });
  }
}

export const audio = new AudioManager();
