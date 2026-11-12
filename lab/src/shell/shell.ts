// Runs a command line on a simulated host: chains (; &&), pipes, redirects, sudo, help, history.
import type { Host, Result, Session, Value } from './types';
import { parse } from './parse';
import { linux, LINUX_TIPS, withRoot } from './linux';
import { windows, WIN_ALIASES, WINDOWS_TIPS, asText, notRecognized } from './windows';
import { windowsExtra } from './windows2';
import { writeFile, displayCwd } from './vfs';
import { withPathTips } from './hints';

export interface RunOutput { stdout: string; stderr: string; clear: boolean; commands: string[]; code: number }

export function newSession(host: Host): Session { return { host, cwd: host.startDir, history: [] }; }

const LINUX_HELP = `Commands available in this Ubuntu lab VM:
  System     hostnamectl  uname -a  whoami  id  who  last  date  uptime
  Network    ip a  ip route  ss -tunap  ping  traceroute  dig  nslookup
  Processes  ps aux  ps aux --sort=-%cpu
  Files      ls  cd  pwd  cat  less  head  tail      (Day 3: ~/day3   Day 4: ~/day4)
  Text       grep  awk  sort  uniq  wc  cut      (combine with |)
  Scripts    python3 <script.py> <file>
  Other      sudo <command>  history  clear  help
`;
const WIN_HELP = `Commands available on this Windows lab workstation (PowerShell):
  System     systeminfo  hostname  whoami  query user  Get-Date
  Network    ipconfig  ipconfig /all  netstat -ano  Get-NetTCPConnection  ping  tracert  nslookup
  Processes  tasklist  tasklist /svc  tasklist /fi "PID eq 1234"  Get-Process
  Files      dir  cd  type <file>  Get-Content <file>
  Filters    findstr  Select-String  Sort-Object  Select-Object  Where-Object  Group-Object  Measure-Object
  Logs, CSV  Import-Csv <file>  Get-WinEvent -LogName Security -MaxEvents 5
  Security   Get-MpComputerStatus  Get-MpThreat  Get-MpThreatDetection  Get-Service
  Output     Format-Table  Format-List (fl)
  Other      history  cls  help
`;

function dispatch(argv: string[], stdin: Value | null, s: Session): Result {
  const win = s.host.os === 'windows';
  const [raw, ...args] = argv;
  if (win) {
    let name = raw.toLowerCase();
    name = WIN_ALIASES[name] ?? name;
    if (name === 'get-help') return { out: WIN_HELP };
    if (name === 'history' || name === 'get-history') return { out: s.history.map((h, i) => `${String(i + 1).padStart(4)} ${h}`).join('\n') + '\n' };
    const fn = windows[name] ?? windowsExtra[name];
    if (!fn) return notRecognized(raw, WINDOWS_TIPS[name]);
    return tips(fn(args, stdin, s), s);
  }
  if (raw === 'help') return { out: LINUX_HELP };
  if (raw === 'history') return { out: s.history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`).join('\n') + '\n' };
  if (raw === 'exit' || raw === 'logout') return { out: '(Lab: the terminal stays open. Switch hosts with the tabs above.)\n' };
  if (raw === 'sudo') {
    if (!args.length) return { out: '', err: 'usage: sudo <command>', code: 1 };
    let note = '';
    if (!s.sudoWarned) { note = `[sudo] password for ${s.host.user}: ********   (lab: password accepted)\n`; s.sudoWarned = true; }
    const r = withRoot(() => dispatch(args, stdin, s));
    return { ...r, err: (note ? note.trimEnd() + (r.err ? '\n' : '') : '') + (r.err ?? '') || undefined };
  }
  const fn = linux[raw];
  // bash expands a leading ~ before the command runs, so commands that print file names show /home/<user>/...
  args.forEach((x, k) => { if (/^~(\/|$)/.test(x)) args[k] = s.host.home + x.slice(1); });
  if (!fn) {
    const tip = LINUX_TIPS[raw.toLowerCase()];
    return { out: '', err: `${raw}: command not found${tip ? `\n(Lab tip: on Linux use  ${tip})` : ''}`, code: 127 };
  }
  return tips(fn(args, stdin, s), s);
}

/** Add beginner Lab tips under wrong-path errors (the error line itself is unchanged). */
const tips = (r: Result, s: Session): Result => (r.err ? { ...r, err: withPathTips(s, r.err) } : r);

export function run(s: Session, line: string): RunOutput {
  const trimmed = line.trim();
  const res: RunOutput = { stdout: '', stderr: '', clear: false, commands: [], code: 0 };
  if (!trimmed) return res;
  s.history.push(trimmed);
  const win = s.host.os === 'windows';
  const chain = parse(trimmed, win);
  let lastCode = 0;
  for (const { pipeline, op } of chain.items) {
    let v: Value | null = null; let code = 0;
    for (const c of pipeline.cmds) {
      res.commands.push(c.argv[0].toLowerCase());
      const r = dispatch(c.argv, v, s);
      if (r.err) res.stderr += r.err.replace(/\n?$/, '\n');
      if (r.clear) res.clear = true;
      v = r.out; code = r.code ?? 0;
    }
    let text = asText(v) ?? '';
    if (pipeline.redirect) { writeFile(s, pipeline.redirect.file, text, pipeline.redirect.append); text = ''; }
    res.stdout += text;
    lastCode = code;
    if (op === '&&' && code !== 0) break;
  }
  res.code = lastCode;
  return res;
}

export function prompt(s: Session): string {
  if (s.host.os === 'windows') return `PS ${s.cwd}> `;
  return `${s.host.user}@${s.host.hostname}:${displayCwd(s)}$ `;
}
