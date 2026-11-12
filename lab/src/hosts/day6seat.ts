// Day 6, Activity 6.4: each seat triages its own five workstation alerts (C:\Users\<you>\day6\my_alerts.csv).
// Every seat gets one routine, one false positive, one blocked and one confirmed alert plus one random extra,
// in a seat-specific order with seat-specific times and details. Own random stream: Days 2–5 seat values never change.
import type { Host } from '../shell/types';

export type Disp = 'Confirmed' | 'Blocked' | 'False positive' | 'Routine';
export interface Day6Alert { id: string; time: string; source: string; rule: string; details: string; disp: Disp; threat: string; priority: string; ticket: 'Yes' | 'No' }
export interface Day6Facts { alerts: Day6Alert[]; tickets: number } // tickets: how many incident tickets to open (0 or 1)

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
const two = (n: number) => String(n).padStart(2, '0');

type Tpl = (r: () => number, u: string, host: string) => Omit<Day6Alert, 'id' | 'time' | 'priority' | 'ticket'>;
// Workstations are Tier 2 (asset_inventory.csv: WKS-LAB-*). Priority comes from the SOC-SOP-02 matrix for Tier 2.
const TIER2: Record<string, string> = { Critical: 'P1', High: 'P2', Medium: 'P3', Low: 'P4' };

const ROUTINE: Tpl[] = [
  () => ({ source: 'SIEM', rule: 'Defender signatures updated', details: 'Security intelligence updated to 1.421.130.0 (scheduled update)', disp: 'Routine', threat: '-' }),
  (_r, _u, host) => ({ source: 'IDS', rule: 'ET SCAN Nmap scan detected', details: `Port scan of ${host} from 10.10.1.60 (SCAN-01) on Thursday morning`, disp: 'Routine', threat: '-' }),
  () => ({ source: 'SIEM', rule: 'Wazuh agent keep-alive restored', details: 'Agent reconnected after the 08:00 network maintenance; health OK', disp: 'Routine', threat: '-' }),
];
const FALSEPOS: Tpl[] = [
  (_r, u) => ({ source: 'SIEM', rule: 'Impossible travel: Manila then Davao in 8 minutes', details: `Logon by ${u} from the office (10.10.20.x) then from 203.0.113.20 (geolocated to Davao); 203.0.113.20 is VPN-GW-01`, disp: 'False positive', threat: '-' }),
  (_r, u) => ({ source: 'SIEM', rule: 'Possible brute force: 6 failed logons', details: `6 failed logons for ${u} typed at the console of this PC (logon type 2) then success; user confirmed Caps Lock by phone`, disp: 'False positive', threat: '-' }),
  () => ({ source: 'EDR', rule: 'Suspicious file name: invoice.pdf.exe', details: 'The file is invoice.pdf.exe.txt: a plain text file of 2 KB in the lab notes folder; it never ran', disp: 'False positive', threat: '-' }),
];
const BLOCKED: Tpl[] = [
  () => ({ source: 'AV', rule: 'PUA:Win32/Presenoker blocked', details: 'FreeConverterSetup.exe blocked before it ran', disp: 'Blocked', threat: 'Low' }),
  (r) => ({ source: 'AV', rule: `Trojan:Win32/${pick(r, ['Wacatac.B!ml', 'Agent.QX', 'Phonzy.A!ml'])} quarantined`, details: 'File quarantined on download; it never ran', disp: 'Blocked', threat: 'Medium' }),
  () => ({ source: 'Firewall', rule: 'Outbound connection to threat-feed IP blocked', details: 'This PC tried to reach 203.0.113.140:443 once; denied by EDGE-FW-01', disp: 'Blocked', threat: 'Medium' }),
];
const CONFIRMED: Tpl[] = [
  (r, u) => ({ source: 'AV', rule: `Trojan:Win32/${pick(r, ['Wacatac.B!ml', 'Agent.QX'])} detected`, details: `${u} restored the file from quarantine and ran it; it now connects to 203.0.113.140 every 60 seconds`, disp: 'Confirmed', threat: 'High' }),
  (r) => ({ source: 'SIEM', rule: 'New local administrator account', details: `Account ${pick(r, ['support1', 'helpdesk9', 'admin_tmp'])} created and added to Administrators at night; no approved change`, disp: 'Confirmed', threat: 'High' }),
  (r) => ({ source: 'EDR', rule: 'Mass file rename by unsigned process', details: `${6 + Math.floor(r() * 9)} files renamed to ${pick(r, ['.kz7', '.vaultx', '.lck9'])} and a ransom note created (red flags R1 R2)`, disp: 'Confirmed', threat: 'Critical' }),
];

export function day6Seat(h: Host, seat: number): Day6Facts {
  const r = rng(seat * 7727 + 61);
  const groups = [ROUTINE, FALSEPOS, BLOCKED, CONFIRMED];
  const chosen: Tpl[] = groups.map((g) => pick(r, g));
  let extra = pick(r, pick(r, groups));
  while (chosen.includes(extra)) extra = pick(r, pick(r, groups)); // never the same alert twice
  chosen.push(extra);
  chosen.sort(() => r() - 0.5);
  let t = 8 * 60 + 5 + Math.floor(r() * 20);
  const raw = chosen.map((tpl) => {
    const a = tpl(r, h.user, h.hostname);
    t += 9 + Math.floor(r() * 25);
    // the SCAN-01 scan is routine only inside RT2's window (Thursday 08:00-10:00), so keep it there
    const m = /Nmap/.test(a.rule) ? 8 * 60 + 15 + Math.floor(r() * 40) : t;
    return { ...a, min: m, sec: Math.floor(r() * 60) };
  }).sort((x, y) => x.min - y.min || x.sec - y.sec); // file order = time order; alerts are numbered in that order
  const alerts: Day6Alert[] = raw.map(({ min, sec, ...a }, i) => {
    const ticket = a.disp === 'Confirmed' ? 'Yes' : 'No';
    const priority = a.disp === 'Confirmed' || a.disp === 'Blocked' ? TIER2[a.threat] : '-';
    return { id: `W-${two(seat)}-${i + 1}`, time: `2026-11-05 ${two(Math.floor(min / 60))}:${two(min % 60)}:${two(sec)}`, ...a, priority, ticket };
  });
  const head = 'alert_id,time,source,rule_name,host,details';
  h.files = { ...h.files, [`C:\\Users\\${h.user}\\day6\\my_alerts.csv`]: [head, ...alerts.map((a) => [a.id, a.time, a.source, a.rule, h.hostname, a.details].join(','))].join('\n') + '\n' };
  // SOC-SOP-02 T2: one ticket per incident. All five alerts are on the same workstation, so every confirmed
  // alert is linked to ONE ticket.
  return { alerts, tickets: alerts.some((a) => a.ticket === 'Yes') ? 1 : 0 };
}
