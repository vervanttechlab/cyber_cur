// Day 9, Activity 9.4: each seat's own scan log after the Day 8 scan (C:\Users\<you>\day9\my_scan_log.csv).
// Built from the seat's Day 8 facts, so it tells the same story even after the lab restarts (hosts are rebuilt on every start).
// Every seat has at least one failed action. Own random stream: earlier days never change.
import type { Host } from '../shell/types';
import type { Day8Facts } from './day8seat';

export interface Day9Failure { event: number; detail: string; authority: string; rule: string }
export interface Day9Facts { failures: Day9Failure[]; vendorCase: boolean }

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const IT = 'IT Department Manager', VENDOR = 'Security solution vendor';

export function day9Seat(h: Host, seat: number, d8: Day8Facts): Day9Facts {
  const r = rng(seat * 3571 + 13);
  const rows: [string, number, string][] = [['2026-11-05 10:12', 2000, `Security intelligence updated to ${d8.sigAfter}`], ['2026-11-05 10:14', 1000, 'Full scan started']];
  const failures: Day9Failure[] = [];
  rows.push(['2026-11-05 10:16', 1116, `Detected ${d8.name} in ${d8.path}`]);
  if (d8.fails) {
    const d = `Quarantine failed for ${d8.name}: file in use by another process`;
    rows.push(['2026-11-05 10:17', 1118, d]); failures.push({ event: 1118, detail: d, authority: IT, rule: 'E4' });
  } else rows.push(['2026-11-05 10:17', 1117, `Action taken: Quarantine of ${d8.name}`]);
  rows.push(['2026-11-05 10:31', 1001, 'Full scan finished']);
  const stopped = r() < 0.35, update = r() < 0.4;
  if (stopped || (!failures.length && !update)) {
    const d = 'Quick scan stopped before it finished: the user restarted the PC';
    rows.push(['2026-11-05 11:05', 1002, d]); failures.push({ event: 1002, detail: d, authority: IT, rule: 'E4' });
  }
  if (update) {
    const d = 'Security intelligence update failed: error 0x80072ee2 (connection timed out)';
    rows.push(['2026-11-05 11:40', 2001, d]); failures.push({ event: 2001, detail: d, authority: VENDOR, rule: 'E3' });
  }
  rows.push(['2026-11-05 11:50', 1000, 'Quick scan started'], ['2026-11-05 11:54', 1001, 'Quick scan finished']);
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  h.files = { ...h.files, [`C:\\Users\\${h.user}\\day9\\my_scan_log.csv`]: ['time,host,event_id,detail', ...rows.map(([t, e, d]) => `${t},${h.hostname},${e},${d}`)].join('\n') + '\n' };
  return { failures, vendorCase: failures.some((f) => f.event === 2001) };
}
