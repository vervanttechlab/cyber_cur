// Answer sharing in a team (sync/Code.gs: share, shared). A trainee shares the answers of one activity with their team;
// a teammate opens them and may copy them into their own worksheet. Every copy is recorded on the server (Copies tab)
// and flagged on the Trainer board. Answers that depend on the seat are not copied: each seat has its own evidence,
// so the copier must find those with the commands on their own seat.
import type { Mission, Worksheet } from '../missions/types';
import { fieldKeys } from './submit';
import { esc } from '../views/pages';
import { ago } from '../views/board';

export interface Share { id: number; name: string; seat: number; day: number; act: string; t: number; mine: boolean }
export interface SharedAnswers { id: number; name: string; seat: number; day: number; act: string; ws: string; values: Record<string, string>; steps?: string[]; updated: number; mine: boolean }
export interface CopyPlan { copy: Record<string, string>; seatOnly: string[] }

/**
 * Which answers a teammate can copy. ownerOk / mineOk: the grader's verdicts for these answers on the owner's seat and on the
 * copier's seat. An answer that is right on the owner's seat but not on the copier's depends on the seat: it is not copied.
 * Everything else that has a value is copied (answers the lab does not check, such as explanations, too).
 */
export function copyPlan(ws: Worksheet, values: Record<string, string>, ownerOk: Record<string, boolean>, mineOk: Record<string, boolean>): CopyPlan {
  const copy: Record<string, string> = {}, seatOnly: string[] = [];
  for (const k of fieldKeys(ws)) {
    const v = values[k];
    if (v === undefined || String(v).trim() === '') continue;
    if (ownerOk[k] === true && mineOk[k] === false) seatOnly.push(k);
    else copy[k] = v;
  }
  return { copy, seatOnly };
}

/** Readable label of every answer key of a worksheet. */
export function fieldLabels(ws: Worksheet): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of ws.tables ?? []) for (const r of t.rows) for (const c of t.columns) out[`${t.id}.${r.id}.${c.id}`] = [t.title, r.label ?? r.id, c.label].filter(Boolean).join(' · ');
  for (const f of ws.fields ?? []) out[f.id] = f.label;
  return out;
}

export const actName = (m: Mission | undefined, id: string) => (m ? m.title.replace(/ · .*/, '') : id);
const seatTxt = (n: number) => `Seat ${String(n || 0).padStart(2, '0')}`;

