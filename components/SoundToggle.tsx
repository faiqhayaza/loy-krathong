// Sound toggle in the topbar: 🔊/🔇 with a label in the visitor's
// language. State lives in lib/audio (persisted in localStorage, default
// ON); the component only mirrors it. The mirrored state is the HONEST
// one — sound is "on" only while the music is actually playing, so
// after a reload it reads "off" until the first gesture starts the
// kalimba, and it never flips by itself. The initial state is the same
// on the server and the first client render (no music has started on
// either), so there is no hydration mismatch.

'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/data';
import { t } from '@/lib/i18n';
import { audio } from '@/lib/audio';

export default function SoundToggle({ lang }: { lang: Lang }) {
  const [on, setOn] = useState(() => audio.isEffectivelyOn());
  useEffect(() => {
    setOn(audio.isEffectivelyOn());
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
