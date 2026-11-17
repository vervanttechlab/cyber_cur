// Teams: what a teammate may copy (seat-specific answers are not copied), balancing the class into teams, typing text.
import { describe, it, expect } from 'vitest';
import { DAY5, Q51 } from '../src/missions/day05';
import { seatHosts } from '../src/hosts/hosts';
import type { HostId, Mission } from '../src/missions/types';
import { autoScore, fieldKeys } from '../src/ui/submit';
import { copyPlan, sharedHtml, offerHtml, readyHtml, filledAfter, emptyKeys, type SharedAnswers } from '../src/ui/share';
import { balance, changes, teamList, finished, teamsHtml } from '../src/views/teams';
import { typingText } from '../src/ui/social';
import type { ReportTrainee } from '../src/ui/report';

const m = (id: string) => DAY5.missions.find((x) => x.id === id)!;
const ctxFor = (n: number) => { const s = seatHosts(n); return { facts: s.facts, hosts: { 'seat-win': s.win, 'seat-linux': s.linux } as Record<HostId, typeof s.win> }; };
const verdicts = (mi: Mission, seat: number, v: Record<string, string>) => autoScore(mi.worksheet!, v, ctxFor(seat)).verdicts;
/** The right answers of Activity 5.4 on one seat (as in tests/day05.test.ts). */
function right54(n: number): Record<string, string> {
  const f = ctxFor(n).facts.day5;
  return { verdict: f.kind === 'ransomware' ? 'Ransomware red flag' : f.kind === 'pe' ? 'PE infection red flag' : 'No red flag', codes: f.kind === 'ransomware' ? 'R1, R2' : f.kind === 'pe' ? 'V1, V2' : 'none',
    count: String(f.count), first: f.first, process: f.process, detail: f.kind === 'ransomware' ? `${f.ext} ${f.note}` : f.kind === 'pe' ? f.detection! : 'SafeCopy backup (scbackup.exe)',
    action: f.kind === 'none' ? 'Record in the shift log; no escalation' : 'Escalate immediately to the Shift Lead (local 4401)' };
}

describe('copying a teammate\'s shared answers', () => {
  it('a shared activity (5.1, same files on every seat): every answer is copied and stays right on my seat', () => {
    const a = m('d5-act5.1');
    const v: Record<string, string> = { newCount: '8', late: 'Q-5005 (Critical, 24 minutes)', first: 'Q-5011: Critical ransomware red flag, 3 minutes left', red: 'Q-5005 R1, Q-5011 R3, Q-5007 V1, Q-5008 V2' };
    for (const q of Q51) { v[`q.${q.id}.min`] = String(Math.round(q.minutes)); v[`q.${q.id}.sla`] = q.within; }
    const plan = copyPlan(a.worksheet!, v, verdicts(a, 1, v), verdicts(a, 7, v));
    expect(plan).toEqual({ copy: v, seatOnly: [] });
    expect(Object.values(verdicts(a, 7, plan.copy)).every(Boolean)).toBe(true);
    expect(fieldKeys(a.worksheet!).length).toBeGreaterThanOrEqual(Object.keys(v).length);
  });
  it('the per-seat activity (5.4): answers that are right on the owner\'s seat but not on mine are not copied', () => {
    const a = m('d5-act5.4');
    for (const [owner, me] of [[3, 6], [1, 2], [10, 25]]) {
      const v = right54(owner);
      const plan = copyPlan(a.worksheet!, v, verdicts(a, owner, v), verdicts(a, me, v));
      expect(plan.seatOnly.length).toBeGreaterThan(0);
      // what is copied is never wrong on my seat when it was right on the owner's
      const mine = verdicts(a, me, plan.copy);
      for (const k of Object.keys(plan.copy)) if (verdicts(a, owner, v)[k]) expect(mine[k]).toBe(true);
      expect(Object.keys(plan.copy).length + plan.seatOnly.length).toBe(Object.keys(v).length);
    }
  });
  it('a wrong answer of the owner is copied as it is (it is wrong on both seats); empty answers are skipped', () => {
    const a = m('d5-act5.4');
    const v = { count: '999', first: '', process: '   ' };
    expect(copyPlan(a.worksheet!, v, verdicts(a, 3, v), verdicts(a, 6, v))).toEqual({ copy: { count: '999' }, seatOnly: [] });
  });
  it('the dialog marks seat-specific answers, warns that the trainer sees the copy, and escapes the answers', () => {
    const a = m('d5-act5.4');
    const x: SharedAnswers = { id: 1, name: 'Ana Reyes', seat: 3, day: 5, act: a.id, ws: a.worksheet!.id, values: { ...right54(3), action: '<b>x</b>' }, updated: Date.now(), mine: false };
    const plan = copyPlan(a.worksheet!, x.values, verdicts(a, 3, x.values), verdicts(a, 6, x.values));
    const h = sharedHtml(x, a, plan, true, '', {});
    expect(h).toContain('YOUR SEAT DIFFERS');
    expect(h).toContain('Your trainer sees that you copied, and from whom.');
    expect(h).toContain(`Copy ${Object.keys(plan.copy).length} answer`);
    expect(h).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(sharedHtml(x, a, plan, false, 'Day 5 is still locked for you, so you cannot copy yet.', {})).not.toContain('id="sh-copy"');
  });
});

