// Teams: who is online, the team room (team chat, pinned announcements, typing), answer sharing and copying,
// and the trainer rearranging the teams (sync/Code.gs on the fake Google services).
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
// @ts-expect-error plain JS helper
import { loadGas } from '../sync/gas-fake.mjs';

const CODE = resolve(__dirname, '../sync/Code.gs');
function world() {
  const g = loadGas(CODE); g.ctx.setup();
  g.setSetting('Trainer Emails', 'coach@example.com');
  const ro = g.ss.getSheetByName('Roster');
  ro.appendRow(['ana@example.com', 'Ana Reyes', 1, 'YES', 'Blue Team']);
  ro.appendRow(['ben@example.com', 'Ben Cruz', 2, 'YES', 'Blue Team']);
  ro.appendRow(['cy@example.com', 'Cy Lim', 3, 'YES', 'Red Team']);
  ro.appendRow(['dee@example.com', 'Dee Tan', 4, 'YES', '']);
  const tok: Record<string, string> = {};
  for (const [e, n] of [['ana@example.com', 'Ana Reyes'], ['ben@example.com', 'Ben Cruz'], ['cy@example.com', 'Cy Lim'], ['dee@example.com', 'Dee Tan'], ['coach@example.com', 'Coach']]) {
    g.post({ action: 'requestCode', email: e, name: n });
    tok[e.split('@')[0]] = g.post({ action: 'verify', email: e, name: n, code: g.lastCode(e) }).token;
  }
  const as = (who: string, body: Record<string, unknown>) => g.post({ token: tok[who], ...body });
  return { g, as, tok };
}
// the server refuses a second message within 1.5 s; tests move its clock instead of waiting
const later = (g: any, who: string) => g.ctx.CacheService.getScriptCache().remove(`CHATGAP_${who}@example.com`);
const texts = (r: any) => r.messages.map((m: any) => m.text);

describe('who is online', () => {
  it('a trainee sees their own team and the trainers; the trainer sees everyone', () => {
    const { as } = world();
    const names = (r: any) => r.online.map((p: any) => p.name).sort();
    const ana = as('ana', { action: 'status', mission: 'Activity 9.1 · Verify Results' });
    expect(ana.team).toBe('Blue Team');
    expect(names(ana)).toEqual(['Ana Reyes', 'Ben Cruz', 'Coach']);
    expect(ana.online.find((p: any) => p.name === 'Ana Reyes')).toMatchObject({ me: true, seat: 1, team: 'Blue Team', mission: 'Activity 9.1 · Verify Results' });
    expect(JSON.stringify(ana.online)).not.toContain('@'); // no emails go to trainees
    expect(names(as('cy', { action: 'status' }))).toEqual(['Coach', 'Cy Lim']);
    expect(names(as('dee', { action: 'status' }))).toEqual(['Coach', 'Dee Tan']); // no team yet
    expect(names(as('coach', { action: 'status' }))).toEqual(['Ana Reyes', 'Ben Cruz', 'Coach', 'Cy Lim', 'Dee Tan']);
  });
  it('someone not seen for 2.5 minutes is no longer online', () => {
    const { g, as } = world();
    const cache = g.ctx.CacheService.getScriptCache();
    const pres = JSON.parse(cache.get('PRESENCE'));
    pres['ben@example.com'].t -= 151000;
    cache.put('PRESENCE', JSON.stringify(pres));
    expect(as('ana', { action: 'status' }).online.map((p: any) => p.name)).not.toContain('Ben Cruz');
  });
  it('a team change in the Roster shows on the next check-in', () => {
    const { g, as } = world();
    expect(as('ana', { action: 'room' }).members).toHaveLength(2); // the room's roster is now cached
    g.ss.getSheetByName('Roster').rows[3][4] = 'Blue Team'; // Cy (row 4 of the sheet) transfers to Blue Team
    as('cy', { action: 'status' });
    expect(as('ana', { action: 'status' }).online.map((p: any) => p.name)).toContain('Cy Lim');
    expect(as('cy', { action: 'room' }).team).toBe('Blue Team'); // the check-in noticed the change: the room follows at once
    expect(as('ana', { action: 'room' }).members.map((m: any) => m.name)).toContain('Cy Lim');
  });
});

