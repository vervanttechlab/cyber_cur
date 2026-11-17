// CTM Virtual Lab: app shell, router and the work page (steps | terminal | Lab Notebook).
// Pages (hash routes):  #/  Home · #/day/N  Activities · #/lesson/N/k · #/files/N · #/m/<missionId>  work page
//                        #/workspace · #/progress
import '@xterm/xterm/css/xterm.css';
import './styles.css';
import type { Host } from './shell/types';
import { newSession } from './shell/shell';
import { demoLinux, demoWindows, seatHosts, type SeatFacts } from './hosts/hosts';
import type { HostId, Mission, Worksheet } from './missions/types';
import { DAY2 } from './missions/day02';
import { DAY3 } from './missions/day03';
import { DAY4 } from './missions/day04';
import { DAY5 } from './missions/day05';
import { DAY6 } from './missions/day06';
import { DAY7 } from './missions/day07';
import { DAY8 } from './missions/day08';
import { DAY9 } from './missions/day09';
import './missions/practice34';
import { WORKSPACE } from './missions/workspace';
import type { ScenarioPack } from './missions/types';
import { TermView, type CommandEvent } from './ui/terminal';
import { emptyState, load, save, saveNow, clearSaved, now, clipOutput, trimLog, type LabState } from './ui/store';
import { notebookHtml, download, printHtml } from './ui/export';
import { api, syncEnabled, queueSync, flushOnExit, flushNow, onStatus, type SyncStatus } from './ui/sync';
import { onSave } from './ui/store';
import { foldersLine } from './missions/folders';
import { reportHtml, reportCsv, defaultDay, type ReportData } from './ui/report';
import { Social, type StatusReply } from './ui/social';
import { copyPlan, sharedHtml, actName, offerHtml, readyHtml, filledAfter, emptyKeys, type Share, type SharedAnswers, type Offer } from './ui/share';
import { Updates } from './ui/updates';
import { teamsHtml, teamList, changes as teamChanges, balance, type TeamDraft } from './views/teams';
import { watchFor, dayVideos, videoTitle } from './missions/watch';
import { homeHtml, dayHtml, lessonHtml, filesHtml, progressHtml, dayTitle, esc, code, type PageCtx, type Lesson } from './views/pages';
import { buildPayload, autoScore, verdictLabel, when, type MySubs } from './ui/submit';
import { boardHtml, detailHtml, gradesCsv, waiting, traineeHref, type BoardData, type Detail } from './views/board';
import { monitorHtml, pickMission, type TraineeDetail, type MonitorView } from './views/monitor';
import { activityLogCsv, accomplishmentsCsv, FILTERS, type ClassLog } from './ui/activity';

const PACKS: ScenarioPack[] = [DAY2, DAY3, DAY4, DAY5, DAY6, DAY7, DAY8, DAY9, WORKSPACE];
const ALL = PACKS.flatMap((p) => p.missions);
const DAYS = PACKS.filter((p) => p.day > 0);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
// Lessons: generated from each day's Student Handout by _build/lab_lessons.py
const LESSONS: Record<number, Lesson> = Object.fromEntries(Object.values(import.meta.glob<Lesson>('./lessons/day*.json', { eager: true, import: 'default' })).map((l) => [l.day, l]));

let st: LabState;
let hosts: Record<HostId, Host>;
let facts: SeatFacts;
const terms = new Map<HostId, TermView>();
let activeHost: HostId = 'demo-win';
let nbTab: 'ws' | 'ev' | 'notes' | 'log' = 'ws';
let grades: Record<string, Record<string, { ok: boolean; hint?: string }>> = {};
type Route = { name: 'home' } | { name: 'day'; day: number } | { name: 'lesson'; day: number; k: number } | { name: 'files'; day: number } | { name: 'work'; id: string } | { name: 'progress' } | { name: 'board'; bday?: number } | { name: 'trainee'; email: string; act?: string } | { name: 'teams' };
let route: Route = { name: 'home' };

const mission = () => ALL.find((m) => m.id === st.missionId) ?? ALL[0];
const pack = () => PACKS.find((p) => p.missions.includes(mission()))!;
const packOfM = (m: Mission) => PACKS.find((p) => p.missions.includes(m))!;
const hostLabel = (id: HostId) => { const h = hosts[id]; return `${h.os === 'windows' ? 'PowerShell' : 'Ubuntu'} · ${h.hostname}${id.startsWith('ws-') ? (id.includes('seat') ? ' (my copy)' : ' (demo)') : ''}`; };
const hostTip = (id: HostId) => hosts[id].note ?? '';
const onWork = () => route.name === 'work';
/** A trainer account signed in online: lands on the Trainer board and sees the class, not its own progress. */
const isTrainer = () => !!(st?.trainer && st.token && syncEnabled());

// ------------------------------------------------------------------ activity gate (trainer opens days in the Sheet)
/** Days whose Activities the trainer opened (Settings > Open Days). null = not confirmed by the server in this session. */
let gateDays: number[] | null = null;
/** Activities need a signed-in trainee on an open day. Practice and the Workspace are always open. No sync URL = no gate. */
function activityOpen(day: number): boolean {
  if (!syncEnabled()) return true;
  if (!st.token) return false;
  return st.trainer || (!!gateDays && gateDays.includes(day));
}
function gateReason(day: number): string {
  if (!st.token) return 'Sign in online to do the Activities. Practice and the Workspace work offline.';
  if (!gateDays) return 'Cannot reach the lab server right now. Activities open again when you are back online.';
  return `Day ${day} Activities are closed. Your trainer opens them on the training day. Practice and the Workspace stay open.`;
}
/** Apply the open days from a server reply; redraw if they changed. */
function setGate(days: unknown, trainer?: boolean) {
  if (!Array.isArray(days)) return;
  const next = days.map(Number);
  const changed = JSON.stringify(next) !== JSON.stringify(gateDays) || (trainer !== undefined && trainer !== st.trainer);
  const opened = next.filter((d) => !(gateDays ?? []).includes(d));
  gateDays = next;
  if (trainer !== undefined) st.trainer = trainer;
  if (!changed || !hosts) return;
  if (!leaveLockedActivity()) onRoute(); // re-read the route: a trainer account lands on the Trainer board
  const mine = opened.filter((d) => unlocked(d) && packOf(d));
  if (mine.length && !st.trainer) toast(`🔓 Your trainer opened the Day ${mine.join(', ')} Activities.`);
}
/** On a closed Activity: go back to its day page. True when it moved. */
function leaveLockedActivity(): boolean {
  if (!onWork()) return false;
  const m = mission();
  if (m.kind !== 'activity' || activityOpen(m.day)) return false;
  toast(`🔒 ${esc(gateReason(m.day))}`);
  go(`#/day/${m.day}`);
  return true;
}

// ------------------------------------------------------------------ progress, unlocking and sync summary
const isActivity = (m: Mission) => m.kind === 'activity';
/** An activity is finished when every step is done and its worksheet has been checked at least once. */
function activityDone(m: Mission): boolean {
  const d = new Set(st.done[m.id] ?? []);
  return m.steps.every((s) => d.has(s.id)) && (!m.worksheet || !!st.checked?.[m.worksheet.id]);
}
/** Times for the trainer's activity log: when each step was done and each mission first finished. Runs on every save;
 *  base = true (at start-up) marks what was already done with 0 ("before the lab kept times"), so it is never given today's time. */
function stamp(base = false) {
  const t = base ? 0 : Date.now();
  const at = (st.stepAt ??= {}), fin = (st.finished ??= {});
  for (const m of ALL) {
    for (const id of st.done[m.id] ?? []) { const k = `${m.id}|${id}`; if (!(k in at)) at[k] = t; }
    if (!(m.id in fin) && m.steps.length && activityDone(m)) fin[m.id] = t;
  }
}
const packOf = (day: number) => PACKS.find((p) => p.day === day);
function dayDone(day: number): boolean { const p = packOf(day); return !!p && p.missions.filter(isActivity).every(activityDone); }
/** Day 2 is always open; each later day opens when every activity of the day before is finished. Trainers see all. */
function unlocked(day: number): boolean {
  if (day === 0 || st.trainer) return true;
  const first = Math.min(...DAYS.map((p) => p.day));
  if (day <= first) return true;
  return dayDone(day - 1) && unlocked(day - 1);
}
/** Checked score of an activity's worksheet (after "Check my answers"), or null. */
function score(m: Mission): { ok: number; total: number } | null {
  if (!m.worksheet || !st.checked?.[m.worksheet.id]) return null;
  const v = Object.entries(grades[m.worksheet.id] ?? {}).filter(([k]) => !k.startsWith('_'));
  return v.length ? { ok: v.filter(([, x]) => x.ok).length, total: v.length } : null;
}
function progressSummary() {
  const stepsDone = (m: Mission) => m.steps.filter((s) => (st.done[m.id] ?? []).includes(s.id)).length;
  const days: Record<number, { done: number; total: number; checked: number; correct: number; steps: number; stepsTotal: number }> = {};
  for (const p of DAYS) {
    const acts = p.missions.filter(isActivity);
    let checked = 0, correct = 0;
    for (const m of acts) if (m.worksheet && st.checked?.[m.worksheet.id]) for (const [k, v] of Object.entries(grades[m.worksheet.id] ?? {})) if (!k.startsWith('_')) { checked++; if (v.ok) correct++; }
    days[p.day] = { done: acts.filter(activityDone).length, total: acts.length, checked, correct,
      steps: acts.reduce((n, m) => n + stepsDone(m), 0), stepsTotal: acts.reduce((n, m) => n + m.steps.length, 0) };
  }
  const highestDay = Math.max(...DAYS.filter((p) => unlocked(p.day)).map((p) => p.day));
  const practice = ALL.filter((m) => m.kind === 'practice');
  const practiceDone = practice.filter((m) => stepsDone(m) === m.steps.length).length;
  const cur = mission();
  return { highestDay, days, practiceDone, practiceTotal: practice.length, commands: st.log.length, mission: cur.title,
    missionSteps: cur.steps.length ? `${stepsDone(cur)}/${cur.steps.length} steps` : '' };
}
let lastSync: SyncStatus = { kind: 'off', text: '' };
function setSyncChip(s: SyncStatus) {
  lastSync = s;
  const el = $('sync'); if (!el) return;
  el.className = `sync-chip ${s.kind}`; el.textContent = s.kind === 'off' ? '' : s.text; el.title = s.text;
  renderStatusbar();
}

// ------------------------------------------------------------------ sign in
function signIn(prev?: LabState | null) {
  if (syncEnabled()) return signInOnline(prev);
  signInLocal(prev);
}

/** Sign in with an emailed code; progress is restored from the trainer's Google Sheet. */
function signInOnline(prev?: LabState | null, msg = '') {
  const dlg = $<HTMLDialogElement>('signin');
  dlg.innerHTML = `<form class="signin" id="f1">
    <div class="brand-mark big" aria-hidden="true">&gt;_</div>
    <h2>Welcome to the CTM Virtual Lab</h2>
    <p>Sign in with your email. Your progress is saved online, so you can continue on any computer.</p>
    <label>Your full name<input name="name" required autocomplete="name" value="${esc(prev?.name ?? '')}" placeholder="e.g., Ana Reyes"></label>
    <label>Email<input name="email" required type="email" autocomplete="email" value="${esc(prev?.email ?? '')}" placeholder="you@example.com"></label>
    <p class="fine">Your trainer assigns your seat number. It gives you your own lab hosts, so do your own work.</p>
    <p class="err" id="err">${esc(msg)}</p>
    <button class="btn" type="submit" id="send">Send me a code</button>
    <button class="link" type="button" id="offline">Practice offline without signing in (Activities stay locked)</button>
  </form>`;
  const f = dlg.querySelector('form') as HTMLFormElement;
  const val = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value.trim();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const info = { name: val('name'), email: val('email').toLowerCase() };
    $('send').setAttribute('disabled', ''); $('send').textContent = 'Sending…';
    try { const r = await api<{ masked: string }>('requestCode', info); codeStep(info, r.masked, prev); }
    catch (err) { $('err').textContent = (err as Error).message.includes('fetch') ? 'Cannot reach the lab server. Check your internet connection.' : (err as Error).message; $('send').removeAttribute('disabled'); $('send').textContent = 'Send me a code'; }
  };
  // open the offline form only after this dialog's 'close' event has fired, or that event would submit the empty form
  $('offline').onclick = () => { dlg.addEventListener('close', () => signInLocal(prev, true), { once: true }); dlg.close(); };
  dlg.addEventListener('cancel', (e) => e.preventDefault());
  if (!dlg.open) dlg.showModal();
}

