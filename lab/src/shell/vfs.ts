// Path handling and a tiny read-only-ish virtual filesystem over Host.files.
import type { Host, Session } from './types';

export function isWin(h: Host) { return h.os === 'windows'; }

/** Resolve a user path against cwd. Linux: posix, `~` = home. Windows: drive paths, case-insensitive. */
export function resolvePath(s: Session, p: string): string {
  const h = s.host;
  if (isWin(h)) {
    let q = p.replace(/\//g, '\\');
    if (q.startsWith('~')) q = h.home + q.slice(1);
    if (!/^[a-zA-Z]:\\/.test(q)) q = s.cwd.replace(/\\$/, '') + '\\' + q;
    const parts: string[] = [];
    for (const seg of q.split('\\')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') { if (parts.length > 1) parts.pop(); continue; }
      parts.push(seg);
    }
    return parts.length === 1 ? parts[0] + '\\' : parts.join('\\');
  }
  let q = p;
  if (q === '~' || q.startsWith('~/')) q = h.home + q.slice(1);
  if (!q.startsWith('/')) q = s.cwd.replace(/\/$/, '') + '/' + q;
  const parts: string[] = [];
  for (const seg of q.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { parts.pop(); continue; }
    parts.push(seg);
  }
  return '/' + parts.join('/');
}

const key = (h: Host, p: string) => (isWin(h) ? p.toLowerCase() : p);

function index(h: Host): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of Object.keys(h.files)) m.set(key(h, p), p);
  return m;
}

export function readFile(s: Session, p: string): string | null {
  const abs = resolvePath(s, p);
  const real = index(s.host).get(key(s.host, abs));
  return real === undefined ? null : s.host.files[real];
}

export function writeFile(s: Session, p: string, content: string, append = false) {
  const abs = resolvePath(s, p);
  const real = index(s.host).get(key(s.host, abs)) ?? abs;
  s.host.files[real] = append && s.host.files[real] !== undefined ? s.host.files[real] + content : content;
}

export function isDir(s: Session, p: string): boolean {
  const abs = resolvePath(s, p);
  const sep = isWin(s.host) ? '\\' : '/';
  const pre = key(s.host, abs.endsWith(sep) ? abs : abs + sep);
  if (abs === '/' || /^[a-zA-Z]:\\$/.test(abs)) return true;
  return Object.keys(s.host.files).some((f) => key(s.host, f).startsWith(pre));
}

export interface Entry { name: string; dir: boolean; size: number; path: string }

export function listDir(s: Session, p: string): Entry[] | null {
  const abs = resolvePath(s, p);
  if (!isDir(s, abs)) return null;
  const sep = isWin(s.host) ? '\\' : '/';
  const base = abs.endsWith(sep) ? abs : abs + sep;
  const seen = new Map<string, Entry>();
  for (const f of Object.keys(s.host.files)) {
    if (!key(s.host, f).startsWith(key(s.host, base))) continue;
    const rest = f.slice(base.length);
    const [first, ...more] = rest.split(sep);
    if (!first) continue;
    if (more.length) seen.set(first, { name: first, dir: true, size: 4096, path: base + first });
    else seen.set(first, { name: first, dir: false, size: new TextEncoder().encode(s.host.files[f]).length, path: f });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Expand simple globs (*, ?) in a Linux argument against the directory it points into. */
export function glob(s: Session, arg: string): string[] {
  if (!/[*?]/.test(arg)) return [arg];
  const i = arg.lastIndexOf('/');
  const dir = i >= 0 ? arg.slice(0, i) || '/' : '.';
  const pat = i >= 0 ? arg.slice(i + 1) : arg;
  const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  const ents = listDir(s, dir) ?? [];
  const hits = ents.filter((e) => re.test(e.name) && !e.name.startsWith('.')).map((e) => (i >= 0 ? arg.slice(0, i + 1) : '') + e.name);
  return hits.length ? hits : [arg];
}

export function displayCwd(s: Session): string {
  if (isWin(s.host)) return s.cwd;
  return s.cwd === s.host.home ? '~' : s.cwd.startsWith(s.host.home + '/') ? '~' + s.cwd.slice(s.host.home.length) : s.cwd;
}
