// The secret riddle dialog (Chunk C1).
//
// Flow: hint first, then the riddle with three options in the
// destination's display order (SECRET_ORDER — the right answer is
// option 0 in the data, but never in the same place on screen). A
// correct answer reveals the secret's story fragment and the +5 River
// Light claim to tonight (lib/secrets.ts); a wrong answer just says
// try again — retry is always allowed. A secret already found reopens
// straight to its story, and a repeat correct answer claims nothing.
//
// The dialog never opens for a night that is not open yet — the caller
// checks `isOpenDay` first and shows the locked state in the secrets
// list instead.

'use client';

import { useState } from 'react';
import type { Lang } from '@/lib/data';
import type { Destination } from '@/lib/destinations';
import { t } from '@/lib/i18n';
import { answerSecret, isSecretFound, secretDisplayOptions } from '@/lib/secrets';

interface Props {
  lang: Lang;
  destination: Destination;
  onClose: () => void;
  /** The parent refreshes its found/claims state after a find. */
  onFound: () => void;
}

export default function SecretDialog({ lang, destination, onClose, onFound }: Props) {
  const s = t(lang);
  const alreadyFound = isSecretFound(destination.id);
  const [phase, setPhase] = useState<'hint' | 'riddle' | 'right' | 'wrong'>(
    alreadyFound ? 'right' : 'hint',
  );
  // What this find earned: the +5 claim while a night is live, nothing
  // when the nights are over (archive), and nothing on a repeat visit.
  // A secret found on an earlier visit shows the "already found" note.
  const [claimed, setClaimed] = useState(false);
  const [repeat, setRepeat] = useState(alreadyFound);
  const options = secretDisplayOptions(destination.id);
  const secret = destination.secret;

  function choose(optionIndex: number) {
    const result = answerSecret(destination.id, optionIndex);
    if (result.outcome === 'correct') {
      setClaimed(result.claimed);
      setRepeat(result.alreadyFound);
      setPhase('right');
      if (!result.alreadyFound) onFound();
    } else {
      setPhase('wrong');
    }
  }

  return (
    <div className="dlg-overlay" role="dialog" aria-modal="true" aria-labelledby="secret-title">
      <div className="dlg">
        <div className="dlg-head">
          <h3 id="secret-title">
            <span aria-hidden="true">{secret.symbol} </span>
            {secret.name[lang]}
          </h3>
          <button type="button" className="btn small ghost" onClick={onClose}>
            {s.close}
          </button>
        </div>
        <p className="dlg-sub">
          {destination.name[lang]} · {s.welcomeNight(destination.day)}
        </p>

        {phase === 'hint' && (
          <>
            <p className="dlg-label">{s.secretHintLabel}</p>
            <p className="dlg-body">{secret.hint[lang]}</p>
            <button type="button" className="btn primary" onClick={() => setPhase('riddle')}>
              {s.secretRiddleTitle}
            </button>
          </>
        )}

        {(phase === 'riddle' || phase === 'wrong') && (
          <>
            <p className="dlg-label">{s.secretRiddleTitle}</p>
            <p className="dlg-body">{secret.riddle[lang]}</p>
            {phase === 'wrong' && (
              <p className="dlg-note" role="alert">
                {s.secretTryAgain}
              </p>
            )}
            <div className="dlg-options">
              {options.map((opt) => (
                <button
                  key={opt.index}
                  type="button"
                  className="btn ghost dlg-option"
                  onClick={() => choose(opt.index)}
                >
                  {opt[lang]}
                </button>
              ))}
            </div>
            <button type="button" className="btn small ghost" onClick={() => setPhase('hint')}>
              {s.secretHintLabel}
            </button>
          </>
        )}

        {phase === 'right' && (
          <>
            <p className="dlg-good" role="status">
              {s.secretRight}
            </p>
            <p className="dlg-label">{s.secretStoryTitle}</p>
            <p className="dlg-body">{secret.story[lang]}</p>
            {claimed ? (
              <p className="dlg-note">{s.secretReward}</p>
            ) : repeat ? (
              <p className="dlg-note">{s.secretAlreadyFound}</p>
            ) : (
              <p className="dlg-note">{s.secretNoClaim}</p>
            )}
            <button type="button" className="btn primary" onClick={onClose}>
              {s.close}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
