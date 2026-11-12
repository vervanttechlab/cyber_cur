// GNU-compatible text tools used by the Linux shell (and by tests that diff against real Git Bash output).

export interface TR { out: string; err?: string; code?: number }
export type Reader = (path: string) => string | null;

const lines = (t: string) => { if (t === '') return []; const a = t.split('\n'); if (a[a.length - 1] === '') a.pop(); return a; };
const join = (a: string[]) => (a.length ? a.join('\n') + '\n' : '');

/** Collect input: named files (with errors) or stdin. */
function inputs(files: string[], stdin: string | null, read: Reader, cmd: string): { name: string; text: string }[] | TR {
  if (!files.length) return [{ name: '(standard input)', text: stdin ?? '' }];
  const res: { name: string; text: string }[] = [];
  for (const f of files) {
    const t = read(f);
    if (t === null) return { out: '', err: `${cmd}: ${f}: No such file or directory`, code: 2 };
    res.push({ name: f, text: t });
  }
  return res;
}

function bre2js(p: string): string {
  // GNU basic regex: + ? | ( ) { } are literal unless escaped; \+ \? \| \( \) are operators.
  let out = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '\\' && i + 1 < p.length) {
      const n = p[i + 1];
      out += '+?|(){}'.includes(n) ? n : '\\' + n; i++; continue;
    }
    out += '+?|(){}'.includes(c) ? '\\' + c : c;
  }
  return out;
}

export function grep(args: string[], stdin: string | null, read: Reader): TR {
  const f = { i: false, v: false, c: false, n: false, E: false, F: false, o: false, w: false, h: false, H: false, l: false };
  const pats: string[] = []; const files: string[] = [];
  let endOpts = false; let after = 0, before = 0;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    const ctx = !endOpts && a.match(/^-([ABC])(\d*)$/);
    if (ctx) { const n = parseInt(ctx[2] || args[++k] || '0', 10); if (ctx[1] !== 'B') after = n; if (ctx[1] !== 'A') before = n; continue; }
    if (endOpts) { if (!pats.length) pats.push(a); else files.push(a); continue; }
    if (a === '--') { endOpts = true; continue; }
    if (a === '-e') { pats.push(args[++k] ?? ''); continue; }
    if (a === '--ignore-case') { f.i = true; continue; }
    if (a === '--count') { f.c = true; continue; }
    if (a === '--invert-match') { f.v = true; continue; }
    if (/^-[ivcnEFowhHlr]+$/.test(a)) { for (const ch of a.slice(1)) (f as Record<string, boolean>)[ch] = true; continue; }
    if (!pats.length) pats.push(a); else files.push(a);
  }
  if (!pats.length) return { out: '', err: 'Usage: grep [OPTION]... PATTERNS [FILE]...', code: 2 };
  const src = pats.map((p) => (f.F ? p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : f.E ? p : bre2js(p)));
  let body = src.length > 1 ? src.map((s) => `(?:${s})`).join('|') : src[0];
  if (f.w) body = `(?<![\\w])(?:${body})(?![\\w])`;
  let re: RegExp;
  try { re = new RegExp(body, f.i ? 'gi' : 'g'); } catch { return { out: '', err: `grep: Invalid regular expression`, code: 2 }; }
  const ins = inputs(files, stdin, read, 'grep');
  if (!Array.isArray(ins)) return ins;
  const multi = (ins.length > 1 || f.H) && !f.h;
  const out: string[] = []; let any = false;
  for (const { name, text } of ins) {
    let count = 0;
    const ls = lines(text);
    const hits = ls.map((ln) => { re.lastIndex = 0; return re.test(ln) !== f.v; });
    const ctxMode = (after || before) && !f.c && !f.l && !f.o;
    let lastPrinted = -1;
    ls.forEach((ln, idx) => {
      const hit = hits[idx];
      if (hit) { count++; any = true; }
      if (f.c || f.l) return;
      if (ctxMode) {
        const near = hit || hits.slice(Math.max(0, idx - after), idx).some(Boolean) || hits.slice(idx + 1, idx + 1 + before).some(Boolean);
        if (!near) return;
        if (lastPrinted >= 0 && idx > lastPrinted + 1) out.push('--');
        const sep = hit ? ':' : '-';
        out.push((multi ? name + sep : '') + (f.n ? idx + 1 + sep : '') + ln);
        lastPrinted = idx; return;
      }
      if (!hit) return;
      const pre = (multi ? name + ':' : '') + (f.n ? idx + 1 + ':' : '');
      if (f.o && !f.v) { re.lastIndex = 0; for (const m of ln.matchAll(re)) if (m[0]) out.push(pre + m[0]); }
      else out.push(pre + ln);
    });
    if (f.c) out.push((multi ? name + ':' : '') + count);
    if (f.l && count) out.push(name);
  }
  return { out: join(out), code: any ? 0 : 1 };
}

