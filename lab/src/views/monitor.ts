// Trainee page for the trainer (after the DAL3 Virtual Lab's "who is working on what"): one trainee's status, every day
// at a glance, the live work of one mission (answers re-checked on their seat, steps with times, evidence, commands
// with output), and the dated activity log with filters. Data: the trainee action in sync/Code.gs.
import type { Mission, ScenarioPack } from '../missions/types';
import type { BoardSub } from '../ui/submit';
import { verdictLabel, when } from '../ui/submit';
import { timeline, FILTERS, KIND_LABEL, stampOf, timeOf, type ActEvent, type LogTrainee, type LogState } from '../ui/activity';
import { answersHtml, stepsHtml, evidenceHtml, logHtml, ago, isOnline, type Presence } from './board';
import { esc, dayTitle } from './pages';

export interface TraineeDetail extends LogTrainee {
  updated: number; generated: number; presence: Presence | null; subs: BoardSub[];
  redo: { email: string; act: string; note: string; at: number }[];
  state: (LogState & { ws?: Record<string, Record<string, string>> }) | null;
}
export interface MonitorView { mission: string; filter: string; day: number; limit: number }
type Recheck = { auto: number; max: number; verdicts: Record<string, boolean> } | null;
interface Lessons { [day: number]: { parts: { h: string }[] } | undefined }

const steps = (s: LogState, m: Mission) => (s.done?.[m.id] ?? []).filter((id) => m.steps.some((x) => x.id === id)).length;
const latestSub = (x: TraineeDetail, id: string) => x.subs.filter((s) => s.act === id).sort((a, b) => a.attempt - b.attempt).pop();
const worked = (s: LogState, m: Mission) => !!s.started?.[m.id] || steps(s, m) > 0 || (s.log ?? []).some((l) => l.mission === m.title);

/** The mission the page opens on: the one asked for, else what the trainee has open, else the last one started. */
export function pickMission(x: TraineeDetail, packs: ScenarioPack[], want: string): Mission | undefined {
  const all = packs.flatMap((p) => p.missions).filter((m) => m.kind !== 'workspace');
  const s = x.state ?? {};
  const by = (id?: string) => all.find((m) => m.id === id);
  if (want) return by(want);
  const cur = by(s.missionId);
  if (cur && worked(s, cur)) return cur;
  const last = Object.entries(s.started ?? {}).sort((a, b) => b[1] - a[1]).map(([id]) => by(id)).find(Boolean);
  return last ?? cur;
}

function statusChip(x: TraineeDetail, s: LogState, m: Mission): string {
  const sub = latestSub(x, m.id);
  const redo = x.redo.some((r) => r.act === m.id);
  const n = steps(s, m);
  const fin = s.finished?.[m.id] !== undefined || (n === m.steps.length && (!m.worksheet || !!s.checked?.[m.worksheet.id]));
  const now = isOnline(x.presence) && x.presence!.mission === m.title;
  const tag = redo ? '<span class="tag warn">REDO</span>' : sub?.verdict === 'C' ? '<span class="tag good">C</span>' : sub?.verdict === 'NYC' ? '<span class="tag bad">NYC</span>'
    : sub ? '<span class="tag info">SUBMITTED</span>' : fin ? '<span class="tag good">DONE</span>' : n || worked(s, m) ? `<span class="small">${n}/${m.steps.length}</span>` : '<span class="muted">–</span>';
  const no = (m.title.match(/^(?:Activity|Practice:) ?(\S+)/) ?? [])[1] ?? m.id;
  return `<button class="mchip" data-m="${m.id}" title="${esc(m.title)}">${now ? '<span class="dot on"></span>' : ''}<b>${esc(m.kind === 'activity' ? no : `D${(m.title.match(/Demo (\d+)/) ?? [])[1] ?? ''}`)}</b>${tag}</button>`;
}