function codeStep(info: { name: string; email: string }, masked: string, prev?: LabState | null) {
  const dlg = $<HTMLDialogElement>('signin');
  dlg.innerHTML = `<form class="signin">
    <h2>Check your email</h2>
    <p>We sent a 6-digit code to <b>${esc(masked)}</b>. It is valid for 10 minutes.</p>
    <label>Code<input name="code" required inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></label>
    <p class="err" id="err"></p>
    <button class="btn" type="submit" id="verify">Sign in</button>
    <button class="link" type="button" id="back">Change details or resend</button>
  </form>`;
  const f = dlg.querySelector('form') as HTMLFormElement;
  f.onsubmit = async (e) => {
    e.preventDefault();
    $('verify').setAttribute('disabled', '');
    try {
      const r = await api<{ token: string; email: string; name: string; seat: number; trainer: boolean; state: LabState | null; updated: number; openDays?: number[] }>('verify', { ...info, code: (f.elements.namedItem('code') as HTMLInputElement).value });
      gateDays = Array.isArray(r.openDays) ? r.openDays.map(Number) : null;
      const local = load();
      const useLocal = local && local.email === r.email && (local.updatedAt ?? 0) > (r.updated ?? 0);
      st = useLocal ? local! : r.state && r.state.version === 1 ? r.state : emptyState(r.name, r.seat, ALL[0].id);
      Object.assign(st, { email: r.email, token: r.token, trainer: r.trainer, name: r.name, seat: r.seat });
      dlg.close(); save(st); boot();
      const seatTxt = `Seat ${String(r.seat).padStart(2, '0')}`;
      toast(r.state && !useLocal ? `Welcome back! Your saved progress was restored. You are ${seatTxt}.` : `Signed in as ${esc(r.email)}. You are ${seatTxt}.`);
    } catch (err) { $('err').textContent = (err as Error).message.includes('fetch') ? 'Cannot reach the lab server. Check your internet connection and try again.' : (err as Error).message; $('verify').removeAttribute('disabled'); }
  };
  $('back').onclick = () => signInOnline({ ...(prev ?? emptyState(info.name, 1, ALL[0].id)), name: info.name, email: info.email });
}

/** Offline mode: name + seat, progress kept on this computer only. */
function signInLocal(prev?: LabState | null, offline = false) {
  const dlg = $<HTMLDialogElement>('signin');
  dlg.innerHTML = `<form method="dialog" class="signin">
    <div class="brand-mark big" aria-hidden="true">&gt;_</div>
    <h2>Welcome to the CTM Virtual Lab</h2>
    <p>A safe practice lab: a Windows workstation and an Ubuntu server that run inside this page. Nothing you type touches your own computer or any real network.</p>
    <label>Your full name<input name="name" required autocomplete="name" value="${esc(prev?.name ?? '')}" placeholder="e.g., Ana Reyes"></label>
    <label>Seat number (from your trainer)<input name="seat" required type="number" min="1" max="40" value="${prev?.seat ?? ''}" placeholder="1–40"></label>
    <p class="fine">Your seat number gives you your own lab hosts. Your classmates' hosts have different values, so do your own work.${offline ? ' <b>Offline practice:</b> the Practice missions and the Workspace work; the Activities need an online sign-in. Nothing is saved online.' : ''}</p>
    <button class="btn" value="ok">Start the lab</button>
  </form>`;
  dlg.addEventListener('close', () => {
    const f = dlg.querySelector('form') as HTMLFormElement;
    const name = (f.elements.namedItem('name') as HTMLInputElement).value.trim();
    const seat = Math.min(40, Math.max(1, parseInt((f.elements.namedItem('seat') as HTMLInputElement).value, 10) || 1));
    if (!name) return signIn(prev);
    st = prev && prev.name === name && prev.seat === seat ? prev : emptyState(name, seat, ALL[0].id);
    save(st); boot();
  }, { once: true });
  dlg.addEventListener('cancel', (e) => e.preventDefault());
  dlg.showModal();
}

// ------------------------------------------------------------------ boot
function boot() {
  const seat = seatHosts(st.seat);
  facts = seat.facts;
  hosts = { 'demo-win': demoWindows(), 'demo-linux': demoLinux(), 'seat-win': seat.win, 'seat-linux': seat.linux } as Record<HostId, Host>;
  freshWorkspace();
  for (const t of terms.values()) t.dispose();
  terms.clear(); $('terms').innerHTML = '';
  $('who').innerHTML = `<b>${esc(st.name)}</b> · Seat ${String(st.seat).padStart(2, '0')}${st.trainer ? '<span class="trainer-tag">TRAINER</span>' : ''}`;
  setSyncChip(st.token ? { kind: 'saved', text: 'Saved online' } : { kind: syncEnabled() ? 'error' : 'off', text: syncEnabled() ? 'Offline mode: not saved online' : '' });
  regrade();
  stamp(true); // what was done before the lab kept times gets 0, not today's time
  onRoute();
  pollGate(); // check in now: online list, open days, chat
}

/** (Re)create the workspace hosts: independent copies, so nothing done there touches the activity hosts. */
function freshWorkspace() {
  const copy = seatHosts(st.seat);
  hosts['ws-win'] = { ...demoWindows(), id: 'ws-win', note: 'Workspace copy of the demo workstation (not linked to any activity)' };
  hosts['ws-linux'] = { ...demoLinux(), id: 'ws-linux', note: 'Workspace copy of the demo VM (not linked to any activity)' };
  hosts['ws-seat-win'] = { ...copy.win, id: 'ws-seat-win', note: `Workspace copy of your workstation, seat ${String(st.seat).padStart(2, '0')} (not linked to any activity)` };
  hosts['ws-seat-linux'] = { ...copy.linux, id: 'ws-seat-linux', note: `Workspace copy of your Ubuntu VM, seat ${String(st.seat).padStart(2, '0')} (not linked to any activity)` };
  for (const id of ['ws-win', 'ws-linux', 'ws-seat-win', 'ws-seat-linux'] as HostId[]) { terms.get(id)?.dispose(); terms.delete(id); $('terms').querySelector(`.term[data-h="${id}"]`)?.remove(); }
}

// ------------------------------------------------------------------ router
function go(hash: string) { if (location.hash === hash) onRoute(); else location.hash = hash; }
function parseRoute(h: string): Route {
  const p = h.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const n = Number(p[1]);
  if (p[0] === 'day' && packOf(n)) return { name: 'day', day: n };
  if (p[0] === 'lesson' && LESSONS[n]?.parts.length) return { name: 'lesson', day: n, k: p[2] === undefined ? -1 : Number(p[2]) };
  if (p[0] === 'files' && packOf(n)) return { name: 'files', day: n };
  if (p[0] === 'm' && ALL.some((m) => m.id === p[1])) return { name: 'work', id: p[1] };
  if (p[0] === 'workspace') return { name: 'work', id: 'workspace' };
  if (p[0] === 'progress') return { name: 'progress' };
  if (p[0] === 'board') return { name: 'board', bday: packOf(n) ? n : undefined };
  if (p[0] === 'teams') return { name: 'teams' };
  if (p[0] === 'trainee' && p[1]) return { name: 'trainee', email: p[1].trim().toLowerCase(), act: ALL.some((m) => m.id === p[2]) ? p[2] : undefined };
  return isTrainer() ? { name: 'board' } : { name: 'home' };
}
function onRoute() {
  if (!st || !hosts) return;
  const r = parseRoute(location.hash);
  const day = 'day' in r ? r.day : r.name === 'work' ? ALL.find((m) => m.id === r.id)!.day : 0;
  if (day > 0 && !unlocked(day)) { toast(`🔒 Day ${day} is locked. Finish every Day ${day - 1} activity first.`); return go('#/'); }
  if ((r.name === 'board' || r.name === 'trainee' || r.name === 'teams') && !isTrainer()) return go('#/');
  if (r.name === 'board' && r.bday) boardDay = r.bday;
  if (isTrainer() && r.name === 'day' && (!board || Date.now() - board.generated > 60000)) loadBoard(); // the class results on the Day page
  if (r.name === 'work') {
    const m = ALL.find((x) => x.id === r.id)!;
    if (m.kind === 'activity' && !activityOpen(m.day)) { toast(`🔒 ${esc(gateReason(m.day))}`); return go(`#/day/${m.day}`); }
    if (st.missionId !== m.id || route.name !== 'work') { if (window.innerWidth <= 1100) showPane('steps'); }
    if (st.missionId !== m.id) { st.missionId = m.id; activeHost = m.hosts[0]; save(st); }
    if (!m.hosts.includes(activeHost)) activeHost = m.hosts[0];
  }
  route = r;
  renderAll();
  if (r.name !== 'work') $('view').scrollTop = 0;
  document.body.dataset.route = location.hash || '#/'; // for the e2e tests: this route has been drawn
}
window.addEventListener('hashchange', onRoute);

function pageCtx(): PageCtx {
  return { packs: PACKS.filter((p) => p.day > 0), st, lessons: LESSONS, unlocked, activityOpen, gateReason, activityDone,
    openToday: (d) => !!gateDays?.includes(d), score, sub: (m) => mySubs?.latest[m.id], redo: (m) => mySubs?.redo[m.id], trainer: isTrainer(), cls };
}

function renderAll() {
  renderChrome();
  const work = onWork();
  $('work').hidden = !work; $('view').hidden = work;
  document.body.classList.toggle('working', work);
  if (work) { renderMissions(); renderHead(); renderTabs(); renderNotebook(); renderWatch(); renderStatusbar(); void maybeOffer(); }
  else renderPage();
  social.setVisible(!!st.token && syncEnabled());
}

/** Title bar (back + crumbs), side nav and bottom nav. */
function renderChrome() {
  const r = route;
  const homeL = isTrainer() ? 'Trainer board' : 'Home';
  const crumbs: [string, string][] = [[homeL, '#/']];
  let back: [string, string] | null = null;
  const dayOf = r.name === 'work' ? mission().day : 'day' in r ? r.day : 0;
  if (dayOf > 0) crumbs.push([`Day ${dayOf}`, `#/day/${dayOf}`]);
  if (r.name === 'day') back = [homeL, '#/'];
  if (r.name === 'lesson') { crumbs.push(['Lesson', '']); back = [`Day ${r.day}`, `#/day/${r.day}`]; }
  if (r.name === 'files') { crumbs.push(['Files', '']); back = [`Day ${r.day}`, `#/day/${r.day}`]; }
  if (r.name === 'progress') { crumbs.push(['My progress', '']); back = ['Home', '#/']; }
  if (r.name === 'board') { crumbs.splice(0, 1, ['Trainer board', '']); back = null; }
  if (r.name === 'trainee') { crumbs.push([tdata?.email === r.email ? tdata.name || r.email : r.email, '']); back = ['Board', '#/']; }
  if (r.name === 'teams') { crumbs.push(['Teams', '']); back = ['Board', '#/']; }
  if (r.name === 'work') {
    const m = mission();
    crumbs.push([m.kind === 'workspace' ? 'Workspace' : m.title.replace(/ · .*/, '').replace(/^Practice: /, 'Practice '), '']);
    back = m.day > 0 ? [`Day ${m.day}`, `#/day/${m.day}`] : [homeL, '#/'];
  }
  $('crumbs').innerHTML = crumbs.map(([t, h], i) => i === crumbs.length - 1 ? `<span class="cur">${esc(t)}</span>` : `<a href="${h}">${esc(t)}</a><span class="sep">/</span>`).join('');
  const b = $<HTMLAnchorElement>('tb-back'); b.hidden = !back;
  if (back) { b.href = back[1]; $('tb-back-l').textContent = back[0]; }
  const curDay = dayOf;
  const link = (href: string, on: boolean, inner: string, cls = '') => `<a href="${href}" class="${on ? 'on' : ''} ${cls}">${inner}</a>`;
  const tr = isTrainer();
  $('sidenav').innerHTML = (tr
    ? link('#/', r.name === 'board' || r.name === 'trainee', '<span class="sn-n">▦</span><span class="sn-t">Trainer board</span>') + link('#/teams', r.name === 'teams', '<span class="sn-n">👥</span><span class="sn-t">Teams</span>') + link('#/report', false, '<span class="sn-n">☷</span><span class="sn-t">Class report</span>', 'sn-report')
    : link('#/', r.name === 'home', '<span class="sn-n">⌂</span><span class="sn-t">Home</span>')) +
    `<div class="sn-h">${tr ? 'Days · class view and preview' : 'Training days'}</div>` + DAYS.map((p) => {
      const open = unlocked(p.day);
      return link(open ? `#/day/${p.day}` : '#/', curDay === p.day, `<span class="sn-n">${p.day}</span><span class="sn-t">${open ? '' : '🔒 '}${esc(dayTitle(p))}</span>${gateDays?.includes(p.day) && open ? '<span class="sn-live" title="Activities open today"></span>' : ''}`, open ? '' : 'locked');
    }).join('') +
    `<div class="sn-h">More</div>` + link('#/workspace', r.name === 'work' && mission().kind === 'workspace', '<span class="sn-n">›_</span><span class="sn-t">Workspace</span>') +
    (tr ? '' : link('#/progress', r.name === 'progress', '<span class="sn-n">✓</span><span class="sn-t">My progress</span>'));
  $('sidenav').querySelector<HTMLAnchorElement>('.sn-report')?.addEventListener('click', (e) => { e.preventDefault(); openReport(boardDay || undefined); });
  const lastDay = DAYS.filter((p) => unlocked(p.day)).pop()!.day;
  const dayN = curDay || lastDay;
  $('bottomnav').innerHTML = (tr ? link('#/', r.name === 'board', '<span class="bn-i">▦</span>Board') : link('#/', r.name === 'home', '<span class="bn-i">⌂</span>Home')) + link(`#/day/${dayN}`, curDay > 0, `<span class="bn-i">☰</span>Day ${dayN}`) +
    link('#/workspace', r.name === 'work' && mission().kind === 'workspace', '<span class="bn-i">›_</span>Workspace') + link('#/progress', r.name === 'progress', '<span class="bn-i">✓</span>Progress');
}

