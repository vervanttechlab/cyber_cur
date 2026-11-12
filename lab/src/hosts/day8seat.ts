// Day 8: an infection hidden on each seat's workstation for Activity 8.4 (and on the demo workstation for Video 3).
// The workstation's signatures are 1.421.112.0 (Day 4 value); the vendor bulletin says 1.421.130.0 is the latest.
// Following SOC-SOP-04 (update first, then a FULL scan) always finds it. Own random stream: earlier days never change.
import type { Host, PlantedThreat } from '../shell/types';

export const LATEST_SIGNATURE = '1.421.130.0';
export interface Day8Facts { name: string; path: string; quick: boolean; needsUpdate: boolean; fails: boolean; sigBefore: string; sigAfter: string }

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

const THREATS: [string, number, number][] = [
  ['Trojan:Win32/AgentTesla!ml', 2147749373, 5], ['Backdoor:Win32/Bladabindi!ml', 2147711442, 5], ['Trojan:Win32/Fareit.AD!MTB', 2147729905, 5],
  ['TrojanDownloader:Win32/Upatre!pz', 2147688812, 4], ['PWS:Win32/Zbot!ml', 2147730041, 5],
];
const NAMES = ['winupdate_helper.exe', 'adobe_sync.exe', 'chrome_patch.exe', 'msedge_update.exe', 'printer_tool.exe', 'onedrive_fix.exe'];

/** Plant a threat on a Windows host. quick: inside a quick-scan location (Startup folder or Temp). */
export function plant(h: Host, p: Omit<PlantedThreat, 'found'>): void {
  h.files = { ...h.files, [p.path]: 'CTM VIRTUAL LAB - SIMULATED INFECTED FILE (text placeholder, not malware)\n' };
  h.scan = { latestSignature: LATEST_SIGNATURE, planted: { ...p }, scans: 0 };
}

export function day8Seat(h: Host, seat: number): Day8Facts {
  const r = rng(seat * 6151 + 29);
  const [name, threatId, severityId] = pick(r, THREATS);
  const file = pick(r, NAMES), u = `C:\\Users\\${h.user}`;
  const quick = r() < 0.4;
  const dir = quick ? pick(r, [`${u}\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup`, `${u}\\AppData\\Local\\Temp`])
    : pick(r, [`${u}\\Music\\Playlists`, `C:\\ProgramData\\SyncHelper`, `${u}\\AppData\\Roaming\\Updater`, `${u}\\Pictures\\Camera Roll`]);
  const needsUpdate = r() < 0.6, fails = r() < 0.3;
  const path = `${dir}\\${file}`;
  plant(h, { path, name, threatId, severityId, quick, needsUpdate, fails });
  return { name, path, quick, needsUpdate, fails, sigBefore: h.defender?.signatureVersion ?? '', sigAfter: LATEST_SIGNATURE };
}
