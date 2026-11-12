// Worksheet graders: correct answers pass, wrong ones are flagged, and every step's suggested
// command really completes that step (and runs without errors on its host).
import { describe, it, expect } from 'vitest';
import { DAY2 } from '../src/missions/day02';
import { DAY3 } from '../src/missions/day03';
import { DAY4 } from '../src/missions/day04';
import { DAY5, Q51, IR52, H53 } from '../src/missions/day05';
import { DAY6 } from '../src/missions/day06';
import { DAY7 } from '../src/missions/day07';
import { DAY8 } from '../src/missions/day08';
import { DAY9 } from '../src/missions/day09';
import '../src/missions/practice34';
import { seatHosts, demoLinux, demoWindows } from '../src/hosts/hosts';
import { newSession, run } from '../src/shell/shell';
import type { HostId } from '../src/missions/types';
import { foldersLine, missionFolders } from '../src/missions/folders';

const seat = seatHosts(7);
const hosts = { 'demo-win': demoWindows(), 'demo-linux': demoLinux(), 'seat-win': seat.win, 'seat-linux': seat.linux } as Record<HostId, ReturnType<typeof demoLinux>>;
const ctx = { facts: seat.facts, hosts };
const ALL = [DAY2, DAY3, DAY4, DAY5, DAY6, DAY7, DAY8, DAY9].flatMap((p) => p.missions);
const m = (id: string) => ALL.find((x) => x.id === id)!;

describe('every step hint completes its own step and runs cleanly', () => {
  for (const mi of ALL) for (const s of mi.steps.filter((x) => !x.manual)) {
    it(`${mi.id} / ${s.id}`, () => {
      const cmd = (s.try ?? '').split('   then   ')[0];
      expect(s.match.some((r) => r.test(cmd))).toBe(true);
      const out = run(newSession(hosts[s.host!]), cmd);
      expect(out.stderr.replace(/\[sudo\].*\n?/, '')).toBe('');
      expect(out.stdout.length).toBeGreaterThan(0);
    });
  }
});

describe('Activity 2.1 grading uses the seat facts', () => {
  const f = seat.facts;
  const good = {
    't.ip.wc': 'ipconfig', 't.ip.wr': f.win.ip, 't.ip.lc': 'ip a', 't.ip.lr': f.linux.ip + '/24',
    't.gw.wr': f.win.gateway, 't.gw.lr': f.linux.gateway, 't.ports.wr': String(f.win.listening), 't.ports.lr': `${f.linux.listening} ports`,
    't.procs.wr': 'explorer.exe, msedge.exe, lsass.exe', 't.procs.lr': 'sshd, apache2, cron',
    't.os.wr': f.win.os, 't.os.lr': f.linux.os, 't.user.wr': f.win.user, 't.user.lr': f.linux.user,
    analysis: `Windows: port ${f.win.unexpected.port} (${f.win.unexpected.proc}). Linux: port ${f.linux.unexpected.port} (${f.linux.unexpected.proc}).`,
  };
  it('all correct', () => {
    const g = m('d2-act2.1').worksheet!.grade!(good, ctx);
    const bad = Object.entries(g).filter(([, v]) => !v.ok);
    expect(bad).toEqual([]);
  });
  it('demo values are wrong for a seat host', () => {
    const g = m('d2-act2.1').worksheet!.grade!({ 't.ip.wr': '10.10.20.57', 't.ports.wr': '99' }, ctx);
    expect(g['t.ip.wr'].ok).toBe(false);
    expect(g['t.ports.wr'].ok).toBe(false);
  });
});

describe('Activities 2.2–2.4 grading', () => {
  it('2.2 rules', () => {
    const g = m('d2-act2.2').worksheet!.grade!({ 'r.4.v': 'Risky', 'r.5.v': 'Risky', 'r.1.v': 'Acceptable', 'r.2.v': 'Risky', 'z.1.zone': 'DMZ', 'z.1.range': '172.16.10.0/24' }, ctx);
    expect([g['r.4.v'].ok, g['r.5.v'].ok, g['r.1.v'].ok, g['r.2.v'].ok, g['z.1.range'].ok]).toEqual([true, true, true, false, true]);
  });
  it('2.3 all four found', () => {
    const v: Record<string, string> = {};
    [['198.51.100.23', '403', 'No'], ['203.0.113.77', '404', 'No'], ['192.0.2.90', '400', 'No'], ['198.51.100.200', '200', 'Yes']].forEach(([ip, st, ok], i) => { v[`s.${i + 1}.ip`] = ip; v[`s.${i + 1}.st`] = st; v[`s.${i + 1}.ok`] = ok; });
    v.urgent = 'The web shell at 198.51.100.200 returned 200, so it worked.';
    const g = m('d2-act2.3').worksheet!.grade!(v, ctx);
    expect(Object.values(g).every((x) => x.ok)).toBe(true);
  });
  it('2.4 top 3 comes from the real script output', () => {
    const g = m('d2-act2.4').worksheet!.grade!({ 'top.1.ip': '203.0.113.77', 'top.2.ip': '198.51.100.23', 'top.3.ip': '198.51.100.200', changes: 'Nothing; it only prints' }, ctx);
    expect(Object.values(g).every((x) => x.ok)).toBe(true);
  });
});

