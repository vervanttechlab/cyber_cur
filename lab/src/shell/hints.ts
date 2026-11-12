// Beginner tips after a wrong path. The real error line stays exactly as bash / PowerShell print it;
// a "(Lab tip: ...)" line is added below it when the lab can tell what the trainee probably meant:
//   - the file exists, but in another folder (e.g. typed in ~/demo, the file is in ~/demo3)
//   - a spelling slip (demo_behavior__cards.txt -> demo_behavior_cards.txt, demo_scan_log.csv -> demo_scan_logs.csv)
//   - a folder was given where a file is needed (cat ~/demo3)
import type { Session } from './types';
import { isDir, resolvePath, isWin } from './vfs';

const LINUX_MISSING = [
  /^ls: cannot access '(.+)': No such file or directory$/,
  /^python3: can't open file '(.+)': \[Errno 2\]/,
  /No such file or directory: '(.+)'$/,
  /^(?:bash: )?[\w.-]+: (.+): No such file or directory$/,
];
const LINUX_DIR = /^[\w.-]+: (.+): Is a directory$/;
const WIN_MISSING = [/Cannot find path '(.+)' because it does not exist\.$/, /Could not find file '(.+)'\.$/];

function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}

/** How the trainee should type a lab path: ~/... on Linux, relative to the home folder on Windows. */
function show(s: Session, abs: string): string {
  const h = s.host.home;
  if (isWin(s.host)) return abs.toLowerCase().startsWith(h.toLowerCase() + '\\') && s.cwd.toLowerCase() === h.toLowerCase() ? abs.slice(h.length + 1) : abs;
  return abs === h ? '~' : abs.startsWith(h + '/') ? '~' + abs.slice(h.length) : abs;
}

function tipFor(s: Session, typed: string, folder: boolean, cd: boolean): string | null {
  const win = isWin(s.host), sep = win ? '\\' : '/';
  const abs = resolvePath(s, typed);
  const ls = win ? 'dir' : 'ls';
  if (cd) {
    // cd / Set-Location to a folder that does not exist: suggest the closest lab folder
    const home = s.host.home + sep, low = (x: string) => (win ? x.toLowerCase() : x);
    const dirs = [...new Set(Object.keys(s.host.files).filter((f) => low(f).startsWith(low(home))).flatMap((f) => {
      const parts = f.slice(home.length).split(sep).slice(0, -1);
      return parts.map((_, i) => home + parts.slice(0, i + 1).join(sep));
    }))].filter((d) => !d.slice(home.length).split(sep).some((p) => p.startsWith('.')));
    const best = dirs.map((d) => ({ d, n: distance(low(d), low(abs)) })).filter((x) => x.n <= 2).sort((a, b) => a.n - b.n)[0];
    return best ? `Check the spelling. Did you mean  cd ${show(s, best.d)} ?` : `Type  ${ls} ~  to see every lab folder.`;
  }
  if (folder || isDir(s, abs)) return `${show(s, abs)} is a folder, not a file. See the files inside with:  ${ls} ${show(s, abs)}`;
  const low = (x: string) => (win ? x.toLowerCase() : x);
  const name = abs.slice(abs.lastIndexOf(sep) + 1);
  const home = s.host.home + sep;
  const files = Object.keys(s.host.files).filter((f) => low(f).startsWith(low(home)) && !f.slice(home.length).split(sep).some((p) => p.startsWith('.')));
  const base = (f: string) => f.slice(f.lastIndexOf(sep) + 1);
  const where = (list: string[]) => [...new Set(list)].slice(0, 3).map((f) => show(s, f)).join('  or  ');
  // 1. right name, wrong folder
  const same = files.filter((f) => low(base(f)) === low(name));
  if (same.length) {
    const dirs = [...new Set(same.map((f) => show(s, f.slice(0, f.lastIndexOf(sep)))))].slice(0, 3);
    return `There is no ${name} here. It is in ${dirs.join(' and ')}: type the full path  ${where(same)}${dirs.length === 1 ? `  (or  cd ${dirs[0]}  first)` : ''}`;
  }
  // 2. a spelling slip in the file name (or in the folder name)
  const max = Math.max(2, Math.floor(name.length / 8));
  const score = (f: string) => Math.min(distance(base(f).toLowerCase(), name.toLowerCase()), distance(low(f), low(abs)));
  const close = files.map((f) => ({ f, d: score(f) })).filter((x) => x.d > 0 && x.d <= max).sort((a, b) => a.d - b.d || a.f.length - b.f.length);
  if (close.length) {
    const best = close.filter((x) => x.d === close[0].d).map((x) => x.f);
    return `Check the spelling. Did you mean  ${where(best)} ?`;
  }
  // 3. nothing close: show how to look around
  const dir = abs.slice(0, abs.lastIndexOf(sep)) || sep;
  return isDir(s, dir) ? `No file with that name in ${show(s, dir)}. List the files with  ${ls} ${show(s, dir)}  (or  ${ls} ~  to see every lab folder)` : `The folder ${show(s, dir)} does not exist. Type  ${ls} ~  to see every lab folder.`;
}

/** Returns `err` with a Lab tip line after each wrong-path error line (at most 3 tips). */
export function withPathTips(s: Session, err: string): string {
  const win = isWin(s.host);
  let n = 0;
  return err.split('\n').map((line) => {
    if (n >= 3) return line;
    let typed: string | undefined, folder = false;
    const cd = /^bash: cd: |^Set-Location : /.test(line);
    for (const re of win ? WIN_MISSING : LINUX_MISSING) { const m = line.match(re); if (m) { typed = m[1]; break; } }
    if (!typed && !win) { const m = line.match(LINUX_DIR); if (m) { typed = m[1]; folder = true; } }
    if (!typed) return line;
    const tip = tipFor(s, typed, folder, cd);
    if (!tip) return line;
    n++;
    return `${line}\n(Lab tip: ${tip})`;
  }).join('\n');
}
