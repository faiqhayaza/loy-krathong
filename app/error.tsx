// Error boundary for the whole app — the audit found there was none,
// so a render crash anywhere showed Next's default error page with no
// way back. This keeps the visitor on the site with a retry.
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No error-reporting service on this site; the console is the log.
    console.error('[loy] page error:', error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        background: '#0b1026',
        color: '#fdf6e3',
      }}
    >
      <h1 style={{ fontSize: '1.5rem' }}>The river stumbled</h1>
      <p style={{ opacity: 0.85 }}>
        Something went wrong loading this page. Your wishes are safe —
        try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          padding: '0.6rem 1.4rem',
          borderRadius: '999px',
          border: 'none',
          background: '#f5b942',
          color: '#231a05',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </main>
  );
}