describe('team room', () => {
  it('members (online or not, what they work on), the team chat; other teams cannot read it; the Chat tab keeps every message', () => {
    const { g, as } = world();
    as('ana', { action: 'status', mission: 'Activity 2.1 · Windows and Linux Command Lab' });
    expect(as('ana', { action: 'chatSend', channel: 'Blue Team', text: '  Hi team,   who has C-02? ' })).toMatchObject({ ok: true, id: 1 });
    const ben = as('ben', { action: 'room' });
    expect(ben).toMatchObject({ ok: true, team: 'Blue Team', trainer: false, trainersOnline: 1 });
    expect(ben.messages).toEqual([expect.objectContaining({ id: 1, name: 'Ana Reyes', text: 'Hi team, who has C-02?', mine: false, trainer: false })]);
    expect(ben.members).toEqual([
      { name: 'Ana Reyes', seat: 1, online: true, mission: 'Activity 2.1 · Windows and Linux Command Lab', me: false },
      { name: 'Ben Cruz', seat: 2, online: true, mission: '', me: true },
    ]);
    expect(JSON.stringify(ben)).not.toContain('@');
    expect(as('ana', { action: 'room' }).messages[0].mine).toBe(true);
    // a trainee cannot open another team's room: asking for it still gives their own
    expect(as('cy', { action: 'room', team: 'Blue Team' })).toMatchObject({ team: 'Red Team', messages: [] });
    expect(as('cy', { action: 'chatSend', channel: 'Blue Team', text: 'x' })).toMatchObject({ ok: false, error: expect.stringMatching(/not a member/) });
    expect(as('dee', { action: 'room' })).toMatchObject({ ok: true, team: '', members: [], messages: [] });
    expect(as('dee', { action: 'chatSend', channel: 'Blue Team', text: 'x' })).toMatchObject({ ok: false, error: expect.stringMatching(/not in a team yet/) });
    expect(g.ss.getSheetByName('Chat').rows[1].slice(1, 7)).toEqual(['Blue Team', 'ana@example.com', 'Ana Reyes', 'Hi team, who has C-02?', 1, '']);
  });
  it('the trainer opens and posts in every team; announcements are pinned in every room; trainees cannot announce', () => {
    const { g, as } = world();
    expect(as('coach', { action: 'room' })).toMatchObject({ team: 'Blue Team', teams: ['Blue Team', 'Red Team'], trainer: true });
    expect(as('ana', { action: 'room' }).teams).toBeUndefined();
    expect(as('ana', { action: 'room' }).trainersOnline).toBe(1);
    g.setSetting('Trainer Emails', 'someone.else@example.com'); // no longer a trainer: not counted
    expect(as('ana', { action: 'room' }).trainersOnline).toBe(0);
    g.setSetting('Trainer Emails', 'coach@example.com');
    expect(Object.keys(as('coach', { action: 'status' }).chat)).toEqual(['Announcements', 'Blue Team', 'Red Team']);
    expect(Object.keys(as('ana', { action: 'status' }).chat)).toEqual(['Announcements', 'Blue Team']);
    expect(as('coach', { action: 'chatSend', channel: 'Red Team', text: 'Red Team: start 9.2 now' }).ok).toBe(true);
    expect(as('coach', { action: 'room', team: 'Red Team' }).messages[0]).toMatchObject({ text: 'Red Team: start 9.2 now', mine: true });
    later(g, 'coach');
    expect(as('coach', { action: 'chatSend', channel: 'Announcements', text: 'Break until 10:30' }).ok).toBe(true);
    expect(as('cy', { action: 'room' }).messages[0]).toMatchObject({ name: 'Coach', trainer: true });
    for (const who of ['ana', 'cy', 'dee']) expect(as(who, { action: 'room' }).pinned.map((m: any) => m.text)).toEqual(['Break until 10:30']);
    expect(as('ana', { action: 'chatSend', channel: 'Announcements', text: 'hello all' })).toMatchObject({ ok: false, error: expect.stringMatching(/Only the trainer/) });
    // the badge data: each channel's version and newest message id
    expect(as('cy', { action: 'status' }).chat['Red Team']).toEqual({ ver: 1, last: 1 });
  });
  it('an unchanged room returns { same: true } with the members; a message, a share or a team change gives a new version', () => {
    const { g, as } = world();
    g.setSetting('Answer Sharing', '2');
    const v = as('ben', { action: 'room' }).ver;
    const same = as('ben', { action: 'room', ver: v });
    expect(same).toMatchObject({ ok: true, same: true, team: 'Blue Team' });
    expect(same.messages).toBeUndefined();
    expect(same.members).toHaveLength(2);
    as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'one' });
    const v2 = as('ben', { action: 'room', ver: v });
    expect(texts(v2)).toEqual(['one']);
    as('ana', { action: 'share', day: 2, act: 'd2-act2.1', ws: 'ws-2.1', on: true });
    const v3 = as('ben', { action: 'room', ver: v2.ver });
    expect(v3.same).toBeUndefined();
    expect(v3.shares).toHaveLength(1);
    as('coach', { action: 'teamSet', changes: [{ email: 'dee@example.com', team: 'Blue Team' }] });
    expect(as('ben', { action: 'room', ver: v3.ver }).same).toBeUndefined();
  });
  it('empty, long and too-fast messages are refused', () => {
    const { g, as } = world();
    as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'one' });
    expect(as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'two' })).toMatchObject({ ok: false, error: expect.stringMatching(/Slow down/) });
    later(g, 'ana');
    expect(as('ana', { action: 'chatSend', channel: 'Blue Team', text: '   ' })).toMatchObject({ ok: false, error: expect.stringMatching(/Type a message/) });
    expect(as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'x'.repeat(501) })).toMatchObject({ ok: false, error: expect.stringMatching(/at most 500/) });
    later(g, 'ana');
    expect(as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'two' }).ok).toBe(true);
    expect(texts(as('ben', { action: 'room' }))).toEqual(['one', 'two']);
  });
  it('typing shows to the rest of the team for 5 s, and stops when the message is sent', () => {
    const { g, as } = world();
    expect(as('ana', { action: 'typing' })).toMatchObject({ ok: true, team: 'Blue Team' });
    expect(as('ben', { action: 'room' }).typing).toEqual(['Ana Reyes']);
    expect(as('ana', { action: 'room' }).typing).toEqual([]); // not to herself
    expect(as('cy', { action: 'room' }).typing).toEqual([]);  // not to another team
    as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'hi' });
    expect(as('ben', { action: 'room' }).typing).toEqual([]);
    as('ana', { action: 'typing' });
    const cache = g.ctx.CacheService.getScriptCache();
    const ty = JSON.parse(cache.get('TYPING_Blue Team'));
    ty['ana@example.com'].t -= 6000;
    cache.put('TYPING_Blue Team', JSON.stringify(ty));
    expect(as('ben', { action: 'room' }).typing).toEqual([]);
  });
  it('the trainer hides a message: gone for everyone, kept in the Chat tab as Hidden = YES', () => {
    const { g, as } = world();
    const { id } = as('ben', { action: 'chatSend', channel: 'Blue Team', text: 'something rude' });
    expect(as('ana', { action: 'chatHide', id })).toMatchObject({ ok: false, error: expect.stringMatching(/Only the trainer/) });
    expect(as('coach', { action: 'chatHide', id }).ok).toBe(true);
    expect(as('ana', { action: 'room' }).messages).toEqual([]);
    expect(g.ss.getSheetByName('Chat').rows[1][6]).toBe('YES');
  });
  it('messages survive a cleared cache (rebuilt from the Chat tab, hidden ones stay hidden)', () => {
    const { g, as } = world();
    as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'keep me' });
    later(g, 'ana');
    const { id } = as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'hide me' });
    as('coach', { action: 'chatHide', id });
    g.ctx.CacheService.getScriptCache().remove('CH_Blue Team');
    expect(texts(as('ben', { action: 'room' }))).toEqual(['keep me']);
  });
  it('signing out everywhere also ends cached sign-ins', () => {
    const { g, as } = world();
    expect(as('ana', { action: 'status' }).ok).toBe(true);
    g.ctx.signOutEverywhere('ana@example.com');
    expect(as('ana', { action: 'status' })).toMatchObject({ ok: false, error: expect.stringMatching(/no longer valid/) });
  });
});