function splitFields(ln: string, fs: string | null): string[] {
  if (fs === null || fs === ' ') return ln.trim() === '' ? [] : ln.trim().split(/[ \t]+/);
  if (fs === '\\t' || fs === '\t') return ln.split('\t');
  return fs.length === 1 ? ln.split(fs) : ln.split(new RegExp(fs));
}

/** Translate a tiny awk expression into JS. Supports $N, $NF, NR, NF, strings, numbers, comparisons, ~ /re/, && || !, + - * / and juxtaposition concat. */
function awkExpr(src: string): string {
  const res: string[] = [];
  const hold = (js: string) => `\u0000${res.push(js) - 1}\u0000`;
  const field = (t: string) => t.replace(/\$NF\b/g, 'F(NF)').replace(/\$\(([^)]*)\)/g, 'F($1)').replace(/\$(\d+)/g, 'F($1)');
  let s = src;
  // `lhs ~ /re/` and `lhs !~ /re/`
  s = s.replace(/(\$\w+|\$\([^)]*\)|"[^"]*"|\w+)\s*(!?)~\s*\/((?:\\\/|[^/])*)\//g, (_m, lhs, neg, re) => hold(`${neg ? '!' : ''}(/${re}/.test(String(${field(lhs)})))`));
  // bare `/re/` = match against the whole line
  s = s.replace(/\/((?:\\\/|[^/\u0000])+)\//g, (_m, re) => hold(`(/${re}/.test(F(0)))`));
  s = field(s);
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i) => res[+i]);
}

function awkPrintArgs(src: string): string {
  // split on top-level commas
  const parts: string[] = []; let depth = 0, cur = '', q = false;
  for (const c of src) {
    if (c === '"') q = !q;
    if (!q && c === '(') depth++;
    if (!q && c === ')') depth--;
    if (!q && depth === 0 && c === ',') { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  if (!parts.length) return 'F(0)';
  const exprs = parts.map((p) => {
    const terms = p.trim().match(/"[^"]*"|\$NF|\$\d+|\$\([^)]*\)|NR|NF|\d+(?:\.\d+)?|[^\s"]+/g) ?? [];
    const hasOp = /[+\-*/%]|==|!=|<|>/.test(p.replace(/"[^"]*"/g, ''));
    return hasOp ? `(${awkExpr(p)})` : terms.map((t) => awkExpr(t)).join(' + "" + ');
  });
  return exprs.map((e) => `String(${e})`).join(' + " " + ');
}

export function awk(args: string[], stdin: string | null, read: Reader): TR {
  let fs: string | null = null; let prog: string | null = null; const files: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '-F') { fs = args[++k]; continue; }
    if (a.startsWith('-F')) { fs = a.slice(2); continue; }
    if (prog === null) prog = a; else files.push(a);
  }
  if (prog === null) return { out: '', err: 'usage: awk [-F fs] \'program\' [file ...]', code: 2 };
  // program: [pattern] [{ print ... }]  (BEGIN/END and variables are not supported in the lab)
  const m = prog.trim().match(/^([^{]*?)\s*(?:\{\s*([\s\S]*?)\s*;?\s*\})?\s*$/);
  if (!m || /\bBEGIN\b|\bEND\b|\+\+|\bfor\b/.test(prog)) {
    return { out: '', err: "awk: this lab supports patterns and { print ... } only (e.g. awk '{print $1}' file)", code: 2 };
  }
  const pattern = m[1].trim();
  const action = (m[2] ?? 'print').trim();
  const am = action.match(/^print\b\s*(.*)$/);
  if (!am) return { out: '', err: "awk: this lab supports { print ... } actions only", code: 2 };
  let fn: (F: (i: number) => string, NR: number, NF: number, $0: string) => [boolean, string];
  try {
    const cond = pattern ? awkExpr(pattern) : 'true';
    // eslint-disable-next-line no-new-func
    fn = new Function('F', 'NR', 'NF', '$0', `return [Boolean(${cond}), ${awkPrintArgs(am[1])}];`) as any;
  } catch { return { out: '', err: 'awk: syntax error in program', code: 2 }; }
  const ins = inputs(files, stdin, read, 'awk');
  if (!Array.isArray(ins)) return { ...ins, err: ins.err?.replace('awk: ', 'awk: cannot open ') };
  const out: string[] = []; let nr = 0;
  for (const { text } of ins) for (const ln of lines(text)) {
    nr++;
    const fl = splitFields(ln, fs);
    const F = (i: number) => (i === 0 ? ln : fl[i - 1] ?? '');
    try { const [ok, v] = fn(F, nr, fl.length, ln); if (ok) out.push(v); } catch { return { out: join(out), err: 'awk: runtime error', code: 2 }; }
  }
  return { out: join(out) };
}

