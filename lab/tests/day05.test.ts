// Day 5 (Checking for Alerts): the answer key computed from the asset files, the graders, and the per-seat evidence of Activity 5.4.
import { describe, it, expect } from 'vitest';
import { DAY5, Q51, IR52, H53 } from '../src/missions/day05';
import { seatHosts } from '../src/hosts/hosts';
import { newSession, run } from '../src/shell/shell';
import type { HostId } from '../src/missions/types';

const m = (id: string) => DAY5.missions.find((x) => x.id === id)!;
const ctxFor = (n: number) => { const s = seatHosts(n); return { facts: s.facts, hosts: { 'seat-win': s.win, 'seat-linux': s.linux } as Record<HostId, typeof s.win> }; };
const bad = (g: Record<string, { ok: boolean }>) => Object.entries(g).filter(([, v]) => !v.ok).map(([k]) => k);

describe('Activity 5.1 · alert receipt log', () => {
  it('the SLA answer key matches SOC-SOP-01 rule A2', () => {
    const k = Object.fromEntries(Q51.map((q) => [q.id, [Math.floor(q.minutes), q.within]]));
    expect(k).toEqual({
      'Q-5001': [19, 'Yes'], 'Q-5002': [34, 'Yes'], 'Q-5003': [51, 'Yes'], 'Q-5004': [33, 'Yes'], 'Q-5005': [23, 'No - breach'],
      'Q-5006': [56, 'No - breach'], 'Q-5007': [48, 'No - breach'], 'Q-5008': [42, 'No - breach'], 'Q-5009': [24, 'N/A (Informational)'],
      'Q-5010': [17, 'Yes'], 'Q-5011': [11, 'Yes'], 'Q-5012': [5, 'Yes'], 'Q-5013': [2, 'Yes'],
    });
  });
  it('correct answers pass; rounding either way is accepted', () => {
    const v: Record<string, string> = { newCount: '8', late: 'Q-5005 (Critical, 24 minutes)', first: 'Q-5011: Critical ransomware red flag, 3 minutes left', red: 'Q-5005 R1, Q-5011 R3, Q-5007 V1, Q-5008 V2' };
    for (const q of Q51) { v[`q.${q.id}.min`] = String(Math.round(q.minutes)); v[`q.${q.id}.sla`] = q.within; }
    expect(bad(m('d5-act5.1').worksheet!.grade!(v, ctxFor(1)))).toEqual([]);
  });
  it('typical mistakes are flagged', () => {
    const g = m('d5-act5.1').worksheet!.grade!({ 'q.Q-5005.sla': 'Yes', 'q.Q-5009.sla': 'Yes', 'q.Q-5006.min': '30', newCount: '13', first: 'Q-5006', late: 'Q-5003' }, ctxFor(1));
    expect(bad(g).sort()).toEqual(['first', 'late', 'newCount', 'q.Q-5005.sla', 'q.Q-5006.min', 'q.Q-5009.sla']);
  });
});

describe('Activity 5.2 · incident report intake', () => {
  it('correct answers pass', () => {
    const asset: Record<string, string> = { 'IR-01': 'FIN-PC-03', 'IR-02': 'ENG-PC-11, QA-PC-05', 'IR-03': 'Grace Lim mailbox', 'IR-04': 'Admin console / SOC OTP', 'IR-05': '3rd floor printer', 'IR-06': 'LOAN-PC-08' };
    const v: Record<string, string> = { match: 'IR-01 = Q-5005/Q-5011 (FIN-PC-03); IR-02 = Q-5007/Q-5008', advice: 'Unplug the network cable or turn off Wi-Fi, do not shut down, never pay.' };
    for (const [id, k] of Object.entries(IR52)) Object.assign(v, { [`r.${id}.ch`]: k.ch, [`r.${id}.who`]: 'name, local 1234', [`r.${id}.asset`]: asset[id], [`r.${id}.type`]: k.type, [`r.${id}.next`]: k.next });
    expect(bad(m('d5-act5.2').worksheet!.grade!(v, ctxFor(1)))).toEqual([]);
  });
  it('sending the OTP or escalating the printer is wrong', () => {
    const g = m('d5-act5.2').worksheet!.grade!({ 'r.IR-04.type': 'Security incident', 'r.IR-04.next': 'Record and create a ticket', 'r.IR-05.next': 'Escalate immediately to the Shift Lead', advice: 'Shut down the PC' }, ctxFor(1));
    expect(bad(g).sort()).toEqual(['advice', 'r.IR-04.next', 'r.IR-04.type', 'r.IR-05.next']);
  });
});

