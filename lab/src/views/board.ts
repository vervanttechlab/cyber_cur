// Trainer board (after the DAL3 Virtual Lab board): trainees x activities of one day, then one submission in detail
// with the answers re-checked against the trainee's own seat, the evidence and commands, a verdict and feedback.
import type { Mission, ScenarioPack, Worksheet } from '../missions/types';
import type { ReportTrainee } from '../ui/report';
import type { BoardSub, Payload, SubResult } from '../ui/submit';
import { verdictLabel, when } from '../ui/submit';
import { esc, dayTitle } from './pages';
import { stampOf } from '../ui/activity';

export interface Presence { mission: string; ago: number }   // ago: seconds since the trainee's lab last checked in
export interface BoardData { trainees: ReportTrainee[]; openDays: number[]; generated: number; subs: BoardSub[]; redo: { email: string; act: string; note: string; at: number }[]; presence?: Record<string, Presence> }
/** Online = the lab checked in within the last 2.5 minutes (it checks in every minute). */
export const isOnline = (p?: Presence | null) => !!p && p.ago < 150;
/** "just now", "12 min ago", "3 h ago", else the date and time. */
export function ago(ms: number, now = Date.now()): string {
  if (!ms) return '';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  return s < 90 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 6 * 3600 ? `${Math.round(s / 3600)} h ago` : when(ms);
}
/** When the trainee last did something: their last save or sync, or their lab's last check-in. */
export function lastActive(d: Pick<BoardData, 'generated' | 'presence'>, t: Pick<ReportTrainee, 'email' | 'updated' | 'lastSync'>): number {
  const p = d.presence?.[t.email];
  return Math.max(t.updated || 0, t.lastSync || 0, p ? d.generated - p.ago * 1000 : 0);
}
export const traineeHref = (email: string, act?: string) => `#/trainee/${encodeURIComponent(email)}${act ? `/${act}` : ''}`;
export interface Detail {
  history: Omit<SubResult, 'act' | 'day' | 'title' | 'attempts'>[]; attempt: number; latest: boolean;
  email: string; name: string; seat: number; day: number; act: string; title: string; payload: Payload | null; redo: { note: string; at: number } | null;
}

const actNo = (m: Mission) => (m.title.match(/^Activity (\d+\.\d+)/) ?? [])[1] ?? m.id;
export const subKey = (email: string, act: string) => `${email}|${act}`;

/** Submitted and not graded yet (latest attempts), oldest first: the "Grade next" queue. */
export function waiting(d: BoardData): BoardSub[] {
  return d.subs.filter((s) => !s.verdict).sort((a, b) => a.ts - b.ts);
}

function cell(d: BoardData, t: ReportTrainee, m: Mission): string {
  const s = d.subs.find((x) => x.email === t.email && x.act === m.id);
  const redo = d.redo.find((x) => x.email === t.email && x.act === m.id);
  const steps = (t.done[m.id] ?? []).filter((id) => m.steps.some((x) => x.id === id)).length;
  const started = !!t.started[m.id] || steps > 0;
  if (!s) {
    if (!started && !redo) return '<td class="bc empty"><span class="muted">–</span></td>';
    // not submitted yet: the live work (steps done, answers typed), green dot = working on it right now
    const p = d.presence?.[t.email], now = isOnline(p) && p!.mission === m.title;
    const filled = m.worksheet ? t.filled[m.worksheet.id] ?? 0 : 0;
    return `<td class="bc"><button class="bcell live" data-email="${esc(t.email)}" data-act="${m.id}" title="${esc(`${t.name || t.email} · ${m.title} · not submitted yet${now ? ' · working on it now' : ''} · click to watch the live work`)}">
      ${now ? '<span class="dot on" aria-label="working now"></span>' : ''}${redo ? '<span class="tag warn">REDO</span>' : ''}<span class="small">${steps}/${m.steps.length} steps${filled ? ` · ${filled} ans` : ''}</span></button></td>`;
  }
  const tag = redo ? '<span class="tag warn">REDO</span>' : s.verdict === 'C' ? '<span class="tag good">C</span>' : s.verdict === 'NYC' ? '<span class="tag bad">NYC</span>' : '<span class="tag info">NEW</span>';
  return `<td class="bc"><button class="bcell" data-email="${esc(t.email)}" data-act="${m.id}" title="${esc(`${t.name || t.email} · ${m.title} · attempt ${s.attempts} · ${when(s.ts)}`)}">
    <span class="mono">${s.score}/${s.max}</span>${tag}${s.attempts > 1 ? `<span class="small muted">×${s.attempts}</span>` : ''}${s.late ? '<span class="tag">LATE</span>' : ''}</button></td>`;
}

