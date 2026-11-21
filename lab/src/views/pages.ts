// The lab's pages other than the work page: Home, Day (Activities / Lesson / Files) and My progress.
// Pure HTML builders; main.ts wires the links (hash routes) and the few buttons.
import type { Mission, ScenarioPack } from '../missions/types';
import type { LabState } from '../ui/store';
import { dayVideos, videoTitle, watchFor } from '../missions/watch';
import { verdictLabel, when, type SubResult } from '../ui/submit';

export interface LessonPart { h: string; html: string; videos: string[] }
export interface DayFile { name: string; href: string; size: string }
export interface Lesson { day: number; title: string; unit?: string; parts: LessonPart[]; files: DayFile[] }

export interface PageCtx {
  packs: ScenarioPack[];
  st: LabState;
  lessons: Record<number, Lesson>;
  activityOpen(day: number): boolean;
  gateReason(day: number): string;
  activityDone(m: Mission): boolean;
  openToday(day: number): boolean;
  score(m: Mission): { ok: number; total: number } | null;
  sub(m: Mission): SubResult | undefined;               // the latest submission (online, after the server has answered)
  redo(m: Mission): { note: string; at: number } | undefined;
  /** Trainer accounts: the class results of an activity (from the Trainer board), or null while loading. */
  trainer: boolean;
  cls(m: Mission): { submitted: number; trainees: number; waiting: number; c: number; nyc: number; redo: number } | null;
}

export const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const code = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const chev = '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const lock = '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

export const dayTitle = (p: ScenarioPack) => p.title.replace(/^Day \d+ · /, '');
const actNo = (m: Mission) => (m.title.match(/^Activity (\d+\.\d+)/) ?? [])[1] ?? '';
const actName = (m: Mission) => m.title.replace(/^Activity \d+\.\d+ · /, '').replace(/^Practice: /, '');
const stepsDone = (st: LabState, m: Mission) => m.steps.filter((s) => (st.done[m.id] ?? []).includes(s.id)).length;
export const missionHref = (m: Mission) => `#/m/${m.id}`;

/** Status tags of one activity row. */
function actStatus(c: PageCtx, m: Mission): string {
  if (c.trainer) {
    const k = c.cls(m);
    if (!k) return '<span class="muted">Loading the class…</span>';
    return `<span class="cls"><span><b>${k.submitted}</b>/${k.trainees} submitted</span>${k.waiting ? `<span class="tag info">${k.waiting} TO GRADE</span>` : ''}${k.c ? `<span class="tag good">${k.c} C</span>` : ''}${k.nyc ? `<span class="tag bad">${k.nyc} NYC</span>` : ''}${k.redo ? `<span class="tag warn">${k.redo} REDO</span>` : ''}</span>`;
  }
  const sub = c.sub(m), redo = c.redo(m);
  if (redo) return '<span class="tag warn">REDO</span><span>Your trainer returned it: fix it and submit again</span>';
  if (sub) return `<span class="tag good">SUBMITTED</span><span>${sub.score}/${sub.max}</span>${sub.verdict ? `<span class="tag ${sub.verdict === 'C' ? 'good' : 'bad'}">${verdictLabel(sub.verdict)}</span>` : '<span class="muted">waiting for trainer</span>'}`;
  if (!c.activityOpen(m.day)) return '<span class="tag">CLOSED</span><span class="muted">Opens when your trainer starts it</span>';
  const sc = c.score(m);
  if (c.activityDone(m)) return `<span class="tag good">FINISHED</span>${sc ? `<span>${sc.ok}/${sc.total} correct</span>` : ''}`;
  const d = stepsDone(c.st, m), ws = m.worksheet && Object.values(c.st.ws[m.worksheet.id] ?? {}).some((v) => v);
  if (d || ws || c.st.watched?.[m.id]) return `<span class="tag info">IN PROGRESS</span><span>${d}/${m.steps.length} steps${sc ? ` · ${sc.ok}/${sc.total} correct` : ''}</span>`;
  return '<span class="tag">NOT STARTED</span>';
}

/** The trainer's redo note or feedback under an activity row. */
function rowNote(c: PageCtx, m: Mission): string {
  if (c.trainer) return '';
  const redo = c.redo(m), sub = c.sub(m);
  if (redo) return `<div class="feedback redo">Your trainer: ${esc(redo.note || 'please redo this activity.')}</div>`;
  if (sub?.feedback) return `<div class="feedback">Trainer feedback: ${esc(sub.feedback)}</div>`;
  return '';
}