describe('Activity 5.3 · red flag check', () => {
  it('correct answers pass', () => {
    const codes: Record<string, string> = { 'FIN-PC-03': 'R1, R2, R3', 'ENG-PC-11': 'V1', 'QA-PC-05': 'V2, V3', 'FS-02': 'none', 'HR-LT-07': 'none' };
    const v: Record<string, string> = { renamed: '24', ext: '.lockd, README_RESTORE_FILES.txt', firstR: '08:24:51 svcupd.exe', modified: '9 files', source: 'ENG-PC-11, pdfreader_setup.exe', why: 'Both are approved signed software: SafeCopy backup and Windows Update (TiWorker).' };
    for (const [h, k] of Object.entries(H53)) Object.assign(v, { [`h.${h}.v`]: k.v, [`h.${h}.codes`]: codes[h] });
    expect(bad(m('d5-act5.3').worksheet!.grade!(v, ctxFor(1)))).toEqual([]);
  });
  it('the backup agent is not ransomware', () => {
    const g = m('d5-act5.3').worksheet!.grade!({ 'h.FS-02.v': 'Ransomware red flag', 'h.FIN-PC-03.codes': 'V1', renamed: '12' }, ctxFor(1));
    expect(bad(g).sort()).toEqual(['h.FIN-PC-03.codes', 'h.FS-02.v', 'renamed']);
  });
});

describe('Activity 5.4 · every seat has its own evidence', () => {
  const kinds = new Set<string>(); const details = new Set<string>();
  for (let n = 1; n <= 40; n++) {
    const { facts, hosts } = ctxFor(n), f = facts.day5;
    kinds.add(f.kind); details.add(`${f.kind}|${f.count}|${f.first}|${f.process}`);
    it(`seat ${n} (${f.kind}): its own files support the right answer`, () => {
      const s = newSession(hosts['seat-win']);
      const ev = run(s, String.raw`Import-Csv day5\my_edr_events.csv | Format-Table time, process, action, path, new_path`).stdout;
      expect(ev).toContain(f.first);
      expect(ev).toContain(f.process);
      const docs = run(s, 'Get-ChildItem Documents').stdout;
      if (f.kind === 'ransomware') { expect(docs).toContain(f.note!); expect(docs.split(f.ext!).length - 1).toBe(f.count); }
      else expect(docs).not.toMatch(/README|DECRYPT|RECOVER/);
      const right = { verdict: f.kind === 'ransomware' ? 'Ransomware red flag' : f.kind === 'pe' ? 'PE infection red flag' : 'No red flag', codes: f.kind === 'ransomware' ? 'R1, R2' : f.kind === 'pe' ? 'V1, V2' : 'none',
        count: String(f.count), first: f.first, process: f.process, detail: f.kind === 'ransomware' ? `${f.ext} ${f.note}` : f.kind === 'pe' ? f.detection! : 'SafeCopy backup (scbackup.exe)',
        action: f.kind === 'none' ? 'Record in the shift log; no escalation' : 'Escalate immediately to the Shift Lead (local 4401)' };
      expect(bad(m('d5-act5.4').worksheet!.grade!(right, { facts, hosts }))).toEqual([]);
    });
  }
  it('the three cases all occur and details differ between seats', () => {
    expect([...kinds].sort()).toEqual(['none', 'pe', 'ransomware']);
    expect(details.size).toBe(40);
  });
  it('a neighbour\'s answers do not pass on my seat', () => {
    const a = ctxFor(3), b = ctxFor(6); // both ransomware seats
    const g = m('d5-act5.4').worksheet!.grade!({ count: String(b.facts.day5.count), first: b.facts.day5.first, detail: `${b.facts.day5.ext} ${b.facts.day5.note}` }, a);
    expect(Object.values(g).some((x) => !x.ok)).toBe(true);
  });
});
