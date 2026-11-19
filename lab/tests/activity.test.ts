// Trainer monitoring: the dated activity log (timeline), the two CSV exports, the trainee page and the board's live cells.
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
import { parseLabTime, timeline, activityLogCsv, accomplishmentsCsv, dateOf, timeOf, stampOf, FILTERS, type ClassLog, type LogTrainee } from '../src/ui/activity';
import { monitorHtml, pickMission, type TraineeDetail } from '../src/views/monitor';
import { boardHtml, ago, lastActive, type BoardData } from '../src/views/board';
import type { ReportTrainee } from '../src/ui/report';

const PACKS = [DAY2, DAY3, DAY4, DAY5, DAY6, DAY7, DAY8, DAY9];
const at = (d: number, h: number, m: number, s = 0) => new Date(2026, 10, d, h, m, s).getTime();
const A51 = DAY5.missions.find((m) => m.id === 'd5-act5.1')!;

const ana: LogTrainee = {
  email: 'ana@example.com', name: 'Ana Reyes', seat: 3, team: 'Blue', signedIn: true, firstSignIn: at(12, 8, 0), lastSync: at(12, 9, 40),
  events: [
    { at: at(12, 8, 0), event: 'Signed in', detail: 'Seat 3', by: '' },
    { at: at(12, 9, 45), event: 'Submitted', detail: 'd5-act5.1 attempt 1: 24 / 30', by: '' },
    { at: at(12, 10, 5), event: 'Graded', detail: 'd5-act5.1 attempt 1: NYC', by: 'coach@example.com' },
  ],
  state: {
    videos: { 'Day05_Demo1_Receive_Alerts_per_SOP.mp4': at(12, 8, 5) },
    lessonAt: { '5|0': at(12, 8, 2) },
    watched: { 'd5-act5.1': 'skipped' }, watchedAt: { 'd5-act5.1': at(12, 9, 0) },
    started: { 'd5-act5.1': at(12, 9, 0) },
    done: { 'd5-act5.1': ['sop', 'old'] },
    stepAt: { 'd5-act5.1|sop': at(12, 9, 2), 'd5-act5.1|old': 0 },   // 0 = done before the lab kept times: not in the log
    checks: [{ mission: 'd5-act5.1', at: at(12, 9, 30), ok: 20, total: 30 }],
    finished: {},
    log: [
      { at: at(12, 9, 2, 7), time: 'Nov 12, 9:02:07 AM', host: 'ubuntu-lab-03', line: 'grep -A7 "^A2" ~/day5/soc_alert_sop.txt', mission: A51.title, day: 5 },
      { time: 'Nov 12, 9:10:00\u202fAM', host: 'WKS-LAB-03', line: '=cmd|calc', mission: A51.title, day: 5 },   // an older entry without at
    ],
    evidence: [{ time: 'Nov 12, 9:20:00 AM', host: 'WKS-LAB-03', cmd: 'Import-Csv queue.csv', note: 'two over the limit', mission: A51.title, day: 5 }],
  },
};