export function homeHtml(c: PageCtx): string {
  const days = c.packs.filter((p) => p.day > 0);
  const rows = days.map((p) => {
    const acts = p.missions.filter((m) => m.kind === 'activity');
    const fin = acts.filter((m) => c.activityDone(m)).length;
    const status = `${c.openToday(p.day) ? '<span class="tag solid">OPEN TODAY</span>' : ''}${fin === acts.length && acts.length ? '<span class="tag good">FINISHED</span>' : ''}<span>${fin} of ${acts.length} activities finished</span>`;
    const L = c.lessons[p.day];
    return `<a class="row daysrow" href="#/day/${p.day}">
      <div class="num">Day ${p.day}</div>
      <div><div class="title">${esc(dayTitle(p))}</div>${L?.unit ? `<div class="sub">${esc(L.unit)}</div>` : ''}<span class="bar" style="width:160px"><span style="width:${acts.length ? Math.round(100 * fin / acts.length) : 0}%"></span></span></div>
      <div class="status">${status}</div><div class="chev">${chev}</div></a>`;
  }).join('');
  const st = c.st;
  return `<div class="pagehead"><div class="kicker">Cyber Threat Monitoring Level I</div><h2>Welcome, ${esc(st.name.split(' ')[0] || st.name)}</h2>
      <div class="meta">Seat ${String(st.seat).padStart(2, '0')} · Each day: watch the demo videos, practise them on the demo hosts, then do the activities on your own hosts.</div></div>
    <div class="toolrow"><a class="btn" href="#/workspace">Open the Workspace (free practice)</a><a class="btn quiet" href="#/progress">My progress</a></div>
    <div class="label">Training days</div><div class="list">${rows}</div>`;
}

/** Day page tabs. */
export function dayTabs(c: PageCtx, day: number, on: 'acts' | 'lesson' | 'files'): string {
  const L = c.lessons[day];
  const t = (k: string, href: string, label: string) => `<a class="${on === k ? 'on' : ''}" href="${href}">${label}</a>`;
  return `<nav class="daytabs">${t('acts', `#/day/${day}`, 'Activities')}${L?.parts.length ? t('lesson', `#/lesson/${day}`, 'Lesson') : ''}${t('files', `#/files/${day}`, 'Files')}</nav>`;
}