/** Home, Day, Lesson, Files, My progress. */
function renderPage() {
  const c = pageCtx(), r = route, v = $('view');
  if (r.name === 'home') v.innerHTML = homeHtml(c);
  else if (r.name === 'day') {
    v.innerHTML = dayHtml(c, r.day);
    $('btn-day-videos')?.addEventListener('click', () => openVideos(dayVideos(packOf(r.day)!), `Day ${r.day} demo videos`));
    $('btn-day-export')?.addEventListener('click', () => exportNotebook(r.day));
  } else if (r.name === 'lesson') {
    const L = LESSONS[r.day];
    let k = r.k;
    if (!(k >= 0 && k < L.parts.length)) k = Math.max(0, Math.min(L.parts.length - 1, (st.lessonRead?.[r.day] ?? []).slice(-1)[0] ?? 0));
    const read = (st.lessonRead ??= {})[r.day] ??= [];
    if (!read.includes(k)) { read.push(k); (st.lessonAt ??= {})[`${r.day}|${k}`] ??= Date.now(); save(st); }
    v.innerHTML = lessonHtml(c, r.day, k);
    v.querySelectorAll<HTMLVideoElement>('video[data-video]').forEach((el) => el.addEventListener('play', () => markVideo(el.dataset.video!), { once: true }));
  } else if (r.name === 'files') v.innerHTML = filesHtml(c, r.day);
  else if (r.name === 'board') renderBoard();
  else if (r.name === 'trainee') renderTrainee();
  else if (r.name === 'teams') renderTeams(true);
  else v.innerHTML = progressHtml(c);
}

// ------------------------------------------------------------------ work page: steps pane
function renderMissions() {
  const m = mission();
  if (m.kind === 'workspace') return renderWorkspacePanel(m);
  const P = pack();
  const fin = isActivity(m) ? activityDone(m) : false;
  $('missions').innerHTML = `<h3>${m.kind === 'practice' ? 'Practice on the demo hosts' : 'Your task'}</h3><p class="intro">${code(m.intro)}</p>
    ${foldersLine(m) ? `<p class="files-line">${code(foldersLine(m))}</p>` : ''}
    ${trainerNote(m)}
    ${fin ? '<p class="note good">✓ Finished: every step done and the worksheet checked.</p>' : ''}
    <h3>Steps · ${(st.done[m.id] ?? []).length}/${m.steps.length} done</h3>
    <ol class="steps">${m.steps.map((s) => stepHtml(m, s.id)).join('')}</ol>
    ${isActivity(m) && m.worksheet ? '<p class="small muted">When the steps are done, fill in the worksheet in the <b>Lab Notebook</b> and press <b>Check my answers</b>.</p>' : ''}
    ${m.kind === 'practice' ? `<p class="small muted">Then do the activities of <a href="#/day/${P.day}">Day ${P.day}</a> on your own hosts.</p>` : ''}`;
  $('missions').querySelectorAll<HTMLButtonElement>('button[data-hint]').forEach((b) => b.onclick = () => { b.parentElement!.querySelector('.hint')!.classList.toggle('show'); });
  $('missions').querySelectorAll<HTMLButtonElement>('button[data-manual]').forEach((b) => b.onclick = () => {
    const m = mission(); const set = new Set(st.done[m.id] ?? []);
    if (set.has(b.dataset.manual!)) set.delete(b.dataset.manual!); else set.add(b.dataset.manual!);
    const before = openDays(); st.done[m.id] = [...set]; save(st); renderMissions(); renderStatusbar(); announceUnlock(before);
  });
  $('missions').querySelectorAll<HTMLButtonElement>('button[data-type]').forEach((b) => b.onclick = () => {
    const step = mission().steps.find((s) => s.id === b.dataset.type)!;
    if (!step.host) return;
    showPane('term'); switchHost(step.host); terms.get(step.host)!.typeLine((step.try ?? '').split('   then   ')[0]);
  });
}

function stepHtml(m: Mission, id: string): string {
  const s = m.steps.find((x) => x.id === id)!;
  const done = (st.done[m.id] ?? []).includes(id);
  const hostTag = s.manual || !s.host ? 'TASK' : hosts[s.host].os === 'windows' ? 'WIN' : 'LINUX';
  return `<li class="${done ? 'done' : ''}"><span class="tick" aria-hidden="true">${done ? '✓' : ''}</span><span class="host-tag ${hostTag.toLowerCase()}">${hostTag}</span>
    <span class="s-text">${code(s.text)}</span>
    ${s.link ? `<a class="link" href="${esc(s.link)}" target="_blank" rel="noopener">Open ↗</a>` : ''}
    ${s.manual ? `<button class="link" data-manual="${s.id}">${done ? 'Undo' : 'Mark as done'}</button>` : ''}
    ${s.try ? `<button class="link" data-hint="${s.id}">${done ? 'Command' : 'Hint'}</button><div class="hint"><code>${esc(s.try)}</code> <button class="link" data-type="${s.id}">Type it</button></div>` : ''}
    ${done && s.why ? `<div class="why">👁 ${code(s.why)}</div>` : ''}</li>`;
}

function renderWorkspacePanel(m: Mission) {
  $('missions').innerHTML = `<h3>Workspace</h3><p class="muted ws-note">Free practice. Not linked to any activity: nothing here is logged, checked or exported.</p>
    <button class="btn small" id="btn-ws-reset">↺ Reset workspace</button>` +
    (m.cheats ?? []).map((g, gi) => `<h3>${esc(g.group)}</h3><ul class="cheats">${g.cmds.map((c, ci) => `<li><code>${esc(c)}</code><button class="link" data-cheat="${gi}:${ci}">Type it</button></li>`).join('')}</ul>`).join('');
  $('btn-ws-reset').onclick = () => { freshWorkspace(); renderTabs(); toast('Workspace reset: fresh copies of all four hosts.'); };
  $('missions').querySelectorAll<HTMLButtonElement>('button[data-cheat]').forEach((b) => b.onclick = () => {
    const [gi, ci] = b.dataset.cheat!.split(':').map(Number); const g = m.cheats![gi];
    showPane('term'); switchHost(g.host); terms.get(g.host)!.typeLine(g.cmds[ci]);
  });
}

// ------------------------------------------------------------------ work page: head, terminal
function renderHead() {
  const m = mission();
  const w = watchFor(m, pack());
  const meta = m.kind === 'workspace' ? 'Free practice · not linked to any activity' : m.kind === 'practice' ? `Practice · demo hosts${m.minutes ? ` · ${m.minutes} min` : ''}` : `${m.subtitle} · your own hosts`;
  $('mission-head').innerHTML = `<h1>${esc(m.kind === 'workspace' ? 'Workspace' : m.title)}</h1><span class="meta">${esc(meta)}</span><span class="grow"></span>
    ${m.video && m.kind === 'practice' ? '<button class="btn small" id="btn-video">▶ Watch the video</button>' : ''}
    ${w.length ? `<button class="btn small" id="btn-watch-again">▶ ${w.length > 1 ? 'Demo videos' : 'Demo video'}</button>` : ''}`;
  if (m.video && m.kind === 'practice') $('btn-video').onclick = () => openVideo(m.video!);
  if (w.length) $('btn-watch-again').onclick = () => openVideos(w, m.title);
}

function renderTabs() {
  const m = mission();
  if (!m.hosts.includes(activeHost)) activeHost = m.hosts[0];
  $('host-tabs').innerHTML = m.hosts.map((h) => `<button role="tab" class="tab ${h === activeHost ? 'active' : ''} ${hosts[h].os}" data-h="${h}" title="${esc(hostTip(h))}">${esc(hostLabel(h))}</button>`).join('');
  $('host-tabs').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => switchHost(b.dataset.h as HostId));
  switchHost(activeHost);
}

function banner(id: HostId): string {
  const h = hosts[id];
  return h.os === 'windows'
    ? `Windows PowerShell\nCopyright (C) Microsoft Corporation. All rights reserved.\n\x1b[90m[CTM Virtual Lab] ${h.note}. Type  help  for the commands you can use.\x1b[0m\n\n`
    : `Welcome to ${h.osName} (GNU/Linux ${h.kernel} x86_64)\n\x1b[90m[CTM Virtual Lab] ${h.note}. Type  help  for the commands you can use.\x1b[0m\n\n`;
}

function switchHost(id: HostId) {
  activeHost = id;
  if (!terms.has(id)) {
    const el = document.createElement('div'); el.className = 'term'; el.dataset.h = id; $('terms').appendChild(el);
    terms.set(id, new TermView(el, newSession(hosts[id]), (e) => onCommand(id, e), banner(id)));
  }
  $('terms').querySelectorAll<HTMLElement>('.term').forEach((el) => el.classList.toggle('show', el.dataset.h === id));
  $('host-tabs').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.classList.toggle('active', b.dataset.h === id));
  if ($('watch').hidden) requestAnimationFrame(() => terms.get(id)!.focus());
}

/** Phones and small screens: one pane at a time. */
function showPane(p: 'steps' | 'term' | 'nb') {
  $('panes').dataset.show = p;
  $('seg').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
  if (p === 'term') requestAnimationFrame(() => terms.get(activeHost)?.focus());
}
$('seg').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => showPane(b.dataset.p as 'steps' | 'term' | 'nb'));

function onCommand(id: HostId, e: CommandEvent) {
  const before = openDays();
  const m = mission();
  if (m.kind === 'workspace' || id.startsWith('ws-')) return; // workspace is never logged or checked
  if (m.kind === 'activity' && !activityOpen(m.day)) return; // closed activity: nothing is recorded
  st.log.push({ time: now(), at: Date.now(), host: hosts[id].hostname, line: e.line, mission: m.title, day: m.day, out: clipOutput(e.out.stderr + e.out.stdout) });
  (st.started ??= {})[m.id] ??= Date.now(); // for the trainer's Class report
  st.log = trimLog(st.log); // each day keeps its newest 150 commands
  const done = new Set(st.done[m.id] ?? []);
  const newly = m.steps.filter((s) => !s.manual && s.host === id && !done.has(s.id) && s.match.some((r) => r.test(e.line)));
  if (newly.length) {
    for (const s of newly) done.add(s.id);
    st.done[m.id] = [...done];
    const s = newly[0];
    toast(`✓ Step done: ${s.text}${s.why ? `<br><span>👁 ${code(s.why)}</span>` : ''}`);
    renderMissions(); renderStatusbar();
    if (done.size === m.steps.length) setTimeout(() => toast(m.worksheet ? `🎉 All steps done. Finish the worksheet in your Lab Notebook, then press <b>Check my answers</b>.` : `🎉 Practice complete! Pin anything useful as evidence.`), 2600);
  }
  announceUnlock(before);
  if (nbTab === 'log') renderNotebook();
  save(st);
}

