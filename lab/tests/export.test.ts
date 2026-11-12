// Lab Notebook export: commands with their output, grouped by mission; the command log survives long days
// and the online save (slim) stays well under the server's MAX_STATE.
import { describe, it, expect } from 'vitest';
import { DAY2 } from '../src/missions/day02';
import { DAY9 } from '../src/missions/day09';
import { notebookHtml } from '../src/ui/export';
import { clipOutput, trimLog, emptyState, type LogEntry } from '../src/ui/store';
import { slim, OUTPUT_BUDGET } from '../src/ui/sync';
import { newSession, run } from '../src/shell/shell';
import { seatHosts } from '../src/hosts/hosts';

const entry = (over: Partial<LogEntry>): LogEntry => ({ time: 'Nov 7, 9:00:00 AM', host: 'WKS-LAB-07', line: 'ipconfig', mission: 'Activity 2.1 · Know Your Lab Host', day: 2, ...over });
const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

describe('command output is kept for the notebook', () => {
  it('short output is kept as is (colours removed)', () => {
    expect(clipOutput('\x1b[32mok\x1b[0m\r\nline 2\n\n')).toBe('ok\nline 2');
  });
  it('long output is clipped to 40 lines with a note', () => {
    const out = clipOutput(Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n'));
    const lines = out.split('\n');
    expect(lines).toHaveLength(41);
    expect(lines[39]).toBe('line 40');
    expect(lines[40]).toBe('… (60 more lines not kept: pin the output as evidence to keep all of it)');
    expect(clipOutput('x'.repeat(5000))).toMatch(/^x{3000}\n… \(the rest of the line not kept/);
  });
  it('a real lab output (Activity 2.1 ipconfig on a seat host) is kept whole', () => {
    const r = run(newSession(seatHosts(7).win), 'ipconfig');
    expect(clipOutput(r.stdout)).toContain('IPv4 Address');
  });
});

describe('command log', () => {
  it('each day keeps its newest 150 commands; a long day never removes another day', () => {
    const log = [...Array.from({ length: 20 }, (_, i) => entry({ line: `d2-${i}`, day: 2 })), ...Array.from({ length: 400 }, (_, i) => entry({ line: `d9-${i}`, day: 9 }))];
    const t = trimLog(log);
    expect(t.filter((l) => l.day === 2)).toHaveLength(20);
    expect(t.filter((l) => l.day === 9).map((l) => l.line)).toEqual(Array.from({ length: 150 }, (_, i) => `d9-${i + 250}`));
  });
  it('the online copy keeps every command and the newest outputs within the budget', () => {
    const st = emptyState('Ana', 7, 'd9-act9.1');
    st.token = 'secret';
    // 15 busy days, 150 commands each, every output 40 lines
    const big = Array.from({ length: 40 }, (_, i) => `2026-11-05 08:${String(i).padStart(2, '0')}:00,FIN-PC-03,1117,Quarantine,Trojan:Win32/Example`).join('\n');
    st.log = Array.from({ length: 15 * 150 }, (_, i) => entry({ line: `cmd ${i}`, day: 1 + Math.floor(i / 150), out: big }));
    const s = slim(st);
    expect((s as { token?: string }).token).toBeUndefined();
    expect(s.log).toHaveLength(15 * 150); // no command is lost
    expect(s.log[s.log.length - 1].out).toBe(big); // the newest outputs are kept
    expect(s.log[0].out).toBeUndefined(); // the oldest give up their output first
    const kept = s.log.reduce((n, l) => n + (l.out?.length ?? 0), 0);
    expect(kept).toBeLessThanOrEqual(OUTPUT_BUDGET);
    expect(JSON.stringify(s).length).toBeLessThan(900000); // MAX_STATE in sync/Code.gs
  });
});

describe('exported notebook', () => {
  it('shows every command with its output, grouped by activity, for that day only', () => {
    const st = emptyState('Ana Reyes', 7, 'd2-act2.1');
    st.log = [
      entry({ line: 'ipconfig', out: 'IPv4 Address. . . . . . . . . . . : 10.10.20.107' }),
      entry({ line: 'hostname', mission: 'Practice: Demo 1 · Monitoring Commands', out: 'WKS-TRN-07' }),
      entry({ line: 'whoami', out: '' }),
      entry({ line: 'old command', out: undefined }),
      entry({ line: 'cat ~/day9/scan_logs.csv', mission: 'Activity 9.2 · Find the Failed Actions', day: 9, out: 'should not appear' }),
    ];
    const h = notebookHtml(st, 2, DAY2.missions, () => ({}));
    const t = text(h);
    expect(t).toContain('Terminal work (commands and output)');
    expect(t).toContain('ipconfig IPv4 Address. . . . . . . . . . . : 10.10.20.107');
    expect(t).toContain('hostname WKS-TRN-07');
    expect(t).toContain('whoami (no output)');
    expect(t).toContain('old command (output not recorded');
    expect(t).not.toContain('should not appear');
    // activities come before the practice missions
    expect(h.indexOf('Activity 2.1')).toBeLessThan(h.lastIndexOf('Practice: Demo 1 · Monitoring Commands'));
    expect(h).toContain('<pre>IPv4 Address');
  });
  it('lists each step with the command that completed it', () => {
    const a = DAY2.missions.find((m) => m.id === 'd2-act2.1')!;
    const s0 = a.steps.find((s) => !s.manual && s.try)!;
    const linux = a.steps.find((s) => !s.manual && s.try && s.host === 'seat-linux')!;
    const st = emptyState('Ana Reyes', 7, a.id);
    st.done[a.id] = [s0.id, linux.id];
    st.log = [
      entry({ line: 'not a step command', mission: a.title }),
      entry({ line: s0.try!, mission: a.title, host: s0.host === 'seat-win' ? 'WKS-LAB-07' : 'ubuntu-lab-07' }),
      entry({ line: linux.try!, mission: a.title, host: 'WKS-LAB-07' }), // wrong terminal: not credited
      entry({ line: linux.try!, mission: a.title, host: 'ubuntu-lab-07', time: 'Nov 7, 9:05:00 AM' }),
    ];
    const h = notebookHtml(st, 2, DAY2.missions, () => ({}));
    const sec = h.slice(h.indexOf('Steps and commands used'), h.indexOf('<h2>Worksheets'));
    expect(sec).toContain('Activity 2.1');
    const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    expect(sec).toContain(`<code>${esc(s0.try!)}</code>`);
    expect(sec).toContain(`<code>${esc(linux.try!)}</code><br><span class="when">Nov 7, 9:05:00 AM · ubuntu-lab-07`);
    expect(sec).not.toContain('Practice: Demo 2'); // untouched missions are left out
  });
  it('a day with no commands says so', () => {
    expect(text(notebookHtml(emptyState('Ana', 7, 'd9-act9.1'), 9, DAY9.missions, () => ({})))).toContain('No commands run for this day yet.');
  });
});