describe('activity log', () => {
  it('reads the time the lab shows next to a command (no year; also with a narrow no-break space)', () => {
    const ref = at(12, 12, 0);
    expect(parseLabTime('Nov 12, 3:04:05 PM', ref)).toBe(at(12, 15, 4, 5));
    expect(parseLabTime('Nov 12, 12:00:01\u202fAM', ref)).toBe(at(12, 0, 0, 1));
    expect(new Date(parseLabTime('Dec 30, 9:00:00 AM', ref)).getFullYear()).toBe(2025); // in the future -> last year
    expect(parseLabTime('yesterday', ref)).toBe(0);
  });

  it('builds a dated timeline from the lab state and the server events, oldest first', () => {
    const ev = timeline(ana, PACKS);
    expect(ev.map((e) => e.kind)).toEqual(['signin', 'lesson', 'video', 'video', 'start', 'step', 'command', 'command', 'evidence', 'check', 'submit', 'grade']);
    expect(ev.find((e) => e.kind === 'step')!.text).toBe(A51.steps[0].text);
    expect(ev.filter((e) => e.kind === 'step')).toHaveLength(1); // the step without a time is left out
    expect(ev.find((e) => e.kind === 'command' && e.text === '=cmd|calc')!.at).toBe(at(12, 9, 10));
    expect(ev.find((e) => e.kind === 'grade')!.text).toBe('Trainer graded Activity 5.1: Not Yet Competent');
    expect(ev.find((e) => e.kind === 'submit')).toMatchObject({ day: 5, mission: A51.title, text: 'Submitted Activity 5.1: attempt 1: 24 / 30' });
  });

  it('the Activity log CSV has a Date and a Time column on every row, and is safe to open in Excel', () => {
    const data: ClassLog = { day: 0, generated: at(12, 11, 0), subs: [], trainees: [ana, { ...ana, email: 'ben@example.com', name: 'Ben', seat: 1, events: [], state: null }] };
    const lines = activityLogCsv(data, PACKS).replace(/^\ufeff/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Date,Time,Seat,Full Name,Email,Team,Day,Activity / Mission,Event,Details,Host');
    expect(lines).toHaveLength(1 + 12);
    expect(lines[1]).toBe('2026-11-12,8:00:00 AM,3,Ana Reyes,ana@example.com,Blue,,,Signed in,Signed in (Seat 3),');
    expect(lines.find((l) => l.includes('calc'))).toContain(`"'=cmd|calc"`); // a formula is never run
    for (const l of lines.slice(1)) expect(l).toMatch(/^2026-11-12,\d{1,2}:\d\d:\d\d [AP]M,/);
    // accomplished only, one day
    const done = activityLogCsv({ ...data, day: 5 }, PACKS, FILTERS.find((f) => f.id === 'done')!.kinds).trim().split('\r\n');
    expect(done.slice(1).map((l) => l.split(',')[8])).toEqual(['Step done', 'Checked answers', 'Submitted', 'Graded']);
    expect(activityLogCsv({ ...data, day: 6 }, PACKS, ['step']).trim().split('\r\n')).toHaveLength(1);
  });

  it('the Accomplishments CSV: one row per trainee and mission worked on, with dates and times', () => {
    const data: ClassLog = { day: 5, generated: at(12, 11, 0), trainees: [ana],
      subs: [{ email: 'ana@example.com', act: 'd5-act5.1', day: 5, title: A51.title, attempt: 1, attempts: 1, ts: at(12, 9, 45), score: 24, max: 30, verdict: 'NYC', feedback: '', gradedAt: at(12, 10, 5), late: false }] };
    const lines = accomplishmentsCsv(data, PACKS).replace(/^\ufeff/, '').trim().split('\r\n');
    expect(lines).toHaveLength(2);
    const head = lines[0].split(','), row = lines[1].split(',');
    const col = (h: string) => row[head.indexOf(h)];
    expect(col('Activity / Mission')).toBe(A51.title);
    expect(col('Started (date & time)')).toBe('2026-11-12 9:00 AM');
    expect(col('Steps Done')).toBe('1'); // 'old' is not a step of 5.1
    expect(col('Last Check Score')).toBe('20/30');
    expect(col('Commands Run')).toBe('2');
    expect(col('Submitted (date & time)')).toBe('2026-11-12 9:45 AM');
    expect(col('Graded (date & time)')).toBe('2026-11-12 10:05 AM');
    expect(col('Status')).toBe('Not Yet Competent');
  });

  it('formats dates and times for the exports', () => {
    expect([dateOf(at(2, 7, 5, 9)), timeOf(at(2, 7, 5, 9)), timeOf(at(2, 0, 0)), timeOf(at(2, 12, 30)), stampOf(at(2, 13, 7, 59))]).toEqual(['2026-11-02', '7:05:09 AM', '12:00:00 AM', '12:30:00 PM', '2026-11-02 1:07 PM']);
    expect(stampOf(0)).toBe('');
  });
});

describe('trainee page and live board cells', () => {
  const x: TraineeDetail = { ...ana, updated: at(12, 9, 40), generated: at(12, 9, 41), presence: { mission: A51.title, ago: 20 }, subs: [], redo: [],
    state: { ...ana.state!, missionId: 'd5-act5.1', ws: { [A51.worksheet!.id]: { anything: '<script>' } } } };

  it('opens on what the trainee has open, shows them online, and lists the log newest first', () => {
    const m = pickMission(x, PACKS, '');
    expect(m?.id).toBe('d5-act5.1');
    const h = monitorHtml(x, PACKS, {}, { mission: '', filter: 'all', day: 0, limit: 300 }, m, null);
    expect(h).toContain('Online now');
    expect(h).toContain('WORKING ON IT NOW');
    expect(h).toContain('Thursday, November 12, 2026');
    expect(h.indexOf('Trainer graded')).toBeLessThan(h.indexOf('Signed in (Seat 3)'));
    expect(h).not.toContain('<script>');
    const only = monitorHtml(x, PACKS, {}, { mission: '', filter: 'work', day: 0, limit: 300 }, m, null);
    expect(only).not.toContain('Trainer graded');
    expect(only).toContain('soc_alert_sop.txt');
  });

  it('board: online dot and the mission, live step progress for work not submitted yet', () => {
    const t: ReportTrainee = { email: 'ana@example.com', name: 'Ana Reyes', seat: 3, signedIn: true, firstSignIn: 1, lastSync: at(12, 9, 0), updated: at(12, 9, 30),
      done: { 'd5-act5.1': ['sop'] }, checked: {}, videos: {}, started: { 'd5-act5.1': 1 }, filled: { [A51.worksheet!.id]: 4 } };
    const d: BoardData = { trainees: [t], openDays: [5], generated: at(12, 9, 41), subs: [], redo: [], presence: { 'ana@example.com': { mission: A51.title, ago: 20 } } };
    const h = boardHtml(d, PACKS, 5);
    expect(h).toContain('href="#/trainee/ana%40example.com"');
    expect(h).toContain(`Online · ${A51.title}`);
    expect(h).toMatch(new RegExp(`class="bcell live" data-email="ana@example.com" data-act="d5-act5.1"[^>]*>\\s*<span class="dot on"[^>]*></span><span class="small">1/${A51.steps.length} steps · 4 ans`));
    expect(h).toContain('<b>1</b> online now');
    expect(lastActive(d, t)).toBe(at(12, 9, 41) - 20000);
    const off = boardHtml({ ...d, presence: { 'ana@example.com': { mission: A51.title, ago: 600 } } }, PACKS, 5);
    expect(off).toContain('Active 10 min ago');
    expect(off).not.toContain('class="dot on"></span><span class="small">');
    expect(ago(at(12, 9, 0), at(12, 9, 0, 30))).toBe('just now');
  });
});