const T = (email: string, seat: number, team: string, done: Record<string, string[]> = {}, checked: Record<string, boolean> = {}): ReportTrainee =>
  ({ email, name: email.split('@')[0], seat, team, signedIn: true, firstSignIn: 0, lastSync: 0, updated: 0, done, checked, videos: {}, started: {}, filled: {} });

describe('the Teams page', () => {
  const acts = DAY5.missions.filter((x) => x.kind === 'activity');
  const allDone = (k: number) => [Object.fromEntries(acts.slice(0, k).map((a) => [a.id, a.steps.map((s) => s.id)])), Object.fromEntries(acts.slice(0, k).map((a) => [a.worksheet!.id, true]))] as const;
  const class8 = [0, 1, 2, 3, 4, 4, 3, 2].map((k, i) => T(`t${i + 1}@x.ph`, i + 1, i < 4 ? 'Blue' : '', ...allDone(k)));
  it('counts finished activities', () => {
    expect(class8.map((t) => finished(t, [DAY5]))).toEqual([0, 1, 2, 3, 4, 4, 3, 2]);
  });
  it('balance deals the class in a snake order, so every team mixes trainees who are ahead with those who need help', () => {
    const b = balance(class8, [DAY5], 2, ['Blue']);
    const teams = (name: string) => class8.filter((t) => b[t.email] === name).map((t) => finished(t, [DAY5])).sort();
    expect(Object.values(b).sort()).toEqual(['Blue', 'Blue', 'Blue', 'Blue', 'Team 1', 'Team 1', 'Team 1', 'Team 1']);
    expect(teams('Blue')).toEqual([0, 2, 3, 4]);   // 4, 3, 2, 0
    expect(teams('Team 1')).toEqual([1, 2, 3, 4]); // 4, 3, 2, 1
    const four = balance(class8, [DAY5], 4, []);
    expect(new Set(Object.values(four))).toEqual(new Set(['Team 1', 'Team 2', 'Team 3', 'Team 4']));
    for (const name of ['Team 1', 'Team 2', 'Team 3', 'Team 4']) expect(class8.filter((t) => four[t.email] === name)).toHaveLength(2);
    expect(Object.values(balance(class8, [DAY5], 20, [])).length).toBe(8); // never more teams than trainees
  });
  it('only real moves are saved; the team list includes empty new teams', () => {
    const d = { teams: { 't1@x.ph': 'Blue', 't2@x.ph': 'Red', 't5@x.ph': 'Red' }, extra: ['Gold'] };
    expect(changes(class8, d)).toEqual([{ email: 't2@x.ph', team: 'Red' }, { email: 't5@x.ph', team: 'Red' }]);
    expect(teamList(class8, d)).toEqual(['Blue', 'Gold', 'Red']);
    const h = teamsHtml({ trainees: class8, openDays: [], generated: Date.now(), subs: [], redo: [], shareDays: [5] }, [DAY5], d);
    expect(h).toContain('2 changes not saved');
    expect(h).toContain('Answer sharing is <b>on</b> for Day 5');
    expect(h).toContain('data-team="Gold"');
  });
});

it('typing text', () => {
  expect(typingText([])).toBe('');
  expect(typingText(['Ana Reyes'])).toBe('Ana is typing…');
  expect(typingText(['Ana Reyes', 'Ben Cruz'])).toBe('Ana and Ben are typing…');
  expect(typingText(['A', 'B', 'C'])).toBe('3 people are typing…');
});

describe('the fill-in offer and "ready to submit"', () => {
  const a = m('d5-act5.4');
  const ws = a.worksheet!;
  const x = (seat: number): SharedAnswers => ({ id: 1, name: 'Ana Reyes', seat, day: 5, act: a.id, ws: ws.id, values: right54(seat), updated: Date.now(), mine: false });
  const offer = (owner: number, me: number) => { const y = x(owner); return { x: y, plan: copyPlan(ws, y.values, verdicts(a, owner, y.values), verdicts(a, me, y.values)) }; };
  it('seat-specific answers are filled in only when the trainee ticks the box', () => {
    const o = offer(3, 6);
    const total = fieldKeys(ws).length;
    expect(emptyKeys(ws, filledAfter(ws, {}, o, true))).toHaveLength(total - Object.keys(o.x.values).length);
    expect(emptyKeys(ws, filledAfter(ws, {}, o, false))).toHaveLength(total - Object.keys(o.plan.copy).length);
    expect(offerHtml(a, [o], 0, {}, false)).toContain('Also fill in the');
    expect(offerHtml(a, [o], 0, {}, false)).toContain('Your trainer sees that you copied, and from whom.');
    expect(offerHtml(a, [o, offer(10, 6)], 1, {}, false)).toContain('Shared by 2 teammates');
  });
  it('ready: all answers filled = Submit now (and the steps still to do); otherwise the list of what is left', () => {
    const all = Object.fromEntries(fieldKeys(ws).map((k) => [k, 'x']));
    const h = readyHtml(a, all, 1, false);
    expect(h).toContain('ready to submit');
    expect(h).toContain('id="rd-submit"');
    expect(h).toContain(`${a.steps.length - 1} steps not done yet`);
    expect(readyHtml(a, all, a.steps.length, true)).toContain('Submit again');
    const some = readyHtml(a, { count: '3' }, 0, false);
    expect(some).toContain(`1 of ${fieldKeys(ws).length} answers filled in`);
    expect(some).not.toContain('rd-submit');
  });
});
