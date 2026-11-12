// Day 6 (Alert Triage and Ticketing): answer keys follow SOC-SOP-02 and the data files; graders; per-seat alerts of 6.4.
import { describe, it, expect } from 'vitest';
import { DAY6, KEY61, KEY62 } from '../src/missions/day06';
import { DAY6_FILES, DAY5_FILES } from '../src/hosts/files';
import { parseCsv } from '../src/shell/windows2';
import { seatHosts } from '../src/hosts/hosts';
import { newSession, run } from '../src/shell/shell';
import type { HostId } from '../src/missions/types';

const m = (id: string) => DAY6.missions.find((x) => x.id === id)!;
const ctxFor = (n: number) => { const s = seatHosts(n); return { facts: s.facts, hosts: { 'seat-win': s.win, 'seat-linux': s.linux } as Record<HostId, typeof s.win> }; };
const bad = (g: Record<string, { ok: boolean }>) => Object.entries(g).filter(([, v]) => !v.ok).map(([k]) => k);

describe('Activity 6.1 · the answer key is consistent with the data and the SOP matrix', () => {
  const tiers = Object.fromEntries(parseCsv(DAY6_FILES['asset_inventory.csv']).slice(1).map((r) => [r[0], r[4]]));
  const affected = Object.fromEntries(parseCsv(DAY6_FILES['alert_details.csv']).slice(1).map((r) => [r[0], r[1]]));
  const queue = parseCsv(DAY5_FILES['alert_queue.csv']).slice(1).map((r) => r[0]);
  const MATRIX: Record<string, string[]> = { Critical: ['P1', 'P1', 'P1'], High: ['P1', 'P2', 'P2'], Medium: ['P2', 'P3', 'P3'], Low: ['P3', 'P4', 'P4'] };
  it('every Day 5 queue alert has details and a key', () => { expect(Object.keys(KEY61)).toEqual(queue); expect(Object.keys(affected)).toEqual(queue); });
  for (const [id, [disp, threat, tier, prio, ticket]] of Object.entries(KEY61)) it(id, () => {
    expect(tier).toBe(tiers[affected[id]]);                                       // tier of the affected asset
    expect(prio).toBe(disp === 'Confirmed' || disp === 'Blocked' ? MATRIX[threat][Number(tier) - 1] : '-'); // STEP 5 matrix
    expect(ticket).toBe(disp === 'Confirmed' ? 'Yes' : 'No');                     // rule T1
  });
  it('correct answers pass, typical mistakes are flagged', () => {
    const v: Record<string, string> = { count: '4 tickets', linked: 'Q-5005 and Q-5011', q5012: 'RT3: approved vendor scan from 198.51.100.23 on Thursday 09:24 (CHG-1142)' };
    for (const [id, k] of Object.entries(KEY61)) ['disp', 'threat', 'tier', 'prio', 'ticket'].forEach((c, i) => { v[`a.${id}.${c}`] = k[i]; });
    expect(bad(m('d6-act6.1').worksheet!.grade!(v, ctxFor(1)))).toEqual([]);
    const g = m('d6-act6.1').worksheet!.grade!({ 'a.Q-5008.disp': 'Blocked', 'a.Q-5012.disp': 'Confirmed', 'a.Q-5005.prio': 'P2', count: '6', 'a.Q-5010.prio': 'P2', 'a.Q-5010.tier': '1' }, ctxFor(1));
    expect(bad(g).sort()).toEqual(['a.Q-5005.prio', 'a.Q-5008.disp', 'a.Q-5012.disp', 'count']);
  });
});

