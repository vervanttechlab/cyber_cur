// The demo video(s) a trainee is shown before starting an activity ("Watch first", skippable).
// Days 5–9: Activity N.1–N.3 follow Demo 1–3, and N.4 (your own workstation) uses all three.
// Days 2–4 do not line up one to one, so they are listed by hand. An activity not listed here has no video first.
import type { Mission, ScenarioPack } from './types';

const BY_HAND: Record<string, number[]> = {
  // index into the day's practice videos (0 = Demo 1); 'own' videos on the activity itself are added first
  'd2-act2.1': [0], 'd2-act2.2': [], 'd2-act2.3': [1], 'd2-act2.4': [2],          // 2.2 (network topology) has no demo
  'd3-act3.1': [0], 'd3-act3.2': [1], 'd3-act3.3': [2], 'd3-act3.4': [2],
  'd4-act4.1': [], 'd4-act4.2': [0], 'd4-act4.3': [1], 'd4-act4.4': [2],   // 4.1 has its own supplemental video
};

/** The day's demo videos, in practice-mission order (Demo 1, 2, 3). */
export function dayVideos(pack: ScenarioPack): string[] {
  return pack.missions.filter((m) => m.kind === 'practice' && m.video).map((m) => m.video!);
}

/** Video files to show before this activity (empty = none). */
export function watchFor(m: Mission, pack: ScenarioPack): string[] {
  if (m.kind !== 'activity') return [];
  const vids = dayVideos(pack);
  const own = m.video ? [m.video] : [];
  if (m.id in BY_HAND) return [...own, ...BY_HAND[m.id].map((i) => vids[i]).filter(Boolean)];
  const k = pack.missions.filter((x) => x.kind === 'activity').indexOf(m);
  return [...own, ...(k >= 0 && k < vids.length && k < 3 ? [vids[k]] : vids)];
}

/** "Day05_Demo1_Receive_Alerts_per_SOP.mp4" -> "Demo 1 · Receive Alerts per SOP" */
export function videoTitle(file: string): string {
  const m = file.replace(/\.mp4$/, '').match(/^Day\d+_Demo(\d+)_(.*)$/);
  return m ? `Demo ${m[1]} · ${m[2].replace(/_/g, ' ')}` : file.replace(/\.mp4$/, '').replace(/_/g, ' ');
}
