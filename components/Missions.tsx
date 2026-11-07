// Chunk A — Missions UI: tonight's missions (side panel), the milestone
// card, and the all-seven-nights list.
//
// The component reads the D1 event store + the device-local claims store
// on every render and re-reads whenever either changes (window events
// 'loy:events-changed' from lib/events.ts and 'loy:claims-changed' from
// lib/missions.ts), so a visit, a reaction or a float elsewhere on the
// page updates the missions without a page reload.
//
// Go buttons only exist where the action exists today: visit -> the
// passport strip, the night-1 float special -> the builder, kindness ->
// the wish wall. Other nights' specials get their Go when chunk B lands
// their dialogs; until then their missions show honestly as available /
// in progress, never as complete.

'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/data';
import { DESTINATIONS } from '@/lib/destinations';
import type { FestivalCalendar } from '@/lib/festival';
import { loadEvents } from '@/lib/events';
import {
  claimMission,
  loadClaims,
  milestoneFor,
  missionsFor,
  missionsForDay,
  totalRiverLight,
  type Mission,
} from '@/lib/missions';
import { t, type Strings } from '@/lib/i18n';

/** Bumps whenever the event store or the claims store changes. */
export function useMissionsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener('loy:events-changed', bump);
    window.addEventListener('loy:claims-changed', bump);
    return () => {
      window.removeEventListener('loy:events-changed', bump);
      window.removeEventListener('loy:claims-changed', bump);
    };
  }, []);
  return version;
}

/** Where the Go button takes the visitor — only for actions that exist. */
function goTarget(mission: Mission): string | null {
  if (mission.slot === 'visit') return '#destinations';
  if (mission.slot === 'kindness') return '#wishes';
  if (mission.slot === 'special' && mission.day === 1) return '#float';
  return null;
}

function stateLabel(s: Strings, state: Mission['state']): string {
  if (state === 'locked') return s.locked;
  if (state === 'missed') return s.missed;
  if (state === 'claimed') return s.claimed;
  return '';
}

function MissionRow({ lang, mission, cal }: { lang: Lang; mission: Mission; cal: FestivalCalendar }) {
  const s = t(lang);
  const target = goTarget(mission);
  const label = stateLabel(s, mission.state);
  return (
    <li className={`mission ${mission.state}`} data-day={mission.day} data-slot={mission.slot}>
      <span className="mission-icon" aria-hidden="true">{mission.icon}</span>
      <span className="mission-body">
        <span className="mission-title">{mission.title[lang]}</span>
        <span className="mission-detail">{mission.detail[lang]}</span>
        <span className="mission-meta">
          <span className="mission-progress">
            {s.missionProgress(mission.progress, mission.goal)}
          </span>
          <span className="mission-reward">{s.reward(mission.reward)}</span>
          {label && <span className="mission-state">{label}</span>}
        </span>
      </span>
      <span className="mission-actions">
        {mission.state === 'completed' && (
          <button
            type="button"
            className="btn small primary"
            onClick={() => claimMission(cal, mission.day, mission.slot, loadEvents())}
          >
            {s.claim}
          </button>
        )}
        {(mission.state === 'available' || mission.state === 'in_progress') && target && (
          <a className="btn small ghost" href={target}>
            {s.go}
          </a>
        )}
      </span>
    </li>
  );
}

/** The night the side panel talks about: tonight while live, the first
 *  night before the festival, the last night once it is over. */
export function panelDay(cal: FestivalCalendar): number {
  if (cal.liveDay !== null) return cal.liveDay;
  return cal.phase === 'archive' || cal.phase === 'closed' ? 7 : 1;
}

/** Tonight's 3 missions with a done/3 badge — the side panel. */
export function MissionsPanel({ lang, cal }: { lang: Lang; cal: FestivalCalendar }) {
  useMissionsVersion();
  const s = t(lang);
  const day = panelDay(cal);
  const missions = missionsForDay(cal, loadEvents(), loadClaims(), day);
  const done = missions.filter((m) => m.state === 'completed' || m.state === 'claimed').length;
  const dest = DESTINATIONS.find((d) => d.day === day);
  return (
    <section className="missions-panel" aria-labelledby="missions-title">
      <div className="section-head">
        <h3 id="missions-title">{s.missionsTitle}</h3>
        <span className="pill" aria-live="polite">
          {s.missionsDone(done, 3)}
        </span>
      </div>
      {dest && <p className="section-intro">{s.missionsNight(day, dest.name[lang])}</p>}
      {cal.phase === 'before' && <p className="hint">{s.missionsLockedNote}</p>}
      <ul className="mission-list">
        {missions.map((m) => (
          <MissionRow key={m.slot} lang={lang} mission={m} cal={cal} />
        ))}
      </ul>
    </section>
  );
}

/** One night's milestone card. The total is DEVICE-LOCAL until E1 — the
 *  card says so in plain language and never presents it as the shared
 *  river total (plan A3e). */
export function MilestoneCard({ lang, cal, day }: { lang: Lang; cal: FestivalCalendar; day: number }) {
  useMissionsVersion();
  const s = t(lang);
  const dest = DESTINATIONS.find((d) => d.day === day);
  const milestone = milestoneFor(day, loadClaims());
  const pct = Math.min(1, milestone.pct);
  const stage = milestone.stage;
  const nextPct = [25, 50, 75, 100][stage];
  const nextWhat = dest?.milestone.stages[stage];
  return (
    <section className="milestone-card" aria-labelledby="milestone-title">
      <div className="section-head">
        <h3 id="milestone-title">{s.milestoneTitle}</h3>
      </div>
      {dest && (
        <p className="milestone-name">
          {dest.milestone.name[lang]} · {s.missionsNight(day, dest.name[lang])}
        </p>
      )}
      <div
        className="milestone-bar"
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={s.riverLightCount(milestone.riverLight, milestone.target)}
      >
        <span className="milestone-fill" style={{ width: `${pct * 100}%` }} />
        {[25, 50, 75].map((mark) => (
          <span key={mark} className="milestone-mark" style={{ left: `${mark}%` }} aria-hidden="true" />
        ))}
      </div>
      <p className="milestone-count">{s.riverLightCount(milestone.riverLight, milestone.target)}</p>
      {stage >= 4 ? (
        <p className="milestone-done" role="status">
          {s.milestoneDone}
          {dest && <span> {dest.milestone.bonus[lang]}</span>}
        </p>
      ) : (
        nextWhat && <p className="milestone-next">{s.nextUnlock(nextPct, nextWhat[lang])}</p>
      )}
      <p className="milestone-local">{s.milestoneLocalNote}</p>
      <p className="milestone-total">{s.totals(totalRiverLight(loadClaims()))}</p>
    </section>
  );
}

/** All seven nights, one <details> each — the live night open. */
export function MissionsAll({ lang, cal }: { lang: Lang; cal: FestivalCalendar }) {
  useMissionsVersion();
  const s = t(lang);
  const all = missionsFor(cal, loadEvents(), loadClaims());
  return (
    <div className="missions-all">
      {DESTINATIONS.map((dest) => {
        const night = all.filter((m) => m.day === dest.day);
        const done = night.filter((m) => m.state === 'completed' || m.state === 'claimed').length;
        return (
          <details key={dest.id} className="night" open={cal.liveDay === dest.day}>
            <summary>
              <span>{s.missionsNight(dest.day, dest.name[lang])}</span>
              <span className="pill">{s.missionsDone(done, 3)}</span>
            </summary>
            <ul className="mission-list">
              {night.map((m) => (
                <MissionRow key={m.slot} lang={lang} mission={m} cal={cal} />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