function pin(text: string, cmd: string) {
  if (mission().kind === 'workspace') return toast('Pinning is off in the Workspace: it is not linked to any notebook. Open an activity to collect evidence.');
  if (!text.trim()) return toast('Nothing to pin yet. Run a command first, or select some terminal text.');
  st.evidence.push({ id: Math.random().toString(36).slice(2), time: now(), at: Date.now(), host: hosts[activeHost].hostname, cmd, text: text.replace(/\x1b\[[0-9;]*m/g, ''), note: '', mission: mission().title, day: mission().day });
  save(st); nbTab = 'ev'; renderNotebook(); toast(`📌 Pinned as evidence E${st.evidence.length}. Add a note saying what it shows.`);
}

// ------------------------------------------------------------------ work page: Watch first (activities)
let watchIdx = 0;
function renderWatch() {
  const m = mission(), box = $('watch');
  const vids = watchFor(m, pack());
  if (!vids.length || st.watched?.[m.id] || isTrainer()) { if (!box.hidden) { box.hidden = true; box.innerHTML = ''; } return; } // trainers preview without the video gate
  if (!box.hidden && box.dataset.m === m.id) return; // already showing
  box.hidden = false; box.dataset.m = m.id;
  if (watchIdx >= vids.length) watchIdx = 0;
  const v = vids[watchIdx];
  box.innerHTML = `<div class="pagehead"><div class="kicker">Before you start · ${esc(m.title.replace(/ · .*/, ''))}</div><h2>Watch first</h2>
      <div class="meta">${vids.length > 1 ? `These ${vids.length} demonstrations show` : 'This demonstration shows'} how to do this activity's tasks on the demo hosts. Then you do the same on your own hosts.</div></div>
    <div class="vbox"><div class="vhead"><div class="vlabel">Demo video${vids.length > 1 ? ` ${watchIdx + 1} of ${vids.length}` : ''}</div><div class="vtitle">${esc(videoTitle(v))}</div></div>
      <video controls preload="metadata" src="videos/${esc(v)}"><track kind="captions" srclang="en" label="English" src="videos/${esc(v.replace(/\.mp4$/, '.vtt'))}" default></video>
      <div class="vend" id="watch-end" hidden></div></div>
    ${vids.length > 1 ? `<div class="list vlist" style="border-top:1px solid var(--line)">${vids.map((f, i) => `<div class="row ${i === watchIdx ? 'on' : ''}" data-i="${i}" tabindex="0" role="button"><span>${st.videos?.[f] ? '✓' : '▶'}</span><span>${esc(videoTitle(f))}</span><span class="small muted">${i === watchIdx ? 'playing' : ''}</span></div>`).join('')}</div>` : ''}
    <div class="toolrow" style="margin-top:12px"><button class="btn primary" id="watch-go">Start the activity</button><button class="btn quiet" id="watch-skip">Skip the video (I already watched it)</button></div>`;
  const video = box.querySelector('video')!;
  video.addEventListener('play', () => markVideo(v), { once: true });
  video.addEventListener('ended', () => {
    const end = $('watch-end'); end.hidden = false;
    end.innerHTML = watchIdx + 1 < vids.length ? `<b>✓ End of this video</b><button class="btn primary" id="watch-next">Next video ›</button>` : `<b>✓ You watched the demonstration</b><button class="btn primary" id="watch-done">Start the activity ›</button>`;
    $('watch-next')?.addEventListener('click', () => { watchIdx++; box.dataset.m = ''; box.hidden = true; renderWatch(); });
    $('watch-done')?.addEventListener('click', () => finishWatch('watched'));
  });
  box.querySelectorAll<HTMLElement>('.vlist .row').forEach((r) => r.onclick = () => { watchIdx = Number(r.dataset.i); box.dataset.m = ''; box.hidden = true; renderWatch(); });
  $('watch-go').onclick = () => finishWatch(vids.every((f) => st.videos?.[f]) ? 'watched' : 'skipped');
  $('watch-skip').onclick = () => finishWatch('skipped');
}
function finishWatch(how: 'watched' | 'skipped') {
  const m = mission();
  $('watch').querySelector('video')?.pause();
  (st.watched ??= {})[m.id] = how; (st.watchedAt ??= {})[m.id] = Date.now(); (st.started ??= {})[m.id] ??= Date.now();
  save(st); watchIdx = 0;
  $('watch').hidden = true; $('watch').innerHTML = '';
  showPane('term'); renderTabs();
  void maybeOffer();
}
function markVideo(file: string) { if (!st.videos?.[file]) { (st.videos ??= {})[file] = Date.now(); save(st); } }

// ------------------------------------------------------------------ work page: status bar
function renderStatusbar() {
  if (!st || !onWork()) return;
  const m = mission();
  const ws = m.kind === 'workspace';
  $('btn-check').hidden = ws || !m.worksheet;
  $('btn-export').hidden = ws; $('btn-print').hidden = ws;
  const d = (st.done[m.id] ?? []).length;
  const sc = score(m);
  const parts = ws ? ['Workspace · nothing here is saved to a notebook'] : [`${d}/${m.steps.length} steps`, ...(sc ? [`${sc.ok}/${sc.total} answers correct`] : []), ...(isActivity(m) && activityDone(m) ? ['Finished'] : [])];
  const sub = mySubs?.latest[m.id];
  if (sub && isActivity(m)) parts.push(`Submitted ${sub.score}/${sub.max} (attempt ${sub.attempt})${sub.verdict ? ` · ${verdictLabel(sub.verdict)}` : ''}`);
  if (lastSync.kind !== 'off') parts.push(lastSync.text);
  $('sb-left').textContent = parts.join(' · ');
  // Submit: activities, signed in online, and the server knows submissions (an older Code.gs does not)
  const sb = $('btn-submit');
  sb.hidden = !(isActivity(m) && syncEnabled() && st.token && subsOn !== false && !st.trainer); // trainers grade, they do not submit
  sb.textContent = mySubs?.redo[m.id] ? 'Submit again (redo)' : sub ? 'Submit again' : 'Submit';
}

// ------------------------------------------------------------------ notebook
function regrade() {
  grades = {};
  for (const m of ALL) if (m.worksheet?.grade) grades[m.worksheet.id] = m.worksheet.grade(st.ws[m.worksheet.id] ?? {}, { facts, hosts });
}

function worksheetHtml(ws: Worksheet, show: boolean): string {
  const vals = st.ws[ws.id] ?? {};
  const g = show ? grades[ws.id] ?? {} : {};
  const mark = (k: string) => (g[k] ? `<span class="mark ${g[k].ok ? 'ok' : 'no'}" title="${esc(g[k].hint ?? '')}">${g[k].ok ? '✓' : '✗'}</span>` : '');
  const cls = (k: string) => (g[k] ? (g[k].ok ? 'ok' : 'no') : '');
  const input = (k: string, kind = 'text', options?: string[], ph = '') => kind === 'select'
    ? `<select data-k="${k}" class="${cls(k)}">${(options ?? []).map((o) => `<option ${vals[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`
    : kind === 'area' ? `<textarea data-k="${k}" class="${cls(k)}" rows="3" placeholder="${esc(ph)}">${esc(vals[k] ?? '')}</textarea>`
      : `<input data-k="${k}" class="${cls(k)}" value="${esc(vals[k] ?? '')}" placeholder="${esc(ph)}">`;
  let h = `<h3>${esc(ws.title)}</h3>${ws.intro ? `<p class="muted">${code(ws.intro)}</p>` : ''}`;
  let tbl = '', fld = '';
  for (const t of ws.tables ?? []) {
    const lab = t.rows.some((r) => r.label);
    tbl += `${t.title ? `<h4>${esc(t.title)}</h4>` : ''}<div class="ws-table" style="--cols:${t.columns.length + (lab ? 1 : 0)}">` +
      (lab ? '<div class="th"></div>' : '') + t.columns.map((c) => `<div class="th">${esc(c.label)}</div>`).join('') +
      t.rows.map((r) => (lab ? `<div class="rh">${esc(r.label ?? '')}</div>` : '') + t.columns.map((c) => { const k = `${t.id}.${r.id}.${c.id}`; return `<div class="td">${input(k, c.kind, c.options)}${mark(k)}</div>`; }).join('')).join('') + '</div>';
  }
  for (const f of ws.fields ?? []) fld += `<label class="field">${esc(f.label)}${input(f.id, f.kind, f.options, f.placeholder)}${mark(f.id)}</label>`;
  h += ws.fieldsFirst ? fld + tbl : tbl + fld;
  const found = g._found;
  h += `<div class="ws-actions">${show ? summary(g) : '<span class="small muted">Press <b>Check my answers</b> (bottom right) to check this worksheet.</span>'}</div>${found ? `<p class="found ${found.ok ? 'ok' : ''}">${esc(found.hint ?? '')}</p>` : ''}`;
  return h;
}

function summary(g: Record<string, { ok: boolean }>) {
  const v = Object.entries(g).filter(([k]) => !k.startsWith('_')); const ok = v.filter(([, x]) => x.ok).length;
  return v.length ? `<span class="score">${ok} / ${v.length} checked answers correct</span>` : '<span class="score">Fill in some answers first.</span>';
}

const showMarks: Record<string, boolean> = {};
function renderNotebook() {
  const m = mission();
  if (m.kind === 'workspace') {
    $('nb-tabs').innerHTML = `<div class="nb-title">Workspace scratch pad</div>`;
    $('nb-body').innerHTML = `<p class="muted">Jot anything while you experiment. The scratch pad stays in this browser and is <b>not</b> part of any exported notebook.</p><textarea id="scratch" rows="22">${esc(st.scratch ?? '')}</textarea>`;
    ($('scratch') as HTMLTextAreaElement).oninput = (e) => { st.scratch = (e.target as HTMLTextAreaElement).value; save(st); };
    return;
  }
  const tabs: [typeof nbTab, string][] = [['ws', 'Worksheet'], ['ev', `Evidence (${st.evidence.filter((e) => (e.day ?? 2) === m.day).length})`], ['notes', 'Notes'], ['log', 'Command log']];
  $('nb-tabs').innerHTML = `<div class="nb-title">Lab Notebook · Day ${m.day}</div>` + tabs.map(([k, l]) => `<button role="tab" class="tab ${nbTab === k ? 'active' : ''}" data-t="${k}">${l}</button>`).join('');
  $('nb-tabs').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => { nbTab = b.dataset.t as typeof nbTab; renderNotebook(); });
  const body = $('nb-body');
  if (nbTab === 'ws') {
    if (!m.worksheet) { body.innerHTML = `<p class="muted">This practice mission has no worksheet. Follow the steps, compare your screen with the video, and pin useful outputs as evidence.</p><p class="muted">Every activity has its worksheet here.</p>`; return; }
    const ws = m.worksheet;
    body.innerHTML = `<div id="teambar"></div>` + worksheetHtml(ws, !!showMarks[ws.id]);
    renderTeamBar();
    body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-k]').forEach((el) => {
      const upd = () => { (st.ws[ws.id] ??= {})[el.dataset.k!] = el.value; save(st); };
      el.addEventListener('input', upd); el.addEventListener('change', () => { upd(); showReady(m); });
    });
  } else if (nbTab === 'ev') {
    const evs = st.evidence.filter((e) => (e.day ?? 2) === m.day);
    body.innerHTML = evs.length ? evs.map((e, i) => `<div class="ev"><div class="ev-head"><b>E${i + 1}</b> · ${esc(e.host)} · ${esc(e.time)}<button class="link" data-del="${e.id}">Remove</button></div>
      <div class="ev-cmd"><code>${esc(e.cmd)}</code></div><pre>${esc(e.text)}</pre><textarea data-note="${e.id}" rows="2" placeholder="What does this evidence show?">${esc(e.note)}</textarea></div>`).reverse().join('')
      : `<p class="muted">Evidence is proof of what you found. After a command, press <b>📌 Pin last output</b> (or select text in the terminal and press <b>📌 Pin selection</b>), then write a short note.</p>`;
    body.querySelectorAll<HTMLTextAreaElement>('[data-note]').forEach((t) => t.oninput = () => { st.evidence.find((e) => e.id === t.dataset.note)!.note = t.value; save(st); });
    body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => b.onclick = () => { st.evidence = st.evidence.filter((e) => e.id !== b.dataset.del); save(st); renderNotebook(); });
  } else if (nbTab === 'notes') {
    body.innerHTML = `<p class="muted">Your own notes for today: findings, questions for tomorrow's morning session, the step you got stuck on.</p><textarea id="notes" rows="18">${esc(st.notes)}</textarea>`;
    ($('notes') as HTMLTextAreaElement).oninput = (e) => { st.notes = (e.target as HTMLTextAreaElement).value; save(st); };
  } else {
    const logs = st.log.filter((l) => (l.day ?? 2) === m.day);
    body.innerHTML = logs.length ? `<table class="log"><tr><th>Time</th><th>Host</th><th>Command</th></tr>${logs.slice(-150).reverse().map((l) => `<tr><td>${esc(l.time)}</td><td>${esc(l.host)}</td><td>${l.out ? `<details><summary><code>${esc(l.line)}</code></summary><pre class="log-out">${esc(l.out)}</pre></details>` : `<code>${esc(l.line)}</code>`}</td></tr>`).join('')}</table><p class="muted">Click a command to see its output. Export notebook and Print / PDF include every command with its output.</p>` : '<p class="muted">Every command you run is recorded here, with its output, and included in your exported notebook.</p>';
  }
}

$('btn-check').onclick = () => {
  const m = mission(), ws = m.worksheet;
  if (!ws) return;
  const before = openDays();
  showMarks[ws.id] = true; regrade();
  if (Object.keys(grades[ws.id] ?? {}).some((k) => !k.startsWith('_'))) {
    (st.checked ??= {})[ws.id] = true;
    const sc = score(m);
    if (sc) st.checks = [...(st.checks ?? []), { mission: m.id, at: Date.now(), ok: sc.ok, total: sc.total }].slice(-100);
  }
  save(st); nbTab = 'ws'; showPane('nb'); renderNotebook(); renderMissions(); renderStatusbar();
  if (openDays() > before) { renderChrome(); toast(`🎉 Day ${m.day} finished! Day ${m.day + 1} is now unlocked.`); }
  else if (activityDone(m)) toast(`✓ ${esc(m.title)} finished.`);
  else if (!st.checked?.[ws.id]) toast('Fill in some answers first, then check.');
  else { const sc = score(m); if (sc) toast(`${sc.ok} of ${sc.total} checked answers correct.${sc.ok < sc.total ? ' Hover over a ✗ for a hint.' : ''}${(st.done[m.id] ?? []).length < m.steps.length ? ' Finish every step too.' : ''}`); }
};

// ------------------------------------------------------------------ videos, menu, class report, toast, export
function openVideo(file: string) { openVideos([file], file.replace(/\.mp4$/, '').replace(/_/g, ' ')); }
/** One or more demo videos in a dialog (a list to switch between them when there are several). */
function openVideos(files: string[], title: string) {
  const dlg = $<HTMLDialogElement>('video-dlg');
  const show = (i: number) => {
    const f = files[i];
    markVideo(f);
    dlg.innerHTML = `<div class="video-wrap"><video controls autoplay src="videos/${esc(f)}"><track kind="captions" srclang="en" label="English" src="videos/${esc(f.replace(/\.mp4$/, '.vtt'))}" default></video>
      <div class="video-bar"><span>${esc(files.length > 1 ? `${title} · ${videoTitle(f)}` : videoTitle(f))}</span><span class="btnrow">${files.length > 1 ? files.map((_, j) => `<button class="btn small ${j === i ? 'primary' : ''}" data-v="${j}">Demo ${j + 1}</button>`).join('') : ''}<button class="btn small" id="video-close">Close and practice</button></span></div></div>`;
    dlg.querySelectorAll<HTMLButtonElement>('[data-v]').forEach((b) => b.onclick = () => show(Number(b.dataset.v)));
    $('video-close').onclick = () => { dlg.querySelector('video')?.pause(); dlg.close(); if (onWork()) terms.get(activeHost)?.focus(); };
  };
  show(0);
  if (!dlg.open) dlg.showModal();
}
$('video-dlg').addEventListener('close', () => $('video-dlg').querySelector('video')?.pause());

function openMenu() {
  const dlg = $<HTMLDialogElement>('menu-dlg');
  const theme = document.documentElement.dataset.theme ?? 'auto';
  const trainer = st.trainer && st.token && syncEnabled();
  dlg.innerHTML = `<div class="menu-in"><div class="who">${esc(st.name)}</div><div class="muted">Seat ${String(st.seat).padStart(2, '0')}${st.email ? ` · ${esc(st.email)}` : ''}${st.trainer ? ' · trainer' : ''}</div>
    <a class="btn" href="#/progress" data-close>My progress</a>
    ${trainer ? '<button class="btn" id="btn-board">Trainer board</button><button class="btn" id="btn-report">Class report</button>' : ''}
    <div class="small muted" style="margin:6px 0 0">Theme</div>
    <div class="seg2">${['auto', 'light', 'dark'].map((t) => `<button data-theme="${t}" class="${theme === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
    <button class="btn" id="btn-news">🆕 What's new</button>
    <button class="btn" id="btn-user" title="Sign out or change seat" style="margin-top:6px">Switch user</button>
    <button class="btn quiet" data-close>Close</button></div>`;
  dlg.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((b) => b.onclick = () => {
    const t = b.dataset.theme!;
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { if (t === 'auto') localStorage.removeItem('ctm-theme'); else localStorage.setItem('ctm-theme', t); } catch { /* storage blocked */ }
    openMenu();
  });
  $('btn-report')?.addEventListener('click', () => { dlg.close(); openReport(); });
  $('btn-board')?.addEventListener('click', () => { dlg.close(); go('#/board'); });
  $('btn-user').onclick = switchUser;
  $('btn-news').onclick = () => { dlg.close(); updates.whatsNew(); };
  if (!dlg.open) dlg.showModal();
}
$('btn-menu').onclick = openMenu;
$('menu-dlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) $<HTMLDialogElement>('menu-dlg').close(); }); // click outside closes

// class report (trainer accounts only)
async function openReport(day?: number) {
  const dlg = $<HTMLDialogElement>('report-dlg');
  if (!dlg.open) { dlg.innerHTML = '<div class="report"><h2>Class report</h2><p class="muted">Loading the class progress…</p></div>'; dlg.showModal(); }
  let data: ReportData;
  try { data = await api<ReportData>('report', { token: st.token }); }
  catch (e) {
    dlg.innerHTML = `<div class="report"><h2>Class report</h2><p class="err">${esc((e as Error).message)}</p><p class="muted">If this says "Unknown action", the trainer must paste the new Code.gs and deploy a new version (lab/sync/README_Sync_Setup.txt).</p><button class="btn small" id="rp-close">Close</button></div>`;
    $('rp-close').onclick = () => dlg.close();
    return;
  }
  const draw = (d: number) => {
    dlg.innerHTML = reportHtml(data, PACKS, d);
    ($('rp-day') as HTMLSelectElement).onchange = (e) => draw(Number((e.target as HTMLSelectElement).value));
    $('rp-refresh').onclick = () => openReport(d);
    $('rp-csv').onclick = () => download(`CTM_Class_Report_${new Date().toISOString().slice(0, 10)}.csv`, reportCsv(data, PACKS), 'text/csv;charset=utf-8');
    $('rp-close').onclick = () => dlg.close();
  };
  draw(day ?? defaultDay(data, PACKS));
}

let toastTimer: number | undefined;
function toast(html: string) {
  const t = $('toast'); t.innerHTML = html; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t.classList.remove('show'), 5200);
}

function exportHtml(day: number) { regrade(); const p = packOf(day)!; return notebookHtml(st, day, p.missions, (m) => (m.worksheet ? grades[m.worksheet.id] ?? {} : {})); }
function exportNotebook(day: number) { download(`Day${String(day).padStart(2, '0')}_Lab_Notebook_${st.name.replace(/[^\w]+/g, '_')}_Seat${String(st.seat).padStart(2, '0')}.doc`, exportHtml(day)); }

$('btn-pin-last').onclick = () => { const t = terms.get(activeHost); if (t) pin(t.lastOutput, t.lastLine); };
$('btn-pin-sel').onclick = () => { const t = terms.get(activeHost); if (t) pin(t.term.getSelection(), t.lastLine || '(selection)'); };
$('btn-export').onclick = () => exportNotebook(pack().day);
$('btn-print').onclick = () => printHtml(exportHtml(pack().day));

let armed = 0;
async function switchUser() {
  const b = $('btn-user');
  // Non-blocking confirmation inside the page (no browser dialogs)
  if (Date.now() - armed > 4000) {
    armed = Date.now(); b.textContent = 'Click again: clears this browser\'s saved work';
    toast(st.token ? 'Your progress is saved online; you can sign in again on any computer.' : 'Export your notebook first if you need it. Switching user clears the saved work on this computer.');
    return;
  }
  armed = 0;
  // signed in online: finish saving first, so nothing done in the last few seconds is lost
  if (st.token && syncEnabled()) {
    b.setAttribute('disabled', ''); b.textContent = 'Saving…';
    const saved = await flushNow();
    b.removeAttribute('disabled'); b.textContent = 'Switch user';
    if (!saved) return toast('Not saved online yet (no connection). Your work is kept on this computer. Connect to the internet, wait for "Saved online", then switch user.');
  }
  $<HTMLDialogElement>('menu-dlg').close();
  clearSaved(); history.replaceState(null, '', '#/'); signIn(null);
}

// ------------------------------------------------------------------ submissions (trainee)
/** The trainee's latest results and open redo requests, from the server (each status check). null = not known yet. */
let mySubs: MySubs | null = null;
/** false = the Sheet runs a Code.gs from before submissions (no Submit button); null = not known yet. */
let subsOn: boolean | null = null;
function setSubs(x: MySubs | undefined) {
  if (!x) { if (subsOn !== false) { subsOn = false; if (onWork()) renderStatusbar(); } return; }
  subsOn = true;
  const prev = mySubs;
  if (JSON.stringify(prev) === JSON.stringify(x)) return;
  mySubs = x;
  if (prev && !st.trainer) {
    const title = (id: string) => ALL.find((m) => m.id === id)?.title.replace(/ · .*/, '') ?? id;
    for (const [id, s] of Object.entries(x.latest)) if (s.gradedAt && s.gradedAt !== prev.latest[id]?.gradedAt) toast(`📝 Your trainer checked ${esc(title(id))}${s.verdict ? `: <b>${verdictLabel(s.verdict)}</b>` : ''}.${s.feedback ? ` Feedback: ${esc(s.feedback)}` : ''}`);
    for (const id of Object.keys(x.redo)) if (!prev.redo[id]) toast(`↩ Your trainer returned ${esc(title(id))} for redo: ${esc(x.redo[id].note)}`);
  }
  if (onWork()) { renderMissions(); renderStatusbar(); } else if (route.name !== 'board' && route.name !== 'trainee' && route.name !== 'teams' && route.name !== 'lesson') renderPage();
}

/** Trainer's redo note or verdict + feedback, at the top of the activity's steps. */
function trainerNote(m: Mission): string {
  const redo = mySubs?.redo[m.id], sub = mySubs?.latest[m.id];
  if (redo) return `<p class="note"><b>↩ Returned by your trainer for redo.</b> ${esc(redo.note)}<br>Fix it, then press <b>Submit again</b>.</p>`;
  if (sub && (sub.verdict || sub.feedback)) return `<p class="note ${sub.verdict === 'C' ? 'good' : ''}"><b>${sub.verdict ? verdictLabel(sub.verdict) : 'Trainer feedback'}</b>${sub.feedback ? `: ${esc(sub.feedback)}` : ''}</p>`;
  if (sub) return `<p class="note info">✓ Submitted ${esc(when(sub.ts))} (attempt ${sub.attempt}, ${sub.score}/${sub.max}). Waiting for your trainer.</p>`;
  return '';
}

function openSubmit() {
  const m = mission();
  if (!isActivity(m)) return;
  regrade();
  const p = buildPayload(st, m, { facts, hosts });
  const dlg = $<HTMLDialogElement>('submit-dlg');
  const empty = m.worksheet ? Object.keys(p.verdicts).filter((k) => !(p.ws[k] ?? '').trim()).length : 0;
  const stepsLeft = p.stepsTotal - p.steps.length;
  const redo = mySubs?.redo[m.id];
  dlg.innerHTML = `<form class="sform" method="dialog"><div class="kicker">Turn in to your trainer</div><h2>Submit ${esc(m.title.replace(/ · .*/, ''))}?</h2>
    ${redo ? `<p class="note">Your trainer asked for a redo: ${esc(redo.note)}</p>` : ''}
    <table class="ptable"><tbody>
      <tr><td>Answers the lab checked</td><td><b>${p.auto} / ${p.max}</b> correct</td></tr>
      <tr><td>Steps done</td><td>${p.steps.length} / ${p.stepsTotal}</td></tr>
      <tr><td>Evidence pinned</td><td>${p.evidence.length}</td></tr>
      <tr><td>Commands recorded</td><td>${p.log.length}</td></tr></tbody></table>
    ${stepsLeft || empty ? `<p class="note">${stepsLeft ? `${stepsLeft} step(s) not done yet. ` : ''}${empty ? `${empty} answer(s) still empty. ` : ''}You can still submit now, or finish first.</p>` : ''}
    <p class="small muted">Your trainer sees your answers, evidence and commands. You can submit again later: the latest attempt counts.</p>
    <p class="err small" id="sb-err"></p>
    <div class="btnrow"><button class="btn primary" value="go" id="sb-go">Submit</button><button class="btn quiet" value="cancel">Cancel</button></div></form>`;
  $('sb-go').onclick = async (e) => {
    e.preventDefault();
    const b = $<HTMLButtonElement>('sb-go'); b.disabled = true; b.textContent = 'Submitting…';
    try {
      const r = await api<{ attempt: number; late: boolean; subs: MySubs }>('submit', { token: st.token, day: m.day, act: m.id, title: m.title, score: p.auto, max: p.max, payload: p });
      setSubs(r.subs);
      const acts = pack().missions.filter(isActivity);
      const next = acts.slice(acts.indexOf(m) + 1).find((x) => !mySubs?.latest[x.id]);
      dlg.innerHTML = `<div class="sform"><div class="kicker">Activity submitted</div><h2>✓ ${esc(m.title.replace(/ · .*/, ''))} is with your trainer</h2>
        <p>Attempt ${r.attempt} · auto-checked score <b>${p.auto} / ${p.max}</b>${r.late ? ' · sent while the Activities were closed (marked late)' : ''}.</p>
        <p class="small muted">Your trainer's verdict and feedback appear here in the lab (Day page and My progress).</p>
        <div class="btnrow">${next ? `<a class="btn primary" href="#/m/${next.id}" data-close>Next: ${esc(next.title.replace(/ · .*/, ''))} ›</a>` : ''}<a class="btn ${next ? '' : 'primary'}" href="#/day/${m.day}" data-close>Back to Day ${m.day}</a><button class="btn quiet" data-close>Stay here</button></div></div>`;
      dlg.querySelectorAll<HTMLElement>('[data-close]').forEach((x) => x.addEventListener('click', () => dlg.close()));
    } catch (err) {
      const msg = (err as Error).message;
      if (/Unknown action/.test(msg)) { subsOn = false; renderStatusbar(); }
      $('sb-err').textContent = /Unknown action/.test(msg) ? 'Submitting is not switched on yet: your trainer must update the lab server. Your work stays saved here.'
        : /fetch/i.test(msg) ? 'Cannot reach the lab server. Check your internet connection and press Submit again.' : msg;
      b.disabled = false; b.textContent = 'Submit';
    }
  };
  dlg.showModal();
}
$('btn-submit').onclick = openSubmit;

// ------------------------------------------------------------------ trainer board
let board: BoardData | null = null;
let boardDay = 0;
/** Load the board data in the background (the Day page shows the class results from it). */
async function loadBoard() {
  try { board = await api<BoardData>('board', { token: st.token }); if (!onWork() && route.name !== 'board' && route.name !== 'trainee' && route.name !== 'teams' && route.name !== 'lesson') renderPage(); }
  catch { /* the Day page keeps "Loading the class…"; the board itself shows the error */ }
}
/** Class results of one activity, from the board data. */
function cls(m: Mission) {
  if (!board) return null;
  const subs = board.subs.filter((s) => s.act === m.id);
  return { submitted: subs.length, trainees: board.trainees.length, waiting: subs.filter((s) => !s.verdict).length, c: subs.filter((s) => s.verdict === 'C').length,
    nyc: subs.filter((s) => s.verdict === 'NYC').length, redo: board.redo.filter((x) => x.act === m.id).length };
}
async function renderBoard(refresh = false) {
  const v = $('view');
  if (!board || refresh) {
    if (!board) v.innerHTML = '<div class="pagehead"><div class="kicker">Trainer board</div><h2>Submissions</h2><div class="meta">Loading the class…</div></div>';
    try { board = await api<BoardData>('board', { token: st.token }); }
    catch (e) {
      v.innerHTML = `<div class="pagehead"><h2>Trainer board</h2></div><p class="note">${esc((e as Error).message)}${/Unknown action/.test((e as Error).message) ? ' The lab server must be updated: paste the new Code.gs, run setup, and deploy a new version (lab/sync/README_Sync_Setup.txt).' : ''}</p>`;
      return;
    }
  }
  if (route.name !== 'board') return;
  if (!boardDay) boardDay = board.openDays.find((d) => packOf(d)) ?? board.subs.map((s) => s.day).sort((a, b) => b - a)[0] ?? DAYS[0].day;
  v.innerHTML = boardHtml(board, PACKS, boardDay);
  ($('bd-day') as HTMLSelectElement).onchange = (e) => { boardDay = Number((e.target as HTMLSelectElement).value); history.replaceState(null, '', `#/board/${boardDay}`); document.body.dataset.route = location.hash; renderBoard(); };
  $('bd-refresh').onclick = () => renderBoard(true);
  $('bd-csv').onclick = () => download(`CTM_Grades_${new Date().toISOString().slice(0, 10)}.csv`, gradesCsv(board!, PACKS), 'text/csv;charset=utf-8');
  $('bd-report').onclick = () => openReport(boardDay);
  $('bd-log').onclick = () => openLogExport();
  $('bd-next').onclick = () => { const q = waiting(board!); const n = q.find((s) => s.day === boardDay) ?? q[0]; if (n) openDetail(n.email, n.act); };
  v.querySelectorAll<HTMLButtonElement>('.bcell').forEach((b) => b.onclick = () => b.classList.contains('live') ? go(traineeHref(b.dataset.email!, b.dataset.act!)) : openDetail(b.dataset.email!, b.dataset.act!));
}

/** Grade answers with the trainee's own seat hosts (rebuilt from the seat number, kept for the session). */
const seatCache = new Map<number, ReturnType<typeof seatHosts>>();
function recheckOn(seatNo: number, m: Mission, values: Record<string, string>) {
  if (!m.worksheet) return null;
  const n = seatNo || 1;
  if (!seatCache.has(n)) seatCache.set(n, seatHosts(n));
  const seat = seatCache.get(n)!;
  return autoScore(m.worksheet, values, { facts: seat.facts, hosts: { 'demo-win': demoWindows(), 'demo-linux': demoLinux(), 'seat-win': seat.win, 'seat-linux': seat.linux } as Record<HostId, Host> });
}

// ------------------------------------------------------------------ trainee page: live work and activity log (trainer)
let tdata: TraineeDetail | null = null;
let mview: MonitorView = { mission: '', filter: 'all', day: 0, limit: 300 };
async function renderTrainee(refresh = false) {
  if (route.name !== 'trainee') return;
  const r = route, v = $('view');
  if (!tdata || tdata.email !== r.email || refresh) {
    if (!tdata || tdata.email !== r.email) {
      mview = { mission: '', filter: mview.filter, day: 0, limit: 300 };
      v.innerHTML = '<div class="pagehead"><div class="kicker"><a href="#/board">‹ Trainer board</a></div><h2>Trainee</h2><div class="meta">Loading the live work…</div></div>';
    }
    try { tdata = await api<TraineeDetail>('trainee', { token: st.token, email: r.email }); }
    catch (e) {
      const msg = (e as Error).message;
      v.innerHTML = `<div class="pagehead"><div class="kicker"><a href="#/board">‹ Trainer board</a></div><h2>Trainee</h2></div><p class="note">${esc(msg)}${/Unknown action/.test(msg) ? ' The lab server must be updated: paste the new Code.gs, run setup, and deploy a new version (lab/sync/README_Sync_Setup.txt).' : ''}</p>`;
      return;
    }
    if (route.name !== 'trainee' || route.email !== r.email) return;
    renderChrome();
  }
  const x = tdata;
  if (r.act) mview.mission = r.act;
  const m = pickMission(x, PACKS, mview.mission);
  const recheck = m?.worksheet ? recheckOn(x.seat, m, x.state?.ws?.[m.worksheet.id] ?? {}) : null;
  const top = v.scrollTop;
  v.innerHTML = monitorHtml(x, PACKS, LESSONS, mview, m, recheck);
  v.scrollTop = top;
  document.body.dataset.route = location.hash; // drawn (for the e2e tests)
  const pick = (id: string) => {
    mview.mission = id; r.act = id;
    history.replaceState(null, '', traineeHref(x.email, id)); renderTrainee();
    $('mn-work').scrollIntoView({ block: 'start' });
  };
  $('mn-refresh').onclick = () => renderTrainee(true);
  $('mn-csv').onclick = () => download(`CTM_Activity_Log_Seat${String(x.seat || 0).padStart(2, '0')}_${(x.name || x.email).replace(/[^A-Za-z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`,
    activityLogCsv({ day: 0, generated: x.generated, subs: x.subs, trainees: [x] }, PACKS), 'text/csv;charset=utf-8');
  ($('mn-mission') as HTMLSelectElement | null)?.addEventListener('change', (e) => pick((e.target as HTMLSelectElement).value));
  v.querySelectorAll<HTMLButtonElement>('.mchip').forEach((b) => b.onclick = () => pick(b.dataset.m!));
  v.querySelectorAll<HTMLButtonElement>('.chip[data-f]').forEach((b) => b.onclick = () => { mview.filter = b.dataset.f!; mview.limit = 300; renderTrainee(); });
  ($('mn-day') as HTMLSelectElement).onchange = (e) => { mview.day = Number((e.target as HTMLSelectElement).value); renderTrainee(); };
  $('mn-more')?.addEventListener('click', () => { mview.limit = Infinity; renderTrainee(); });
  $('mn-sub')?.addEventListener('click', (e) => openDetail(x.email, (e.currentTarget as HTMLElement).dataset.act!));
}

/** Download everyone's dated activity: the accomplishments summary, the accomplished events, or the full log; one day or all. */
function openLogExport() {
  const dlg = $<HTMLDialogElement>('board-dlg');
  const kinds = FILTERS.find((f) => f.id === 'done')!.kinds;
  dlg.innerHTML = `<div class="dhead"><div><div class="kicker">Trainer board</div><h2>Download the class activity log</h2></div><button class="btn quiet" id="lx-close">Close</button></div>
    <form class="dbody lxform" id="lx-form">
      <div class="label">Days</div>
      <label class="radio"><input type="radio" name="lx-day" value="${boardDay}" checked> <span>Day ${boardDay} only</span></label>
      <label class="radio"><input type="radio" name="lx-day" value="0"> <span>All days</span></label>
      <div class="label">What</div>
      <label class="radio"><input type="radio" name="lx-what" value="sum" checked> <span><b>Accomplishments summary</b><br><span class="small muted">One row per trainee and mission: started, steps done, answer checks and score, finished, submitted, verdict, each with its date and time.</span></span></label>
      <label class="radio"><input type="radio" name="lx-what" value="done"> <span><b>Accomplished events</b><br><span class="small muted">One row per step done, answer check, finished mission, submission and grade, with its date and time.</span></span></label>
      <label class="radio"><input type="radio" name="lx-what" value="all"> <span><b>Full activity log</b><br><span class="small muted">Everything above, plus sign-ins, lessons, videos, every command and pinned evidence.</span></span></label>
      <p class="small muted">CSV files open in Excel or Google Sheets. Dates and times are in this computer's time zone.</p>
      <div class="btnrow"><button class="btn primary" type="submit" id="lx-go">Download (CSV)</button></div>
      <p class="err small" id="lx-err"></p>
    </form>`;
  if (!dlg.open) dlg.showModal();
  $('lx-close').onclick = () => dlg.close();
  ($('lx-form') as HTMLFormElement).onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const day = Number(f.get('lx-day')), what = String(f.get('lx-what'));
    const btn = $<HTMLButtonElement>('lx-go');
    btn.disabled = true; btn.textContent = 'Preparing…';
    let data: ClassLog;
    try { data = await api<ClassLog>('classLog', { token: st.token, day }); }
    catch (er) {
      const msg = (er as Error).message;
      btn.disabled = false; btn.textContent = 'Download (CSV)';
      $('lx-err').textContent = msg + (/Unknown action/.test(msg) ? ' Paste the new Code.gs and deploy a new version first.' : '');
      return;
    }
    const name = ({ sum: 'Accomplishments', done: 'Accomplished_Events', all: 'Activity_Log' } as Record<string, string>)[what] ?? 'Activity_Log';
    const text = what === 'sum' ? accomplishmentsCsv(data, PACKS) : activityLogCsv(data, PACKS, what === 'done' ? kinds : []);
    download(`CTM_${name}_${day ? `Day${day}` : 'All_Days'}_${new Date().toISOString().slice(0, 10)}.csv`, text, 'text/csv;charset=utf-8');
    dlg.close();
    toast(`Downloaded: ${name.replace(/_/g, ' ')} (${day ? `Day ${day}` : 'all days'}).`);
  };
}

/** The board and the trainee page update every minute while on screen (not while a dialog is open, text is selected or an output is open). */
setInterval(() => {
  if (document.visibilityState !== 'visible' || !isTrainer() || $<HTMLDialogElement>('board-dlg').open || $<HTMLDialogElement>('report-dlg').open) return;
  if (String(window.getSelection() ?? '')) return;
  if (route.name === 'board') renderBoard(true);
  else if (route.name === 'trainee' && !$('view').querySelector('details[open]')) renderTrainee(true);
}, 60000);

/** One submission: the answers re-checked against the trainee's own seat, evidence, commands; verdict, feedback, redo. */
async function openDetail(email: string, act: string, attempt?: number) {
  const dlg = $<HTMLDialogElement>('board-dlg');
  if (!dlg.open) { dlg.innerHTML = '<div class="dbody"><p class="muted">Loading the submission…</p></div>'; dlg.showModal(); }
  let x: Detail;
  try { x = await api<Detail>('submission', { token: st.token, email, act, attempt }); }
  catch (e) { dlg.innerHTML = `<div class="dbody"><p class="err">${esc((e as Error).message)}</p><button class="btn" id="dt-close">Close</button></div>`; $('dt-close').onclick = () => dlg.close(); return; }
  const m = ALL.find((y) => y.id === act);
  const recheck = m?.worksheet && x.payload ? recheckOn(x.seat, m, x.payload.ws) : null;
  const others = () => waiting(board ?? { subs: [] } as unknown as BoardData).filter((s) => !(s.email === email && s.act === act));
  dlg.innerHTML = detailHtml(x, m, recheck, others().length);
  $('dt-close').onclick = () => dlg.close();
  dlg.querySelectorAll<HTMLButtonElement>('[data-attempt]').forEach((b) => b.onclick = () => openDetail(email, act, Number(b.dataset.attempt)));
  let verdict = x.history.find((h) => h.attempt === x.attempt)!.verdict as string;
  dlg.querySelectorAll<HTMLButtonElement>('.verdict button').forEach((b) => b.onclick = () => {
    verdict = b.dataset.v!; dlg.querySelectorAll('.verdict button').forEach((y) => y.classList.toggle('on', y === b));
  });
  const err = (msg: string) => { $('dt-err').textContent = msg; };
  const local = (fn: (s: BoardData['subs'][number]) => void) => { const s = board?.subs.find((y) => y.email === email && y.act === act); if (s && x.latest) fn(s); };
  ($('dt-form') as HTMLFormElement).onsubmit = async (e) => {
    e.preventDefault();
    const goNext = (e as SubmitEvent).submitter?.getAttribute('data-next') === '1';
    const feedback = ($('dt-fb') as HTMLTextAreaElement).value.trim();
    try { await api('grade', { token: st.token, email, act, attempt: x.attempt, verdict, feedback }); }
    catch (er) { return err((er as Error).message); }
    local((s) => { s.verdict = verdict as '' | 'C' | 'NYC'; s.feedback = feedback; s.gradedAt = Date.now(); });
    renderBoard();
    const n = others()[0];
    if (goNext && n) { boardDay = n.day; renderBoard(); openDetail(n.email, n.act); }
    else { dlg.close(); toast(`Saved: ${esc(x.name)} · ${esc(x.title.replace(/ · .*/, ''))}${verdict ? ` · ${verdictLabel(verdict)}` : ''}`); }
  };
  $('dt-redo')?.addEventListener('click', () => { $('dt-redo-box').hidden = false; ($('dt-redo-note') as HTMLTextAreaElement).focus(); });
  $('dt-redo-send')?.addEventListener('click', async () => {
    const note = ($('dt-redo-note') as HTMLTextAreaElement).value.trim();
    if (!note) return err('Write what the trainee should fix.');
    try { await api('redo', { token: st.token, email, act, note }); } catch (er) { return err((er as Error).message); }
    board?.redo.push({ email, act, note, at: Date.now() });
    dlg.close(); renderBoard(); toast(`Returned for redo: ${esc(x.name)} · ${esc(x.title.replace(/ · .*/, ''))}`);
  });
  $('dt-unredo')?.addEventListener('click', async () => {
    try { await api('redo', { token: st.token, email, act, cancel: true }); } catch (er) { return err((er as Error).message); }
    if (board) board.redo = board.redo.filter((r) => !(r.email === email && r.act === act));
    openDetail(email, act, x.attempt); renderBoard();
  });
}

// ------------------------------------------------------------------ team: share answers, open a teammate's, copy them
/** Above an activity's worksheet: share my answers with my team, and open the answers my teammates share. */
function renderTeamBar() {
  const el = document.getElementById('teambar');
  if (!el) return;
  const m = mission();
  const info = social.info();
  if (!onWork() || !isActivity(m) || !m.worksheet || !info || !info.team || isTrainer()) { el.className = ''; el.innerHTML = ''; return; }
  if (!info.shareDays.includes(m.day)) {
    el.className = 'teambar off';
    el.innerHTML = `🤝 Answer sharing in ${esc(info.team)} is off for Day ${m.day}. You can still ask your team in the <button class="link" id="tb-chat">team chat</button>.`;
    $('tb-chat').onclick = () => social.open('chat');
    return;
  }
  const mine = info.shares.some((s) => s.mine && s.act === m.id);
  const others = info.shares.filter((s) => !s.mine && s.act === m.id);
  el.className = 'teambar';
  el.innerHTML = `<label class="tb-share"><input type="checkbox" id="tb-share" ${mine ? 'checked' : ''}> 🤝 Share my answers with ${esc(info.team)}</label>
    <span class="tb-others">${others.length ? `Shared by ${others.map((s) => `<button class="link" data-share="${s.id}" title="Open the answers of ${esc(s.name)}">${esc(s.name)}</button>`).join(', ')}` : '<span class="muted">No teammate shares this activity yet.</span>'}</span>`;
  const box = $<HTMLInputElement>('tb-share');
  box.onchange = async () => {
    const on = box.checked;
    box.disabled = true;
    try {
      if (on) await flushNow(); // teammates read the answers saved online: send the latest first
      const r = await api<{ shares: Share[] }>('share', { token: st.token, day: m.day, act: m.id, ws: m.worksheet!.id, on });
      social.setShares(r.shares);
      toast(on ? `🤝 ${esc(actName(m, m.id))}: your answers are shared with ${esc(info.team)}. They always see your latest saved answers.` : `${esc(actName(m, m.id))}: you stopped sharing your answers.`);
    } catch (err) { toast(esc((err as Error).message)); box.checked = !on; }
    finally { box.disabled = false; }
  };
  el.querySelectorAll<HTMLButtonElement>('[data-share]').forEach((b) => b.onclick = () => { const s = info.shares.find((x) => x.id === Number(b.dataset.share)); if (s) openShare(s); });
}

/** A teammate's shared answers. Answers that depend on the seat (right on their seat, not on mine) are not copied. */
async function openShare(s: Share) {
  const dlg = $<HTMLDialogElement>('board-dlg');
  dlg.innerHTML = '<div class="dbody"><p class="muted">Loading the shared answers…</p></div>';
  if (!dlg.open) dlg.showModal();
  const fail = (msg: string) => { dlg.innerHTML = `<div class="dbody"><p class="err">${esc(msg)}</p><button class="btn" id="sh-close">Close</button></div>`; $('sh-close').onclick = () => dlg.close(); };
  let x: SharedAnswers;
  try { x = await api<SharedAnswers>('shared', { token: st.token, id: s.id }); } catch (e) { return fail((e as Error).message); }
  const m = ALL.find((y) => y.id === x.act);
  const ws = m?.worksheet;
  const plan = (vals: Record<string, string>) => (m && ws ? copyPlan(ws, vals, recheckOn(x.seat, m, vals)?.verdicts ?? {}, autoScore(ws, vals, { facts, hosts }).verdicts) : null);
  const canCopy = !isTrainer() && !x.mine && !!ws && unlocked(m!.day) && activityOpen(m!.day);
  const why = isTrainer() || !m ? '' : x.mine ? 'These are your own answers, as your teammates see them.' : !unlocked(m.day) ? `Day ${m.day} is still locked for you, so you cannot copy yet.` : !activityOpen(m.day) ? esc(gateReason(m.day)) : '';
  const p0 = plan(x.values);
  dlg.innerHTML = sharedHtml(x, m, p0, canCopy, why, ws ? st.ws[ws.id] ?? {} : {});
  $('sh-close').onclick = () => dlg.close();
  $('sh-open')?.addEventListener('click', () => { nbTab = 'ws'; dlg.close(); });
  $('sh-copy')?.addEventListener('click', async () => {
    const b = $<HTMLButtonElement>('sh-copy'); b.disabled = true; b.textContent = 'Copying…';
    let fresh: SharedAnswers;
    try { fresh = await api<SharedAnswers>('shared', { token: st.token, id: s.id, copy: true, fields: Object.keys(p0?.copy ?? {}).length }); }
    catch (e) { $('sh-err').textContent = (e as Error).message; b.disabled = false; b.textContent = 'Copy into my worksheet'; return; }
    const p = plan(fresh.values)!;
    offerDone([s]);
    Object.assign((st.ws[ws!.id] ??= {}), p.copy);
    showMarks[ws!.id] = false;
    save(st);
    dlg.close();
    const n = Object.keys(p.copy).length;
    toast(`⧉ Copied ${n} answer${n === 1 ? '' : 's'} from ${esc(x.name)}.${p.seatOnly.length ? ` Find the ${p.seatOnly.length} seat-specific answer${p.seatOnly.length === 1 ? '' : 's'} on your own seat.` : ''} Read each one, then press <b>Check my answers</b>.`);
    nbTab = 'ws';
    if (onWork() && mission().id === m!.id) { showPane('nb'); renderNotebook(); renderStatusbar(); showReady(m!, true); } else go(`#/m/${m!.id}`);
  });
}

// ------------------------------------------------------------------ team: the fill-in offer and "ready to submit"
// When a teammate shares the activity I am on (when I open it, or while I work on it), a modal offers to fill in my whole
// worksheet with their answers. Each offer is answered once (per share, per account, on this computer).
const offerKey = () => `ctm-share-offer:${st?.email ?? ''}`;
function offersDone(): Record<string, number> { try { return JSON.parse(localStorage.getItem(offerKey()) || '{}'); } catch { return {}; } }
function offerDone(list: Share[]) {
  const o = offersDone();
  for (const s of list) o[s.id] = s.t;
  try { localStorage.setItem(offerKey(), JSON.stringify(o)); } catch { /* storage blocked: the offer may show again */ }
}
const dlgBusy = () => ['board-dlg', 'submit-dlg', 'video-dlg', 'menu-dlg', 'report-dlg', 'signin', 'update-dlg'].some((id) => $<HTMLDialogElement>(id)?.open);
let offering = false;
async function maybeOffer() {
  if (offering || !st?.token || !onWork() || isTrainer() || dlgBusy() || !$('watch').hidden) return;
  const m = mission(), ws = m.worksheet;
  if (!isActivity(m) || !ws || !activityOpen(m.day) || !unlocked(m.day)) return;
  const info = social.info();
  if (!info?.team || !info.shareDays.includes(m.day)) return;
  const done = offersDone();
  const list = info.shares.filter((s) => !s.mine && s.act === m.id && done[s.id] !== s.t);
  if (!list.length) return;
  offering = true;
  try { await offerShare(m, list); } finally { offering = false; }
}

async function offerShare(m: Mission, list: Share[]) {
  const ws = m.worksheet!;
  const plan = (x: SharedAnswers) => copyPlan(ws, x.values, recheckOn(x.seat, m, x.values)?.verdicts ?? {}, autoScore(ws, x.values, { facts, hosts }).verdicts);
  let got: (SharedAnswers | null)[];
  try { got = await Promise.all(list.map((s) => api<SharedAnswers>('shared', { token: st.token, id: s.id }).catch(() => null))); } catch { return; }
  const mine = () => st.ws[ws.id] ?? {};
  // only offers that would change something
  const offers: Offer[] = got.filter((x): x is SharedAnswers => !!x).map((x) => ({ x, plan: plan(x) }))
    .filter((o) => [...Object.keys(o.plan.copy), ...o.plan.seatOnly].some((k) => (mine()[k] ?? '') !== o.x.values[k]));
  if (!offers.length) { offerDone(list); return; }
  if (!onWork() || mission().id !== m.id || dlgBusy()) return; // moved on while loading: offer next time
  offers.sort((a, b) => Object.keys(b.x.values).length - Object.keys(a.x.values).length || b.x.updated - a.x.updated);
  const dlg = $<HTMLDialogElement>('board-dlg');
  let pick = 0, withSeat = false;
  const draw = () => {
    dlg.innerHTML = offerHtml(m, offers, pick, mine(), withSeat);
    dlg.querySelectorAll<HTMLInputElement>('input[name="of-who"]').forEach((r) => r.onchange = () => { pick = Number(r.value); withSeat = false; draw(); });
    const seat = dlg.querySelector<HTMLInputElement>('#of-seat');
    if (seat) seat.onchange = () => { withSeat = seat.checked; draw(); };
    $('of-no').onclick = () => dlg.close();
    $('of-go').onclick = async () => {
      const b = $<HTMLButtonElement>('of-go'); b.disabled = true; b.textContent = 'Filling in…';
      const o = offers[pick];
      let fresh: SharedAnswers;
      try { fresh = await api<SharedAnswers>('shared', { token: st.token, id: o.x.id, copy: true, fields: Object.keys(o.plan.copy).length + (withSeat ? o.plan.seatOnly.length : 0) }); }
      catch (e) { $('of-err').textContent = (e as Error).message; b.disabled = false; b.textContent = 'Fill in my worksheet'; return; }
      const f: Offer = { x: fresh, plan: plan(fresh) };
      st.ws[ws.id] = filledAfter(ws, mine(), f, withSeat);
      showMarks[ws.id] = false;
      save(st);
      dlg.close();
      nbTab = 'ws'; showPane('nb'); renderNotebook(); renderStatusbar();
      toast(`⧉ Your worksheet is filled in with ${esc(fresh.name)}'s answers.`);
      showReady(m, true);
    };
  };
  draw();
  dlg.addEventListener('close', () => offerDone(list), { once: true }); // filled or "Not now": asked once
  dlg.showModal();
}

/** "Every answer is filled in: ready to submit" (or what is still empty, right after a fill). Once per worksheet per session, unless forced. */
const readyShown = new Set<string>();
function showReady(m: Mission, force = false) {
  const ws = m.worksheet;
  if (!ws || !isActivity(m) || isTrainer() || dlgBusy()) return;
  const vals = st.ws[ws.id] ?? {};
  const complete = !emptyKeys(ws, vals).length;
  if (!force && (!complete || readyShown.has(ws.id))) return;
  const sub = mySubs?.latest[m.id];
  if (!force && sub && !mySubs?.redo[m.id]) return; // already submitted: no reminder while typing
  if (complete) readyShown.add(ws.id);
  const dlg = $<HTMLDialogElement>('board-dlg');
  dlg.innerHTML = readyHtml(m, vals, (st.done[m.id] ?? []).filter((id) => m.steps.some((s) => s.id === id)).length, !!sub);
  dlg.showModal();
  $('rd-ok')?.addEventListener('click', () => dlg.close());
  $('rd-later')?.addEventListener('click', () => dlg.close());
  $('rd-check')?.addEventListener('click', () => { dlg.close(); $('btn-check').click(); });
  $('rd-submit')?.addEventListener('click', () => {
    dlg.close();
    if (!$('btn-submit').hidden) openSubmit();
    else toast('Submitting needs the online lab: sign in online, and your trainer must have updated the lab server.');
  });
}

// ------------------------------------------------------------------ teams page (trainer)
let teamDraft: TeamDraft = { teams: {}, extra: [] };
async function renderTeams(refresh = false) {
  const v = $('view');
  if (board) drawTeams();
  else v.innerHTML = '<div class="pagehead"><div class="kicker">Trainer board</div><h2>Teams</h2><div class="meta">Loading the class…</div></div>';
  if (board && !refresh) return;
  try { board = await api<BoardData>('board', { token: st.token }); }
  catch (e) { if (route.name === 'teams' && !$('view').querySelector('.tcols')) v.innerHTML = `<div class="pagehead"><h2>Teams</h2></div><p class="note">${esc((e as Error).message)}</p>`; return; }
  drawTeams();
}
function drawTeams() {
  if (route.name !== 'teams' || !board) return;
  const v = $('view'), b = board, top = v.scrollTop;
  v.innerHTML = teamsHtml(b, PACKS, teamDraft);
  v.scrollTop = top;
  document.body.dataset.route = location.hash; // drawn (for the e2e tests)
  const move = (email: string, team: string) => { teamDraft.teams[email] = team; drawTeams(); };
  v.querySelectorAll<HTMLSelectElement>('[data-move]').forEach((sel) => sel.onchange = () => move(sel.dataset.move!, sel.value));
  v.querySelectorAll<HTMLElement>('.tcard').forEach((c) => {
    c.ondragstart = (e) => { e.dataTransfer!.setData('text/plain', c.dataset.email!); e.dataTransfer!.effectAllowed = 'move'; c.classList.add('dragging'); };
    c.ondragend = () => c.classList.remove('dragging');
  });
  v.querySelectorAll<HTMLElement>('.tcol').forEach((col) => {
    col.ondragover = (e) => { e.preventDefault(); col.classList.add('over'); };
    col.ondragleave = () => col.classList.remove('over');
    col.ondrop = (e) => { e.preventDefault(); col.classList.remove('over'); const em = e.dataTransfer!.getData('text/plain'); if (em) move(em, col.dataset.team!); };
  });
  v.querySelectorAll<HTMLInputElement>('[data-rename]').forEach((inp) => inp.onchange = () => {
    const old = inp.dataset.rename!, name = inp.value.replace(/\s+/g, ' ').trim();
    const taken = teamList(b.trainees, teamDraft).includes(name);
    if (!name || name === old || taken || /^announcements$/i.test(name)) {
      if (taken && name !== old) toast(`There is already a team called ${esc(name)}. Drag the members across instead.`);
      if (/^announcements$/i.test(name)) toast('"Announcements" cannot be a team name.');
      inp.value = old; return;
    }
    for (const t of b.trainees) if ((t.email in teamDraft.teams ? teamDraft.teams[t.email] : t.team ?? '') === old) teamDraft.teams[t.email] = name;
    teamDraft.extra = teamDraft.extra.map((x) => (x === old ? name : x));
    drawTeams();
  });
  $('tm-new').onclick = () => {
    const names = teamList(b.trainees, teamDraft);
    let i = names.length + 1;
    while (names.includes(`Team ${i}`)) i++;
    teamDraft.extra.push(`Team ${i}`);
    drawTeams();
  };
  $('tm-balance').onclick = () => {
    const n = Math.max(1, Math.round(Number(($('tm-n') as HTMLInputElement).value) || 2));
    teamDraft = { teams: balance(b.trainees, PACKS, n, teamList(b.trainees, { teams: {}, extra: [] })), extra: [] };
    drawTeams();
    toast(`Balanced the class into ${n} team${n === 1 ? '' : 's'}. Check them, then press <b>Save</b>.`);
  };
  $('tm-undo').onclick = () => { teamDraft = { teams: {}, extra: [] }; drawTeams(); };
  $('tm-save').onclick = async () => {
    const list = teamChanges(b.trainees, teamDraft);
    if (!list.length) return;
    const btn = $<HTMLButtonElement>('tm-save'); btn.disabled = true; btn.textContent = 'Saving…';
    try { await api('teamSet', { token: st.token, changes: list }); }
    catch (e) { toast(esc((e as Error).message)); btn.disabled = false; btn.textContent = 'Save'; return; }
    for (const c of list) { const t = b.trainees.find((x) => x.email === c.email); if (t) t.team = c.team; }
    teamDraft = { teams: {}, extra: teamDraft.extra.filter((x) => !b.trainees.some((t) => t.team === x)) };
    drawTeams();
    toast(`Saved: ${list.length} trainee${list.length === 1 ? '' : 's'} moved. Their team rooms update within seconds.`);
  };
}

// ------------------------------------------------------------------ start
const openDays = () => DAYS.filter((p) => unlocked(p.day)).length;
function announceUnlock(before: number) {
  if (openDays() > before) { renderChrome(); toast(`🎉 Day ${mission().day} finished! Day ${mission().day + 1} is now unlocked.`); }
}

onStatus(setSyncChip);
/** Every minute (and when the window gets focus): which days the trainer has opened, who is online, new chat.
 *  The current mission goes along, so the trainer's online list shows what each trainee is working on. */
function pollGate() {
  if (!syncEnabled() || !st?.token) return;
  const m = mission();
  api<StatusReply>('status', { token: st.token, mission: !onWork() ? 'Browsing the lab' : m.kind === 'workspace' ? 'Workspace' : m.title })
    .then((r) => { setGate(r.openDays, r.trainer); setSubs((r as StatusReply & { subs?: MySubs }).subs); social.update(r); }).catch(() => { /* keep the last known gate */ });
}
const social = new Social(api, () => st?.token, () => st?.email ?? '', toast, pollGate, {
  actTitle: (id) => ALL.find((m) => m.id === id)?.title ?? id,
  openShare: (s) => openShare(s),
  onShares: () => { renderTeamBar(); void maybeOffer(); },
});
setInterval(pollGate, 60000);
setInterval(() => void maybeOffer(), 15000); // an offer skipped while another dialog or the video was open
window.addEventListener('focus', pollGate);
onSave((s) => { if (s === st) stamp(); if (s === st && s.token) queueSync(s, progressSummary()); });
window.addEventListener('pagehide', flushOnExit);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushOnExit(); });