describe('Activity 6.2 · borderline alerts', () => {
  it('correct answers pass', () => {
    const ev: Record<string, string> = { 'B-01': 'RT5 CHG-2201', 'B-02': 'RT5 CHG-2203', 'B-03': '203.0.113.20 is VPN-GW-01', 'B-04': 'no approved change', 'B-05': 'RT2 SCAN-01', 'B-06': 'restored and ran; beaconing', 'B-07': 'loan account numbers fail Luhn', 'B-08': 'normal search for select committee' };
    const v: Record<string, string> = { b04: 'Linked to Q-5001: the same svc_backup account', chg: 'CHG-2209 is still pending (not approved) and is for 2026-11-06', b06: 'P2' };
    for (const [id, want] of Object.entries(KEY62)) Object.assign(v, { [`b.${id}.v`]: want, [`b.${id}.ev`]: ev[id], [`b.${id}.t`]: want === 'Confirmed' ? 'Yes' : 'No' });
    expect(bad(m('d6-act6.2').worksheet!.grade!(v, ctxFor(1)))).toEqual([]);
  });
  it('trusting the rule name is flagged', () => {
    const g = m('d6-act6.2').worksheet!.grade!({ 'b.B-01.v': 'Confirmed', 'b.B-08.v': 'Confirmed', 'b.B-04.v': 'Routine', 'b.B-01.ev': 'looks fine', chg: 'it is about accounts' }, ctxFor(1));
    expect(bad(g).sort()).toEqual(['b.B-01.ev', 'b.B-01.v', 'b.B-04.v', 'b.B-08.v', 'chg']);
  });
});

describe('Activity 6.3 · the ticket', () => {
  it('a complete ticket passes; a guessed one does not', () => {
    const good = { title: 'Ransomware activity on FIN-PC-03', linked: 'Q-5005, Q-5011, IR-01', asset: 'FIN-PC-03, accounting workstation, Tier 2', cat: 'Ransomware', prio: 'P1',
      evidence: '24 files renamed to .lockd by svcupd.exe; README_RESTORE_FILES.txt; vssadmin delete shadows blocked', actions: 'Told Liza to unplug the network cable; called the Shift Lead (local 4401)', assign: 'Shift Lead', status: 'New' };
    expect(bad(m('d6-act6.3').worksheet!.grade!(good, ctxFor(1)))).toEqual([]);
    const g = m('d6-act6.3').worksheet!.grade!({ linked: 'Q-5005', prio: 'P2', assign: 'IT Helpdesk', status: 'Closed', evidence: 'looks bad' }, ctxFor(1));
    expect(bad(g).sort()).toEqual(['assign', 'evidence', 'linked', 'prio', 'status']);
  });
});

describe('Activity 6.4 · every seat triages its own alerts', () => {
  const sets = new Set<string>();
  for (let n = 1; n <= 40; n++) {
    const { facts, hosts } = ctxFor(n), al = facts.day6.alerts;
    sets.add(al.map((a) => a.rule + a.time).join('|'));
    it(`seat ${n}: five alerts, all four kinds, file matches the facts, right answers pass`, () => {
      expect(al).toHaveLength(5);
      expect(new Set(al.map((a) => a.disp)).size).toBe(4);
      expect(new Set(al.map((a) => a.rule)).size).toBe(5);
      const scan = al.find((a) => /Nmap/.test(a.rule));
      if (scan) expect(scan.time.slice(11, 16) >= '08:00' && scan.time.slice(11, 16) < '10:00').toBe(true); // inside RT2
      expect([...al].map((a) => a.time).sort()).toEqual(al.map((a) => a.time));
      const out = run(newSession(hosts['seat-win']), String.raw`Import-Csv day6\my_alerts.csv | Format-List alert_id, time, rule_name, details`).stdout;
      for (const a of al) { expect(out).toContain(a.id); expect(out).toContain(a.details); }
      const v: Record<string, string> = { count: String(facts.day6.tickets) };
      al.forEach((a, i) => Object.assign(v, { [`m.${i + 1}.disp`]: a.disp, [`m.${i + 1}.prio`]: a.priority, [`m.${i + 1}.ticket`]: a.ticket }));
      const top = [...al].filter((a) => a.priority !== '-').sort((x, y) => x.priority.localeCompare(y.priority) || (y.disp === 'Confirmed' ? 1 : 0) - (x.disp === 'Confirmed' ? 1 : 0))[0];
      v.first = top.id;
      expect(bad(m('d6-act6.4').worksheet!.grade!(v, { facts, hosts }))).toEqual([]);
    });
  }
  it('seats get different alert sets', () => { expect(sets.size).toBeGreaterThanOrEqual(35); });
});
