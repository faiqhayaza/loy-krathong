// Sign-up / sign-in gate — the FIRST PAGE of the festival.
//
// Faiq's decision (voice, 2026-11-07, confirmed ~09:38): the first page
// IS the gate. When no identity exists, the visitor sees ONLY the gate —
// the whole site (missions, passport, river, wish wall) is blocked behind
// it and is not rendered at all until they pass. There is NO guest entry
// past this page and NO way to browse it without signing up or signing
// in. Sign up with a nickname (display-only, not unique, not a secret)
// and the site generates a random 10-digit recovery ID — shown BIG, with
// a copy button and a "remember this ID, it is the only way back" message
// — or sign in with a nickname + the ID from another device. The ID is
// stored in the visitor's own browser, so the same device passes the gate
// automatically on later visits.
//
// No eID, no email, no password, nothing personal — only a nickname and
// a random number. For D1, signing in stores the ID locally; pulling
// the visitor's progress back from the server is E1's job, so the
// sign-in copy says so plainly instead of pretending.
//
// Strings live here, not in lib/i18n.ts (D1 adds no keys there): the
// gate is its own self-contained step. The /admin page keeps its own
// password and is out of scope for the gate.

'use client';

import { useState } from 'react';
import type { Lang } from '@/lib/data';
import {
  MAX_NICKNAME_CHARS,
  createIdentity,
  isValidNickname,
  isValidRecoveryId,
  restoreIdentity,
  type VisitorIdentity,
} from '@/lib/identity';

const STRINGS = {
  en: {
    title: 'Seven Nights of Wishes',
    sub: 'First, a nickname — and your key to come back.',
    nicknameLabel: 'Your nickname',
    nicknamePlaceholder: 'What should the river call you?',
    nicknameHint: 'Shown beside your wishes. Not unique, not a secret — just a name.',
    nicknameError: 'Please enter a nickname (1–40 characters).',
    signupButton: 'Create my key',
    signupNote: 'No email, no password, nothing personal — just a nickname and a random key.',
    generatingError: 'Could not create a key on this device. Please try again.',
    yourKeyTitle: 'Your key — keep it safe',
    yourKeyBody: 'This is the only way back to your wishes and stamps. Write it down or copy it somewhere safe. If you lose it, there is no other way back.',
    copyButton: 'Copy my key',
    copied: 'Copied ✓',
    enterButton: 'Enter the river',
    haveKey: 'I already have a key',
    newKey: 'I need a new key instead',
    signinTitle: 'Welcome back',
    signinBody: 'Enter your nickname and your 10-digit key.',
    keyLabel: 'Your 10-digit key',
    keyPlaceholder: 'e.g. 4829130756',
    keyError: 'That key does not look right — it must be exactly 10 digits.',
    signinButton: 'Restore my visit',
    signinNote: 'Your key is stored on this device, so next time you come straight in. Signing in pulls your wishes, stamps and progress back from the river.',
    signinRateLimited: 'Too many tries. Wait a minute and try again.',
    nicknameFirst: 'Please enter a nickname first.',
  },
  th: {
    title: 'เจ็ดค่ำคืนแห่งคำอธิษฐาน',
    sub: 'ก่อนอื่น ชื่อเล่นของคุณ — และกุญแจสำหรับกลับมา',
    nicknameLabel: 'ชื่อเล่นของคุณ',
    nicknamePlaceholder: 'อยากให้สายน้ำเรียกคุณว่าอะไร?',
    nicknameHint: 'จะแสดงข้างคำอธิษฐานของคุณ ไม่ต้องไม่ซ้ำใคร ไม่ใช่ความลับ — แค่ชื่อ',
    nicknameError: 'กรุณาใส่ชื่อเล่น (1–40 ตัวอักษร)',
    signupButton: 'สร้างกุญแจของฉัน',
    signupNote: 'ไม่ต้องใช้อีเมล ไม่ต้องใช้รหัสผ่าน ไม่มีข้อมูลส่วนตัว — แค่ชื่อเล่นกับกุญแจสุ่ม',
    generatingError: 'สร้างกุญแจบนอุปกรณ์นี้ไม่ได้ กรุณาลองอีกครั้ง',
    yourKeyTitle: 'กุญแจของคุณ — เก็บไว้ให้ดี',
    yourKeyBody: 'นี่คือทางเดียวที่จะกลับมาหาคำอธิษฐานและตราของคุณ จดไว้หรือคัดลอกเก็บไว้ในที่ปลอดภัย ถ้าทำหาย จะไม่มีทางอื่นกลับมา',
    copyButton: 'คัดลอกกุญแจของฉัน',
    copied: 'คัดลอกแล้ว ✓',
    enterButton: 'เข้าสู่สายน้ำ',
    haveKey: 'ฉันมีกุญแจอยู่แล้ว',
    newKey: 'ฉันต้องการกุญแจใหม่',
    signinTitle: 'ยินดีต้อนรับกลับ',
    signinBody: 'ใส่ชื่อเล่นและกุญแจ 10 หลักของคุณ',
    keyLabel: 'กุญแจ 10 หลักของคุณ',
    keyPlaceholder: 'เช่น 4829130756',
    keyError: 'กุญแจดูไม่ถูกต้อง — ต้องเป็นตัวเลข 10 หลักพอดี',
    signinButton: 'กลับมาที่เดิมของฉัน',
    signinNote: 'กุญแจของคุณจะเก็บไว้บนอุปกรณ์นี้ ครั้งหน้าจะเข้าได้เลย การลงชื่อเข้าจะดึงคำอธิษฐาน ตราประทับ และความคืบหน้าของคุณกลับมาจากสายน้ำ',
    signinRateLimited: 'ลองหลายครั้งเกินไปแล้ว รอสักครู่แล้วลองอีกครั้ง',
    nicknameFirst: 'กรุณาใส่ชื่อเล่นก่อน',
  },
} as const;

