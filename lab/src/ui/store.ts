// Per-trainee lab state, saved in the browser (or the Electron app's storage). Never required to work:
// if storage is blocked the lab still runs, it just won't remember progress after a reload.

// time: what the trainee sees ("Nov 12, 3:04:05 PM"); at: the same moment in ms, for the trainer's dated activity log (older entries have no at)
export interface Evidence { id: string; time: string; at?: number; host: string; cmd: string; text: string; note: string; mission: string; day?: number }
export interface LogEntry { time: string; at?: number; host: string; line: string; mission: string; day?: number; out?: string } // out: what the terminal showed (clipped)
/** One press of "Check my answers": which mission, when, and the score then. */
export interface CheckEntry { mission: string; at: number; ok: number; total: number }

/** Keep a command's output for the notebook export: at most 40 lines / 3000 characters. */
export function clipOutput(text: string): string {
  const all = text.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '').replace(/\n+$/, '');
  const lines = all.split('\n');
  let out = lines.slice(0, 40).join('\n');
  if (out.length > 3000) out = out.slice(0, 3000).replace(/\n[^\n]*$/, '');
  if (out === all) return all;
  const rest = lines.length - out.split('\n').length;
  return `${out}\n… (${rest > 0 ? `${rest} more line${rest === 1 ? '' : 's'}` : 'the rest of the line'} not kept: pin the output as evidence to keep all of it)`;
}

/** Each day keeps its newest 150 commands (one long day never pushes out the earlier days). */
export function trimLog(log: LogEntry[], perDay = 150): LogEntry[] {
  const seen: Record<string, number> = {};
  const keep = new Array<boolean>(log.length);
  for (let i = log.length - 1; i >= 0; i--) { const d = String(log[i].day ?? 2); seen[d] = (seen[d] ?? 0) + 1; keep[i] = seen[d] <= perDay; }
  return log.filter((_, i) => keep[i]);
}

export interface LabState {
  version: 1;
  name: string;
  seat: number;
  missionId: string;
  done: Record<string, string[]>;               // missionId -> completed step ids
  ws: Record<string, Record<string, string>>;   // worksheetId -> field -> value
  evidence: Evidence[];
  notes: string;
  scratch?: string;
  email?: string;                               // set when signed in with the trainer's Google Sheet
  token?: string;
  trainer?: boolean;                            // trainer accounts see every day unlocked
  checked?: Record<string, boolean>;            // worksheetId -> "Check my answers" was used
  videos?: Record<string, number>;              // demo video file -> first time it was opened (ms), for the Class report
  started?: Record<string, number>;             // missionId -> first time the trainee worked on it (ms), for the Class report
  watched?: Record<string, 'watched' | 'skipped'>; // activity missionId -> its "Watch first" video was watched to the end, or skipped
  lessonRead?: Record<string, number[]>;          // day -> lesson parts opened
  // When things happened (ms), for the trainer's activity log. 0 = done before the lab kept these times.
  stepAt?: Record<string, number>;              // "missionId|stepId" -> when the step was done
  finished?: Record<string, number>;            // missionId -> when it was first finished (steps done, worksheet checked)
  checks?: CheckEntry[];                        // the newest 100 "Check my answers"
  watchedAt?: Record<string, number>;           // activity missionId -> when its "Watch first" video was watched or skipped
  lessonAt?: Record<string, number>;            // "day|part" -> when the lesson part was first opened
  updatedAt?: number;                           // ms; newest copy wins when syncing                             // workspace scratch pad (never exported)
  log: LogEntry[];
}

const KEY = 'ctm-virtual-lab:v1';

export function emptyState(name: string, seat: number, missionId: string): LabState {
  return { version: 1, name, seat, missionId, done: {}, ws: {}, evidence: [], notes: '', log: [] };
}

export function load(): LabState | null {
  try { const raw = localStorage.getItem(KEY); if (!raw) return null; const s = JSON.parse(raw) as LabState; return s.version === 1 ? s : null; } catch { return null; }
}

let timer: number | undefined;
let afterSave: ((s: LabState) => void) | null = null;
export function onSave(cb: (s: LabState) => void) { afterSave = cb; }
export function save(s: LabState) {
  s.updatedAt = Date.now();
  afterSave?.(s);
  clearTimeout(timer);
  timer = window.setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }, 250);
}

export function clearSaved() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

export const now = () => new Date().toLocaleString('en-PH', { hour12: true, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
