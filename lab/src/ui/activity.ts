// The trainer's activity log: every dated thing a trainee did in the lab (sign-ins, lessons, videos, missions started,
// steps, commands, evidence, answer checks, finished missions, submissions, grades), built from the saved lab state
// and the server's Sync Log (sync/Code.gs: trainee, classLog). Plain functions, so they can be unit-tested.
// Used by the trainee page (src/views/monitor.ts) and by the two CSV exports on the Trainer board.
import type { Mission, ScenarioPack } from '../missions/types';
import type { CheckEntry } from './store';
import type { BoardSub } from './submit';

/** What the server sends about one trainee (classLog: command lines without output; trainee: the full state). */
export interface LogState {
  seat?: number; missionId?: string;
  done?: Record<string, string[]>; started?: Record<string, number>; finished?: Record<string, number>; stepAt?: Record<string, number>;
  checked?: Record<string, boolean>; checks?: CheckEntry[];
  videos?: Record<string, number>; watched?: Record<string, string>; watchedAt?: Record<string, number>;
  lessonRead?: Record<string, number[]>; lessonAt?: Record<string, number>;
  log?: { at?: number; time: string; host: string; line: string; mission: string; day?: number; out?: string }[];
  evidence?: { at?: number; time: string; host: string; cmd: string; note: string; mission: string; day?: number; text?: string }[];
  ws?: Record<string, Record<string, string>>;
}
export interface SrvEvent { at: number; event: string; detail: string; by: string }
export interface LogTrainee { email: string; name: string; seat: number; team?: string; signedIn: boolean; firstSignIn: number; lastSync: number; state: LogState | null; events: SrvEvent[] }
export interface ClassLog { day: number; generated: number; subs: BoardSub[]; trainees: LogTrainee[] }

export type Kind = 'signin' | 'lesson' | 'video' | 'start' | 'step' | 'command' | 'evidence' | 'check' | 'finish' | 'submit' | 'grade' | 'redo';
export const KIND_LABEL: Record<Kind, string> = {
  signin: 'Signed in', lesson: 'Lesson', video: 'Video', start: 'Started', step: 'Step done', command: 'Command', evidence: 'Evidence',
  check: 'Checked answers', finish: 'Finished', submit: 'Submitted', grade: 'Graded', redo: 'Redo',
};
/** Filter chips on the trainee page: which kinds each one shows. */
export const FILTERS: { id: string; label: string; kinds: Kind[] }[] = [
  { id: 'all', label: 'All', kinds: [] },
  { id: 'done', label: 'Accomplished', kinds: ['step', 'check', 'finish', 'submit', 'grade', 'redo'] },
  { id: 'learn', label: 'Lessons & videos', kinds: ['lesson', 'video'] },
  { id: 'work', label: 'Commands & evidence', kinds: ['command', 'evidence'] },
  { id: 'signin', label: 'Sign-ins', kinds: ['signin', 'start'] },
];