describe('answer sharing in a team', () => {
  const ANA_WS = { 'ws-2.1': { 'q1': 'WKS-LAB-01', 'q2': '  ', 't.r1.c1': '=SUM(1)' } };
  function shared() {
    const w = world();
    w.g.setSetting('Answer Sharing', '2,3');
    w.as('ana', { action: 'save', state: { version: 1, name: 'Ana Reyes', seat: 1, updatedAt: 5000, done: {}, ws: ANA_WS }, summary: {} });
    const r = w.as('ana', { action: 'share', day: 2, act: 'd2-act2.1', ws: 'ws-2.1', on: true });
    return { ...w, r };
  }
  it('the trainer turns sharing on per day; off = refused', () => {
    const { g, as } = world();
    expect(as('ana', { action: 'share', day: 2, act: 'd2-act2.1', ws: 'ws-2.1', on: true })).toMatchObject({ ok: false, error: expect.stringMatching(/sharing is off for Day 2/) });
    g.setSetting('Answer Sharing', 'ALL');
    expect(as('ana', { action: 'status' }).shareDays).toHaveLength(15);
    expect(as('ana', { action: 'share', day: 2, act: 'd2-act2.1', ws: 'ws-2.1', on: true }).ok).toBe(true);
    expect(as('dee', { action: 'share', day: 2, act: 'd2-act2.1', ws: 'ws-2.1', on: true })).toMatchObject({ ok: false, error: expect.stringMatching(/not in a team/) });
    expect(as('coach', { action: 'share', day: 2, act: 'd2-act2.1', ws: 'ws-2.1', on: true })).toMatchObject({ ok: false, error: expect.stringMatching(/Trainer accounts/) });
    expect(as('ana', { action: 'share', day: 3, act: 'd2-act2.1', ws: 'ws-2.1', on: true })).toMatchObject({ ok: false, error: expect.stringMatching(/Unknown activity/) });
    expect(as('ana', { action: 'share', day: 2, act: 'd2-act2.1', ws: 'bad id!', on: true })).toMatchObject({ ok: false, error: expect.stringMatching(/Unknown activity/) });
  });
  it('a teammate sees the share (no emails) and opens the latest saved answers; another team cannot', () => {
    const { as, r } = shared();
    expect(r.shares).toEqual([expect.objectContaining({ name: 'Ana Reyes', seat: 1, day: 2, act: 'd2-act2.1', mine: true })]);
    const st = as('ben', { action: 'status' });
    expect(st.shares).toEqual([expect.objectContaining({ id: r.shares[0].id, name: 'Ana Reyes', mine: false })]);
    expect(JSON.stringify(st.shares)).not.toContain('@');
    expect(as('cy', { action: 'status' }).shares).toEqual([]);
    expect(as('coach', { action: 'status' }).shares).toEqual([]);
    const v = as('ben', { action: 'shared', id: r.shares[0].id });
    // empty answers are left out; a value that looks like a formula comes back as typed
    expect(v).toMatchObject({ ok: true, name: 'Ana Reyes', seat: 1, act: 'd2-act2.1', ws: 'ws-2.1', values: { q1: 'WKS-LAB-01', 't.r1.c1': '=SUM(1)' }, updated: 5000 });
    expect(as('cy', { action: 'shared', id: r.shares[0].id })).toMatchObject({ ok: false, error: expect.stringMatching(/same team/) });
    expect(as('coach', { action: 'shared', id: r.shares[0].id }).values.q1).toBe('WKS-LAB-01'); // the trainer can look
  });
  it('copying is recorded in the Copies tab and on the board and the submission; stopping or closing sharing hides it', () => {
    const { g, as, r } = shared();
    const id = r.shares[0].id;
    expect(as('ana', { action: 'shared', id, copy: true, fields: 1 })).toMatchObject({ ok: false, error: expect.stringMatching(/your own/) });
    expect(as('ben', { action: 'shared', id, copy: true, fields: 2 }).ok).toBe(true);
    expect(g.ss.getSheetByName('Copies').rows[1].slice(1)).toEqual(['ben@example.com', 'Ben Cruz', 'Blue Team', 2, 'd2-act2.1', 'ana@example.com', 'Ana Reyes', 2]);
    expect(as('coach', { action: 'board' }).copies).toEqual([expect.objectContaining({ email: 'ben@example.com', act: 'd2-act2.1', from: 'ana@example.com', fromName: 'Ana Reyes', n: 2 })]);
    as('ben', { action: 'submit', day: 2, act: 'd2-act2.1', title: 'Activity 2.1', score: 1, max: 3, payload: { ws: {} } });
    expect(as('coach', { action: 'submission', email: 'ben@example.com', act: 'd2-act2.1' }).copies).toHaveLength(1);
    // the Shares tab: one row per trainee and activity
    expect(as('ana', { action: 'share', day: 2, act: 'd2-act2.1', ws: 'ws-2.1', on: false }).shares).toEqual([]);
    expect(as('ana', { action: 'share', day: 2, act: 'd2-act2.1', ws: 'ws-2.1', on: true }).shares).toHaveLength(1);
    expect(g.ss.getSheetByName('Shares').getLastRow()).toBe(2);
    g.setSetting('Answer Sharing', '');
    expect(as('ben', { action: 'status' }).shares).toEqual([]);
    expect(as('ben', { action: 'shared', id })).toMatchObject({ ok: false, error: expect.stringMatching(/sharing is off/) });
    // the trainee left the team: the share stays with the team they are in now
    g.setSetting('Answer Sharing', '2');
    as('coach', { action: 'teamSet', changes: [{ email: 'ana@example.com', team: 'Red Team' }] });
    expect(as('ben', { action: 'status' }).shares).toEqual([]);
    expect(as('cy', { action: 'status' }).shares).toHaveLength(1);
  });
});