export function boardHtml(d: BoardData, packs: ScenarioPack[], day: number): string {
  const p = packs.find((x) => x.day === day)!;
  const acts = p.missions.filter((m) => m.kind === 'activity');
  const q = waiting(d);
  const qDay = q.filter((s) => s.day === day).length;
  const subsDay = d.subs.filter((s) => s.day === day);
  const rows = d.trainees.map((t) => {
    const p = d.presence?.[t.email], last = lastActive(d, t);
    const state = isOnline(p) ? `<span class="dot on"></span>Online · ${esc(p!.mission || 'in the lab')}` : !t.signedIn ? 'never signed in' : last ? `Active ${esc(ago(last, d.generated))}` : '';
    return `<tr><td class="tcell"><a class="tname" href="${traineeHref(t.email)}" title="Open ${esc(t.name || t.email)}: live work and activity log"><b>${esc(t.name || t.email)}</b></a>
      <div class="small muted">Seat ${String(t.seat || 0).padStart(2, '0')}${t.team ? ` · ${esc(t.team)}` : ''}</div><div class="small tstate">${state}</div></td>${acts.map((m) => cell(d, t, m)).join('')}</tr>`;
  }).join('');
  const online = d.trainees.filter((t) => isOnline(d.presence?.[t.email])).length;
  return `<div class="pagehead"><div class="kicker">Trainer board · updated ${esc(when(d.generated))}</div><h2>Submissions</h2>
      <div class="meta">Click a score to open the work: answers re-checked on the trainee's seat, evidence, commands. Give a verdict and feedback, or return it for redo.
        Click a name, or a cell with steps, to watch a trainee's live work and activity log. The board updates every minute.</div></div>
    <div class="boardbar"><label class="small muted">Day <select id="bd-day">${packs.filter((x) => x.day > 0).map((x) => `<option value="${x.day}" ${x.day === day ? 'selected' : ''}>Day ${x.day} · ${esc(dayTitle(x))}${d.openDays.includes(x.day) ? ' (open today)' : ''}</option>`).join('')}</select></label>
      <span class="grow"></span>
      <button class="btn primary" id="bd-next" ${q.length ? '' : 'disabled'}>Grade next (${q.length} waiting${qDay !== q.length ? `, ${qDay} on this day` : ''})</button>
      <button class="btn" id="bd-refresh">Refresh</button><button class="btn" id="bd-csv">Download grades (CSV)</button><button class="btn" id="bd-log">Activity log (CSV)…</button><button class="btn quiet" id="bd-report">Class report</button></div>
    <div class="bstats"><span><b>${online}</b> online now</span><span><b>${new Set(subsDay.map((s) => s.email)).size}</b> of ${d.trainees.length} trainees submitted</span><span><b>${subsDay.length}</b> submissions</span>
      <span><b>${subsDay.filter((s) => s.verdict === 'C').length}</b> competent</span><span><b>${subsDay.filter((s) => !s.verdict).length}</b> to grade</span>
      <span><b>${d.redo.filter((r) => r.act.startsWith(`d${day}-`)).length}</b> returned for redo</span></div>
    <div class="bscroll"><table class="btable"><thead><tr><th>Trainee</th>${acts.map((m) => `<th title="${esc(m.title)}">${actNo(m)}<div class="small">${esc(m.title.replace(/^Activity \d+\.\d+ · /, ''))}</div></th>`).join('')}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${acts.length + 1}" class="muted">No trainees yet: add them to the Roster tab of the Google Sheet.</td></tr>`}</tbody></table></div>
    <p class="small muted"><span class="dot on"></span> working on it now · "3/5 steps · 4 ans" = not submitted yet: steps done and answers typed so far · Score = answers the lab checks automatically. <span class="tag info">NEW</span> waiting for your verdict · <span class="tag good">C</span> Competent · <span class="tag bad">NYC</span> Not Yet Competent · <span class="tag warn">REDO</span> returned to the trainee · ×2 = attempts (the latest counts) · LATE = submitted while the day's Activities were closed.</p>`;
}

