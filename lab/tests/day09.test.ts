// Day 9 (Case Follow-up and Escalation): answer keys from the data files and SOC-SOP-05; graders; per-seat scan logs of 9.4.
import { describe, it, expect } from 'vitest';
import { DAY9, KEY91, KEY92, KEY93, AUTH } from '../src/missions/day09';
import { DAY9_FILES, DAY6_FILES } from '../src/hosts/files';
import { parseCsv } from '../src/shell/windows2';
import { seatHosts } from '../src/hosts/hosts';
import { newSession, run } from '../src/shell/shell';
import type { HostId } from '../src/missions/types';

const m = (id: string) => DAY9.missions.find((x) => x.id === id)!;
const ctxFor = (n: number) => { const s = seatHosts(n); return { facts: s.facts, hosts: { 'seat-win': s.win, 'seat-linux': s.linux } as Record<HostId, typeof s.win> }; };
const bad = (g: Record<string, { ok: boolean }>) => Object.entries(g).filter(([, v]) => !v.ok).map(([k]) => k);
const FAILED = [1118, 1119, 1002, 1005, 2001];
const scans = parseCsv(DAY9_FILES['scan_logs.csv']).slice(1);

describe('9.2 key: F2 failure events', () => {
  it('every log row is in the key with the right answer', () => {
    expect(Object.keys(KEY92)).toEqual(scans.map((r) => `${r[0].slice(11)} ${r[1]}`));
    for (const r of scans) expect(KEY92[`${r[0].slice(11)} ${r[1]}`]).toBe(FAILED.includes(Number(r[2])) ? 'Yes' : 'No');
  });
});

describe('9.3 key: E1-E4 applied in order', () => {
  const tier = Object.fromEntries(parseCsv(DAY6_FILES['asset_inventory.csv']).slice(1).map((r) => [r[0], Number(r[4])]));
  const redFlag = new Set(['FIN-PC-03', 'ENG-PC-11', 'QA-PC-05']); // Day 5 Activity 5.3: ransomware and PE infection hosts
  for (const [, host, ev, detail] of scans.filter((r) => FAILED.includes(Number(r[2])))) it(host, () => {
    const ransomTier1 = /ransom/i.test(detail) && (tier[host] === 1 || /FS-01/.test(detail));
    const rule = ransomTier1 ? 'E1' : redFlag.has(host) || tier[host] === 1 ? 'E2' : ['1005', '2001'].includes(ev) ? 'E3' : 'E4';
    expect(KEY93[host]).toEqual([rule, { E1: AUTH[1], E2: AUTH[2], E3: AUTH[3], E4: AUTH[4] }[rule]]);
  });
  it('the key covers exactly the failed hosts', () => { expect(Object.keys(KEY93).sort()).toEqual(scans.filter((r) => FAILED.includes(Number(r[2]))).map((r) => r[1]).sort()); });
});

describe('graders', () => {
  it('9.1 correct answers pass; closing a case with symptoms is wrong', () => {
    const who: Record<string, string> = { 'C-01': 'Maria Reyes', 'C-02': 'Carlo Diaz', 'C-03': 'Leo Uy', 'C-04': 'Rosa Mendoza', 'C-05': 'Alvin Jimenez' };
    const v: Record<string, string> = { msg: 'We found a trojan in payslip_viewer.exe; the antivirus quarantined it and it is gone. Please restart your laptop and tell us if anything looks unusual.' };
    for (const [id, k] of Object.entries(KEY91)) Object.assign(v, { [`c.${id}.who`]: who[id], [`c.${id}.o`]: k[1], [`c.${id}.n`]: k[2] });
    expect(bad(m('d9-act9.1').worksheet!.grade!(v, ctxFor(1)))).toEqual([]);
    expect(bad(m('d9-act9.1').worksheet!.grade!({ 'c.C-02.n': 'Close the case', 'c.C-03.n': 'Try again after 2 hours' }, ctxFor(1))).sort()).toEqual(['c.C-02.n', 'c.C-03.n']);
  });
  it('9.2 and 9.3 correct answers pass; common mistakes are flagged', () => {
    const v2: Record<string, string> = { count: '6', why1117: '1117 means the action was taken successfully' };
    for (const [l, f] of Object.entries(KEY92)) v2[`s.${l.replace(/[^A-Za-z0-9]/g, '')}.f`] = f;
    expect(bad(m('d9-act9.2').worksheet!.grade!(v2, ctxFor(1)))).toEqual([]);
    const v3: Record<string, string> = { to: AUTH[1], impact: 'The FS-01 Finance share is still encrypted by the ransomware', need: 'A decision to isolate FS-01 and restore the share from backup', target: '15 minutes', follow: '11:35' };
    for (const [h, [rule, a]] of Object.entries(KEY93)) Object.assign(v3, { [`e.${h}.r`]: rule, [`e.${h}.a`]: a });
    expect(bad(m('d9-act9.3').worksheet!.grade!(v3, ctxFor(1)))).toEqual([]);
    // FIN-PC-03 is Tier 2, but its ransomware reached the Tier 1 FS-01 share: E1, not E2; ENG-PC-11's stopped scan is on a red-flag host: E2, not E4
    expect(bad(m('d9-act9.3').worksheet!.grade!({ 'e.FIN-PC-03.r': 'E2', 'e.ENG-PC-11.r': 'E4', target: '120' }, ctxFor(1))).sort()).toEqual(['e.ENG-PC-11.r', 'e.FIN-PC-03.r', 'target']);
  });
});

describe('9.4 each seat\'s scan log follows its Day 8 scan', () => {
  const kinds = new Set<string>();
  for (let n = 1; n <= 40; n++) it(`seat ${n}`, () => {
    const { facts, hosts } = ctxFor(n), f = facts.day9, d8 = facts.day8;
    kinds.add(f.failures.map((x) => x.event).join('+'));
    expect(f.failures.length).toBeGreaterThan(0);
    expect(f.failures.some((x) => x.event === 1118)).toBe(d8.fails);
    const out = run(newSession(hosts['seat-win']), String.raw`Import-Csv day9\my_scan_log.csv | Format-Table time, event_id, detail`).stdout;
    expect(out).toContain(d8.name);
    for (const x of f.failures) expect(out).toContain(String(x.event));
    const right = { count: String(f.failures.length), events: f.failures.map((x) => x.event).join(', '), it: f.failures.some((x) => x.rule === 'E4') ? 'Yes' : 'No', vendor: f.vendorCase ? 'Yes' : 'No' };
    expect(bad(m('d9-act9.4').worksheet!.grade!(right, { facts, hosts }))).toEqual([]);
  });
  it('different combinations occur', () => { expect(kinds.size).toBeGreaterThanOrEqual(4); });
});
