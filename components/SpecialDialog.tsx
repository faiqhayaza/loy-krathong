// Shared modal shell for the specials dialogs (chunk B): a dark
// backdrop over the page with a centred card. Escape / backdrop click
// closes; the card itself stops propagation. The identity gate has its
// own full-page layout; these are overlays on the river.

'use client';

import { useEffect } from 'react';
import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/data';

interface Props {
  lang: Lang;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  testId?: string;
}

export default function SpecialDialog({ lang, title, subtitle, onClose, children, testId }: Props) {
  const s = t(lang);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dlg-backdrop" role="dialog" aria-modal="true" aria-label={title} data-testid={testId} onClick={onClose}>
      <div className="dlg-card" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-head">
          <h2>{title}</h2>
          <button type="button" className="btn small ghost" onClick={onClose} aria-label={s.close}>
            ✕
          </button>
        </div>
        {subtitle && <p className="dlg-sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
