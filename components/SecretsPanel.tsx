// The secrets list (Chunk C1): all seven secrets with their found
// state. A "Go" button flies the visitor to the secret — today that
// means scrolling to the river and opening the riddle for the night
// that is open; a night that has not opened yet shows when it opens
// instead. The seven fragments together tell one story; the last
// (Roi Et) gathers them.

'use client';

import type { Lang } from '@/lib/data';
import { DESTINATIONS } from '@/lib/destinations';
import type { FestivalCalendar } from '@/lib/festival';
import { isOpenDay } from '@/lib/festival';
import { t } from '@/lib/i18n';
import { loadSecrets } from '@/lib/secrets';

interface Props {
  lang: Lang;
  cal: FestivalCalendar;
  onOpen: (slug: string) => void;
}

export default function SecretsPanel({ lang, cal, onOpen }: Props) {
  const s = t(lang);
  const found = loadSecrets();
  return (
    <div className="secrets-list">
      <p className="hint" role="status">
        {s.secretsFoundCount(found.length)}
      </p>
      {DESTINATIONS.map((d, i) => {
        const isFound = found.includes(d.id);
        const open = isOpenDay(cal, d.day);
        return (
          <div key={d.id} className={`secret-row${isFound ? ' found' : ''}`} style={{ '--i': i } as React.CSSProperties}>
            <span className="secret-symbol" aria-hidden="true">
              {d.secret.symbol}
            </span>
            <span className="secret-info">
              <strong>{d.secret.name[lang]}</strong>
              <span className="secret-dest">
                {d.name[lang]} · {s.welcomeNight(d.day)}
              </span>
              <span className="secret-state">
                {isFound ? `✓ ${s.secretFound}` : open ? s.secretUnknown : s.secretLocked(d.day)}
              </span>
            </span>
            <button
              type="button"
              className="btn small ghost"
              disabled={!open}
              onClick={() => onOpen(d.id)}
            >
              {s.secretGo}
            </button>
          </div>
        );
      })}
    </div>
  );
}