export interface ActEvent {
  at: number;            // ms
  kind: Kind;
  day: number;           // 0 = not tied to a day (sign-in)
  mission: string;       // mission title ('' if none)
  text: string;
  host?: string;
  out?: string;          // command output (trainee page only)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The time the lab shows next to a command ("Nov 12, 3:04:05 PM", no year) as ms; 0 if it cannot be read.
 *  The year is the one that puts it closest before ref (a date more than 2 days after ref belongs to last year). */
export function parseLabTime(s: string, ref = Date.now()): number {
  const m = String(s || '').match(/^([A-Z][a-z]{2}) (\d{1,2}),[\s  ]+(\d{1,2}):(\d{2})(?::(\d{2}))?[\s  ]*([AP]M)$/i);
  if (!m) return 0;
  const mon = MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
  if (mon < 0) return 0;
  const h = (Number(m[3]) % 12) + (m[6].toUpperCase() === 'PM' ? 12 : 0);
  const y = new Date(ref).getFullYear();
  let t = new Date(y, mon, Number(m[2]), h, Number(m[4]), Number(m[5] ?? 0)).getTime();
  if (t > ref + 2 * 86400000) t = new Date(y - 1, mon, Number(m[2]), h, Number(m[4]), Number(m[5] ?? 0)).getTime();
  return t;
}

const dayOfId = (id: string) => Number((id.match(/^d(\d+)-/) ?? [])[1] ?? 0);
const dayOfVideo = (f: string) => Number((f.match(/^Day0?(\d+)_/) ?? [])[1] ?? 0);
export const videoName = (f: string) => f.replace(/\.mp4$/, '').replace(/^Day\d+_/, '').replace(/_/g, ' ');
const actNo = (title: string) => title.replace(/ · .*$/, '');

/** Every dated event of one trainee, oldest first. Events without a known time are left out. */
export function timeline(t: Pick<LogTrainee, 'state' | 'events'>, packs: ScenarioPack[], lessonTitle?: (day: number, part: number) => string): ActEvent[] {
  const all = packs.flatMap((p) => p.missions);
  const byId = new Map(all.map((m) => [m.id, m] as [string, Mission]));
  const byTitle = new Map(all.map((m) => [m.title, m] as [string, Mission]));
  const s = t.state ?? {};
  const out: ActEvent[] = [];
  const add = (e: ActEvent) => { if (e.at > 0) out.push(e); };
  const mt = (id: string) => byId.get(id)?.title ?? id;

  for (const e of t.events ?? []) {
    const act = (e.detail.match(/d\d+-act\d+\.\d/) ?? [])[0] ?? '';
    const title = act ? mt(act) : '';
    if (e.event === 'Signed in') add({ at: e.at, kind: 'signin', day: 0, mission: '', text: `Signed in (${e.detail})` });
    else if (e.event === 'Submitted') add({ at: e.at, kind: 'submit', day: dayOfId(act), mission: title, text: `Submitted ${actNo(title)}: ${e.detail.replace(act, '').trim()}` });
    else if (e.event === 'Graded') {
      const v = (e.detail.match(/: (C|NYC|-)$/) ?? [])[1];
      add({ at: e.at, kind: 'grade', day: dayOfId(act), mission: title, text: `Trainer graded ${actNo(title)}: ${v === 'C' ? 'Competent' : v === 'NYC' ? 'Not Yet Competent' : 'verdict removed'}` });
    } else if (e.event === 'Returned for redo') add({ at: e.at, kind: 'redo', day: dayOfId(act), mission: title, text: `Trainer returned ${actNo(title)} for redo` });
    else if (e.event === 'Redo cancelled') add({ at: e.at, kind: 'redo', day: dayOfId(act), mission: title, text: `Trainer cancelled the redo of ${actNo(title)}` });
  }
  for (const [k, at] of Object.entries(s.lessonAt ?? {})) {
    const [d, p] = k.split('|').map(Number);
    add({ at, kind: 'lesson', day: d, mission: '', text: `Opened lesson part ${p + 1}${lessonTitle ? `: ${lessonTitle(d, p)}` : ''}` });
  }
  for (const [f, at] of Object.entries(s.videos ?? {})) add({ at, kind: 'video', day: dayOfVideo(f), mission: '', text: `Played video: ${videoName(f)}` });
  for (const [id, at] of Object.entries(s.watchedAt ?? {})) add({ at, kind: 'video', day: dayOfId(id), mission: mt(id), text: s.watched?.[id] === 'skipped' ? 'Skipped the Watch first video' : 'Watched the Watch first video to the end' });
  for (const [id, at] of Object.entries(s.started ?? {})) add({ at, kind: 'start', day: dayOfId(id), mission: mt(id), text: `Started ${mt(id)}` });
  for (const [k, at] of Object.entries(s.stepAt ?? {})) {
    const [id, step] = k.split('|');
    const st = byId.get(id)?.steps.find((x) => x.id === step);
    add({ at, kind: 'step', day: dayOfId(id), mission: mt(id), text: st ? st.text : step });
  }
  for (const c of s.checks ?? []) add({ at: c.at, kind: 'check', day: dayOfId(c.mission), mission: mt(c.mission), text: `Checked answers: ${c.ok} of ${c.total} correct` });
  for (const [id, at] of Object.entries(s.finished ?? {})) add({ at, kind: 'finish', day: dayOfId(id), mission: mt(id), text: `Finished ${mt(id)}` });
  const ref = Date.now();
  for (const l of s.log ?? []) {
    const at = l.at || parseLabTime(l.time, ref);
    add({ at, kind: 'command', day: l.day ?? byTitle.get(l.mission)?.day ?? 2, mission: l.mission, text: l.line, host: l.host, out: l.out });
  }
  for (const e of s.evidence ?? []) {
    const at = e.at || parseLabTime(e.time, ref);
    add({ at, kind: 'evidence', day: e.day ?? byTitle.get(e.mission)?.day ?? 2, mission: e.mission, text: `Pinned evidence: ${e.cmd}${e.note ? ` (note: ${e.note})` : ''}`, host: e.host });
  }
  return out.sort((a, b) => a.at - b.at);
}

// ------------------------------------------------------------------ date and time for the exports
const pad = (n: number) => String(n).padStart(2, '0');
/** "2026-11-12" (local time; Excel and Google Sheets read it as a date). */
export const dateOf = (ms: number) => { if (!ms) return ''; const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
/** "3:04:05 PM" (local time). */
export const timeOf = (ms: number) => { if (!ms) return ''; const d = new Date(ms); return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getHours() < 12 ? 'AM' : 'PM'}`; };
/** "2026-11-12 3:04 PM" for one-cell date-and-time columns. */
export const stampOf = (ms: number) => (ms ? `${dateOf(ms)} ${timeOf(ms).replace(/:\d\d (?=[AP]M)/, ' ')}` : '');

const q = (v: unknown) => { const x = String(v ?? ''); return /[",\r\n]/.test(x) || /^[=+\-@]/.test(x) ? `"${(/^[=+\-@]/.test(x) ? "'" : '') + x.replace(/"/g, '""')}"` : x; };
// no BOM here: download() in ui/export.ts adds it (so Excel reads ñ and other accents correctly)
const csv = (rows: unknown[][]) => rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
const bySeat = (a: LogTrainee, b: LogTrainee) => (a.seat || 99) - (b.seat || 99) || a.email.localeCompare(b.email);

/** One row per event, every trainee, with its date and time. kinds = [] keeps every kind. */
export function activityLogCsv(data: ClassLog, packs: ScenarioPack[], kinds: Kind[] = []): string {
  const head = ['Date', 'Time', 'Seat', 'Full Name', 'Email', 'Team', 'Day', 'Activity / Mission', 'Event', 'Details', 'Host'];
  const rows: unknown[][] = [];
  for (const t of data.trainees.slice().sort(bySeat)) {
    for (const e of timeline(t, packs)) {
      if (data.day && e.day && e.day !== data.day) continue;
      if (kinds.length && !kinds.includes(e.kind)) continue;
      rows.push([dateOf(e.at), timeOf(e.at), t.seat || '', t.name, t.email, t.team ?? '', e.day || '', e.mission, KIND_LABEL[e.kind], e.text, e.host ?? '']);
    }
  }
  return csv([head, ...rows]);
}

/** One row per trainee and mission they worked on: what they accomplished, and when (start, finish, checks, submission, grade). */
export function accomplishmentsCsv(data: ClassLog, packs: ScenarioPack[]): string {
  const ms = packs.filter((p) => p.day > 0 && (!data.day || p.day === data.day)).flatMap((p) => p.missions.filter((m) => m.kind !== 'workspace'));
  const head = ['Seat', 'Full Name', 'Email', 'Team', 'Day', 'Type', 'Activity / Mission', 'Started (date & time)', 'Steps Done', 'Steps Total',
    'Last Step Done (date & time)', 'Answer Checks', 'Last Check Score', 'Last Check (date & time)', 'Finished (date & time)', 'Commands Run',
    'Evidence Pinned', 'Submitted (date & time)', 'Attempts', 'Auto Score', 'Verdict', 'Graded (date & time)', 'Status'];
  const rows: unknown[][] = [];
  for (const t of data.trainees.slice().sort(bySeat)) {
    const s = t.state ?? {};
    for (const m of ms) {
      const done = (s.done?.[m.id] ?? []).filter((id) => m.steps.some((x) => x.id === id));
      const stepTimes = done.map((id) => s.stepAt?.[`${m.id}|${id}`] ?? 0).filter(Boolean);
      const checks = (s.checks ?? []).filter((c) => c.mission === m.id);
      const last = checks[checks.length - 1];
      const cmds = (s.log ?? []).filter((l) => l.mission === m.title).length;
      const ev = (s.evidence ?? []).filter((e) => e.mission === m.title).length;
      const sub = data.subs.filter((x) => x.email === t.email && x.act === m.id).sort((a, b) => a.ts - b.ts).pop();
      const started = s.started?.[m.id] ?? 0;
      if (!started && !done.length && !cmds && !sub && !checks.length) continue; // not worked on
      const fin = s.finished?.[m.id];
      const finished = fin !== undefined || (done.length === m.steps.length && (!m.worksheet || !!s.checked?.[m.worksheet.id]));
      const status = sub?.verdict === 'C' ? 'Competent' : sub?.verdict === 'NYC' ? 'Not Yet Competent' : sub ? 'Submitted, not graded' : finished ? 'Finished' : 'In progress';
      rows.push([t.seat || '', t.name, t.email, t.team ?? '', m.day, m.kind === 'activity' ? 'Activity' : 'Practice', m.title, stampOf(started), done.length, m.steps.length,
        stampOf(stepTimes.length ? Math.max(...stepTimes) : 0), checks.length || (m.worksheet && s.checked?.[m.worksheet.id] ? 'yes' : ''), last ? `${last.ok}/${last.total}` : '', stampOf(last?.at ?? 0),
        finished ? stampOf(fin ?? 0) || 'yes (time not recorded)' : '', cmds, ev, stampOf(sub?.ts ?? 0), sub?.attempts ?? '', sub ? `${sub.score}/${sub.max}` : '',
        sub?.verdict === 'C' ? 'Competent' : sub?.verdict === 'NYC' ? 'Not Yet Competent' : sub ? 'Not graded' : '', stampOf(sub?.gradedAt ?? 0), status]);
    }
  }
  return csv([head, ...rows]);
}