export function dayHtml(c: PageCtx, day: number): string {
  const p = c.packs.find((x) => x.day === day)!;
  const acts = p.missions.filter((m) => m.kind === 'activity');
  const prac = p.missions.filter((m) => m.kind === 'practice');
  const fin = acts.filter((m) => c.activityDone(m)).length;
  const closed = acts.length > 0 && !c.activityOpen(day);
  const head = `<div class="listhead actsrow"><div>No.</div><div>Activity</div><div class="c-mode">Mode</div><div class="c-min">Time</div><div>Status</div><div></div></div>`;
  const actRows = acts.map((m) => {
    const open = c.activityOpen(m.day);
    const w = watchFor(m, p);
    return `<${open ? 'a' : 'div'} class="row actsrow${open ? '' : ' closed'}" ${open ? `href="${missionHref(m)}"` : ''} data-m="${m.id}">
      <div class="num">${actNo(m)}</div><div><div class="title">${esc(actName(m))}</div>${w.length ? `<div class="sub">▶ Watch first: ${esc(w.map((f) => videoTitle(f).replace(/ · .*/, '')).join(', '))}${c.st.watched?.[m.id] === 'watched' ? ' ✓' : ''}</div>` : ''}</div>
      <div class="sub c-mode">${esc(m.subtitle.replace(/ · \d+ min$/, ''))}</div><div class="sub c-min">${m.minutes ? `${m.minutes} min` : ''}</div>
      <div class="status">${actStatus(c, m)}</div><div class="chev">${open ? chev : lock}</div>${rowNote(c, m)}</${open ? 'a' : 'div'}>`;
  }).join('');
  const pracRows = prac.map((m, i) => {
    const d = stepsDone(c.st, m), n = m.steps.length;
    return `<a class="row actsrow" href="${missionHref(m)}" data-m="${m.id}">
      <div class="num">D${i + 1}</div><div><div class="title">${esc(actName(m))}</div><div class="sub">${esc(m.subtitle)}</div></div>
      <div class="sub c-mode">Demo hosts</div><div class="sub c-min">${m.minutes ? `${m.minutes} min` : ''}</div>
      <div class="status">${d === n && n ? '<span class="tag good">DONE</span>' : d ? `<span class="tag info">${d}/${n} steps</span>` : '<span class="tag">NOT STARTED</span>'}${m.video && c.st.videos?.[m.video] ? '<span class="muted">video ✓</span>' : ''}</div><div class="chev">${chev}</div></a>`;
  }).join('');
  const vids = dayVideos(p);
  const L = c.lessons[day];
  return `${dayTabs(c, day, 'acts')}
    ${c.trainer ? `<p class="note info trainer-banner"><b>Trainer view.</b> The status column shows the class. Open an activity or practice to preview it as a trainee (your own work is not graded).<a class="btn small" href="#/board/${day}">Open Day ${day} on the Trainer board</a></p>` : ''}
    <div class="pagehead"><div class="kicker">Day ${day}${L?.unit ? ` · ${esc(L.unit)}` : ''}</div><h2>${esc(dayTitle(p))}</h2>
      <div class="meta">${c.trainer ? `${c.openToday(day) ? 'Activities open today (Settings › Open Days)' : 'Activities closed for trainees today (Settings › Open Days in the Sheet)'}` : `${fin} of ${acts.length} activities finished`}</div></div>
    <div class="toolrow">${L?.parts.length ? `<a class="btn primary" href="#/lesson/${day}">Read the lesson</a>` : ''}${vids.length ? `<button class="btn" id="btn-day-videos">▶ Watch the demo videos (${vids.length})</button>` : ''}
      ${c.trainer ? '' : '<button class="btn quiet" id="btn-day-export">Export notebook</button>'}</div>
    ${prac.length ? `<div class="label">Practice the demos · on the demo hosts</div><div class="list">${pracRows}</div>` : ''}
    <div class="label">Activities · on your own hosts</div>
    ${closed ? `<p class="gate-note">🔒 ${esc(c.gateReason(day))}</p>` : ''}
    ${c.trainer ? '' : `<p class="small muted" style="margin:6px auto">An activity is finished when every step is done and you have pressed <b>Check my answers</b>. Then press <b>Submit</b> to turn it in to your trainer (you can submit again; the latest counts).</p>`}
    ${head}<div class="list">${actRows}</div>`;
}

export function lessonHtml(c: PageCtx, day: number, k: number): string {
  const L = c.lessons[day], p = c.packs.find((x) => x.day === day)!;
  const parts = L.parts;
  const read = new Set(c.st.lessonRead?.[day] ?? []);
  const it = parts[k];
  const pct = Math.round(100 * read.size / parts.length);
  const toc = parts.map((x, i) => `<li><a href="#/lesson/${day}/${i}" class="${i === k ? 'on' : ''}" ${i === k ? 'aria-current="page"' : ''}><span class="tk">${read.has(i) ? '✓' : ''}</span><span class="tt">${esc(x.h)}</span>${x.videos.length ? '<span class="tag info">VIDEO</span>' : ''}</a></li>`).join('');
  const prev = k > 0 ? `<a class="btn" href="#/lesson/${day}/${k - 1}">‹ Previous</a>` : '<span></span>';
  const next = k < parts.length - 1 ? `<a class="btn primary" href="#/lesson/${day}/${k + 1}">Next: ${esc(parts[k + 1].h)} ›</a>` : `<a class="btn primary" href="#/day/${day}">Finish: go to the activities ›</a>`;
  const video = it.videos.map((v) => `<div class="vbox"><div class="vhead"><div class="vlabel">Watch it in the lab</div><div class="vtitle">${esc(videoTitle(v))}</div><div class="vsub">The demonstration for this part. Then practise it on the demo hosts (Day ${day} › Practice).</div></div>
      <video controls preload="none" data-video="${esc(v)}" src="videos/${esc(v)}"><track kind="captions" srclang="en" label="English" src="videos/${esc(v.replace(/\.mp4$/, '.vtt'))}" default></video></div>`).join('');
  return `${dayTabs(c, day, 'lesson')}
    <div class="pagehead"><div class="kicker">Day ${day} lesson</div><h2>${esc(dayTitle(p))}</h2>
      <div class="lprog"><span class="bar"><span style="width:${pct}%"></span></span><span class="small muted">${read.size} of ${parts.length} parts read</span></div></div>
    <div class="lreader"><aside><details class="tocbox" ${typeof window !== 'undefined' && window.innerWidth > 760 ? 'open' : ''}><summary>Contents <span class="small muted">Part ${k + 1} of ${parts.length}</span></summary><ol class="toc">${toc}</ol></details></aside>
      <article class="lpart"><div class="lpart-head"><div class="kicker">Part ${k + 1} of ${parts.length}</div><h2>${esc(it.h)}</h2></div>
        <div class="prose">${it.html}</div>${video}<div class="lnav">${prev}${next}</div></article></div>`;
}

