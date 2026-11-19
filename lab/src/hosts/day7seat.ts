// Day 7: security solution status on a Windows host (Activity 7.4 per seat, and the demo workstation for Video 3).
// Adds the CrowdStrike Falcon sensor service (or leaves it out), the Wazuh agent log and the Defender action policy.
// Defender itself stays as Day 4 left it (real-time on, same signatures), so the Day 4 answers never change.
import type { Host } from '../shell/types';

export interface Day7Facts {
  edr: 'Running' | 'Stopped' | 'Not installed';   // CrowdStrike Falcon sensor (CSFalconService)
  wazuhConnected: boolean;                         // last lines of the Wazuh agent log
  lastKeepalive: string;                           // HH:MM of the last successful keep-alive
  high: number; severe: number;                    // Get-MpPreference High/SevereThreatDefaultAction
  exclusion: string | null;                        // Get-MpPreference ExclusionPath
  canClean: boolean;                               // can Defender clean/delete a High threat in Downloads?
  report: boolean;                                 // anything to report to the Shift Lead?
}
export interface Day7State { edr: Day7Facts['edr']; wazuhConnected: boolean; keepalive: number; high: number; severe: number; exclusion: string | null }

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const two = (n: number) => String(n).padStart(2, '0');
const hm = (m: number) => `${two(Math.floor(m / 60))}:${two(m % 60)}`;
export const WAZUH_LOG = 'C:\\Program Files (x86)\\ossec-agent\\ossec.log';
const GOOD = [1, 2, 3, 10];

/** Apply a Day 7 state to a Windows host and return its facts. */
export function applyDay7(h: Host, s: Day7State): Day7Facts {
  if (h.defender) h.defender.prefs = { low: 2, moderate: 2, high: s.high, severe: s.severe, exclusions: s.exclusion ? [s.exclusion] : [] };
  h.services = (h.services ?? []).filter((x) => x.name !== 'CSFalconService');
  if (s.edr !== 'Not installed') h.services = [...h.services, { name: 'CSFalconService', display: 'CrowdStrike Falcon Sensor Service', status: s.edr }].sort((a, b) => a.name.localeCompare(b.name));
  const d = '2026/11/05', k = s.keepalive;
  const lines = [
    `${d} 07:41:02 wazuh-agent: INFO: Started (pid: 2290).`,
    `${d} 07:41:03 wazuh-agent: INFO: Connected to the server ([10.10.1.50]:1514/tcp).`,
    `${d} ${hm(k - 1)}:58 wazuh-agent: INFO: Sending keep alive to manager.`,
    `${d} ${hm(k)}:00 wazuh-agent: INFO: Keep alive acknowledged by manager.`,
    ...(s.wazuhConnected
      ? [`${d} 09:29:58 wazuh-agent: INFO: Sending keep alive to manager.`, `${d} 09:30:00 wazuh-agent: INFO: Keep alive acknowledged by manager.`]
      : [`${d} ${hm(k + 1)}:12 wazuh-agent: WARNING: Lost connection with manager. Trying to reconnect.`, `${d} 09:29:12 wazuh-agent: ERROR: Unable to connect to [10.10.1.50]:1514/tcp: Connection timed out.`]),
  ];
  h.files = { ...h.files, [WAZUH_LOG]: lines.join('\n') + '\n' };
  const canClean = GOOD.includes(s.high) && !(s.exclusion && /downloads/i.test(s.exclusion));
  return { edr: s.edr, wazuhConnected: s.wazuhConnected, lastKeepalive: hm(s.wazuhConnected ? 9 * 60 + 30 : k), high: s.high, severe: s.severe, exclusion: s.exclusion, canClean, report: s.edr !== 'Running' || !s.wazuhConnected || !canClean };
}

/** Seat state: own random stream; every seat has at least one problem to find and report. */
export function day7Seat(h: Host, seat: number): Day7Facts {
  const r = rng(seat * 4513 + 97);
  const x = r();
  const st: Day7State = {
    edr: x < 0.6 ? 'Running' : x < 0.8 ? 'Stopped' : 'Not installed',
    wazuhConnected: r() < 0.65,
    keepalive: 7 * 60 + 50 + Math.floor(r() * 70),
    high: (() => { const y = r(); return y < 0.65 ? 2 : y < 0.82 ? 6 : 9; })(),
    severe: 3,
    exclusion: (() => { const y = r(); return y < 0.6 ? null : y < 0.82 ? `C:\\Users\\${h.user}\\Downloads` : 'C:\\Program Files\\LabApp\\cache'; })(),
  };
  const f = applyDay7(h, st);
  if (!f.report) return applyDay7(h, { ...st, wazuhConnected: false });
  return f;
}
