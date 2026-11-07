// Admin page — export (as before) plus the organiser tools from Chunk E:
// festival settings (E2/E3/E4), the moderation queue, the audit log,
// backup and reset-all (E5). Deliberately plain and unlinked from the
// main site. The password lives only in this page's memory: it is never
// stored, never put in a URL, and never sent anywhere except the admin
// requests themselves, as a header (`x-admin-token` — the rebuild's
// approach; the HTML's localStorage `X-Admin-Key` is not restored, Q8).
//
// Kiosk note (E4/Q6): the shared-screen toggle is recorded only. It
// does NOT lift the once-per-day float limit — the hard rule stands,
// and the toggle says so on the page.

'use client';

import { useState } from 'react';

type Summary = {
  counts: {
    wishes: number;
    people: number;
    reactions: number;
    blessings: number;
    candles: number;
    thanks: number;
    stamps: number;
    secrets: number;
  };
  queue: { id: string; name: string; wish: string; status: string; reports?: number; createdAt: number }[];
  audit: { at: number; action: string; detail: string }[];
  config: {
    startDay: string;
    mode: string;
    targets: number[];
    paused: boolean;
    simDay: string | null;
    celebrateUntil: number | null;
    kiosk: boolean;
  };
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #3a4370',
  background: '#141a3d',
  color: '#f7f1e3',
  fontSize: 15,
  marginBottom: 12,
};

const btnStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#e8b34b',
  color: '#1a1206',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  ...btnStyle,
  background: '#141a3d',
  color: '#f7f1e3',
  border: '1px solid #3a4370',
};

