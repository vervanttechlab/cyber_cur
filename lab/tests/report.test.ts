// Class report (trainer accounts): status per day, summary counts, CSV.
import { describe, it, expect } from 'vitest';
import { DAY2 } from '../src/missions/day02';
import { DAY3 } from '../src/missions/day03';
import { DAY4 } from '../src/missions/day04';
import { DAY5 } from '../src/missions/day05';
import { DAY6 } from '../src/missions/day06';
import { DAY7 } from '../src/missions/day07';
import { DAY8 } from '../src/missions/day08';
import { DAY9 } from '../src/missions/day09';
import '../src/missions/practice34';
import { dayProgress, daySummary, defaultDay, reportCsv, reportHtml, type ReportTrainee, type ReportData } from '../src/ui/report';

const PACKS = [DAY2, DAY3, DAY4, DAY5, DAY6, DAY7, DAY8, DAY9];
const t = (over: Partial<ReportTrainee>): ReportTrainee => ({ email: 'x@example.com', name: 'X', seat: 1, signedIn: true, firstSignIn: 1, lastSync: 1, updated: 1,
  done: {}, checked: {}, videos: {}, started: {}, filled: {}, ...over });
const acts9 = DAY9.missions.filter((m) => m.kind === 'activity');
const allDone9 = Object.fromEntries(acts9.map((m) => [m.id, m.steps.map((s) => s.id)]));
const allChecked9 = Object.fromEntries(acts9.map((m) => [m.worksheet!.id, true]));

const people: ReportTrainee[] = [
  t({ email: 'never@example.com', name: 'Never', seat: 5, signedIn: false, firstSignIn: 0 }),
  t({ email: 'idle@example.com', name: 'Idle', seat: 4 }),
  t({ email: 'video@example.com', name: 'Video', seat: 3, videos: { 'Day09_Demo1_Verify_with_Stakeholder.mp4': 10 } }),
  t({ email: 'practice@example.com', name: 'Practice', seat: 2, done: { 'd9-demo2': ['rule'] } }),
  t({ email: 'sheet@example.com', name: 'Sheet', seat: 6, filled: { 'ws-9.1': 2 } }),
  t({ email: 'done@example.com', name: 'Done', seat: 1, done: allDone9, checked: allChecked9, started: { 'd9-demo1': 5 } }),
];
const data: ReportData = { trainees: people, openDays: [9], generated: Date.UTC(2026, 10, 7, 1) };

describe('Class report', () => {
  it('status per trainee for a day', () => {
    expect(people.map((p) => dayProgress(p, DAY9).status)).toEqual(['Not signed in', 'Signed in, not started', 'Following the demos', 'Following the demos', 'Doing activities', 'Day finished']);
  });
  it('counts videos, practice and activities', () => {
    const v = dayProgress(people[2], DAY9);
    expect([v.videos.n, v.videos.total, v.videos.names]).toEqual([1, 3, ['Demo 1 · Verify Results with the Stakeholder']]);
    const d = dayProgress(people[5], DAY9);
    expect([d.actsStarted.n, d.actsDone.n, d.actsDone.total, d.practiceStarted.n]).toEqual([4, 4, 4, 1]);
    // steps done but "Check my answers" not used = started, not done
    const notChecked = dayProgress(t({ done: allDone9 }), DAY9);
    expect([notChecked.actsStarted.n, notChecked.actsDone.n, notChecked.status]).toEqual([4, 0, 'Doing activities']);
    // Day 3 practice missions (added by practice34) count for Day 3
    expect(dayProgress(t({ videos: { 'Day03_Demo1_Malware_Behavior.mp4': 1 } }), DAY3).videos).toMatchObject({ n: 1, total: 3 });
  });
  it('summary chips', () => {
    expect(daySummary(data, DAY9)).toMatchObject({ total: 6, signedIn: 5, demos: 3, activities: 2, finished: 1 });
  });
  it('opens on the day the trainer opened, else the newest day with work', () => {
    expect(defaultDay(data, PACKS)).toBe(9);
    expect(defaultDay({ ...data, openDays: [] }, PACKS)).toBe(9);
    expect(defaultDay({ trainees: [t({ videos: { 'Day05_Demo1_Receive_Alerts_per_SOP.mp4': 1 } })], openDays: [], generated: 0 }, PACKS)).toBe(5);
    expect(defaultDay({ trainees: [], openDays: [], generated: 0 }, PACKS)).toBe(2);
  });
  it('HTML lists every trainee and escapes names', () => {
    const h = reportHtml({ ...data, trainees: [...people, t({ name: '<b>x</b>', email: 'e@example.com' })] }, PACKS, 9);
    for (const p of people) expect(h).toContain(p.email);
    expect(h).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(h).toContain('Day 9 · Case Follow-up and Escalation (open today)');
  });
  it('CSV: one row per trainee, every day', () => {
    const lines = reportCsv(data, PACKS).trim().split('\r\n');
    expect(lines).toHaveLength(7);
    expect(lines[0]).toMatch(/^Seat,Full Name,Email,Team,Signed In,First Sign-in \(date & time\),Last Active \(date & time\),Day 2 Videos Watched,/);
    expect(lines[0].split(',')).toHaveLength(7 + 8 * 6);
    const done = lines.find((l) => l.includes('done@example.com'))!;
    expect(done).toContain('4/4,Day finished');
    expect(lines.find((l) => l.includes('never@example.com'))).toMatch(/,,No,,/);
  });
});