function daysHtml(x: TraineeDetail, packs: ScenarioPack[], lessons: Lessons): string {
  const s = x.state ?? {};
  const rows = packs.filter((p) => p.day > 0).map((p) => {
    const practice = p.missions.filter((m) => m.kind === 'practice'), acts = p.missions.filter((m) => m.kind === 'activity');
    const vids = practice.filter((m) => m.video);
    const parts = lessons[p.day]?.parts.length ?? 0;
    const read = (s.lessonRead?.[p.day] ?? []).length;
    const pDone = practice.filter((m) => m.steps.length && steps(s, m) === m.steps.length).length;
    return `<tr><td><b>Day ${p.day}</b><div class="small muted">${esc(dayTitle(p))}</div></td>
      <td class="small">${parts ? `${read}/${parts}` : '–'}</td><td class="small">${vids.length ? `${vids.filter((m) => s.videos?.[m.video!]).length}/${vids.length}` : '–'}</td>
      <td>${practice.map((m) => statusChip(x, s, m)).join('')}<div class="small muted">${pDone}/${practice.length} done</div></td><td>${acts.map((m) => statusChip(x, s, m)).join('')}</td></tr>`;
  }).join('');
  return `<div class="bscroll"><table class="ptable mdays"><thead><tr><th>Day</th><th>Lesson read</th><th>Videos</th><th>Practice</th><th>Activities</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="small muted">Click a mission to see its live work below. 3/5 = steps done · DONE = finished · SUBMITTED / C / NYC / REDO = submissions.</p>`;
}

function workHtml(x: TraineeDetail, packs: ScenarioPack[], m: Mission | undefined, recheck: Recheck): string {
  const s = x.state ?? {};
  const all = packs.flatMap((p) => p.missions).filter((y) => y.kind !== 'workspace' && worked(s, y));
  if (!m) return '<p class="muted">No work yet.</p>';
  const opts = (all.includes(m) ? all : [m, ...all]).map((y) => `<option value="${y.id}" ${y === m ? 'selected' : ''}>Day ${y.day} · ${esc(y.title)}</option>`).join('');
  const values = m.worksheet ? s.ws?.[m.worksheet.id] ?? {} : {};
  const log = (s.log ?? []).filter((l) => l.mission === m.title);
  const ev = (s.evidence ?? []).filter((e) => e.mission === m.title);
  const sub = latestSub(x, m.id);
  const checks = (s.checks ?? []).filter((c) => c.mission === m.id);
  const lastCheck = checks[checks.length - 1];
  const fin = s.finished?.[m.id];
  const now = isOnline(x.presence) && x.presence!.mission === m.title;
  const at = (id: string) => { const t = s.stepAt?.[`${m.id}|${id}`]; return t ? stampOf(t) : ''; };
  return `<div class="boardbar"><label class="small muted">Mission <select id="mn-mission">${opts}</select></label>${now ? '<span class="tag good">WORKING ON IT NOW</span>' : ''}
      ${sub ? `<button class="btn small" id="mn-sub" data-act="${m.id}">Open submission · attempt ${sub.attempts}${sub.verdict ? ` · ${sub.verdict}` : ''}</button>` : ''}</div>
    <div class="dsum">
      <div><div class="kicker">Steps</div><b class="big">${steps(s, m)} / ${m.steps.length}</b></div>
      ${m.worksheet ? `<div><div class="kicker">Answers now, re-checked on seat ${x.seat}</div><b class="big">${recheck ? `${recheck.auto} / ${recheck.max}` : '–'}</b></div>
      <div><div class="kicker">Checked by the trainee</div><b>${checks.length ? `${checks.length}× · last ${lastCheck.ok}/${lastCheck.total}` : s.checked?.[m.worksheet.id] ? 'yes' : 'not yet'}</b>${lastCheck ? `<div class="small muted">${esc(stampOf(lastCheck.at))}</div>` : ''}</div>` : ''}
      <div><div class="kicker">Started</div><b>${esc(stampOf(s.started?.[m.id] ?? 0)) || '–'}</b></div>
      <div><div class="kicker">Finished</div><b>${fin ? esc(stampOf(fin)) : fin === 0 ? 'yes' : '–'}</b></div>
      <div><div class="kicker">Submitted</div><b>${sub ? `${esc(stampOf(sub.ts))}` : 'not yet'}</b>${sub ? `<div class="small muted">${sub.score}/${sub.max}${sub.verdict ? ` · ${verdictLabel(sub.verdict)}` : ' · not graded'}</div>` : ''}</div>
    </div>
    <div class="dcols">
      <section>${m.worksheet ? `<div class="label">Worksheet answers (live)</div>${answersHtml(m, values, recheck, true)}` : ''}
        <div class="label">Steps</div>${stepsHtml(m, s.done?.[m.id] ?? [], at)}</section>
      <section><div class="label">Evidence (${ev.length})</div>${evidenceHtml(ev)}
        <div class="label">Commands (${log.length})</div>${logHtml(log)}</section>
    </div>`;
}

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
function logListHtml(events: ActEvent[], v: MonitorView): string {
  const f = FILTERS.find((x) => x.id === v.filter) ?? FILTERS[0];
  const list = events.filter((e) => (!f.kinds.length || f.kinds.includes(e.kind)) && (!v.day || !e.day || e.day === v.day)).reverse();
  const shown = list.slice(0, v.limit);
  let prev = '';
  const rows = shown.map((e) => {
    const d = new Date(e.at).toLocaleDateString('en-PH', DAY_FMT);
    const head = d !== prev ? `<tr class="lday"><td colspan="4">${esc(d)}</td></tr>` : '';
    prev = d;
    const text = e.kind === 'command' ? (e.out ? `<details><summary><code>${esc(e.text)}</code></summary><pre class="log-out">${esc(e.out)}</pre></details>` : `<code>${esc(e.text)}</code>`) : esc(e.text);
    return `${head}<tr><td class="small mono">${esc(timeOf(e.at))}</td><td><span class="tag k-${e.kind}">${KIND_LABEL[e.kind]}</span></td><td>${text}</td>
      <td class="small muted">${esc(e.mission.replace(/ · .*$/, ''))}${e.host ? ` · ${esc(e.host)}` : ''}</td></tr>`;
  }).join('');
  return rows ? `<table class="log mlog">${rows}</table>${list.length > shown.length ? `<p><button class="btn small" id="mn-more">Show all ${list.length} events</button></p>` : ''}`
    : '<p class="muted">Nothing of this kind yet.</p>';
}

