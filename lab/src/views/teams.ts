// Teams page (trainer, #/teams): rearrange the class into teams. Drag a trainee to another team (or use the menu on the card),
// add or rename a team, or let the lab balance the class into N teams that mix fast and slower trainees, so the
// members can help each other. Nothing changes until Save; Save writes the Roster tab, column E (sync/Code.gs: teamSet).
import type { ScenarioPack } from '../missions/types';
import type { ReportTrainee } from '../ui/report';
import { dayProgress } from '../ui/report';
import type { BoardData } from './board';
import { isOnline } from './board';
import { esc } from './pages';

export interface TeamDraft { teams: Record<string, string>; extra: string[] } // email -> team ('' = no team); empty teams added on the page
export const NO_TEAM = '';

/** Activities finished (all steps and the worksheet checked), over every day: the measure used to mix the teams. */
export function finished(t: ReportTrainee, packs: ScenarioPack[]): number {
  return packs.filter((p) => p.day > 0).reduce((n, p) => n + dayProgress(t, p).actsDone.n, 0);
}

/** The team of each trainee after the draft. */
export const teamOf = (d: TeamDraft, t: ReportTrainee) => (t.email in d.teams ? d.teams[t.email] : t.team ?? '');

/** Every team name: from the trainees (with the draft) and the empty teams added on the page, sorted. */
export function teamList(trainees: ReportTrainee[], d: TeamDraft): string[] {
  const s = new Set<string>(d.extra);
  for (const t of trainees) { const x = teamOf(d, t); if (x) s.add(x); }
  return [...s].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Changes to save: trainees whose team in the draft differs from the Roster. */
export function changes(trainees: ReportTrainee[], d: TeamDraft): { email: string; team: string }[] {
  return trainees.filter((t) => t.email in d.teams && d.teams[t.email] !== (t.team ?? '')).map((t) => ({ email: t.email, team: d.teams[t.email] }));
}

/**
 * Balance the class into n teams: sorted by activities finished (most first), dealt in a snake order (1,2,3,3,2,1,…) so
 * every team gets some trainees who are ahead and some who need help. Names: the current teams first, then "Team 1", "Team 2"…
 */
export function balance(trainees: ReportTrainee[], packs: ScenarioPack[], n: number, names: string[]): Record<string, string> {
  const k = Math.max(1, Math.min(n, trainees.length || 1));
  const use = names.slice(0, k);
  for (let i = 1; use.length < k; i++) if (!use.includes(`Team ${i}`)) use.push(`Team ${i}`);
  const order = trainees.slice().sort((a, b) => finished(b, packs) - finished(a, packs) || (a.seat || 99) - (b.seat || 99));
  const out: Record<string, string> = {};
  order.forEach((t, i) => { const round = Math.floor(i / k), pos = i % k; out[t.email] = use[round % 2 ? k - 1 - pos : pos]; });
  return out;
}

export function teamsHtml(d: BoardData, packs: ScenarioPack[], draft: TeamDraft): string {
  const tr = d.trainees;
  const teams = teamList(tr, draft);
  const pending = changes(tr, draft).length;
  const card = (t: ReportTrainee) => {
    const cur = teamOf(draft, t), moved = t.email in draft.teams && draft.teams[t.email] !== (t.team ?? '');
    const on = isOnline(d.presence?.[t.email]);
    return `<li class="tcard${moved ? ' moved' : ''}" draggable="true" data-email="${esc(t.email)}">
      <div class="tc-top"><span class="dot ${on ? 'on' : ''}" title="${on ? 'Online' : 'Offline'}"></span><b>${esc(t.name || t.email)}</b></div>
      <div class="small muted">Seat ${String(t.seat || 0).padStart(2, '0')} · ${finished(t, packs)} activities done${moved ? ` · <span class="tc-was">was ${esc(t.team || 'no team')}</span>` : ''}</div>
      <label class="small tc-move">Move to <select data-move="${esc(t.email)}" aria-label="Team of ${esc(t.name || t.email)}">
        <option value="" ${cur === '' ? 'selected' : ''}>No team</option>${teams.map((x) => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label></li>`;
  };
  const col = (name: string) => {
    const list = tr.filter((t) => teamOf(draft, t) === name).sort((a, b) => (a.seat || 99) - (b.seat || 99));
    const on = list.filter((t) => isOnline(d.presence?.[t.email])).length;
    return `<section class="tcol${name ? '' : ' none'}" data-team="${esc(name)}">
      <header>${name ? `<input class="tc-name" data-rename="${esc(name)}" value="${esc(name)}" maxlength="40" aria-label="Team name" title="Click to rename this team">` : '<b>No team</b>'}
        <span class="small muted">${list.length} · ${on} online</span></header>
      <ul class="tlist">${list.map(card).join('') || `<li class="tc-empty small muted">${name ? 'Drag trainees here' : 'Everyone is in a team'}</li>`}</ul></section>`;
  };
  const share = d.shareDays?.length ? `Answer sharing is <b>on</b> for Day ${d.shareDays.length === 15 ? 'all days' : d.shareDays.join(', ')}` : 'Answer sharing is <b>off</b>';
  return `<div class="pagehead"><div class="kicker">Trainer board · Teams</div><h2>Teams</h2>
      <div class="meta">Put trainees in teams so they help each other. Each team gets its own room: members, team chat and shared answers.
        Drag a trainee to another team, or use <b>Move to</b> on the card. Click a team name to rename it. Nothing changes until you press <b>Save</b>.
        ${share} (Settings tab > Answer Sharing). Every copied answer is flagged on the board.</div></div>
    <div class="boardbar">
      <button class="btn" id="tm-new">+ New team</button>
      <label class="small muted">Balance the class into <input type="number" id="tm-n" min="1" max="${Math.max(1, tr.length)}" value="${Math.max(2, teams.length || Math.round(tr.length / 4) || 2)}" class="tm-n"> teams</label>
      <button class="btn" id="tm-balance" title="Mix trainees who are ahead with trainees who need help">Balance</button>
      <span class="grow"></span>
      <span class="small ${pending ? 'warn' : 'muted'}" id="tm-pending">${pending ? `${pending} change${pending === 1 ? '' : 's'} not saved` : 'No changes'}</span>
      <button class="btn quiet" id="tm-undo" ${pending || draft.extra.length ? '' : 'disabled'}>Undo changes</button>
      <button class="btn primary" id="tm-save" ${pending ? '' : 'disabled'}>Save</button></div>
    <div class="tcols">${[NO_TEAM, ...teams].map(col).join('')}</div>
    <p class="small muted">Balance sorts the class by activities finished and deals them out in turn (1, 2, 3, 3, 2, 1…), so every team gets trainees who are ahead and trainees who need help.
      Saving writes the Team column (E) of the Roster tab; trainees see their new team within seconds. A trainee in no team has no team room.</p>`;
}