export default function IdentityDialog({
  lang,
  onDone,
}: {
  lang: Lang;
  onDone: (identity: VisitorIdentity) => void;
}) {
  const s = STRINGS[lang];
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [step, setStep] = useState<'form' | 'key'>('form');
  const [nickname, setNickname] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [identity, setIdentity] = useState<VisitorIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSignup() {
    setError(null);
    if (!isValidNickname(nickname)) {
      setError(s.nicknameError);
      return;
    }
    const created = createIdentity(nickname);
    if (!created) {
      setError(s.generatingError);
      return;
    }
    setIdentity(created);
    setStep('key');
  }

  // Sign-in (E1): the key is checked against the server first, so a
  // visitor's progress comes back with them — and so guessing keys is
  // rate-limited server-side. When the server cannot be reached the
  // sign-in still works locally (the key is stored on this device and
  // the migration runs when the river answers again); the 429 case
  // blocks, because it means the limit was actually hit.
  async function handleSignin() {
    setError(null);
    if (!isValidNickname(nickname)) {
      setError(s.nicknameFirst);
      return;
    }
    if (!isValidRecoveryId(keyInput.trim())) {
      setError(s.keyError);
      return;
    }
    try {
      const res = await fetch('/api/identity/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), id: keyInput.trim() }),
      });
      if (res.status === 429) {
        setError(s.signinRateLimited);
        return;
      }
      // Any other non-OK (or a missing route) falls through to the
      // local sign-in below — the server check is a restore, not a
      // second gate.
    } catch {
      // Offline: same fall-through — the key is stored locally and the
      // state syncs when the river answers again.
    }
    const restored = restoreIdentity(nickname, keyInput.trim());
    if (!restored) {
      setError(s.keyError);
      return;
    }
    onDone(restored);
  }

  async function copyKey() {
    if (!identity) return;
    try {
      await navigator.clipboard.writeText(identity.id);
      setCopied(true);
      return;
    } catch {
      // Clipboard API unavailable (old browser / permissions): select the
      // key text and try the legacy copy command, so the visitor can still
      // copy it with one tap; the selection stays for a manual copy.
    }
    const el = document.getElementById('recovery-id-value');
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    try {
      if (document.execCommand('copy')) setCopied(true);
    } catch {
      // selection remains for a manual copy
    }
  }

  // The gate IS the first page (not a dialog over the site): while it is
  // up, nothing else is rendered. No dismiss path exists.
  return (
    <main className="id-gate" aria-labelledby="id-gate-title">
      <div className="id-card">
        <h1 id="id-gate-title">🪷 {s.title}</h1>
        <p className="id-sub">{mode === 'signup' && step === 'form' ? s.sub : mode === 'signin' ? s.signinBody : s.yourKeyTitle}</p>

        {mode === 'signup' && step === 'form' && (
          <>
            <label className="field" htmlFor="id-nickname">
              <span>{s.nicknameLabel}</span>
              <input
                id="id-nickname"
                type="text"
                value={nickname}
                maxLength={MAX_NICKNAME_CHARS}
                placeholder={s.nicknamePlaceholder}
                autoComplete="nickname"
                autoFocus
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSignup();
                }}
              />
            </label>
            <p className="id-hint">{s.nicknameHint}</p>
            {error && (
              <p className="id-error" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="btn primary id-submit" onClick={handleSignup}>
              {s.signupButton}
            </button>
            <p className="id-hint">{s.signupNote}</p>
            <button type="button" className="id-switch" onClick={() => { setError(null); setMode('signin'); }}>
              {s.haveKey}
            </button>
          </>
        )}

        {mode === 'signup' && step === 'key' && identity && (
          <>
            <p className="id-key-body">{s.yourKeyBody}</p>
            <div className="id-key" id="recovery-id-value" aria-label={s.keyLabel}>
              {identity.id}
            </div>
            <button type="button" className="btn primary id-submit" onClick={copyKey}>
              {copied ? s.copied : s.copyButton}
            </button>
            <button type="button" className="btn ghost id-submit" onClick={() => onDone(identity)}>
              {s.enterButton} 🪷
            </button>
          </>
        )}

        {mode === 'signin' && (
          <>
            <label className="field" htmlFor="id-nickname-restore">
              <span>{s.nicknameLabel}</span>
              <input
                id="id-nickname-restore"
                type="text"
                value={nickname}
                maxLength={MAX_NICKNAME_CHARS}
                placeholder={s.nicknamePlaceholder}
                autoComplete="nickname"
                autoFocus
                onChange={(e) => setNickname(e.target.value)}
              />
            </label>
            <label className="field" htmlFor="id-key-input">
              <span>{s.keyLabel}</span>
              <input
                id="id-key-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={keyInput}
                maxLength={10}
                placeholder={s.keyPlaceholder}
                onChange={(e) => setKeyInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSignin();
                }}
              />
            </label>
            {error && (
              <p className="id-error" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="btn primary id-submit" onClick={handleSignin}>
              {s.signinButton}
            </button>
            <p className="id-hint">{s.signinNote}</p>
            <button
              type="button"
              className="id-switch"
              onClick={() => { setError(null); setStep('form'); setMode('signup'); }}
            >
              {s.newKey}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
