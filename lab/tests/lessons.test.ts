// Lessons (built from the Student Handouts by tools/lessons.mjs) and the "Watch first" videos of each activity.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DAY2 } from '../src/missions/day02';
import { DAY3 } from '../src/missions/day03';
import { DAY4 } from '../src/missions/day04';
import { DAY5 } from '../src/missions/day05';
import { DAY6 } from '../src/missions/day06';
import { DAY7 } from '../src/missions/day07';
import { DAY8 } from '../src/missions/day08';
import { DAY9 } from '../src/missions/day09';
import '../src/missions/practice34';
import { watchFor, dayVideos, videoTitle } from '../src/missions/watch';
import type { Lesson } from '../src/views/pages';

const ROOT = resolve(__dirname, '../..');
const PACKS = [DAY2, DAY3, DAY4, DAY5, DAY6, DAY7, DAY8, DAY9];
const demoDir = (day: number) => { const d = readdirSync(ROOT).find((x) => x.startsWith(`Day_${String(day).padStart(2, '0')}_`))!; return join(ROOT, d, 'demo'); };
const lesson = (day: number): Lesson => JSON.parse(readFileSync(resolve(__dirname, `../src/lessons/day${String(day).padStart(2, '0')}.json`), 'utf-8'));

describe('lessons from the Student Handouts', () => {
  for (const p of PACKS) it(`Day ${p.day}`, () => {
    const L = lesson(p.day);
    expect(L.day).toBe(p.day);
    expect(L.unit).toMatch(/^CS-ICT251101 /);
    expect(L.parts[0].h).toBe('Learning Objectives');
    expect(L.parts.map((x) => x.h)).toContain('Key Terms');
    for (const part of L.parts) expect(part.html.length, part.h).toBeGreaterThan(100);
    // every demo video of the day sits on exactly one lesson part, and the file exists
    const vids = L.parts.flatMap((x) => x.videos);
    expect(new Set(vids).size).toBe(vids.length);
    for (const v of vids) expect(existsSync(join(demoDir(p.day), v)), v).toBe(true);
    for (const v of dayVideos(p)) expect(vids, `${v} is in the lesson`).toContain(v);
    // the student PDFs only (never trainer files)
    expect(L.files.map((f) => f.name)).toEqual([`Day ${p.day} Student Handout`, `Day ${p.day} Student Activities`]);
    for (const f of L.files) expect(f.href).toMatch(/^days\/Day\d\d_Student_(Handout|Activities)\.pdf$/);
  });
});

describe('Watch first: the demo video(s) before each activity', () => {
  it('every activity of Days 3–9 has a video first; the files exist', () => {
    for (const p of PACKS) for (const m of p.missions.filter((x) => x.kind === 'activity')) {
      const w = watchFor(m, p);
      if (m.id === 'd2-act2.2') { expect(w).toEqual([]); continue; } // the network topology activity has no demo
      expect(w.length, m.id).toBeGreaterThan(0);
      for (const v of w) expect(existsSync(join(demoDir(p.day), v)), `${m.id}: ${v}`).toBe(true);
    }
  });
  it('Days 5–9: N.1–N.3 follow Demo 1–3, N.4 uses all three', () => {
    for (const p of [DAY5, DAY6, DAY7, DAY8, DAY9]) {
      const acts = p.missions.filter((x) => x.kind === 'activity'), vids = dayVideos(p);
      expect(acts.map((a) => watchFor(a, p))).toEqual([[vids[0]], [vids[1]], [vids[2]], vids]);
    }
  });
  it('Day 4: 4.1 its own supplemental video, then Demo 1, 2, 3', () => {
    expect(DAY4.missions.filter((x) => x.kind === 'activity').map((a) => watchFor(a, DAY4).map(videoTitle))).toEqual([
      ['Demo 4 · Which Tool Would Catch It'], ['Demo 1 · Alert Sources'], ['Demo 2 · Log Hunt Password Spray'], ['Demo 3 · Security Console PowerShell']]);
  });
  it('practice missions have no Watch first (they have their own video button)', () => {
    for (const p of PACKS) for (const m of p.missions.filter((x) => x.kind === 'practice')) expect(watchFor(m, p)).toEqual([]);
  });
});
