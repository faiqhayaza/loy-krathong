// Sound toggle in the topbar: 🔊/🔇 with a label in the visitor's
// language. State lives in lib/audio (persisted in localStorage, default
// ON); the component only mirrors it. Initial state is `true` and syncs
// from storage in an effect, so the server render and the first client
// render always agree (no hydration mismatch for a previously-muted
// visitor).

'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/data';
import { t } from '@/lib/i18n';
import { audio } from '@/lib/audio';

export default function SoundToggle({ lang }: { lang: Lang }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(audio.isEnabled());
    return audio.subscribe(setOn);
  }, []);
  const s = t(lang);
  return (
    <button
      type="button"
      className="sound-toggle"
      aria-pressed={on}
      aria-label={on ? s.soundOn : s.soundOff}
      title={on ? s.soundOn : s.soundOff}
      onClick={() => audio.setEnabled(!on)}
    >
      <span aria-hidden="true">{on ? '🔊' : '🔇'}</span>
      <span className="sound-label">{on ? s.soundOn : s.soundOff}</span>
    </button>
  );
}