const cmpBytes = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const leadNum = (s: string) => { const m = s.match(/^\s*(-?\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };

export function sort(args: string[], stdin: string | null, read: Reader): TR {
  let n = false, r = false, u = false, k: number | null = null, t: string | null = null; const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-k') { k = parseInt(args[++i], 10); continue; }
    if (a.startsWith('-k')) { k = parseInt(a.slice(2), 10); continue; }
    if (a === '-t') { t = args[++i]; continue; }
    if (a.startsWith('-t') && a.length > 2) { t = a.slice(2); continue; }
    if (/^-[nrufb]+$/.test(a)) { n ||= a.includes('n'); r ||= a.includes('r'); u ||= a.includes('u'); continue; }
    files.push(a);
  }
  const ins = inputs(files, stdin, read, 'sort');
  if (!Array.isArray(ins)) return ins;
  const all = ins.flatMap((x) => lines(x.text));
  const keyOf = (ln: string) => {
    if (k === null) return ln;
    const parts = t ? ln.split(t) : ln.trim().split(/\s+/);
    return parts.slice(k - 1).join(t ?? ' ');
  };
  const cmp = (a: string, b: string) => {
    const ka = keyOf(a), kb = keyOf(b);
    let c = n ? leadNum(ka) - leadNum(kb) : cmpBytes(ka, kb);
    if (c === 0) c = cmpBytes(a, b);
    return r ? -c : c;
  };
  let sorted = [...all].sort(cmp);
  if (u) sorted = sorted.filter((v, i) => i === 0 || cmp(v, sorted[i - 1]) !== 0);
  return { out: join(sorted) };
}

export function uniq(args: string[], stdin: string | null, read: Reader): TR {
  const c = args.includes('-c'), d = args.includes('-d'), uu = args.includes('-u');
  const files = args.filter((a) => !a.startsWith('-'));
  const ins = inputs(files.slice(0, 1), stdin, read, 'uniq');
  if (!Array.isArray(ins)) return ins;
  const ls = lines(ins[0].text); const out: string[] = [];
  for (let i = 0; i < ls.length;) {
    let j = i; while (j < ls.length && ls[j] === ls[i]) j++;
    const cnt = j - i;
    if ((!d || cnt > 1) && (!uu || cnt === 1)) out.push(c ? String(cnt).padStart(7) + ' ' + ls[i] : ls[i]);
    i = j;
  }
  return { out: join(out) };
}

export function wc(args: string[], stdin: string | null, read: Reader): TR {
  let l = false, w = false, c = false; const files: string[] = [];
  for (const a of args) { if (/^-[lwcm]+$/.test(a)) { l ||= a.includes('l'); w ||= a.includes('w'); c ||= a.includes('c') || a.includes('m'); } else files.push(a); }
  if (!l && !w && !c) l = w = c = true;
  const ins = inputs(files, stdin, read, 'wc');
  if (!Array.isArray(ins)) return { ...ins, code: 1 };
  const rows = ins.map(({ name, text }) => ({ name, v: [l ? (text.match(/\n/g) ?? []).length : null, w ? (text.match(/\S+/g) ?? []).length : null, c ? new TextEncoder().encode(text).length : null].filter((x) => x !== null) as number[] }));
  if (rows.length > 1) rows.push({ name: 'total', v: rows[0].v.map((_, i) => rows.reduce((s, r) => s + r.v[i], 0)) });
  const single = rows.length === 1 && rows[0].v.length === 1;
  // GNU wc sizes columns from the total byte count of the input files (7 for stdin), even if bytes aren't shown
  const totalBytes = ins.reduce((n, x) => n + new TextEncoder().encode(x.text).length, 0);
  const width = single ? 0 : files.length ? Math.max(String(totalBytes).length, ...rows.flatMap((r) => r.v.map((x) => String(x).length))) : 7;
  const out = rows.map((r) => r.v.map((x) => String(x).padStart(width)).join(' ') + (files.length ? ' ' + r.name : ''));
  return { out: join(out) };
}

function countArg(args: string[], def = 10): { n: number; plus: boolean; files: string[] } {
  let n = def, plus = false; const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-n') { const v = args[++i] ?? ''; plus = v.startsWith('+'); n = parseInt(v, 10); continue; }
    if (/^-n[+]?\d+$/.test(a)) { plus = a[2] === '+'; n = parseInt(a.slice(2), 10); continue; }
    if (/^-\d+$/.test(a)) { n = parseInt(a.slice(1), 10); continue; }
    files.push(a);
  }
  return { n: Math.abs(n), plus, files };
}

