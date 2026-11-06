// "Float my krathong": the builder panel. Live SVG preview, nickname, wish,
// a worry that never leaves the device, and flower / boat / flame pickers.
// The POST body contains name, wish, flower, boat, flame and lang only —
// the worry is deliberately never included.

'use client';

import { useState } from 'react';
import type { Lang, Wish } from '@/lib/data';
import {
  BOATS,
  DEFAULT_BOAT,
  DEFAULT_FLAME,
  DEFAULT_FLOWER,
  FLAMES,
  FLOWERS,
  MAX_NAME_CHARS,
  MAX_WISH_CHARS,
  MAX_WORRY_CHARS,
  containsBlocked,
} from '@/lib/data';
import { t } from '@/lib/i18n';
import KrathongSvg from './KrathongSvg';
import { downloadKeepsake } from './Keepsake';

interface Props {
  lang: Lang;
  onFloated: (wish: Wish) => void;
}

export default function Builder({ lang, onFloated }: Props) {
  const s = t(lang);
  const [name, setName] = useState('');
  const [wish, setWish] = useState('');
  const [worry, setWorry] = useState('');
  const [flower, setFlower] = useState(DEFAULT_FLOWER);
  const [boat, setBoat] = useState(DEFAULT_BOAT);
  const [flame, setFlame] = useState(DEFAULT_FLAME);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [floated, setFloated] = useState<Wish | null>(null);
  const [hadWorry, setHadWorry] = useState(false);
  const [keepsakeDone, setKeepsakeDone] = useState(false);

  const blocked = containsBlocked(wish) || containsBlocked(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const text = wish.trim();
    if (!text) {
      setError(s.errorNeedWish);
      return;
    }
    if (blocked) {
      setError(s.errorRejected);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // NOTE: no `worry` field here, ever. It lives only in this browser.
        body: JSON.stringify({ name: name.trim(), wish: text, flower, boat, flame, lang }),
      });
      const data = (await res.json().catch(() => ({}))) as { wish?: Wish; error?: string };
      if (!res.ok) {
        if (res.status === 429) setError(s.errorRateLimited);
        else if (data.error === 'blocked_content') setError(s.errorRejected);
        else setError(s.errorGeneric);
        return;
      }
      if (!data.wish) {
        setError(s.errorGeneric);
        return;
      }
      setHadWorry(worry.trim().length > 0);
      setFloated(data.wish);
      setKeepsakeDone(false);
      // The worry is discarded the moment the krathong floats.
      setWorry('');
      try {
        localStorage.setItem('loy:floated-day', new Date().toISOString().slice(0, 10));
        localStorage.setItem('loy:my-wish', data.wish.id);
      } catch {
        // private mode: the river still works without it
      }
      onFloated(data.wish);
    } catch {
      setError(s.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  function floatAnother() {
    setFloated(null);
    setWish('');
    setName('');
  }

  if (floated) {
    return (
      <div className="builder" aria-live="polite">
        <h2>{s.floatedTitle}</h2>
        <div className="preview">
          <KrathongSvg boat={floated.boat} flower={floated.flower} flame={floated.flame} name={floated.name} />
          <span className="preview-tag">{floated.name || s.anonymous}</span>
        </div>
        <div className="success">
          <strong>“{floated.wish}”</strong>
          <p>{hadWorry ? s.blessingLine : s.blessingLineNoWorry}</p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            downloadKeepsake(floated, lang);
            setKeepsakeDone(true);
          }}
        >
          {s.keepsake}
        </button>
        {keepsakeDone && <p className="hint" role="status">{s.keepsakeSaved}</p>}
        <button type="button" className="btn ghost" onClick={floatAnother}>
          {lang === 'th' ? 'ลอยกระทงอีกใบ' : 'Float another krathong'}
        </button>
      </div>
    );
  }

  return (
    <form className="builder" onSubmit={submit} noValidate>
      <div>
        <h2>{s.builderTitle}</h2>
        <p className="hint">{s.builderIntro}</p>
      </div>

      <div className="preview" aria-hidden="true">
        <KrathongSvg boat={boat} flower={flower} flame={flame} name={name} />
        <span className="preview-tag">{name.trim() || s.anonymous}</span>
      </div>

      <div className="field">
        <label htmlFor="bk-name">{s.nameLabel}</label>
        <input
          id="bk-name"
          type="text"
          value={name}
          maxLength={MAX_NAME_CHARS}
          placeholder={s.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="bk-wish">{s.wishLabel}</label>
        <textarea
          id="bk-wish"
          value={wish}
          maxLength={MAX_WISH_CHARS}
          placeholder={s.wishPlaceholder}
          onChange={(e) => setWish(e.target.value)}
          aria-invalid={wish.trim().length === 0 && error === s.errorNeedWish}
          aria-describedby="bk-wish-hint bk-wish-count"
        />
        <span className="hint" id="bk-wish-hint">{s.wishHint}</span>
        <span className="count" id="bk-wish-count">
          {wish.length}/{MAX_WISH_CHARS}
        </span>
      </div>

      <div className="field">
        <label htmlFor="bk-worry">{s.worryLabel}</label>
        <textarea
          id="bk-worry"
          value={worry}
          maxLength={MAX_WORRY_CHARS}
          placeholder={s.worryPlaceholder}
          onChange={(e) => setWorry(e.target.value)}
          aria-describedby="bk-worry-hint"
        />
        <span className="hint" id="bk-worry-hint">{s.worryHint}</span>
      </div>

      <div>
        <p className="picker-label" id="flower-label">{s.flowerLabel}</p>
        <div className="tiles" role="group" aria-labelledby="flower-label">
          {FLOWERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="tile"
              aria-pressed={flower === f.id}
              aria-label={f.label[lang]}
              onClick={() => setFlower(f.id)}
            >
              <span className="glyph" aria-hidden="true">{f.glyph}</span>
              <span className="tlabel">{f.label[lang]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="picker-label" id="boat-label">{s.boatLabel}</p>
        <div className="swatches" role="group" aria-labelledby="boat-label">
          {BOATS.map((b) => (
            <button
              key={b.id}
              type="button"
              className="swatch-btn"
              aria-pressed={boat === b.id}
              aria-label={b.label[lang]}
              title={b.label[lang]}
              onClick={() => setBoat(b.id)}
            >
              <span
                className="sw"
                style={{ background: `linear-gradient(180deg, ${b.colors[0]}, ${b.colors[1]})` }}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="picker-label" id="flame-label">{s.flameLabel}</p>
        <div className="swatches" role="group" aria-labelledby="flame-label">
          {FLAMES.map((f) => (
            <button
              key={f.id}
              type="button"
              className="flame-btn"
              aria-pressed={flame === f.id}
              aria-label={f.label[lang]}
              title={f.label[lang]}
              style={{ background: f.color }}
              onClick={() => setFlame(f.id)}
            >
              <span aria-hidden="true">🕯️</span>
            </button>
          ))}
        </div>
      </div>

      {blocked && <p className="err" role="alert">{s.badWordWarning}</p>}
      {error && <p className="err" role="alert">{error}</p>}

      <button type="submit" className="btn primary" disabled={submitting || blocked}>
        {submitting ? s.submitting : `${s.submit} 🪷`}
      </button>
    </form>
  );
}
