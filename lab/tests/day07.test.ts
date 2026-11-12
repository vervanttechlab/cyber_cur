// Day 7 (Security Solution Status Check): answer keys follow SOC-SOP-03 and the data files; graders; per-seat checks of 7.4.
import { describe, it, expect } from 'vitest';
import { DAY7, KEY71, KEY72, KEY73 } from '../src/missions/day07';
import { DAY7_FILES } from '../src/hosts/files';
import { parseCsv } from '../src/shell/windows2';
import { seatHosts, demoWindows } from '../src/hosts/hosts';
import { newSession, run } from '../src/shell/shell';
import type { HostId } from '../src/missions/types';

const m = (id: string) => DAY7.missions.find((x) => x.id === id)!;
const ctxFor = (n: number) => { const s = seatHosts(n); return { facts: s.facts, hosts: { 'seat-win': s.win, 'seat-linux': s.linux } as Record<HostId, typeof s.win> }; };
const bad = (g: Record<string, { ok: boolean }>) => Object.entries(g).filter(([, v]) => !v.ok).map(([k]) => k);
const rows = (f: string) => parseCsv(DAY7_FILES[f]).slice(1);

describe('7.1 the coverage key follows Section A', () => {
  const cov = Object.fromEntries(rows('coverage_report.csv').map((r) => [r[0], r]));
  for (const [host, , type] of rows('endpoint_inventory.csv')) it(host, () => {
    const c = cov[host];
    const need = type === 'Linux server' ? [2, 3] : type === 'Tier 3 test PC' ? [1, 3] : [1, 2, 3];
    const label = !c ? 'Gap: not enrolled' : need.map((i) => (c[i] === 'Not installed' ? ['', 'Gap: AV missing', 'Gap: EDR missing', 'Gap: SIEM agent missing'][i] : '')).find(Boolean) ?? 'No gap';
    expect(KEY71[host]).toBe(label);
  });
});

describe('7.2 the health key follows Section B (now = 09:30)', () => {
  const MIN: Record<string, number[]> = { Defender: [4, 18, 24], Falcon: [7, 10], Wazuh: [4, 7] };
  const atLeast = (v: string, min: number[]) => { const p = v.split('.').map(Number); for (let i = 0; i < min.length; i++) { if ((p[i] ?? 0) !== min[i]) return (p[i] ?? 0) > min[i]; } return true; };
  for (const [id, , sol, ver, svc, rt, ci, content, tamper] of rows('agent_health.csv')) it(id, () => {
    const [h, mi] = ci.slice(11).split(':').map(Number);
    const fails = [svc !== 'Running' && 'B1 Service', sol === 'Defender' && rt !== 'On' && 'B2 Real-time', 9 * 60 + 30 - (h * 60 + mi) > 60 && 'B3 Check-in',
      content < '2026-11-02' && 'B4 Content', !atLeast(ver, MIN[sol]) && 'B5 Version', tamper !== 'On' && 'B6 Tamper protection'].filter(Boolean);
    expect(KEY72[id]).toEqual(fails.length ? ['Not operational', fails[0]] : ['Operational', '-']);
  });
});

describe('7.3 the capability key follows Section C', () => {
  const pol = Object.fromEntries(rows('security_policies.csv').map((r) => [r[0], r]));
  for (const [id, host, threat, sev, path] of rows('open_detections.csv')) it(id, () => {
    const p = pol[host];
    const code = Number(p[{ Low: 1, Moderate: 2, High: 3, Severe: 4 }[sev as 'Low']]);
    const excluded = p[6] !== 'none' && path.toLowerCase().startsWith(p[6].toLowerCase());
    const want = /^(Ransom|Rootkit)/.test(threat) || /boot sector/i.test(path) ? ['Re-image', 'C4 Re-image', 'Report: re-image by IT']
      : ![1, 2, 3, 10].includes(code) ? ['No', 'C1 Action code', 'Report to Shift Lead: cannot clean']
        : excluded ? ['No', 'C2 Exclusion', 'Report to Shift Lead: cannot clean'] : ['Yes', 'OK (action 1, 2, 3 or 10)', 'Verify the action in the log'];
    expect(KEY73[id]).toEqual(want);
  });
});

