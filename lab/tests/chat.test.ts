// Who is online and team chat (sync/Code.gs on the fake Google services).
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
    g.ss.getSheetByName('Roster').rows[3][4] = 'Blue Team'; // Cy (row 4 of the sheet) transfers to Blue Team
    as('cy', { action: 'status' });
    expect(as('ana', { action: 'status' }).online.map((p: any) => p.name)).toContain('Cy Lim');
  });
});

describe('team chat', () => {
  it('team members chat; other teams cannot read it; the Chat tab keeps every message', () => {
    const { g, as } = world();
    expect(as('ana', { action: 'chatSend', channel: 'Blue Team', text: '  Hi team,   who has C-02? ' })).toMatchObject({ ok: true, id: 1 });
    const ben = as('ben', { action: 'chatGet', channel: 'Blue Team' });
    expect(ben.messages).toEqual([expect.objectContaining({ id: 1, name: 'Ana Reyes', text: 'Hi team, who has C-02?', mine: false, trainer: false })]);
    expect(JSON.stringify(ben)).not.toContain('@');
    expect(as('ana', { action: 'chatGet', channel: 'Blue Team' }).messages[0].mine).toBe(true);
    expect(as('cy', { action: 'chatGet', channel: 'Blue Team' })).toMatchObject({ ok: false, error: expect.stringMatching(/not a member/) });
    expect(as('cy', { action: 'chatSend', channel: 'Blue Team', text: 'x' }).ok).toBe(false);
    expect(as('dee', { action: 'chatSend', channel: 'Blue Team', text: 'x' })).toMatchObject({ ok: false, error: expect.stringMatching(/not in a team yet/) });
    expect(g.ss.getSheetByName('Chat').rows[1].slice(1, 7)).toEqual(['Blue Team', 'ana@example.com', 'Ana Reyes', 'Hi team, who has C-02?', 1, '']);
  });
  it('the trainer reads and posts in every team and posts announcements; trainees only read announcements', () => {
    const { g, as } = world();
    const st = as('coach', { action: 'status' });
    expect(Object.keys(st.chat)).toEqual(['Announcements', 'Blue Team', 'Red Team']);
    expect(Object.keys(as('ana', { action: 'status' }).chat)).toEqual(['Announcements', 'Blue Team']);
    expect(as('coach', { action: 'chatSend', channel: 'Red Team', text: 'Red Team: start 9.2 now' }).ok).toBe(true);
    later(g, 'coach');
    expect(as('coach', { action: 'chatSend', channel: 'Announcements', text: 'Break until 10:30' }).ok).toBe(true);
    expect(as('cy', { action: 'chatGet', channel: 'Red Team' }).messages[0]).toMatchObject({ name: 'Coach', trainer: true });
    const ann = as('dee', { action: 'chatGet', channel: 'Announcements' });
    expect([ann.canPost, ann.messages[0].text]).toEqual([false, 'Break until 10:30']);
    expect(as('ana', { action: 'chatSend', channel: 'Announcements', text: 'hello all' })).toMatchObject({ ok: false, error: expect.stringMatching(/Only the trainer/) });
    // the badge data: each channel's version and newest message id
    expect(as('cy', { action: 'status' }).chat['Red Team']).toEqual({ ver: 1, last: 1 });
  });
  it('unchanged chat returns { same: true }; empty, long and too-fast messages are refused', () => {
    const { g, as } = world();
    as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'one' });
    const v = as('ben', { action: 'chatGet', channel: 'Blue Team' }).ver;
    expect(as('ben', { action: 'chatGet', channel: 'Blue Team', ver: v })).toMatchObject({ ok: true, same: true });
    expect(as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'two' })).toMatchObject({ ok: false, error: expect.stringMatching(/Slow down/) });
    later(g, 'ana');
    expect(as('ana', { action: 'chatSend', channel: 'Blue Team', text: '   ' })).toMatchObject({ ok: false, error: expect.stringMatching(/Type a message/) });
    expect(as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'x'.repeat(501) })).toMatchObject({ ok: false, error: expect.stringMatching(/at most 500/) });
    later(g, 'ana');
    expect(as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'two' }).ok).toBe(true);
    expect(as('ben', { action: 'chatGet', channel: 'Blue Team', ver: v }).messages.map((m: any) => m.text)).toEqual(['one', 'two']);
  });
  it('the trainer hides a message: gone for everyone, kept in the Chat tab as Hidden = YES', () => {
    const { g, as } = world();
    const { id } = as('ben', { action: 'chatSend', channel: 'Blue Team', text: 'something rude' });
    expect(as('ana', { action: 'chatHide', id })).toMatchObject({ ok: false, error: expect.stringMatching(/Only the trainer/) });
    expect(as('coach', { action: 'chatHide', id }).ok).toBe(true);
    expect(as('ana', { action: 'chatGet', channel: 'Blue Team' }).messages).toEqual([]);
    expect(g.ss.getSheetByName('Chat').rows[1][6]).toBe('YES');
  });
  it('messages survive a cleared cache (rebuilt from the Chat tab, hidden ones stay hidden)', () => {
    const { g, as } = world();
    as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'keep me' });
    later(g, 'ana');
    const { id } = as('ana', { action: 'chatSend', channel: 'Blue Team', text: 'hide me' });
    as('coach', { action: 'chatHide', id });
    g.ctx.CacheService.getScriptCache().remove('CH_Blue Team');
    expect(as('ben', { action: 'chatGet', channel: 'Blue Team' }).messages.map((m: any) => m.text)).toEqual(['keep me']);
  });
  it('signing out everywhere also ends cached sign-ins', () => {
    const { g, as } = world();
    expect(as('ana', { action: 'status' }).ok).toBe(true);
    g.ctx.signOutEverywhere('ana@example.com');
    expect(as('ana', { action: 'status' })).toMatchObject({ ok: false, error: expect.stringMatching(/no longer valid/) });
  });
});