describe('Day 3 grading', () => {
  it('3.1 handout answers pass', () => {
    const key: Record<string, [string, string, string]> = { 1: ['Ransomware', 'Impact', 'vssadmin delete shadows'], 2: ['Fileless malware', 'Execution', 'EncodedCommand from winword'], 3: ['Worm', 'Lateral Movement', '245 hosts on 445'], 4: ['Cryptominer', 'Impact', 'mining pool 3333'], 5: ['Backdoor / RAT', 'Command and Control', 'every 60 seconds'], 6: ['Trojan', 'Persistence', 'scheduled task at logon'], 7: ['Spyware / Infostealer', 'Credential Access', 'Chrome Login Data'], 8: ['Rootkit', 'Defense Evasion', 'Event 1102 logs cleared'] };
    const v: Record<string, string> = {};
    for (const [n, [t, ta, c]] of Object.entries(key)) { v[`c.${n}.type`] = t; v[`c.${n}.tac`] = ta; v[`c.${n}.clue`] = c; }
    v['c.1.urg'] = 'Critical';
    expect(Object.entries(m('d3-act3.1').worksheet!.grade!(v, ctx)).filter(([, x]) => !x.ok)).toEqual([]);
  });
  it('3.2 Kill Chain', () => {
    const g = m('d3-act3.2').worksheet!.grade!({ 'k.recon.ev': '1', 'k.deliv.ev': '3', 'k.actions.ev': '7, 8, 9', 'k.c2.ev': '5', 'k.exploit.src': 'EDR log', stop: 'At delivery: the email gateway should block the .xlsm attachment.' }, ctx);
    expect([g['k.recon.ev'].ok, g['k.deliv.ev'].ok, g['k.actions.ev'].ok, g['k.c2.ev'].ok, g['k.exploit.src'].ok, g.stop.ok]).toEqual([true, true, true, false, true, true]);
  });
  it('3.3 ATT&CK IDs', () => {
    const g = m('d3-act3.3').worksheet!.grade!({ 'a.b2.id': 'T1059.001', 'a.b6.id': 't1486', 'a.b4.id': 'T1059', 'a.b5.tac': 'Lateral Movement' }, ctx);
    expect([g['a.b2.id'].ok, g['a.b6.id'].ok, g['a.b4.id'].ok, g['a.b5.tac'].ok]).toEqual([true, true, false, true]);
  });
  it('3.4 IOC/IOA', () => {
    const g = m('d3-act3.4').worksheet!.grade!({ 'x.i1.v': 'IOC', 'x.i2.v': 'IOA', 'x.i5.v': 'IOA' }, ctx);
    expect([g['x.i1.v'].ok, g['x.i2.v'].ok, g['x.i5.v'].ok]).toEqual([true, true, false]);
  });
});

describe('Day 4 grading', () => {
  it('4.2 sources and severities', () => {
    const g = m('d4-act4.2').worksheet!.grade!({ 'a.A-1004.src': 'SIEM', 'a.A-1004.sev': 'High', 'a.A-1008.sev': 'Informational', 'a.A-1005.rank': '1', 'a.A-1007.src': 'SIEM', 'a.A-1006.asset': 'mail-01' }, ctx);
    expect([g['a.A-1004.src'].ok, g['a.A-1004.sev'].ok, g['a.A-1008.sev'].ok, g['a.A-1005.rank'].ok, g['a.A-1007.src'].ok, g['a.A-1006.asset'].ok]).toEqual([true, true, true, true, false, true]);
  });
  it('4.3 findings', () => {
    const g = m('d4-act4.3').worksheet!.grade!({ ip: '198.51.100.150', fails: '12', accts: 'administrator, admin, vendor', success: '2026-11-04 02:03:41 vendor', after: 'cmd, whoami, created helpdesk2 and added it to Administrators, downloaded t.exe', kc: 'Installation, Command & Control', verdict: 'Yes, compromised' }, ctx);
    expect(Object.values(g).every((x) => x.ok)).toBe(true);
  });
  it('4.4 uses the seat own Defender detection and logon', () => {
    const f = seat.facts.day4;
    const short = f.threat!.name.split('/')[1].split('!')[0];
    const g = m('d4-act4.4').worksheet!.grade!({ 'n.history.f': `${f.threat!.name} quarantined`, 'n.sec.f': `${f.logon4624} ${seat.facts.win.user}`, 'n.wazuh.f': 'Running', 'n.history.x': '' }, ctx);
    expect([g['n.history.f'].ok, g['n.sec.f'].ok, g['n.wazuh.f'].ok]).toEqual([true, true, true]);
    expect(short.length).toBeGreaterThan(2);
  });
});

describe('mission header names the folders where the files are', () => {
  it('Day 3 Demo 1 practice points to ~/demo3', () => {
    expect(foldersLine(m('d3-demo1'))).toBe('Files for this mission: Ubuntu `~/demo3`. Type the folder with the file name, e.g. `cat ~/demo3/<file>`.');
  });
  for (const mi of ALL) it(`${mi.id}: every named folder exists on its host`, () => {
    const { linux, win } = missionFolders(mi);
    const lh = mi.kind === 'practice' ? hosts['demo-linux'] : hosts['seat-linux'], wh = mi.kind === 'practice' ? hosts['demo-win'] : hosts['seat-win'];
    for (const d of linux) expect(run(newSession(lh), `ls ${d}`).stderr).toBe('');
    for (const d of win) expect(run(newSession(wh), `dir ${d}`).stderr).toBe('');
  });
});