export function head(args: string[], stdin: string | null, read: Reader): TR {
  const { n, files } = countArg(args);
  const ins = inputs(files, stdin, read, 'head');
  if (!Array.isArray(ins)) return { ...ins, err: ins.err?.replace('head: ', "head: cannot open '").replace(': No such', "' for reading: No such"), code: 1 };
  const parts = ins.map(({ name, text }, i) => (ins.length > 1 ? `${i ? '\n' : ''}==> ${name} <==\n` : '') + join(lines(text).slice(0, n)));
  return { out: parts.join('') };
}

export function tail(args: string[], stdin: string | null, read: Reader): TR {
  const { n, plus, files } = countArg(args);
  const ins = inputs(files, stdin, read, 'tail');
  if (!Array.isArray(ins)) return { ...ins, err: ins.err?.replace('tail: ', "tail: cannot open '").replace(': No such', "' for reading: No such"), code: 1 };
  const parts = ins.map(({ name, text }, i) => { const ls = lines(text); return (ins.length > 1 ? `${i ? '\n' : ''}==> ${name} <==\n` : '') + join(plus ? ls.slice(n - 1) : ls.slice(Math.max(0, ls.length - n))); });
  return { out: parts.join('') };
}

function ranges(spec: string): (i: number) => boolean {
  const rs = spec.split(',').map((p) => { const [a, b] = p.split('-'); return [a ? parseInt(a, 10) : 1, p.includes('-') ? (b ? parseInt(b, 10) : Infinity) : parseInt(a, 10)]; });
  return (i) => rs.some(([a, b]) => i >= a && i <= b);
}

export function cut(args: string[], stdin: string | null, read: Reader): TR {
  let d = '\t', f: string | null = null, c: string | null = null; const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-d') { d = args[++i]; continue; }
    if (a.startsWith('-d')) { d = a.slice(2); continue; }
    if (a === '-f') { f = args[++i]; continue; }
    if (a.startsWith('-f')) { f = a.slice(2); continue; }
    if (a === '-c') { c = args[++i]; continue; }
    if (a.startsWith('-c')) { c = a.slice(2); continue; }
    files.push(a);
  }
  if (!f && !c) return { out: '', err: 'cut: you must specify a list of bytes, characters, or fields', code: 1 };
  const ins = inputs(files, stdin, read, 'cut');
  if (!Array.isArray(ins)) return ins;
  const sel = ranges((f ?? c)!);
  const out = ins.flatMap((x) => lines(x.text)).map((ln) => {
    if (c) return [...ln].filter((_, i) => sel(i + 1)).join('');
    if (!ln.includes(d)) return ln;
    return ln.split(d).filter((_, i) => sel(i + 1)).join(d);
  });
  return { out: join(out) };
}
