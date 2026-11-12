// Class report for trainer accounts: who has signed in to the lab, who is following the demo videos and
// practice missions, and who has started or finished each activity. The raw data comes from the sync
// server (report action in sync/Code.gs); everything here is plain functions so it can be unit-tested.
import type { Mission, ScenarioPack } from '../missions/types';
import { stampOf } from './activity';

export interface ReportTrainee {
  email: string; name: string; seat: number; team?: string;
  signedIn: boolean;            // has signed in at least once (has a Progress row)
  firstSignIn: number; lastSync: number; updated: number;   // ms (0 = unknown)
  done: Record<string, string[]>;        // missionId -> completed step ids
  checked: Record<string, boolean>;      // worksheetId -> "Check my answers" used
  videos: Record<string, number>;        // video file -> first opened (ms)
  started: Record<string, number>;       // missionId -> first worked on (ms)
  filled: Record<string, number>;        // worksheetId -> number of fields with an answer
}
export interface ReportData { trainees: ReportTrainee[]; openDays: number[]; generated: number }

export const STATUS = ['Not signed in', 'Signed in, not started', 'Following the demos', 'Doing activities', 'Day finished'] as const;
export type Status = typeof STATUS[number];
export interface Count { n: number; total: number; names: string[] }
export interface DayProgress { videos: Count; practiceStarted: Count; practiceDone: Count; actsStarted: Count; actsDone: Count; status: Status }

const count = (list: Mission[], ok: (m: Mission) => boolean): Count => {
  const hit = list.filter(ok);
  return { n: hit.length, total: list.length, names: hit.map((m) => m.title.replace(/^Practice: /, '')) };
};
const steps = (t: ReportTrainee, m: Mission) => (t.done[m.id] ?? []).filter((id) => m.steps.some((s) => s.id === id)).length;

export function dayProgress(t: ReportTrainee, pack: ScenarioPack): DayProgress {
  const practice = pack.missions.filter((m) => m.kind === 'practice');
  const acts = pack.missions.filter((m) => m.kind === 'activity');
  const videos = count(practice.filter((m) => m.video), (m) => !!t.videos[m.video!]);
  const practiceStarted = count(practice, (m) => !!t.started[m.id] || steps(t, m) > 0);
  const practiceDone = count(practice, (m) => m.steps.length > 0 && steps(t, m) === m.steps.length);
  const actsStarted = count(acts, (m) => !!t.started[m.id] || steps(t, m) > 0 || !!(m.worksheet && t.filled[m.worksheet.id]));
  const actsDone = count(acts, (m) => steps(t, m) === m.steps.length && (!m.worksheet || !!t.checked[m.worksheet.id]));
  const status: Status = !t.signedIn ? 'Not signed in'
    : acts.length && actsDone.n === acts.length ? 'Day finished'
    : actsStarted.n ? 'Doing activities'
    : videos.n || practiceStarted.n ? 'Following the demos'
    : 'Signed in, not started';
  return { videos, practiceStarted, practiceDone, actsStarted, actsDone, status };
}

/** The day the report opens on: the newest day the trainer opened, else the newest day anyone worked on. */
export function defaultDay(data: ReportData, packs: ScenarioPack[]): number {
  const days = packs.filter((p) => p.day > 0).map((p) => p.day);
  const open = data.openDays.filter((d) => days.includes(d));
  if (open.length) return Math.max(...open);
  const used = days.filter((d) => data.trainees.some((t) => dayProgress(t, packs.find((p) => p.day === d)!).status !== 'Signed in, not started' && t.signedIn));
  return used.length ? Math.max(...used) : Math.min(...days);
}

export function daySummary(data: ReportData, pack: ScenarioPack) {
  const rows = data.trainees.map((t) => ({ t, p: dayProgress(t, pack) }));
  const at = (...s: Status[]) => rows.filter((r) => s.includes(r.p.status)).length;
  return {
    total: rows.length,
    signedIn: rows.filter((r) => r.t.signedIn).length,
    demos: rows.filter((r) => r.p.videos.n || r.p.practiceStarted.n).length,
    activities: at('Doing activities', 'Day finished'),
    finished: at('Day finished'),
    rows,
  };
}