export function monitorHtml(x: TraineeDetail, packs: ScenarioPack[], lessons: Lessons, v: MonitorView, m: Mission | undefined, recheck: Recheck): string {
  const events = timeline(x, packs, (d, p) => lessons[d]?.parts[p]?.h ?? `part ${p + 1}`);
  const p = x.presence;
  const last = Math.max(x.updated || 0, x.lastSync || 0, p ? x.generated - p.ago * 1000 : 0);
  const status = isOnline(p) ? `<span class="dot on"></span><b>Online now</b> · ${esc(p!.mission || 'in the lab')}` : x.signedIn ? `Last active ${esc(ago(last, x.generated))}` : 'Never signed in';
  const f = FILTERS.find((y) => y.id === v.filter) ?? FILTERS[0];
  const count = (k: typeof FILTERS[number]) => events.filter((e) => (!k.kinds.length || k.kinds.includes(e.kind)) && (!v.day || !e.day || e.day === v.day)).length;
  const days = [...new Set(events.map((e) => e.day).filter(Boolean))].sort((a, b) => a - b);
  return `<div class="pagehead"><div class="kicker"><a href="#/board">‹ Trainer board</a> · Seat ${String(x.seat || 0).padStart(2, '0')}${x.team ? ` · ${esc(x.team)}` : ''} · ${esc(x.email)}</div>
      <h2>${esc(x.name || x.email)}</h2>
      <div class="meta mstatus">${status}${x.firstSignIn ? ` · first signed in ${esc(stampOf(x.firstSignIn))}` : ''} · updated ${esc(when(x.generated))}</div></div>
    <div class="boardbar"><span class="grow"></span><button class="btn" id="mn-refresh">Refresh</button><button class="btn" id="mn-csv">Download activity log (CSV)</button></div>
    <div class="label">Days</div>${daysHtml(x, packs, lessons)}
    <div class="label" id="mn-work">Live work</div>${workHtml(x, packs, m, recheck)}
    <div class="label">Activity log</div>
    <div class="boardbar"><div class="chips" role="group" aria-label="Show in the log">${FILTERS.map((k) => `<button class="chip ${k === f ? 'on' : ''}" data-f="${k.id}" aria-pressed="${k === f}">${k.label} <span class="small muted">${count(k)}</span></button>`).join('')}</div>
      <span class="grow"></span><label class="small muted">Day <select id="mn-day"><option value="0">All days</option>${days.map((d) => `<option value="${d}" ${d === v.day ? 'selected' : ''}>Day ${d}</option>`).join('')}</select></label></div>
    ${logListHtml(events, v)}
    <p class="small muted">Times are when the lab recorded each event (this computer's time zone). Steps, answer checks and finished missions done before the 12 Nov 2026 lab update have no recorded time, so they are not in the log.</p>`;
}

