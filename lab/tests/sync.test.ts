// Runs the real sync/Code.gs (Apps Script) against in-memory fakes of the Google services.
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
// @ts-expect-error plain JS helper
import { loadGas } from '../sync/gas-fake.mjs';

const CODE = resolve(__dirname, '../sync/Code.gs');
function fresh() { const g = loadGas(CODE); g.ctx.setup(); return g; }
function signIn(g: any, email: string, name = 'Ana Reyes') {
  expect(g.post({ action: 'requestCode', email, name }).ok).toBe(true);
  return g.post({ action: 'verify', email, name, code: g.lastCode(email) });
}
const roster = (g: any, ...rows: unknown[][]) => rows.forEach((r) => g.ss.getSheetByName('Roster').appendRow(r));

describe('CTM Virtual Lab sync (Code.gs)', () => {
  it('setup creates the tabs', () => {
    const g = fresh();
    expect([...g.ss.sheets.keys()].sort()).toEqual(['Chat', 'Progress', 'Redo', 'Roster', 'Sessions', 'Settings', 'State', 'Submissions', 'Sync Log']);
    expect(g.ss.getSheetByName('Roster').rows[0]).toEqual(['Email', 'Full Name', 'Seat', 'Allowed (YES/NO)', 'Team']);
    expect(g.post({ action: 'info' })).toMatchObject({ ok: true, open: true });
  });

  it('email code sign-in, save on one PC, load on another', () => {
    const g = fresh();
    const v = signIn(g, 'Ana@Example.com');
    expect(v).toMatchObject({ ok: true, email: 'ana@example.com', seat: 1, trainer: false, state: null });
    const state = { version: 1, name: 'Ana Reyes', seat: 1, updatedAt: 1000, done: { 'd2-act2.1': ['w-ip'] }, notes: 'x'.repeat(100000) };
    const sv = g.post({ action: 'save', token: v.token, state, summary: { highestDay: 2, days: { 2: { done: 1, total: 4, checked: 3, correct: 2 } }, commands: 7, mission: 'Activity 2.1' } });
    expect(sv).toMatchObject({ ok: true, updated: 1000 });
    // the 100k-character state is split across cells and comes back intact
    const second = signIn(g, 'ana@example.com');
    expect(second.state).toEqual(state);
    expect(g.post({ action: 'load', token: v.token }).state.notes.length).toBe(100000);
    const prog = g.ss.getSheetByName('Progress').rows[1];
    expect(prog.slice(0, 3)).toEqual(['ana@example.com', 'Ana Reyes', 1]);
    expect(prog[5]).toBe('1 / 4');
    expect(prog[6]).toBe('2 / 3');
  });

  it('the Progress tab shows step progress, not only finished missions', () => {
    const g = fresh();
    const v = signIn(g, 'ana@example.com');
    g.post({ action: 'save', token: v.token, state: { updatedAt: 1 }, summary: {
      highestDay: 2, days: { 2: { done: 0, total: 4, checked: 0, correct: 0, steps: 3, stepsTotal: 20 } },
      practiceDone: 0, practiceTotal: 9, commands: 4, mission: 'Practice: Demo 1 · Monitoring Commands', missionSteps: '2/13 steps' } });
    const prog = g.ss.getSheetByName('Progress').rows[1];
    expect(prog[5]).toBe('0 / 4 (3/20 steps)');
    expect(prog[11]).toBe('0 / 9');
    expect(prog[13]).toBe('Practice: Demo 1 · Monitoring Commands (2/13 steps)');
  });

  it('Day 5 and later days go in columns after the original ones', () => {
    const g = fresh();
    const head = g.ss.getSheetByName('Progress').rows[0];
    expect(head.slice(11, 16)).toEqual(['Practice Missions Done', 'Commands Run', 'Current Mission', 'Day 5 Activities', 'Day 5 Checked Score']);
    expect(head[head.length - 1]).toBe('Day 15 Checked Score');
    const v = signIn(g, 'ana@example.com');
    g.post({ action: 'save', token: v.token, state: { updatedAt: 1 }, summary: { highestDay: 5, days: { 5: { done: 1, total: 4, checked: 6, correct: 5, steps: 5, stepsTotal: 19 } } } });
    const prog = g.ss.getSheetByName('Progress').rows[1];
    expect(prog.slice(14, 16)).toEqual(['1 / 4 (5/19 steps)', '5 / 6']);
  });

  it('Open Days: the trainer opens Activities per day; the lab polls the status', () => {
    const g = fresh();
    g.setSetting('Trainer Emails', 'boss@example.com');
    const v = signIn(g, 'ana@example.com');
    expect(v.openDays).toEqual([]); // empty = Activities closed
    for (const [val, days] of [['2', [2]], [2, [2]], ['2,3', [2, 3]], ['2 3; 4', [2, 3, 4]], ['x, 99', []]] as [unknown, number[]][]) {
      g.setSetting('Open Days', val);
      expect(g.post({ action: 'status', token: v.token })).toMatchObject({ ok: true, trainer: false, openDays: days });
    }
    g.setSetting('Open Days', 'all');
    expect(g.post({ action: 'status', token: v.token }).openDays).toHaveLength(15);
    expect(g.post({ action: 'load', token: v.token }).openDays).toHaveLength(15);
    g.setSetting('Lab Status', 'CLOSED'); // a closed lab opens no Activities
    expect(g.post({ action: 'status', token: v.token }).openDays).toEqual([]);
    expect(g.post({ action: 'status', token: 'nope' }).error).toMatch(/no longer valid/);
  });

  it('setup adds a missing setting without touching the values already typed', () => {
    const g = fresh();
    const set = g.ss.getSheetByName('Settings');
    g.setSetting('Require Roster', 'YES');
    set.rows = set.rows.filter((r: unknown[]) => r[0] !== 'Open Days'); // a Sheet made before Open Days existed
    g.ctx.setup();
    expect(set.rows.map((r: unknown[]) => r[0])).toEqual(['Setting', 'Lab Status', 'Require Roster', 'Trainer Emails', 'Open Days']);
    expect(set.rows.find((r: unknown[]) => r[0] === 'Require Roster')[1]).toBe('YES');
    g.ctx.setup(); // running it again adds nothing
    expect(set.rows).toHaveLength(5);
  });

  // A state whose text at a 45,000-character cell boundary starts with - (e.g. "-rw-r--r--" or a "----" table rule)
  // was stored by Sheets as a formula, read back as "#ERROR!", and sign-in failed with
  // "Unterminated string in JSON at position 45007".
  const boundary = (ch: string) => {
    const state: any = { version: 1, updatedAt: 3000, log: [{ out: '' }] };
    const before = JSON.stringify(state).indexOf('""') + 1; // where out's text starts
    state.log[0].out = 'a'.repeat(45000 - before) + ch + 'rw-r--r-- 1 ana ana';
    return { state, at: JSON.stringify(state).charAt(45000) };
  };
  it('state cells that start with = + - or an apostrophe survive the round trip', () => {
    for (const ch of ['-', '+', '=', "'"]) {
      const g = fresh();
      const v = signIn(g, 'ana@example.com');
      const { state, at } = boundary(ch);
      expect(at).toBe(ch);
      g.post({ action: 'save', token: v.token, state });
      expect(g.ss.getSheetByName('State').rows[1][3]).not.toBe('#ERROR!');
      expect(signIn(g, 'ana@example.com').state).toEqual(state);
    }
  });

  it('repairs a state saved before the fix (a chunk turned into a formula)', () => {
    const g = fresh();
    const v = signIn(g, 'ana@example.com');
    const { state } = boundary('-');
    const t = JSON.stringify(state);
    // what the old writeState_ did: chunks without the apostrophe
    g.ss.getSheetByName('State').getRange(2, 1, 1, 4).setValues([['ana@example.com', 3000, t.slice(0, 45000), t.slice(45000)]]);
    expect(g.ss.getSheetByName('State').rows[1][3]).toBe('#ERROR!');
    expect(signIn(g, 'ana@example.com').state).toEqual(state);
    expect(g.post({ action: 'load', token: v.token }).state).toEqual(state);
  });

  it('an unreadable saved state does not block sign-in', () => {
    const g = fresh();
    signIn(g, 'ana@example.com');
    g.ss.getSheetByName('State').getRange(2, 1, 1, 3).setValues([['ana@example.com', 3000, "'{\"broken"]]);
    const v = signIn(g, 'ana@example.com');
    expect(v).toMatchObject({ ok: true, state: null, updated: 0 });
    expect(g.ss.getSheetByName('Sync Log').rows.some((r: unknown[]) => r[2] === 'Saved state unreadable')).toBe(true);
  });

  it('a busy server answers with JSON, not an error page', () => {
    const g = fresh();
    g.ctx.__busy = true;
    expect(g.post({ action: 'info' })).toMatchObject({ ok: false, busy: true, error: expect.stringMatching(/busy/) });
    g.ctx.__busy = false;
    expect(g.post({ action: 'info' }).ok).toBe(true);
  });

  it('an older save never overwrites a newer one', () => {
    const g = fresh();
    const v = signIn(g, 'ana@example.com');
    g.post({ action: 'save', token: v.token, state: { updatedAt: 2000, notes: 'new' } });
    expect(g.post({ action: 'save', token: v.token, state: { updatedAt: 1500, notes: 'old' } })).toMatchObject({ stale: true, updated: 2000 });
    expect(g.post({ action: 'load', token: v.token }).state.notes).toBe('new');
  });

  it('rejects wrong codes and bad tokens', () => {
    const g = fresh();
    g.post({ action: 'requestCode', email: 'ben@example.com', name: 'Ben' });
    expect(g.post({ action: 'verify', email: 'ben@example.com', name: 'Ben', code: '000000' }).error).toMatch(/Incorrect code/);
    expect(g.post({ action: 'load', token: 'nope' }).error).toMatch(/no longer valid/);
  });

  it('the trainer assigns seats: Roster seat, else the next free seat; a typed seat is ignored', () => {
    const g = fresh();
    g.setSetting('Trainer Emails', 'boss@example.com');
    roster(g, ['ana@example.com', 'Ana Reyes', 1, 'YES'], ['ben@example.com', 'Ben Cruz', 3, 'YES']);
    expect(signIn(g, 'ana@example.com').seat).toBe(1);
    expect(signIn(g, 'boss@example.com', 'Trainer').seat).toBe(1); // trainers do not take a seat
    // not on the Roster: lowest seat not used and not reserved (1 = Ana, 3 = Ben reserved)
    expect(g.post({ action: 'requestCode', email: 'carl@example.com', name: 'Carl', seat: 3 }).ok).toBe(true);
    expect(g.post({ action: 'verify', email: 'carl@example.com', name: 'Carl', seat: 3, code: g.lastCode('carl@example.com') }).seat).toBe(2);
    expect(signIn(g, 'dina@example.com', 'Dina').seat).toBe(4);
    expect(signIn(g, 'ben@example.com').seat).toBe(3);
    expect(signIn(g, 'carl@example.com', 'Carl').seat).toBe(2); // keeps the same seat on every sign-in
    // the trainer moves Carl to seat 10 in the Roster: his next sign-in uses it
    roster(g, ['carl@example.com', 'Carl Lim', 10, 'YES']);
    expect(signIn(g, 'carl@example.com', 'Carl')).toMatchObject({ seat: 10, name: 'Carl Lim' });
    // a Roster seat that another trainee already uses is refused
    roster(g, ['eve@example.com', 'Eve', 4, 'YES']);
    expect(g.post({ action: 'requestCode', email: 'eve@example.com', name: 'Eve' }).error).toMatch(/Seat 4 is already used/);
  });

  it('refuses sign-in when all seats are taken', () => {
    const g = fresh();
    for (let n = 1; n <= 40; n++) expect(signIn(g, `t${n}@example.com`, `T${n}`).seat).toBe(n);
    expect(g.post({ action: 'requestCode', email: 'late@example.com', name: 'Late' }).error).toMatch(/All 40 seats are taken/);
  });

  it('roster, trainer emails and closing the lab', () => {
    const g = fresh();
    g.setSetting('Require Roster', 'YES');
    g.setSetting('Trainer Emails', 'boss@example.com');
    expect(g.post({ action: 'requestCode', email: 'x@example.com', name: 'X' }).error).toMatch(/class list/);
    roster(g, ['x@example.com', 'Dela Cruz, Juan', 12, 'YES'], ['boss@example.com', 'Trainer', 12, 'YES']);
    const v = signIn(g, 'x@example.com', 'whatever');
    expect(v).toMatchObject({ name: 'Dela Cruz, Juan', seat: 12 }); // roster wins
    expect(signIn(g, 'boss@example.com', 'Trainer').trainer).toBe(true); // trainer may share a seat
    g.setSetting('Lab Status', 'CLOSED');
    expect(g.post({ action: 'requestCode', email: 'x@example.com', name: 'X' }).error).toMatch(/closed/);
  });
  it('Class report: trainer only; lists Roster trainees who never signed in; leaves trainer accounts out', () => {
    const g = fresh();
    g.setSetting('Trainer Emails', 'boss@example.com');
    roster(g, ['ben@example.com', 'Ben Cruz', 2, 'YES'], ['ana@example.com', 'Ana Reyes', 1, 'YES']);
    const ana = signIn(g, 'ana@example.com');
    g.post({ action: 'save', token: ana.token, state: { updatedAt: 5000, done: { 'd9-demo1': ['cases'] }, checked: {}, videos: { 'Day09_Demo1_Verify_with_Stakeholder.mp4': 4000 },
      started: { 'd9-demo1': 4100 }, ws: { 'ws91': { 'c1.who': 'Maria Reyes', 'c2.who': '  ' } } }, summary: {} });
    expect(g.post({ action: 'report', token: ana.token })).toMatchObject({ ok: false, error: expect.stringMatching(/trainer/) });
    const boss = signIn(g, 'boss@example.com', 'Trainer');
    const r = g.post({ action: 'report', token: boss.token });
    expect(r.ok).toBe(true);
    expect(r.trainees.map((t: any) => [t.seat, t.email, t.signedIn])).toEqual([[1, 'ana@example.com', true], [2, 'ben@example.com', false]]);
    const a = r.trainees[0];
    expect(a).toMatchObject({ name: 'Ana Reyes', updated: 5000, done: { 'd9-demo1': ['cases'] }, videos: { 'Day09_Demo1_Verify_with_Stakeholder.mp4': 4000 }, started: { 'd9-demo1': 4100 }, filled: { ws91: 1 } });
    expect(a.firstSignIn).toBeGreaterThan(0);
    expect(r.trainees[1]).toMatchObject({ name: 'Ben Cruz', firstSignIn: 0, done: {} });
  });

  describe('submissions and the trainer board', () => {
    // a big submission whose text at the 45,000-character cell boundary starts with "-" (as command output often does)
    const payload = { ws: { 'ws-5.1': { newCount: '8', why: '=SUM(1) - not a formula' } }, log: [{ line: 'Get-ChildItem', out: 'a'.repeat(44970) + '\n-rw-r--r-- note' }], evidence: [] };
    function setupClass() {
      const g = fresh();
      g.setSetting('Trainer Emails', 'coach@example.com');
      g.setSetting('Open Days', '5');
      roster(g, ['ana@example.com', 'Ana Reyes', 3, 'YES', 'Blue'], ['ben@example.com', 'Ben Cruz', 4, 'YES', 'Blue']);
      return { g, ana: signIn(g, 'ana@example.com').token, ben: signIn(g, 'ben@example.com', 'Ben Cruz').token, coach: signIn(g, 'coach@example.com', 'Coach').token };
    }

    it('a trainee submits; the attempt, the work and the score reach the board; status carries the result', () => {
      const { g, ana, coach } = setupClass();
      const r = g.post({ action: 'submit', token: ana, day: 5, act: 'd5-act5.1', title: 'Activity 5.1 · Receive Detection Alerts per SOP', score: 24, max: 30, payload });
      expect(r).toMatchObject({ ok: true, attempt: 1, late: false });
      expect(r.subs.latest['d5-act5.1']).toMatchObject({ attempt: 1, attempts: 1, score: 24, max: 30, verdict: '', day: 5 });
      // every status check (each minute) brings the trainee's latest results
      expect(g.post({ action: 'status', token: ana, mission: 'x' }).subs.latest['d5-act5.1'].score).toBe(24);
      const b = g.post({ action: 'board', token: coach });
      expect(b.ok).toBe(true);
      expect(b.subs).toEqual([expect.objectContaining({ email: 'ana@example.com', act: 'd5-act5.1', score: 24, max: 30, attempts: 1 })]);
      expect(b.trainees.map((t: any) => t.email)).toEqual(['ana@example.com', 'ben@example.com']);
      const d = g.post({ action: 'submission', token: coach, email: 'ana@example.com', act: 'd5-act5.1' });
      expect(d).toMatchObject({ ok: true, attempt: 1, latest: true, name: 'Ana Reyes', seat: 3, day: 5 });
      expect(d.payload).toEqual(payload); // intact across cells, "-" and "=" included
      const row = g.ss.getSheetByName('Submissions').rows[1];
      expect(row.slice(1, 10)).toEqual(['ana@example.com', 'Ana Reyes', 3, 5, 'd5-act5.1', 'Activity 5.1 · Receive Detection Alerts per SOP', 1, 24, 30]);
      expect(row.length).toBe(14 + 2); // the work is split over two cells
    });

    it('verdict + feedback, return for redo, and a resubmission closes the redo', () => {
      const { g, ana, coach } = setupClass();
      g.post({ action: 'submit', token: ana, day: 5, act: 'd5-act5.1', title: 'A 5.1', score: 20, max: 30, payload: {} });
      expect(g.post({ action: 'grade', token: coach, email: 'ana@example.com', act: 'd5-act5.1', verdict: 'NYC', feedback: '- Recheck Q-5006: the SLA is 30 minutes.' }))
        .toMatchObject({ ok: true, attempt: 1, verdict: 'NYC' });
      let mine = g.post({ action: 'mine', token: ana }).subs;
      expect(mine.latest['d5-act5.1']).toMatchObject({ verdict: 'NYC', feedback: '- Recheck Q-5006: the SLA is 30 minutes.' });
      expect(mine.latest['d5-act5.1'].gradedAt).toBeGreaterThan(0);
      g.post({ action: 'redo', token: coach, email: 'ana@example.com', act: 'd5-act5.1', note: 'Fix the SLA column, then submit again.' });
      mine = g.post({ action: 'mine', token: ana }).subs;
      expect(mine.redo['d5-act5.1'].note).toBe('Fix the SLA column, then submit again.');
      expect(g.post({ action: 'board', token: coach }).redo).toEqual([expect.objectContaining({ email: 'ana@example.com', act: 'd5-act5.1' })]);
      // the trainee submits again: attempt 2, the redo is answered, the new attempt is not graded yet
      expect(g.post({ action: 'submit', token: ana, day: 5, act: 'd5-act5.1', title: 'A 5.1', score: 30, max: 30, payload: {} }).attempt).toBe(2);
      mine = g.post({ action: 'mine', token: ana }).subs;
      expect(mine.redo).toEqual({});
      expect(mine.latest['d5-act5.1']).toMatchObject({ attempt: 2, attempts: 2, score: 30, verdict: '' });
      const d = g.post({ action: 'submission', token: coach, email: 'ana@example.com', act: 'd5-act5.1', attempt: 1 });
      expect(d.history.map((h: any) => [h.attempt, h.verdict])).toEqual([[1, 'NYC'], [2, '']]);
      expect(d).toMatchObject({ attempt: 1, latest: false });
      expect(g.ss.getSheetByName('Redo').rows[1][5]).toBe('DONE');
      // cancel works too
      g.post({ action: 'redo', token: coach, email: 'ana@example.com', act: 'd5-act5.1', note: 'again' });
      g.post({ action: 'redo', token: coach, email: 'ana@example.com', act: 'd5-act5.1', cancel: true });
      expect(g.post({ action: 'mine', token: ana }).subs.redo).toEqual({});
    });

    it('monitoring: the board knows who is online and on what; trainee = the live work; classLog = everyone, one day or all', () => {
      const { g, ana, ben, coach } = setupClass();
      const state = { updatedAt: 7000, token: 'never-stored', missionId: 'd5-act5.1', done: { 'd5-act5.1': ['sop'] }, stepAt: { 'd5-act5.1|sop': 6500 },
        started: { 'd5-act5.1': 6000 }, ws: { 'ws-5.1': { a: '1' } },
        log: [{ at: 6400, time: 'x', host: 'ubuntu-lab-03', line: 'grep A2 sop', mission: 'Activity 5.1', day: 5, out: 'A2 ...' },
          { at: 100, time: 'y', host: 'WKS-LAB-03', line: 'ipconfig', mission: 'Activity 2.1', day: 2, out: 'IPv4 ...' }],
        evidence: [{ at: 6600, time: 'x', host: 'h', cmd: 'grep', text: 'long pinned text', note: 'n', mission: 'Activity 5.1', day: 5 }] };
      g.post({ action: 'save', token: ana, state, summary: {} });
      g.post({ action: 'status', token: ana, mission: 'Activity 5.1 · Receive Detection Alerts per SOP' });
      g.post({ action: 'submit', token: ana, day: 5, act: 'd5-act5.1', title: 'A 5.1', score: 3, max: 5, payload: {} });
      g.post({ action: 'grade', token: coach, email: 'ana@example.com', act: 'd5-act5.1', verdict: 'C', feedback: '' });

      const b = g.post({ action: 'board', token: coach });
      expect(b.presence['ana@example.com']).toMatchObject({ mission: 'Activity 5.1 · Receive Detection Alerts per SOP' });
      expect(b.presence['ana@example.com'].ago).toBeLessThan(5);
      expect(b.presence['coach@example.com']).toBeUndefined(); // trainers are not monitored

      const t = g.post({ action: 'trainee', token: coach, email: 'Ana@Example.com' });
      expect(t).toMatchObject({ ok: true, email: 'ana@example.com', name: 'Ana Reyes', seat: 3, team: 'Blue', updated: 7000 });
      expect(t.state.token).toBeUndefined();
      expect(t.state.log[0].out).toBe('A2 ...'); // the full work, outputs included
      expect(t.state.evidence[0].text).toBe('long pinned text');
      expect(t.subs).toEqual([expect.objectContaining({ act: 'd5-act5.1', verdict: 'C', attempts: 1 })]);
      expect(t.events.map((e: any) => [e.event, e.by])).toEqual([['Signed in', ''], ['Submitted', ''], ['Graded', 'coach@example.com']]);
      expect(t.events[2].detail).toBe('d5-act5.1 attempt 1: C');
      expect(t.presence.mission).toMatch(/^Activity 5.1/);
      expect(g.post({ action: 'trainee', token: coach, email: 'nobody@example.com' }).error).toBe('Unknown trainee.');

      const all = g.post({ action: 'classLog', token: coach });
      expect(all.trainees.map((x: any) => x.email)).toEqual(['ana@example.com', 'ben@example.com']);
      const a = all.trainees[0];
      expect(a.state.log).toEqual([{ at: 6400, time: 'x', host: 'ubuntu-lab-03', line: 'grep A2 sop', mission: 'Activity 5.1', day: 5 }, expect.objectContaining({ line: 'ipconfig' })]);
      expect(a.state.log[0].out).toBeUndefined(); // no outputs in the class log (size)
      expect(a.state.evidence[0].text).toBeUndefined();
      expect(a.state.stepAt).toEqual({ 'd5-act5.1|sop': 6500 });
      expect(all.trainees[1].state).toBeNull(); // Ben never saved
      expect(all.subs).toHaveLength(1);
      const d2 = g.post({ action: 'classLog', token: coach, day: 2 });
      expect(d2.trainees[0].state.log.map((l: any) => l.line)).toEqual(['ipconfig']);
      expect(d2.subs).toEqual([]);
      for (const action of ['trainee', 'classLog']) expect(g.post({ action, token: ben, email: 'ana@example.com' }).error).toMatch(/Only trainer accounts/);
    });

    it('late when the day is not open; trainer actions are refused to trainees; bad input is refused', () => {
      const { g, ana, ben } = setupClass();
      expect(g.post({ action: 'submit', token: ana, day: 6, act: 'd6-act6.1', score: 1, max: 2, payload: {} })).toMatchObject({ ok: true, late: true });
      for (const action of ['board', 'submission', 'grade', 'redo']) expect(g.post({ action, token: ben, email: 'ana@example.com', act: 'd6-act6.1' }).error).toMatch(/Only trainer accounts/);
      expect(g.post({ action: 'submit', token: ana, day: 6, act: '=HYPERLINK("x")', payload: {} }).error).toBe('Unknown activity.');
      expect(g.post({ action: 'submit', token: ana, day: 6, act: 'd6-act6.2', payload: { x: 'y'.repeat(700000) } }).error).toMatch(/too large/);
      expect(g.post({ action: 'grade', token: signIn(g, 'ana@example.com').token, email: 'x', act: 'd6-act6.1' }).error).toMatch(/Only trainer/);
    });
  });
});