describe('the trainer rearranges the teams', () => {
  it('teamSet writes Roster column E, adds a Roster row for a trainee who signed in without one, and refuses trainees', () => {
    const { g, as } = world();
    g.post({ action: 'requestCode', email: 'eve@example.com', name: 'Eve Ong' });
    g.post({ action: 'verify', email: 'eve@example.com', name: 'Eve Ong', code: g.lastCode('eve@example.com') });
    expect(as('ana', { action: 'teamSet', changes: [{ email: 'ana@example.com', team: 'Gold' }] })).toMatchObject({ ok: false, error: expect.stringMatching(/Only trainer/) });
    const r = as('coach', { action: 'teamSet', changes: [{ email: 'Ana@Example.com', team: '  Team   A ' }, { email: 'dee@example.com', team: 'Team A' }, { email: 'eve@example.com', team: 'Team B' }, { email: 'ben@example.com', team: '' }] });
    expect(r).toMatchObject({ ok: true, changed: 4, teams: ['Red Team', 'Team A', 'Team B'] });
    const rows = g.ss.getSheetByName('Roster').rows;
    expect(rows.map((x: unknown[]) => x[4])).toEqual(['Team', 'Team A', '', 'Red Team', 'Team A', 'Team B']);
    expect(rows[5].slice(0, 4)).toEqual(['eve@example.com', 'Eve Ong', 5, 'YES']);
    // at once in the rooms (the roster cache is cleared)
    expect(as('dee', { action: 'room' }).members.map((m: any) => m.name)).toEqual(['Ana Reyes', 'Dee Tan']);
    expect(as('ben', { action: 'room' }).team).toBe('');
    expect(as('coach', { action: 'teamSet', changes: [{ email: 'ana@example.com', team: 'Announcements' }] })).toMatchObject({ ok: false, error: expect.stringMatching(/cannot be a team name/) });
    expect(as('coach', { action: 'teamSet', changes: [{ email: 'ana@example.com', team: 'x'.repeat(41) }] })).toMatchObject({ ok: false, error: expect.stringMatching(/at most 40/) });
    expect(as('coach', { action: 'teamSet', changes: [] })).toMatchObject({ ok: false, error: expect.stringMatching(/Nothing/) });
    expect(g.ss.getSheetByName('Sync Log').rows.some((x: unknown[]) => x[2] === 'Teams changed')).toBe(true);
  });
});