export function filesHtml(c: PageCtx, day: number): string {
  const L = c.lessons[day], p = c.packs.find((x) => x.day === day)!;
  const files = (L?.files ?? []).map((f) => `<a class="row" href="${esc(f.href)}" target="_blank" rel="noopener"><span>📄</span><div><div class="title">${esc(f.name)}</div><div class="sub">PDF · ${esc(f.size)} · opens in a new tab</div></div><span class="chev">${chev}</span></a>`).join('');
  return `${dayTabs(c, day, 'files')}
    <div class="pagehead"><div class="kicker">Day ${day}</div><h2>Files · ${esc(dayTitle(p))}</h2></div>
    <div class="label">Documents</div><div class="list files">${files || '<div class="row"><span></span><div class="muted">No documents for this day yet.</div><span></span></div>'}</div>
    <div class="label">Lab files</div>
    <div class="panel panel-pad"><p>The activity files are already inside your lab hosts. Open them from the terminal:</p>
      <p>Ubuntu: <code>ls ~/day${day}</code> then <code>cat ~/day${day}/&lt;file&gt;</code></p>
      <p>Windows PowerShell: <code>Get-ChildItem day${day}</code> then <code>Get-Content day${day}\\&lt;file&gt;</code></p>
      <p class="small muted">Practice missions use the demo folders (<code>~/demo${day}</code>, <code>demo${day}\\</code>).</p></div>`;
}

export function progressHtml(c: PageCtx): string {
  const rows = c.packs.filter((p) => p.day > 0).map((p) => {
    const acts = p.missions.filter((m) => m.kind === 'activity');
    return acts.map((m, i) => {
      const sc = c.score(m);
      return `<tr>${i === 0 ? `<td rowspan="${acts.length}"><a href="#/day/${p.day}"><b>Day ${p.day}</b></a><div class="small muted">${esc(dayTitle(p))}</div></td>` : ''}
        <td>${c.activityOpen(p.day) ? `<a href="${missionHref(m)}">${esc(m.title)}</a>` : esc(m.title)}</td>
        <td>${stepsDone(c.st, m)}/${m.steps.length}</td><td>${sc ? `${sc.ok}/${sc.total}` : '–'}</td>
        <td>${(() => { const s = c.sub(m), r = c.redo(m); return r ? `<span class="tag warn">REDO</span> <span class="small">${esc(r.note)}</span>` : s ? `${s.score}/${s.max} · ${esc(when(s.ts))}${s.verdict ? ` <span class="tag ${s.verdict === 'C' ? 'good' : 'bad'}">${verdictLabel(s.verdict)}</span>` : ''}${s.feedback ? `<div class="small">${esc(s.feedback)}</div>` : ''}` : '–'; })()}</td>
        <td>${c.activityDone(m) ? '<span class="tag good">FINISHED</span>' : '<span class="tag">NOT FINISHED</span>'}</td></tr>`;
    }).join('');
  }).join('');
  return `<div class="pagehead"><div class="kicker">${esc(c.st.name)} · Seat ${String(c.st.seat).padStart(2, '0')}</div><h2>My progress</h2>
    <div class="meta">Steps done, checked answers and finished activities for every day. Commands run: ${c.st.log.length}. Evidence pinned: ${c.st.evidence.length}.</div></div>
    <table class="ptable"><thead><tr><th>Day</th><th>Activity</th><th>Steps</th><th>Correct</th><th>Submitted</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}
