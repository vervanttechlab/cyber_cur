// Submitting an activity to the trainer (sync/Code.gs: submit, mine, board, submission, grade, redo).
// The lab scores the worksheet with the same graders the trainee sees; the trainer board grades the submitted answers
// again with the trainee's own seat (seat hosts are rebuilt from the seat number), so a changed score shows up there.
import type { GradeCtx, Mission, Worksheet } from '../missions/types';
import type { LabState } from './store';

export interface SubResult { act: string; day: number; title: string; attempt: number; attempts: number; ts: number; score: number; max: number; verdict: '' | 'C' | 'NYC'; feedback: string; gradedAt: number; late: boolean }
export interface MySubs { latest: Record<string, SubResult>; redo: Record<string, { note: string; at: number }> }
export interface BoardSub extends SubResult { email: string }
export interface Payload {
  v: 1; act: string; title: string; seat: number;
  ws: Record<string, string>; auto: number; max: number; verdicts: Record<string, boolean>;
  steps: string[]; stepsTotal: number; watched: string; started: number;
  evidence: { time: string; host: string; cmd: string; text: string; note: string }[];
  log: { time: string; host: string; line: string; out?: string }[];
}

/** Every answer key of a worksheet (table cells and fields). */
export function fieldKeys(ws: Worksheet): string[] {
  const keys: string[] = [];
  for (const t of ws.tables ?? []) for (const r of t.rows) for (const c of t.columns) keys.push(`${t.id}.${r.id}.${c.id}`);
  for (const f of ws.fields ?? []) keys.push(f.id);
  return keys;
}

/** Auto score: answers the grader marks correct, out of every answer it can check (an empty answer counts as wrong). */
export function autoScore(ws: Worksheet, values: Record<string, string>, ctx: GradeCtx): { auto: number; max: number; verdicts: Record<string, boolean> } {
  if (!ws.grade) return { auto: 0, max: 0, verdicts: {} };
  const gradable = Object.keys(ws.grade(Object.fromEntries(fieldKeys(ws).map((k) => [k, 'x'])), ctx)).filter((k) => !k.startsWith('_'));
  const g = ws.grade(values, ctx);
  const verdicts: Record<string, boolean> = {};
  for (const k of gradable) verdicts[k] = !!g[k]?.ok;
  return { auto: gradable.filter((k) => verdicts[k]).length, max: gradable.length, verdicts };
}

/** The work a trainee turns in for one activity: answers, score, steps, evidence and commands (with outputs, newest first within a budget). */
export function buildPayload(st: LabState, m: Mission, ctx: GradeCtx, outputBudget = 150000): Payload {
  const ws = m.worksheet;
  const values = ws ? { ...(st.ws[ws.id] ?? {}) } : {};
  const sc = ws ? autoScore(ws, values, ctx) : { auto: 0, max: 0, verdicts: {} };
  let budget = outputBudget;
  const log = st.log.filter((l) => l.mission === m.title).slice().reverse().map((l) => {
    const e: Payload['log'][number] = { time: l.time, host: l.host, line: l.line };
    if (l.out && l.out.length <= budget) { e.out = l.out; budget -= l.out.length; }
    return e;
  }).reverse();
  return {
    v: 1, act: m.id, title: m.title, seat: st.seat, ws: values, auto: sc.auto, max: sc.max, verdicts: sc.verdicts,
    steps: [...(st.done[m.id] ?? [])], stepsTotal: m.steps.length, watched: st.watched?.[m.id] ?? '', started: st.started?.[m.id] ?? 0,
    evidence: st.evidence.filter((e) => e.mission === m.title).map((e) => ({ time: e.time, host: e.host, cmd: e.cmd, text: e.text, note: e.note })),
    log,
  };
}

export const verdictLabel = (v: string) => (v === 'C' ? 'COMPETENT' : v === 'NYC' ? 'NOT YET COMPETENT' : '');
export const when = (ms: number) => (ms ? new Date(ms).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '');