export const when = (ms: number) => (ms ? new Date(ms).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '');
const lastActive = (t: ReportTrainee) => Math.max(t.updated || 0, t.lastSync || 0);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const frac = (c: Count) => `${c.n}/${c.total}`;

export function reportHtml(data: ReportData, packs: ScenarioPack[], day: number): string {
  const pack = packs.find((p) => p.day === day)!;
  const s = daySummary(data, pack);
  const opts = packs.filter((p) => p.day > 0).map((p) => `<option value="${p.day}"${p.day === day ? ' selected' : ''}>${esc(p.title)}${data.openDays.includes(p.day) ? ' (open today)' : ''}</option>`).join('');
  const chip = (n: number, label: string, cls: string) => `<div class="rp-chip ${cls}"><b>${n}</b><span>${label}</span></div>`;
  const cell = (c: Count, done?: Count) => `<td title="${esc(c.names.join('\n'))}">${frac(c)}${done ? ` <span class="muted">· ${done.n} done</span>` : ''}</td>`;
  const body = s.rows.map(({ t, p }) => `<tr class="st-${STATUS.indexOf(p.status)}">
      <td>${t.seat ? String(t.seat).padStart(2, '0') : '–'}</td><td><b>${esc(t.name || '(no name)')}</b>${t.team ? ` <span class="rp-team">${esc(t.team)}</span>` : ''}<br><span class="muted">${esc(t.email)}</span></td>
      <td>${esc(when(t.firstSignIn)) || '<span class="muted">never</span>'}</td><td>${esc(when(lastActive(t)))}</td>
      ${cell(p.videos)}${cell(p.practiceStarted, p.practiceDone)}${cell(p.actsStarted, p.actsDone)}
      <td><span class="rp-status st-${STATUS.indexOf(p.status)}">${p.status}</span></td></tr>`).join('');
  return `<div class="report">
    <div class="rp-head"><h2>Class report</h2><select id="rp-day">${opts}</select>
      <span class="muted">Updated ${esc(when(data.generated))}</span><div class="spacer"></div>
      <button class="btn small" id="rp-refresh">↻ Refresh</button><button class="btn small" id="rp-csv">Download CSV (all days)</button><button class="btn small ghost" id="rp-close">Close</button></div>
    <div class="rp-chips">${chip(s.signedIn, `of ${s.total} signed in to the lab`, 'c1')}${chip(s.demos, 'following the demos', 'c2')}${chip(s.activities, 'started the activities', 'c3')}${chip(s.finished, `finished all Day ${day} activities`, 'c4')}</div>
    <div class="rp-scroll"><table class="rp-table"><thead><tr><th>Seat</th><th>Trainee</th><th>First sign-in</th><th>Last active</th>
      <th>Videos watched</th><th>Practice started</th><th>Activities started</th><th>Day ${day} status</th></tr></thead><tbody>${body || '<tr><td colspan="8" class="muted">No trainees yet. They appear here after their first sign-in (or when you add them to the Roster tab).</td></tr>'}</tbody></table></div>
    <p class="muted fine">Hover a number to see which videos or missions. "Following the demos" = watched a demo video or worked on a practice mission. An activity is done when every step is done and "Check my answers" was used. Trainer accounts are not listed.</p>
  </div>`;
}

export function reportCsv(data: ReportData, packs: ScenarioPack[]): string {
  const days = packs.filter((p) => p.day > 0);
  const q = (v: string | number) => { const x = String(v); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  const head = ['Seat', 'Full Name', 'Email', 'Team', 'Signed In', 'First Sign-in (date & time)', 'Last Active (date & time)',
    ...days.flatMap((p) => [`Day ${p.day} Videos Watched`, `Day ${p.day} Practice Started`, `Day ${p.day} Practice Done`, `Day ${p.day} Activities Started`, `Day ${p.day} Activities Done`, `Day ${p.day} Status`])];
  const rows = data.trainees.map((t) => [t.seat || '', t.name, t.email, t.team ?? '', t.signedIn ? 'Yes' : 'No', stampOf(t.firstSignIn), stampOf(lastActive(t)),
    ...days.flatMap((p) => { const d = dayProgress(t, p); return [frac(d.videos), frac(d.practiceStarted), frac(d.practiceDone), frac(d.actsStarted), frac(d.actsDone), d.status]; })]);
  return [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
}