/** Readable label of each answer key of a worksheet. */
function labels(ws: Worksheet): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of ws.tables ?? []) for (const r of t.rows) for (const c of t.columns) out[`${t.id}.${r.id}.${c.id}`] = [t.title, r.label ?? r.id, c.label].filter(Boolean).join(' · ');
  for (const f of ws.fields ?? []) out[f.id] = f.label;
  return out;
}

type Recheck = { auto: number; max: number; verdicts: Record<string, boolean> } | null;
/** Worksheet answers with ✓/✗ from the re-check on the trainee's seat. */
export function answersHtml(m: Mission | undefined, values: Record<string, string>, recheck: Recheck, onlyFilled = false): string {
  const lab = m?.worksheet ? labels(m.worksheet) : {};
  const keys = m?.worksheet ? Object.keys(lab) : Object.keys(values);
  const mark = (k: string) => (recheck && k in recheck.verdicts ? (recheck.verdicts[k] ? '<span class="ok">✓</span>' : '<span class="no">✗</span>') : '<span class="muted">·</span>');
  const filled = (k: string) => String(values[k] ?? '').trim() !== '';
  const empty = onlyFilled ? keys.filter((k) => !filled(k)).length : 0;
  const rows = keys.filter((k) => onlyFilled ? filled(k) : (values[k] ?? '') !== '' || (recheck && k in recheck.verdicts)).map((k) => `<tr><td class="small">${esc(lab[k] ?? k)}</td><td>${esc(values[k] ?? '') || '<span class="muted">(empty)</span>'}</td><td class="center">${mark(k)}</td></tr>`).join('');
  const more = empty ? `<p class="small muted">${empty} more ${empty === 1 ? 'answer' : 'answers'} not filled in yet.</p>` : '';
  return (rows ? `<table class="ptable"><thead><tr><th>Question</th><th>Answer</th><th>Check</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">No answers yet.</p>') + more;
}
/** Steps with a tick, and (when known) the time each one was done. */
export function stepsHtml(m: Mission, done: string[], at?: (stepId: string) => string): string {
  return `<ul class="dsteps">${m.steps.map((s) => { const d = done.includes(s.id); const t = d && at ? at(s.id) : ''; return `<li class="${d ? 'done' : ''}">${d ? '✓' : '○'} ${esc(s.text)}${t ? ` <span class="small muted">· ${esc(t)}</span>` : ''}</li>`; }).join('')}</ul>`;
}
export function evidenceHtml(list: { time: string; host: string; cmd: string; text?: string; note: string }[]): string {
  return list.map((e, i) => `<div class="ev"><div class="ev-head"><b>E${i + 1}</b> · ${esc(e.host)} · ${esc(e.time)}</div><div><code>${esc(e.cmd)}</code></div>${e.text !== undefined ? `<pre>${esc(e.text)}</pre>` : ''}<div class="small"><b>Note:</b> ${esc(e.note) || '<span class="muted">(no note)</span>'}</div></div>`).join('') || '<p class="muted">No pinned evidence.</p>';
}
export function logHtml(list: { time: string; host: string; line: string; out?: string }[]): string {
  const rows = list.map((l) => `<tr><td class="small">${esc(l.time)}</td><td class="small">${esc(l.host)}</td><td>${l.out ? `<details><summary><code>${esc(l.line)}</code></summary><pre class="log-out">${esc(l.out)}</pre></details>` : `<code>${esc(l.line)}</code>`}</td></tr>`).join('');
  return rows ? `<table class="log">${rows}</table>` : '<p class="muted">No commands recorded.</p>';
}

export function detailHtml(x: Detail, m: Mission | undefined, recheck: Recheck, nextCount: number): string {
  const p = x.payload;
  const cur = x.history.find((h) => h.attempt === x.attempt)!;
  const hist = x.history.slice().reverse().map((h) => `<button class="btn small ${h.attempt === x.attempt ? 'primary' : ''}" data-attempt="${h.attempt}">#${h.attempt}${h.attempt === x.history.length ? ' latest' : ''} · ${h.score}/${h.max}${h.verdict ? ` · ${h.verdict}` : ''}</button>`).join('');
  const mismatch = recheck && p && (recheck.auto !== cur.score || recheck.max !== cur.max);
  return `<div class="dhead"><div><div class="kicker">Seat ${String(x.seat).padStart(2, '0')} · ${esc(x.email)}</div><h2>${esc(x.name)} · ${esc(x.title)}</h2></div><button class="btn quiet" id="dt-close">Close</button></div>
    <div class="dbody">
      <div class="btnrow">${hist}</div>
      <div class="dsum">
        <div><div class="kicker">Auto score (sent)</div><b class="big">${cur.score} / ${cur.max}</b></div>
        <div><div class="kicker">Re-checked on seat ${x.seat}</div><b class="big ${mismatch ? 'no' : ''}">${recheck ? `${recheck.auto} / ${recheck.max}` : '–'}</b>${mismatch ? '<div class="small no">Differs from the score the lab sent. Trust this one.</div>' : ''}</div>
        <div><div class="kicker">Steps</div><b class="big">${p ? `${p.steps.length} / ${p.stepsTotal}` : '–'}</b></div>
        <div><div class="kicker">Demo video</div><b>${p?.watched === 'watched' ? 'Watched' : p?.watched === 'skipped' ? 'Skipped' : '–'}</b></div>
        <div><div class="kicker">Submitted</div><b>${esc(when(cur.ts))}</b>${cur.late ? ' <span class="tag">LATE</span>' : ''}</div>
      </div>
      ${x.latest ? '' : '<p class="note">You are looking at an earlier attempt. Grading saves on this attempt.</p>'}
      ${!p ? '<p class="note">The submitted work could not be read.</p>' : ''}
      <div class="dcols">
        <section><div class="label">Worksheet answers</div>${answersHtml(m, p?.ws ?? {}, recheck)}
          ${m ? `<div class="label">Steps</div>${stepsHtml(m, p?.steps ?? [])}` : ''}</section>
        <section><div class="label">Evidence (${p?.evidence.length ?? 0})</div>${evidenceHtml(p?.evidence ?? [])}
          <div class="label">Commands (${p?.log.length ?? 0})</div>${logHtml(p?.log ?? [])}</section>
      </div>
    </div>
    <form class="dgrade" id="dt-form">
      <div class="seg2 verdict">${[['C', 'Competent'], ['NYC', 'Not Yet Competent'], ['', 'Not graded']].map(([v, l]) => `<button type="button" data-v="${v}" class="${cur.verdict === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <textarea id="dt-fb" rows="2" placeholder="Feedback for the trainee (they see it in the lab)">${esc(cur.feedback)}</textarea>
      <div class="btnrow"><button class="btn primary" type="submit" data-next="0">Save</button><button class="btn" type="submit" data-next="1" ${nextCount ? '' : 'disabled'}>Save &amp; next (${nextCount})</button>
        <span class="grow"></span>
        ${x.redo ? `<span class="small">Returned for redo: ${esc(x.redo.note)}</span><button class="btn" type="button" id="dt-unredo">Cancel redo</button>` : '<button class="btn" type="button" id="dt-redo">Return for redo…</button>'}</div>
      <div id="dt-redo-box" hidden><textarea id="dt-redo-note" rows="2" placeholder="What should the trainee fix? (they see this note)"></textarea><button class="btn" type="button" id="dt-redo-send">Return to the trainee</button></div>
      <p class="err small" id="dt-err"></p>
    </form>`;
}

/** Grades for every trainee and activity (latest attempt), one row per trainee. */
export function gradesCsv(d: BoardData, packs: ScenarioPack[]): string {
  const acts = packs.filter((p) => p.day > 0).flatMap((p) => p.missions.filter((m) => m.kind === 'activity'));
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Email', 'Name', 'Seat', 'Team', ...acts.flatMap((m) => [`${actNo(m)} Score`, `${actNo(m)} Verdict`, `${actNo(m)} Attempts`, `${actNo(m)} Submitted (date & time)`, `${actNo(m)} Graded (date & time)`])];
  const rows = d.trainees.map((t) => [t.email, t.name, t.seat, t.team, ...acts.flatMap((m) => {
    const s = d.subs.find((x) => x.email === t.email && x.act === m.id);
    return s ? [`${s.score}/${s.max}`, s.verdict ? verdictLabel(s.verdict) : 'Not graded', s.attempts, stampOf(s.ts), stampOf(s.gradedAt)] : ['', '', '', '', ''];
  })]);
  return [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
}