/** The shared answers dialog. canCopy = the viewer may copy now (a trainee, the activity is open for them). */
export function sharedHtml(x: SharedAnswers, m: Mission | undefined, plan: CopyPlan | null, canCopy: boolean, why: string, mine: Record<string, string>): string {
  const ws = m?.worksheet;
  const lab = ws ? fieldLabels(ws) : {};
  const keys = ws ? fieldKeys(ws).filter((k) => (x.values[k] ?? '').trim() !== '') : Object.keys(x.values);
  const seat = new Set(plan?.seatOnly ?? []);
  const n = plan ? Object.keys(plan.copy).length : 0;
  const replace = plan ? Object.keys(plan.copy).filter((k) => (mine[k] ?? '').trim() !== '' && mine[k] !== plan.copy[k]).length : 0;
  const rows = keys.map((k) => `<tr class="${seat.has(k) ? 'seat' : ''}"><td class="small">${esc(lab[k] ?? k)}</td><td>${esc(x.values[k]).replace(/\n/g, '<br>')}</td>
    <td class="small">${seat.has(k) ? '<span class="tag warn" title="Your seat has different evidence. Find this answer with the commands on your own seat.">YOUR SEAT DIFFERS</span>' : ''}</td></tr>`).join('');
  return `<div class="dhead"><div><div class="kicker">🤝 Shared by your teammate · ${esc(seatTxt(x.seat))}${x.updated ? ` · saved ${esc(ago(x.updated))}` : ''}</div>
      <h2>${esc(x.name)} · ${esc(m?.title ?? x.act)}</h2></div><button class="btn quiet" id="sh-close">Close</button></div>
    <div class="dbody">
      ${keys.length ? `<table class="ptable sh-table"><thead><tr><th>Question</th><th>${esc(x.name.split(' ')[0])}'s answer</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
        : `<p class="note">${esc(x.name)} has not typed any answers yet. They are saved online a few seconds after typing.</p>`}
      ${seat.size ? `<p class="note"><b>${seat.size} answer${seat.size === 1 ? '' : 's'} depend${seat.size === 1 ? 's' : ''} on the seat.</b> Every seat has its own hosts and evidence, so ${esc(x.name.split(' ')[0])}'s value is not right on your seat. These are not copied: run the commands on your own seat to find them. Ask in the team chat how to find them.</p>` : ''}
      ${canCopy && n ? `<p class="small muted">Copying puts ${n} answer${n === 1 ? '' : 's'} into your worksheet${replace ? ` and replaces ${replace} answer${replace === 1 ? '' : 's'} you typed` : ''}. <b>Your trainer sees that you copied, and from whom.</b> Make sure you understand each answer: you still press <b>Check my answers</b> and submit your own work.</p>` : ''}
      ${!canCopy && why ? `<p class="small muted">${why}</p>` : ''}
      <div class="btnrow">${canCopy && n ? `<button class="btn primary" id="sh-copy">Copy ${n} answer${n === 1 ? '' : 's'} into my worksheet</button>` : ''}
        ${m ? `<a class="btn" href="#/m/${m.id}" id="sh-open">Open ${esc(actName(m, x.act))}</a>` : ''}</div>
      <p class="err small" id="sh-err"></p>
    </div>`;
}

export interface Offer { x: SharedAnswers; plan: CopyPlan }
const n_ = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Answers of my worksheet after the copy (with or without the seat-specific ones). */
export function filledAfter(ws: Worksheet, mine: Record<string, string>, o: Offer, withSeat: boolean): Record<string, string> {
  const out = { ...mine, ...o.plan.copy };
  if (withSeat) for (const k of o.plan.seatOnly) out[k] = o.x.values[k];
  return out;
}
/** The sharer's finished steps that are steps of this activity. */
export const sharedSteps = (m: Mission, x: SharedAnswers) => (x.steps ?? []).filter((id) => m.steps.some((s) => s.id === id));

/** Answer keys still empty. */
export const emptyKeys = (ws: Worksheet, vals: Record<string, string>) => fieldKeys(ws).filter((k) => String(vals[k] ?? '').trim() === '');

/**
 * The offer that pops up when a teammate shares the activity I am on: fill in my whole worksheet with their answers.
 * pick = the teammate chosen (when several share it).
 */
export function offerHtml(m: Mission, offers: Offer[], pick: number, mine: Record<string, string>, withSeat: boolean): string {
  const ws = m.worksheet!, o = offers[pick];
  const lab = fieldLabels(ws);
  const n = Object.keys(o.plan.copy).length, seat = o.plan.seatOnly.length;
  const replace = Object.keys(o.plan.copy).filter((k) => (mine[k] ?? '').trim() !== '' && mine[k] !== o.plan.copy[k]).length;
  const after = filledAfter(ws, mine, o, withSeat);
  const left = emptyKeys(ws, after).length, total = fieldKeys(ws).length;
  const first = o.x.name.split(' ')[0];
  const rows = fieldKeys(ws).filter((k) => (o.x.values[k] ?? '').trim() !== '').map((k) => `<tr class="${o.plan.seatOnly.includes(k) ? 'seat' : ''}"><td class="small">${esc(lab[k] ?? k)}</td><td>${esc(o.x.values[k]).replace(/\n/g, '<br>')}</td>
    <td class="small">${o.plan.seatOnly.includes(k) ? '<span class="tag warn">YOUR SEAT DIFFERS</span>' : ''}</td></tr>`).join('');
  return `<div class="dhead"><div><div class="kicker">🤝 Your teammate shared this activity</div>
      <h2>Fill in your ${esc(actName(m, m.id))} worksheet with ${esc(first)}'s answers?</h2></div></div>
    <div class="dbody offer">
      ${offers.length > 1 ? `<div class="label">Shared by ${offers.length} teammates. Use the answers of:</div><div class="of-pick">${offers.map((y, i) => `<label class="radio"><input type="radio" name="of-who" value="${i}" ${i === pick ? 'checked' : ''}>
        <span><b>${esc(y.x.name)}</b> <span class="small muted">· Seat ${String(y.x.seat).padStart(2, '0')} · ${n_(Object.keys(y.x.values).length, 'answer')}${y.x.updated ? ` · saved ${esc(ago(y.x.updated))}` : ''}</span></span></label>`).join('')}</div>` : ''}
      <div class="of-sum">
        <div><b class="big">${n + (withSeat ? seat : 0)}</b><div class="small muted">answers filled in</div></div>
        <div><b class="big">${total - left} / ${total}</b><div class="small muted">of your worksheet after this</div></div>
        <div><b class="big">${replace}</b><div class="small muted">of your answers replaced</div></div>
      </div>
      ${seat ? `<label class="of-seat"><input type="checkbox" id="of-seat" ${withSeat ? 'checked' : ''}> Also fill in the ${n_(seat, 'seat-specific answer')} <span class="small muted">(${esc(first)}'s seat has different evidence, so ${seat === 1 ? 'it is' : 'they are'} most likely wrong on your seat: better find ${seat === 1 ? 'it' : 'them'} with the commands on your own seat)</span></label>` : ''}
      <details><summary>Preview ${esc(first)}'s answers</summary><table class="ptable sh-table"><tbody>${rows}</tbody></table></details>
      <p class="small muted">${esc(first)}'s finished steps are marked done for you too. <b>Your trainer sees that you copied, and from whom.</b> Read each answer so you can explain it.</p>
      <div class="btnrow"><button class="btn primary" id="of-go">Fill in my worksheet</button><button class="btn quiet" id="of-no">Not now</button></div>
      <p class="err small" id="of-err"></p>
    </div>`;
}

/** After the worksheet is complete (or after a fill that left some answers to find): ready to submit? */
export function readyHtml(m: Mission, vals: Record<string, string>, stepsDone: number, submitted: boolean): string {
  const ws = m.worksheet!, lab = fieldLabels(ws);
  const empty = emptyKeys(ws, vals), total = fieldKeys(ws).length, stepsLeft = m.steps.length - stepsDone;
  const name = esc(actName(m, m.id));
  if (empty.length) return `<div class="dhead"><div><div class="kicker">${name}</div><h2>${total - empty.length} of ${total} answers filled in</h2></div></div>
    <div class="dbody ready"><p>Still to find${empty.length < total ? ' on your own seat' : ''}:</p><ul class="of-left">${empty.slice(0, 12).map((k) => `<li>${esc(lab[k] ?? k)}</li>`).join('')}${empty.length > 12 ? `<li class="muted">… and ${empty.length - 12} more</li>` : ''}</ul>
      <p class="small muted">Run the commands on your own hosts, or ask your team in the team chat how to find them. This message shows again when everything is filled in.</p>
      <div class="btnrow"><button class="btn primary" id="rd-ok">OK</button></div></div>`;
  return `<div class="dhead"><div><div class="kicker">${name}</div><h2>✓ Every answer is filled in: ready to submit</h2></div></div>
    <div class="dbody ready">
      <div class="of-sum"><div><b class="big">${total} / ${total}</b><div class="small muted">answers</div></div>
        <div><b class="big ${stepsLeft ? 'no' : ''}">${stepsDone} / ${m.steps.length}</b><div class="small muted">steps done</div></div></div>
      ${stepsLeft ? `<p class="note">${n_(stepsLeft, 'step')} not done yet. You can submit now, but your trainer sees which steps you did. To finish the activity (and unlock the next day), run ${stepsLeft === 1 ? 'it' : 'them'} on your terminal and press <b>Check my answers</b>.</p>` : ''}
      ${submitted ? '<p class="small muted">You submitted this activity before. Submitting again sends this attempt; the latest one counts.</p>' : ''}
      <div class="btnrow"><button class="btn primary" id="rd-submit">${submitted ? 'Submit again' : 'Submit now'}</button><button class="btn" id="rd-check">Check my answers first</button><button class="btn quiet" id="rd-later">Later</button></div>
    </div>`;
}
