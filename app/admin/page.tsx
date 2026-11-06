// Admin export page — deliberately plain and unlinked from the main site.
// Type the password, pick a format, and download everything visitors
// floated. The password lives only in this page's memory: it is never
// stored, never put in a URL, and never sent anywhere except the export
// request itself, as a header.

'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function exportWishes() {
    if (!token.trim()) {
      setStatus('Paste the admin token first.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const res = await fetch(`/api/admin/export?format=${format}`, {
        headers: { 'x-admin-token': token.trim() },
      });
      if (res.status === 401) {
        setStatus('Wrong password — try again.');
        return;
      }
      if (res.status === 404) {
        setStatus('Export is not set up on this deployment (no password configured).');
        return;
      }
      if (!res.ok) {
        setStatus(`Export failed (${res.status}). Try again.`);
        return;
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loy-krathong-wishes-${stamp}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Downloaded. The file holds every wish visitors floated — never any worries.');
    } catch {
      setStatus('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0b1026',
        color: '#f7f1e3',
        fontFamily: 'var(--font-body), sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 28, margin: '0 0 8px' }}>
          River export
        </h1>
        <p style={{ color: '#b9c0e8', lineHeight: 1.6, margin: '0 0 24px' }}>
          Download everything visitors floated on the river — names, wishes, krathong
          choices and reactions — as a spreadsheet (CSV) or JSON. The eight opening
          wishes are not included, and nobody&rsquo;s worry is ever in the file: worries
          are never sent or stored.
        </p>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }} htmlFor="admin-token">
          Password
        </label>
        <input
          id="admin-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="The admin password"
          autoComplete="off"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #3a4370',
            background: '#141a3d',
            color: '#f7f1e3',
            fontSize: 15,
            marginBottom: 16,
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['csv', 'json'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: '1px solid #3a4370',
                background: format === f ? '#e8b34b' : '#141a3d',
                color: format === f ? '#1a1206' : '#f7f1e3',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              {f === 'csv' ? 'CSV (spreadsheet)' : 'JSON'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportWishes}
          disabled={busy}
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 8,
            border: 'none',
            background: busy ? '#8a6d2b' : '#e8b34b',
            color: '#1a1206',
            fontWeight: 700,
            fontSize: 16,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Exporting…' : 'Download export'}
        </button>
        {status && <p style={{ marginTop: 16, lineHeight: 1.5 }}>{status}</p>}
        <p style={{ color: '#7d86b8', fontSize: 13, lineHeight: 1.6, marginTop: 24 }}>
          The password is the LOY_ADMIN_TOKEN environment variable on the Vercel
          project. It is only used for this download and is not saved anywhere on
          this page.
        </p>
      </div>
    </main>
  );
}