const sectionStyle: React.CSSProperties = {
  borderTop: '1px solid #2a3263',
  marginTop: 32,
  paddingTop: 24,
};

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [configMsg, setConfigMsg] = useState('');
  const [resetInput, setResetInput] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  // Config form state, seeded from the loaded summary.
  const [startDay, setStartDay] = useState('');
  const [mode, setMode] = useState('none');
  const [targets, setTargets] = useState<number[]>([2000, 2000, 2300, 2300, 2300, 2700, 3300]);
  const [simDay, setSimDay] = useState('');
  const [paused, setPaused] = useState(false);
  const [kiosk, setKiosk] = useState(false);

  function headers(): Record<string, string> {
    return { 'x-admin-token': token.trim() };
  }

  async function loadSummary() {
    if (!token.trim()) {
      setSummaryError('Paste the admin token first.');
      return;
    }
    setSummaryError('');
    try {
      const res = await fetch('/api/admin/summary', { headers: headers() });
      if (res.status === 401) {
        setSummaryError('Wrong password — try again.');
        setSummary(null);
        return;
      }
      if (res.status === 404) {
        setSummaryError('Admin is not set up on this deployment (no password configured).');
        return;
      }
      if (!res.ok) {
        setSummaryError(`Could not load the dashboard (${res.status}).`);
        return;
      }
      const data = (await res.json()) as Summary;
      setSummary(data);
      setStartDay(data.config.startDay);
      setMode(data.config.mode);
      setTargets(data.config.targets);
      setSimDay(data.config.simDay ?? '');
      setPaused(data.config.paused);
      setKiosk(data.config.kiosk);
    } catch {
      setSummaryError('Could not reach the server. Check your connection and try again.');
    }
  }

  async function saveConfig(patch: Record<string, unknown>) {
    setConfigMsg('');
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.status === 401) {
        setConfigMsg('Wrong password — reload the dashboard.');
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string; rejected?: string[] };
        setConfigMsg(data.message ?? `Save failed (${res.status}).`);
        return;
      }
      const data = (await res.json()) as { config: Summary['config']; rejected?: string[] };
      setConfigMsg(
        data.rejected?.length
          ? `Saved, except rejected fields: ${data.rejected.join(', ')}.`
          : 'Saved. Visitors see it on their next update.',
      );
      setSummary((s) => (s ? { ...s, config: data.config } : s));
    } catch {
      setConfigMsg('Could not reach the server.');
    }
  }

  async function moderate(id: string, action: 'approve' | 'hide') {
    try {
      const res = await fetch('/api/admin/wish', {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        setSummaryError(`Moderation failed (${res.status}).`);
        return;
      }
      await loadSummary();
    } catch {
      setSummaryError('Could not reach the server.');
    }
  }

  async function downloadBackup() {
    try {
      const res = await fetch('/api/admin/backup', { headers: headers() });
      if (!res.ok) {
        setSummaryError(`Backup failed (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loy-krathong-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setSummaryError('Could not reach the server.');
    }
  }

  async function resetAll() {
    if (resetInput.trim() !== 'RESET') {
      setResetMsg('Type RESET exactly to confirm.');
      return;
    }
    setResetMsg('');
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET' }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setResetMsg(data.message ?? `Reset failed (${res.status}).`);
        return;
      }
      setResetMsg('Everything deleted. The river is blank.');
      setResetInput('');
      await loadSummary();
    } catch {
      setResetMsg('Could not reach the server.');
    }
  }

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

  const celebrating =
    summary?.config.celebrateUntil != null && summary.config.celebrateUntil > Date.now();

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0b1026',
        color: '#f7f1e3',
        fontFamily: 'var(--font-body), sans-serif',
        display: 'flex',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
        <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 28, margin: '0 0 8px' }}>
          River admin
        </h1>
        <p style={{ color: '#b9c0e8', lineHeight: 1.6, margin: '0 0 24px' }}>
          Festival settings, moderation and export for the organisers. The
          password is the LOY_ADMIN_TOKEN environment variable on the Vercel
          project. It is only used for these requests and is not saved
          anywhere on this page.
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
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button type="button" onClick={loadSummary} style={{ ...btnStyle, flex: 1 }}>
            Load dashboard
          </button>
        </div>
        {summaryError && <p style={{ color: '#ff9d9d', lineHeight: 1.5 }}>{summaryError}</p>}

        {summary && (
          <>
            <section style={sectionStyle} aria-label="Counts">
              <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Tonight at a glance</h2>
              <p style={{ lineHeight: 1.7, margin: 0 }}>
                {summary.counts.wishes} wishes · {summary.counts.people} floated ·{' '}
                {summary.counts.reactions} reactions · {summary.counts.blessings} blessing lanterns ·{' '}
                {summary.counts.candles} candles · {summary.counts.thanks} lanterns of thanks ·{' '}
                {summary.counts.stamps} stamps · {summary.counts.secrets} secrets found
              </p>
            </section>

            <section style={sectionStyle} aria-label="Festival settings">
              <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Festival settings (for organisers)</h2>
              <p style={{ color: '#b9c0e8', lineHeight: 1.6, margin: '0 0 16px' }}>
                These apply to everyone, on their next update. Seven nights:
                the festival runs as seven nights from the first night. An
                opening night shifts every destination one day later; a
                finale night adds one extra night after night 7.
              </p>
              <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }} htmlFor="cfg-start">
                First night
              </label>
              <input
                id="cfg-start"
                type="date"
                value={startDay}
                onChange={(e) => setStartDay(e.target.value)}
                style={inputStyle}
              />
              <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }} htmlFor="cfg-mode">
                Schedule
              </label>
              <select
                id="cfg-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={inputStyle}
              >
                <option value="none">Seven nights</option>
                <option value="opening_night">An opening night, then seven nights</option>
                <option value="finale_night">Seven nights, then a finale night</option>
              </select>
              <p style={{ fontSize: 14, margin: '0 0 6px' }}>River Light target per night</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 12 }}>
                {targets.map((v, i) => (
                  <label key={i} style={{ fontSize: 13, color: '#b9c0e8' }}>
                    Night {i + 1}
                    <input
                      type="number"
                      min={1}
                      max={1000000}
                      value={v}
                      onChange={(e) => {
                        const next = [...targets];
                        next[i] = Math.max(1, Math.min(1000000, Number(e.target.value) || 1));
                        setTargets(next);
                      }}
                      style={{ ...inputStyle, marginBottom: 0, marginTop: 4 }}
                    />
                  </label>
                ))}
              </div>
              <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }} htmlFor="cfg-sim">
                Pretend today is (everyone sees this; clear it before the festival)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="cfg-sim"
                  type="date"
                  value={simDay}
                  onChange={(e) => setSimDay(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button type="button" onClick={() => setSimDay('')} style={ghostBtn}>
                  Use the real date
                </button>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0 12px', fontSize: 15 }}>
                <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
                Pause rewards
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '4px 0 12px', fontSize: 15 }}>
                <input type="checkbox" checked={kiosk} onChange={(e) => setKiosk(e.target.checked)} />
                <span>
                  This device is a shared screen
                  <span style={{ display: 'block', fontSize: 13, color: '#b9c0e8', marginTop: 2 }}>
                    Record only — the once-per-day float limit still applies
                    on a shared screen. The bypass needs Faiq&rsquo;s
                    go-ahead and is not built.
                  </span>
                </span>
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() =>
                    saveConfig({
                      startDay,
                      mode,
                      targets,
                      paused,
                      simDay: simDay || null,
                      kiosk,
                    })
                  }
                  style={btnStyle}
                >
                  Save settings
                </button>
                <button type="button" onClick={() => saveConfig({ celebrate: true })} style={ghostBtn}>
                  {celebrating ? 'Celebration running 🎆' : 'Play a celebration (60 s)'}
                </button>
              </div>
              {configMsg && <p style={{ marginTop: 12, lineHeight: 1.5 }}>{configMsg}</p>}
            </section>

            <section style={sectionStyle} aria-label="Moderation queue">
              <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Reported and hidden wishes</h2>
              {summary.queue.length === 0 ? (
                <p style={{ color: '#b9c0e8' }}>Nothing waiting.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
                  {summary.queue.map((w) => (
                    <li
                      key={w.id}
                      style={{ border: '1px solid #3a4370', borderRadius: 8, padding: 12 }}
                    >
                      <p style={{ margin: '0 0 4px', lineHeight: 1.5 }}>“{w.wish}”</p>
                      <p style={{ margin: '0 0 8px', color: '#b9c0e8', fontSize: 13 }}>
                        {w.name || 'Anonymous'} ·{' '}
                        {w.status === 'reported' ? 'Hidden after reports' : 'Hidden by an organiser'} ·{' '}
                        {w.reports ?? 0} report{(w.reports ?? 0) === 1 ? '' : 's'} ·{' '}
                        {new Date(w.createdAt).toLocaleString()}
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => moderate(w.id, 'approve')} style={btnStyle}>
                          Show on the river
                        </button>
                        {w.status !== 'hidden' && (
                          <button type="button" onClick={() => moderate(w.id, 'hide')} style={ghostBtn}>
                            Hide
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={sectionStyle} aria-label="Audit log">
              <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Recent organiser changes</h2>
              {summary.audit.length === 0 ? (
                <p style={{ color: '#b9c0e8' }}>No changes yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                  {summary.audit.map((a, i) => (
                    <li key={i} style={{ fontSize: 14, lineHeight: 1.5 }}>
                      <span style={{ color: '#b9c0e8' }}>{new Date(a.at).toLocaleString()} — </span>
                      <strong>{a.action}</strong>: {a.detail}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={sectionStyle} aria-label="Backup and reset">
              <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Backup &amp; reset</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <button type="button" onClick={downloadBackup} style={ghostBtn}>
                  Download database backup
                </button>
              </div>
              <p style={{ color: '#b9c0e8', lineHeight: 1.6, fontSize: 14 }}>
                Reset deletes every wish, reaction, lantern, mission and
                stamp on the server, for everyone — and leaves the river
                blank. It does not put back the opening wishes. Type RESET
                to confirm.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={resetInput}
                  onChange={(e) => setResetInput(e.target.value)}
                  placeholder="Type RESET"
                  autoComplete="off"
                  style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={resetAll}
                  style={{ ...btnStyle, background: '#c0392b', color: '#fff' }}
                >
                  Delete all wishes and progress
                </button>
              </div>
              {resetMsg && <p style={{ marginTop: 12, lineHeight: 1.5 }}>{resetMsg}</p>}
            </section>
          </>
        )}

        <section style={sectionStyle} aria-label="River export">
          <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>River export</h2>
          <p style={{ color: '#b9c0e8', lineHeight: 1.6, margin: '0 0 24px' }}>
            Download everything visitors floated on the river — names, wishes, krathong
            choices and reactions — as a spreadsheet (CSV) or JSON. The eight opening
            wishes are not included, and nobody&rsquo;s worry is ever in the file: worries
            are never sent or stored.
          </p>
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
        </section>
      </div>
    </main>
  );
}
