// Day 8 (Manual Checking and Verification): hashes vs real tools, answer keys from the data files, the scan simulation per seat.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DAY8, KEY81, KEY82, KEY83 } from '../src/missions/day08';
import { DAY8_FILES } from '../src/hosts/files';
import { parseCsv } from '../src/shell/windows2';
import { sha256 } from '../src/shell/sha256';
import { seatHosts, demoWindows, demoLinux } from '../src/hosts/hosts';
import { newSession, run } from '../src/shell/shell';
import type { HostId } from '../src/missions/types';

const m = (id: string) => DAY8.missions.find((x) => x.id === id)!;
const ctxFor = (n: number) => { const s = seatHosts(n); return { facts: s.facts, hosts: { 'seat-win': s.win, 'seat-linux': s.linux } as Record<HostId, typeof s.win> }; };
const bad = (g: Record<string, { ok: boolean }>) => Object.entries(g).filter(([, v]) => !v.ok).map(([k]) => k);
const rows = (f: string) => parseCsv(DAY8_FILES[f]).slice(1);
const ASSETS = resolve(__dirname, '../../Day_08_Manual_Checking_and_Verification/assets');
const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe';

describe('SHA-256 matches the real tools', () => {
  it('known test vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });
  it('sha256sum in the lab = GNU sha256sum (Git Bash prints * for binary mode; Ubuntu prints two spaces)', () => {
    const real = execFileSync(GIT_BASH, ['-c', 'sha256sum samples/*'], { cwd: ASSETS, encoding: 'utf-8' }).replace(/\r/g, '').replace(/ \*/g, '  ');
    const s = newSession(demoLinux()); run(s, 'cd ~/day8');
    expect(run(s, 'sha256sum samples/*').stdout).toBe(real);
  });
  it('Get-FileHash in the lab = Windows PowerShell Get-FileHash', () => {
    const f = 'samples\\V-02_putty.exe.sample';
    const real = execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-FileHash '${f}' -Algorithm SHA256).Hash`], { cwd: ASSETS, encoding: 'utf-8' }).trim();
    expect(run(newSession(demoWindows()), `Get-FileHash day8\\${f}`).stdout).toContain(real);
  });
});

describe('8.1 key follows rule V1 and the files', () => {
  const intel = DAY8_FILES['threat_intel_hashes.txt'], good = DAY8_FILES['known_good_hashes.txt'];
  for (const [id, , , , sample, consoleHash] of rows('detections_to_verify.csv')) it(id, () => {
    const disk = sha256(DAY8_FILES[sample]);
    const verdict = disk !== consoleHash ? 'Hash mismatch' : intel.includes(disk) ? 'Verified malicious' : good.includes(disk) ? 'False positive' : 'Unknown - escalate';
    expect(KEY81[id]).toEqual([disk === consoleHash ? 'Yes' : 'No', intel.includes(disk) ? 'Yes' : 'No', verdict]);
  });
});

describe('8.2 key follows rule V2', () => {
  const post = Object.fromEntries(rows('post_action_check.csv').map((r) => [r[0], r[2]]));
  for (const [ev, , host, , , action] of rows('remediation_events.csv')) it(host, () => {
    const res = ev !== '1117' ? 'Failed' : action !== 'Block' && post[host] === 'Yes' ? 'Not verified' : 'Action verified';
    expect(KEY82[host]).toEqual([res, res === 'Action verified' ? 'Record in the shift log' : 'Escalate to Tier 2']);
  });
});

describe('8.3 key follows the vendor bulletin', () => {
  for (const [host, sig, eng, plat] of rows('update_status.csv')) it(host, () => {
    const st = sig !== '1.421.130.0' ? 'Signatures out of date' : eng !== '1.1.24090.11' ? 'Engine out of date' : plat !== '4.18.24090.11' ? 'Platform out of date' : 'Up to date';
    expect(KEY83[host]).toEqual([st, st === 'Up to date' ? 'None' : st.startsWith('Signatures') ? 'Update-MpSignature now' : 'Request the update from IT']);
  });
});

describe('8.4 the SOP procedure finds every seat\'s infection; shortcuts can miss it', () => {
  const paths = new Set<string>();
  for (let n = 1; n <= 40; n++) it(`seat ${n}`, () => {
    const { facts, hosts } = ctxFor(n), f = facts.day8;
    paths.add(f.path);
    // a shortcut first (quick scan, old signatures): finds it only when both allow it
    const s = newSession(hosts['seat-win']);
    const q = run(s, 'Start-MpScan -ScanType QuickScan').stdout;
    expect(q.includes('1 threat detected')).toBe(f.quick && !f.needsUpdate);
    // the SOP: update, full scan
    run(s, 'Update-MpSignature');
    expect(run(s, 'Get-MpComputerStatus | Format-List AntivirusSignatureVersion').stdout).toContain(f.sigAfter);
    const full = run(s, 'Start-MpScan -ScanType FullScan').stdout;
    if (!(f.quick && !f.needsUpdate)) expect(full).toContain('1 threat detected');
    const det = run(s, 'Get-MpThreatDetection').stdout;
    expect(det).toContain(f.path);
    const ev = run(s, "Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'; Id=1117,1118} -MaxEvents 1 | Format-List Id").stdout;
    expect(ev).toMatch(new RegExp(`Id\\s+: ${f.fails ? 1118 : 1117}`));
    expect(run(s, `Test-Path "${f.path}"`).stdout.trim()).toBe(f.fails ? 'True' : 'False');
    const right = { name: f.name, path: f.path, type: 'Full scan', result: f.fails ? 'Failed' : 'Quarantined', present: f.fails ? 'Yes' : 'No', next: f.fails ? 'Escalate to Tier 2' : 'Record in the shift log' };
    expect(bad(m('d8-act8.4').worksheet!.grade!(right, { facts, hosts }))).toEqual([]);
    const v83: Record<string, string> = { before: f.sigBefore, after: f.sigAfter, event: '2000' };
    for (const [h, k] of Object.entries(KEY83)) Object.assign(v83, { [`u.${h}.s`]: k[0], [`u.${h}.a`]: k[1] });
    expect(bad(m('d8-act8.3').worksheet!.grade!(v83, { facts, hosts }))).toEqual([]);
  });
  it('seats hide it in different places', () => { expect(paths.size).toBeGreaterThanOrEqual(25); });
  it('Get-WinEvent lists newest first across 9 AM and 10 AM', () => {
    const s = newSession(seatHosts(5).win);
    run(s, 'Update-MpSignature'); run(s, 'Start-MpScan -ScanType FullScan'); run(s, 'Start-MpScan -ScanType FullScan');
    const times = run(s, "Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'} | Format-List TimeCreated").stdout.match(/\d+:\d\d:\d\d [AP]M/g)!;
    const mins = times.map((t) => { const [h, mi] = t.split(':').map(Number); return (h % 12 + (t.endsWith('PM') ? 12 : 0)) * 60 + mi; });
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
  });
});

describe('8.1 / 8.2 graders', () => {
  it('correct answers pass, mistakes are flagged', () => {
    const v1: Record<string, string> = { changed: 'V-03 payslip_viewer: the file changed after the detection', fp: 'V-02 putty: hash is in the vendor known-good list' };
    for (const [id, k] of Object.entries(KEY81)) Object.assign(v1, { [`v.${id}.m`]: k[0], [`v.${id}.i`]: k[1], [`v.${id}.v`]: k[2] });
    expect(bad(m('d8-act8.1').worksheet!.grade!(v1, ctxFor(1)))).toEqual([]);
    expect(bad(m('d8-act8.1').worksheet!.grade!({ 'v.V-03.v': 'Verified malicious', 'v.V-05.v': 'Verified malicious' }, ctxFor(1))).sort()).toEqual(['v.V-03.v', 'v.V-05.v']);
    const v2: Record<string, string> = { it: 'The file is still present after the action' };
    for (const [h, k] of Object.entries(KEY82)) Object.assign(v2, { [`a.${h}.v`]: k[0], [`a.${h}.n`]: k[1] });
    expect(bad(m('d8-act8.2').worksheet!.grade!(v2, ctxFor(1)))).toEqual([]);
    expect(bad(m('d8-act8.2').worksheet!.grade!({ 'a.IT-PC-01.v': 'Action verified' }, ctxFor(1)))).toEqual(['a.IT-PC-01.v']);
  });
});
