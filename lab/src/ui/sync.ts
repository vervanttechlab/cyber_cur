// Progress sync with the trainer's Google Sheet (Apps Script web app in lab/sync/Code.gs).
// The URL comes from src/sync.config.json, or ?sync=<url> for testing. Empty URL = offline mode.
import cfg from '../sync.config.json';
import { trimLog, type LabState } from './store';

// VITE_SYNC_URL=off (the e2e build, see .env.e2e) builds an offline lab without editing sync.config.json.
const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SYNC_URL;
const fromQuery = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('sync') : null;
export const SYNC_URL: string = (fromQuery ?? (fromEnv === 'off' ? '' : fromEnv ?? cfg.url ?? '')).trim();
export const syncEnabled = () => SYNC_URL.length > 0;

export type SyncStatus = { kind: 'off' | 'saving' | 'saved' | 'offline' | 'error'; text: string };
let statusCb: (s: SyncStatus) => void = () => {};
export function onStatus(cb: (s: SyncStatus) => void) { statusCb = cb; }

export async function api<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  // text/plain avoids a CORS preflight, which Apps Script cannot answer
  const r = await fetch(SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...body }), redirect: 'follow' });
  const j = await r.json();
  // busy = the server could not get its lock in time; treat it like being offline so saves retry
  if (!j.ok) throw Object.assign(new Error(j.error || 'Sync failed'), { server: !j.busy });
  return j as T;
}

let timer: number | undefined, retry: number | undefined, pending: { st: LabState; summary: unknown; n: number } | null = null;
/** Counts changes: the state object is the same one, mutated, so a save that was sent before a newer change must not clear it. */
let changes = 0;

/** Queue a sync of the latest state (debounced). Keeps retrying while offline. */
export function queueSync(st: LabState, summary: unknown) {
  if (!syncEnabled() || !st.token) return;
  pending = { st, summary, n: ++changes };
  clearTimeout(timer);
  timer = window.setTimeout(flush, 3000);
}

async function flush() {
  if (!pending) return;
  const { st, summary, n } = pending;
  statusCb({ kind: 'saving', text: 'Saving online…' });
  try {
    await api('save', { token: st.token, state: slim(st), summary });
    if (pending && pending.n === n) pending = null; // a change made while this save was on its way stays pending
    statusCb({ kind: 'saved', text: `Saved online ${new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}` });
  } catch (e) {
    const server = (e as { server?: boolean }).server;
    statusCb(server ? { kind: 'error', text: `Not saved online: ${(e as Error).message}` } : { kind: 'offline', text: 'Offline: saved on this PC, will retry' });
    clearTimeout(retry);
    if (!server) retry = window.setTimeout(flush, 30000);
  }
}

/** Save any pending change now and wait for the answer (used before Switch user). True = everything is saved online. */
export async function flushNow(): Promise<boolean> {
  clearTimeout(timer);
  if (!pending) return true;
  await flush();
  return pending === null;
}

/** Last-chance save when the window closes (no response needed). */
export function flushOnExit() {
  if (!pending || !syncEnabled()) return;
  const { st, summary } = pending;
  try { navigator.sendBeacon(SYNC_URL, new Blob([JSON.stringify({ action: 'save', token: st.token, state: slim(st), summary })], { type: 'text/plain;charset=utf-8' })); } catch { /* ignore */ }
}

/** Characters of command output kept online (newest first); older commands keep the command line only. */
export const OUTPUT_BUDGET = 250000;

/** What is stored online: everything except the auth token. Every command is kept (each day keeps its newest
 *  150, see trimLog); outputs are kept newest first within OUTPUT_BUDGET so the saved state stays well under
 *  the server's limit (MAX_STATE in sync/Code.gs). */
export function slim(st: LabState): LabState {
  const { token: _t, ...rest } = st;
  let budget = OUTPUT_BUDGET;
  const log = trimLog(st.log).slice().reverse().map((l) => {
    if (!l.out) return l;
    if (l.out.length <= budget) { budget -= l.out.length; return l; }
    budget = 0;
    const { out: _o, ...cmd } = l;
    return cmd;
  }).reverse();
  return { ...rest, log } as LabState;
}
