// The first-visit welcome dialog (Chunk C3).
//
// Once per Bangkok day, on first visit that day, a dialog opens: title
// is the night + tonight's destination, body is the destination's story
// (lib/destinations.ts), then a card with one gentle line
// (lib/welcome.ts — picked by date, stable all day), and a button
// "Welcome to {name}". Closing it records the day, so it shows once.
// If the visitor has not arrived at tonight's destination yet, the
// page then flies there — travel (F4a) does not exist yet, so for now
// closing simply closes; the fly-on-close is recorded as a dependency
// in VERIFICATION.md.
//
// Before the festival there is no live night: the dialog welcomes the
// visitor to the first destination (Bangkok, night 1) — the same
// default the river itself uses. Language toggle inside the dialog,
// as in the original.

'use client';

import { useState } from 'react';
import type { Lang } from '@/lib/data';
import type { Destination } from '@/lib/destinations';
import { t } from '@/lib/i18n';
import { saveWelcomeDay, welcomeLineFor } from '@/lib/welcome';
import { bangkokDay } from '@/lib/bangkok';

interface Props {
  lang: Lang;
  destination: Destination;
  onLangChange: (lang: Lang) => void;
  onClose: () => void;
}

export default function WelcomeDialog({ lang, destination, onLangChange, onClose }: Props) {
  const s = t(lang);
  const [today] = useState(() => bangkokDay());
  const line = welcomeLineFor(today, lang);

  function close() {
    saveWelcomeDay(today);
    onClose();
  }

  return (
    <div className="dlg-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="dlg">
        <div className="dlg-head">
          <h3 id="welcome-title">
            {s.welcomeNight(destination.day)} · {destination.name[lang]}
          </h3>
          <span className="lang-toggle" role="group" aria-label="Language / ภาษา">
            <button type="button" aria-pressed={lang === 'en'} onClick={() => onLangChange('en')}>
              EN
            </button>
            <button type="button" aria-pressed={lang === 'th'} onClick={() => onLangChange('th')}>
              ไทย
            </button>
          </span>
        </div>
        <p className="dlg-body">{destination.story[lang]}</p>
        <p className="dlg-gentle">{line}</p>
        <button type="button" className="btn primary" onClick={close}>
          {s.welcomeArrived(destination.name[lang])} 🪷
        </button>
      </div>
    </div>
  );
}