// a newer published lab: tell the trainee (modal), save their work, reload only when they choose
const updates = new Updates({
  busy: () => ['board-dlg', 'submit-dlg', 'video-dlg', 'menu-dlg', 'report-dlg', 'signin'].some((id) => $<HTMLDialogElement>(id)?.open),
  trainer: () => isTrainer(),
  flush: () => { saveNow(st); return st?.token ? flushNow() : Promise.resolve(true); },
  savedText: () => (st?.token ? "Everything you did is saved on this computer and sent to your trainer's Sheet before the update." : 'Everything you did is saved on this computer.'),
  toast,
  returning: () => !!load(),
});

const saved = load();
updates.start();
if (saved) {
  st = saved; boot();
  // Signed in before: pick up newer progress saved on another computer, or ask to sign in again
  if (syncEnabled() && saved.token) {
    api<{ state: LabState | null; updated: number; trainer: boolean; openDays?: number[] }>('load', { token: saved.token }).then((r) => {
      st.trainer = r.trainer;
      gateDays = Array.isArray(r.openDays) ? r.openDays.map(Number) : gateDays;
      if (r.state && r.updated > (st.updatedAt ?? 0)) { st = { ...r.state, token: saved.token, email: saved.email, trainer: r.trainer }; save(st); boot(); toast('Loaded your newer progress from another computer.'); }
      else { setSyncChip({ kind: 'saved', text: 'Saved online' }); if (!leaveLockedActivity()) renderAll(); }
    }).catch((err) => {
      if ((err as { server?: boolean }).server) { toast(esc((err as Error).message)); delete st.token; signIn(st); }
      else setSyncChip({ kind: 'offline', text: 'Offline: saved on this PC, will retry' });
    });
  } else if (syncEnabled()) {
    // An offline session (never signed in online): ask to sign in, so progress reaches the trainer.
    // "Work offline" on that screen continues the same session.
    signIn(saved);
  }
} else signIn(null);