describe('Activities 7.1-7.3 graders', () => {
  it('correct answers pass', () => {
    const v1: Record<string, string> = { count: '4', siem: 'CORE-DB-01: no Wazuh agent, so the SIEM sees nothing from the core banking database', dev: 'Tier 3 test PC: EDR not required' };
    for (const [h, g] of Object.entries(KEY71)) v1[`c.${h}.g`] = g;
    expect(bad(m('d7-act7.1').worksheet!.grade!(v1, ctxFor(1)))).toEqual([]);
    const v2: Record<string, string> = { count: '6', why07: 'H-07 FIN-PC-03: the user unplugged the network cable after the ransomware' };
    for (const [id, [s, f]] of Object.entries(KEY72)) Object.assign(v2, { [`h.${id}.v`]: s, [`h.${id}.f`]: f });
    expect(bad(m('d7-act7.2').worksheet!.grade!(v2, ctxFor(1)))).toEqual([]);
    const v3: Record<string, string> = { detect: 'QA-PC-05' };
    for (const [id, k] of Object.entries(KEY73)) Object.assign(v3, { [`d.${id}.c`]: k[0], [`d.${id}.w`]: k[1], [`d.${id}.n`]: k[2] });
    expect(bad(m('d7-act7.3').worksheet!.grade!(v3, ctxFor(1)))).toEqual([]);
  });
  it('typical mistakes are flagged', () => {
    expect(bad(m('d7-act7.1').worksheet!.grade!({ 'c.DEV-PC-02.g': 'Gap: EDR missing', 'c.LOAN-PC-03.g': 'No gap', count: '3' }, ctxFor(1))).sort()).toEqual(['c.DEV-PC-02.g', 'c.LOAN-PC-03.g', 'count']);
    expect(bad(m('d7-act7.2').worksheet!.grade!({ 'h.H-11.v': 'Operational', 'h.H-07.v': 'Operational', 'h.H-14.v': 'Not operational' }, ctxFor(1))).sort()).toEqual(['h.H-07.v', 'h.H-11.v', 'h.H-14.v']);
    expect(bad(m('d7-act7.3').worksheet!.grade!({ 'd.D7-02.c': 'Yes', 'd.D7-01.c': 'Yes', 'd.D7-07.c': 'Yes' }, ctxFor(1))).sort()).toEqual(['d.D7-01.c', 'd.D7-02.c', 'd.D7-07.c']);
  });
});

describe('7.4 every seat checks its own workstation', () => {
  const combos = new Set<string>();
  for (let n = 1; n <= 40; n++) {
    const { facts, hosts } = ctxFor(n), f = facts.day7;
    combos.add(`${f.edr}|${f.wazuhConnected}|${f.high}|${f.exclusion}|${f.lastKeepalive}`);
    it(`seat ${n}: the commands show the facts and the right answers pass`, () => {
      const s = newSession(hosts['seat-win']);
      const svc = run(s, 'Get-Service').stdout;
      if (f.edr === 'Not installed') expect(svc).not.toContain('CSFalconService'); else expect(svc).toMatch(new RegExp(`${f.edr}\\s+CSFalconService`));
      const log = run(s, String.raw`Get-Content "C:\Program Files (x86)\ossec-agent\ossec.log" -Tail 4`);
      expect(log.stderr).toBe('');
      expect(log.stdout).toContain(f.wazuhConnected ? '09:30:00 wazuh-agent: INFO: Keep alive acknowledged' : 'Lost connection with manager');
      expect(log.stdout).toContain(`${f.lastKeepalive}:00 wazuh-agent: INFO: Keep alive acknowledged`);
      const pref = run(s, 'Get-MpPreference | Format-List HighThreatDefaultAction, SevereThreatDefaultAction, ExclusionPath').stdout;
      expect(pref).toMatch(new RegExp(`HighThreatDefaultAction\\s+: ${f.high}\\b`));
      if (f.exclusion) expect(pref).toContain(f.exclusion);
      expect(f.report).toBe(true); // every seat has something to report
      const right = { av: 'Installed and operational', edr: f.edr, wazuh: f.wazuhConnected ? 'Yes' : 'No', keep: f.lastKeepalive, high: String(f.high), clean: f.canClean ? 'Yes' : 'No',
        reason: f.canClean ? `action ${f.high} (Quarantine)` : ![1, 2, 3, 10].includes(f.high) ? `action ${f.high}` : 'Downloads is excluded', report: 'Yes' };
      expect(bad(m('d7-act7.4').worksheet!.grade!(right, { facts, hosts }))).toEqual([]);
    });
  }
  it('seats differ', () => { expect(combos.size).toBeGreaterThanOrEqual(30); });
  it('Day 4 values on the seat are unchanged (Defender real-time on, Wazuh service running)', () => {
    const s = newSession(seatHosts(12).win);
    expect(run(s, 'Get-MpComputerStatus').stdout).toMatch(/RealTimeProtectionEnabled\s+: True/);
    expect(run(s, 'Get-Service Wazuh*').stdout).toContain('Running');
  });
  it('the demo workstation (Video 3) cannot clean a High threat: action 6', () => {
    expect(run(newSession(demoWindows()), 'Get-MpPreference').stdout).toMatch(/HighThreatDefaultAction\s+: 6/);
  });
});
