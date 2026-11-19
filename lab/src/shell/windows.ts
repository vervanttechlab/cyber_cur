// Windows (PowerShell console) command set for the simulated lab workstation.
// Classic console tools (ipconfig, netstat, tasklist, findstr...) produce text; a small object
// pipeline supports Get-Process | Sort-Object | Select-Object | Where-Object | Format-Table.
import type { CommandFn, Obj, ObjStream, Result, Session, Value } from './types';
import { readFile, resolvePath, isDir, listDir } from './vfs';
import { labReachable, resolveName, rtt } from './net';

const ok = (out: Value): Result => ({ out });
const fail = (err: string, code = 1): Result => ({ out: '', err, code });

// ---------- object formatting ----------
const isNum = (v: unknown) => typeof v === 'number';
export function formatList(st: ObjStream): string {
  if (!st.objs.length) return '';
  const cols = st.cols.length ? st.cols : Object.keys(st.objs[0]);
  const w = Math.max(...cols.map((c) => c.length));
  const val = (v: string | number | undefined) => String(v ?? '').replace(/\n/g, '\n' + ' '.repeat(w + 3));
  return '\n' + st.objs.map((o) => cols.map((c) => `${c.padEnd(w)} : ${val(o[c])}`).join('\n')).join('\n\n') + '\n\n';
}
export function formatTable(st: ObjStream): string {
  if (!st.objs.length) return '';
  if (st.view === 'list') return formatList(st);
  const cols = st.cols;
  const cell = (v: string | number | undefined, c: string) => { if (v === undefined) return ''; if (isNum(v)) return /CPU/i.test(c) ? (v as number).toFixed(2) : String(v); const t = String(v); const first = t.split('\n')[0]; return first.length > 72 ? first.slice(0, 69) + '...' : t.includes('\n') ? first + '...' : first; };
  const w = cols.map((c) => Math.max(c.length, ...st.objs.map((o) => cell(o[c], c).length)));
  const right = cols.map((c) => st.objs.every((o) => o[c] === undefined || isNum(o[c])));
  const fmt = (vals: string[]) => vals.map((v, i) => (right[i] ? v.padStart(w[i]) : v.padEnd(w[i]))).join(' ').trimEnd();
  return (st.header ? `\n   ${st.header}\n` : '') + '\n' + [fmt(cols), fmt(cols.map((c) => '-'.repeat(c.length))), ...st.objs.map((o) => fmt(cols.map((c) => cell(o[c], c))))].join('\n') + '\n\n';
}
export const asText = (v: Value | null): string | null => (v === null ? null : typeof v === 'string' ? v : formatTable(v));

const PROP_ALIAS: Record<string, string> = { name: 'Name', processname: 'Name', id: 'Id', cpu: 'CPU', 'cpu(s)': 'CPU', ws: 'WS', workingset: 'WS', 'ws(k)': 'WS', handles: 'Handles', localport: 'LocalPort', state: 'State', owningprocess: 'OwningProcess', localaddress: 'LocalAddress', remoteaddress: 'RemoteAddress', remoteport: 'RemotePort' };
const prop = (p: string) => PROP_ALIAS[p.toLowerCase()] ?? p;
/** Resolve a property name against real object keys, case-insensitively (PowerShell semantics). */
function key(objs: Obj[], cols: string[], p: string): string {
  const keys = objs.length ? Object.keys(objs[0]) : cols;
  return keys.find((k) => k === p) ?? keys.find((k) => k.toLowerCase() === p.toLowerCase()) ?? prop(p);
}

function procObjects(s: Session): ObjStream {
  const objs: Obj[] = s.host.procs.filter((p) => p.pid > 4).map((p) => ({ Handles: p.handles ?? 200, WS: p.rssKB, CPU: p.cpu, Id: p.pid, Name: p.name.replace(/\.exe$/i, '') }));
  return { objs: objs.sort((a, b) => String(a.Name).localeCompare(String(b.Name))), cols: ['Handles', 'WS', 'CPU', 'Id', 'Name'] };
}

function compare(a: string | number | undefined, op: string, b: string): boolean {
  const n = parseFloat(b), av = a ?? '';
  const num = (isNum(av) || (String(av).trim() !== '' && !Number.isNaN(Number(av)))) && !Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(b.trim());
  const avn = Number(av);
  switch (op.toLowerCase()) {
    case '-gt': return num ? avn > n : String(av) > b;
    case '-lt': return num ? avn < n : String(av) < b;
    case '-ge': return num ? avn >= n : String(av) >= b;
    case '-le': return num ? avn <= n : String(av) <= b;
    case '-eq': return num ? avn === n : String(av).toLowerCase() === b.toLowerCase();
    case '-ne': return num ? avn !== n : String(av).toLowerCase() !== b.toLowerCase();
    case '-like': return new RegExp('^' + b.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i').test(String(av));
    case '-match': return new RegExp(b, 'i').test(String(av));
    default: return false;
  }
}

// ---------- findstr ----------
function findstr(args: string[], stdin: Value | null, s: Session): Result {
  const o = { i: false, b: false, e: false, v: false, n: false, m: false, l: false };
  const pats: string[] = []; const files: string[] = []; let gotWords = false;
  for (const a of args) {
    const m = a.match(/^\/([a-zA-Z])(?::(.*))?$/);
    if (m) {
      const f = m[1].toLowerCase();
      if (f === 'c') { pats.push(m[2] ?? ''); gotWords = true; continue; }
      if (f in o) (o as Record<string, boolean>)[f] = true;
      continue;
    }
    if (!gotWords) { pats.push(...a.split(' ').filter(Boolean)); gotWords = true; } else files.push(a);
  }
  if (!pats.length) return fail('FINDSTR: Bad command line', 2);
  const toRe = (p: string) => {
    let body = o.l ? p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : p.replace(/[+?{}()|\\]/g, '\\$&');
    if (o.b) body = '^' + body; if (o.e) body += '$';
    return new RegExp(body, o.i ? 'i' : '');
  };
  const res = pats.map(toRe);
  const srcs: { name: string; text: string }[] = [];
  if (files.length) for (const f of files) { const t = readFile(s, f); if (t === null) return fail(`FINDSTR: Cannot open ${f}`); srcs.push({ name: f, text: t }); }
  else srcs.push({ name: '', text: asText(stdin) ?? '' });
  const out: string[] = [];
  for (const { name, text } of srcs) text.split(/\r?\n/).forEach((ln, i, arr) => {
    if (i === arr.length - 1 && ln === '') return;
    const hit = res.some((r) => r.test(ln)) !== o.v;
    if (hit) out.push((files.length > 1 ? name + ':' : '') + (o.n ? i + 1 + ':' : '') + ln);
  });
  return out.length ? ok(out.join('\n') + '\n') : { out: '', code: 1 };
}

function netstat(args: string[], s: Session): Result {
  const f = args.join('').toLowerCase().replace(/[-/]/g, '');
  if (f.includes('b')) return fail('The requested operation requires elevation.');
  const all = f.includes('a'), numeric = f.includes('n'), pid = f.includes('o');
  const names: Record<number, string> = { 135: 'epmap', 139: 'netbios-ssn', 445: 'microsoft-ds', 3389: 'ms-wbt-server', 443: 'https', 80: 'http', 5040: '5040', 5900: '5900' };
  const socks = s.host.socks.filter((k) => all || k.state === 'ESTABLISHED');
  const rows = socks.map((k) => {
    const local = `${numeric ? k.local : k.local === '0.0.0.0' ? '0.0.0.0' : k.local}:${numeric ? k.lport : names[k.lport] ?? k.lport}`;
    const foreign = k.proto === 'udp' ? '*:*' : k.state === 'LISTEN' ? (numeric ? '0.0.0.0:0' : `${s.host.hostname}:0`) : `${k.remote}:${numeric ? k.rport : names[k.rport!] ?? k.rport}`;
    const state = k.proto === 'udp' ? '' : k.state === 'LISTEN' ? 'LISTENING' : 'ESTABLISHED';
    return `  ${k.proto.toUpperCase().padEnd(7)}${local.padEnd(23)}${foreign.padEnd(23)}${state.padEnd(16)}${pid ? k.pid : ''}`.trimEnd();
  });
  return ok(`\nActive Connections\n\n  Proto  Local Address          Foreign Address        State${pid ? '           PID' : ''}\n` + rows.join('\n') + '\n');
}

function tasklist(args: string[], s: Session): Result {
  const svc = args.some((a) => a.toLowerCase() === '/svc');
  let procs = s.host.procs;
  for (let i = 0; i < args.length; i++) if (args[i].toLowerCase() === '/fi') {
    const m = (args[i + 1] ?? '').match(/^\s*(\w+)\s+(eq|ne)\s+(.+?)\s*$/i);
    if (!m) return fail('ERROR: The search filter cannot be recognized.');
    const [, field, op, val] = m; const eq = op.toLowerCase() === 'eq';
    procs = procs.filter((p) => { const v = field.toLowerCase() === 'pid' ? String(p.pid) : field.toLowerCase() === 'imagename' ? p.name.toLowerCase() : ''; return (v === val.toLowerCase()) === eq; });
  }
  if (!procs.length) return ok('INFO: No tasks are running which match the specified criteria.\n');
  if (svc) return ok('\nImage Name                     PID Services\n========================= ======== ============================================\n' + procs.map((p) => `${p.name.padEnd(25)} ${String(p.pid).padStart(8)} ${p.services ?? 'N/A'}`).join('\n') + '\n');
  return ok('\nImage Name                     PID Session Name        Session#    Mem Usage\n========================= ======== ================ =========== ============\n' +
    procs.map((p) => `${p.name.slice(0, 25).padEnd(25)} ${String(p.pid).padStart(8)} ${(p.session ?? 'Services').padEnd(16)} ${String(p.session === 'Console' ? 1 : 0).padStart(11)} ${(p.rssKB.toLocaleString('en-US') + ' K').padStart(12)}`).join('\n') + '\n');
}

function systeminfo(s: Session): Result {
  const h = s.host; const kv = (k: string, v: string) => `${(k + ':').padEnd(27)}${v}`;
  return ok('\n' + [
    kv('Host Name', h.hostname.toUpperCase()), kv('OS Name', h.osName), kv('OS Version', h.osVersion), kv('OS Manufacturer', 'Microsoft Corporation'),
    kv('OS Configuration', 'Member Workstation'), kv('OS Build Type', 'Multiprocessor Free'), kv('Registered Owner', 'Lab Trainee'), kv('Registered Organization', 'CTM Training Lab'),
    kv('Original Install Date', '10/26/2026, 1:15:40 PM'), kv('System Boot Time', h.bootTime), kv('System Manufacturer', 'VMware, Inc.'), kv('System Model', 'VMware20,1'),
    kv('System Type', 'x64-based PC'), kv('Processor(s)', '2 Processor(s) Installed.'), kv('Total Physical Memory', '8,191 MB'), kv('Available Physical Memory', '4,302 MB'),
    kv('Domain', h.dnsSuffix), kv('Logon Server', '\\\\DC-01'), kv('Hotfix(s)', '3 Hotfix(s) Installed.'), kv('Network Card(s)', '1 NIC(s) Installed.'),
    `${''.padEnd(27)}[01]: ${h.nicDesc}`, `${''.padEnd(27)}      IP address(es)`, `${''.padEnd(27)}      [01]: ${h.ip}`,
  ].join('\n') + '\n');
}

function ipconfig(args: string[], s: Session): Result {
  const h = s.host; const all = args.some((a) => a.toLowerCase() === '/all');
  const kv = (k: string, v: string) => `   ${IPC_LABEL[k]}: ${v}`;
  if (!all) return ok(`\nWindows IP Configuration\n\n\nEthernet adapter ${h.nic}:\n\n${kv('Connection-specific DNS Suffix', h.dnsSuffix)}\n${kv('IPv4 Address', h.ip)}\n${kv('Subnet Mask', '255.255.255.0')}\n${kv('Default Gateway', h.gateway)}\n`);
  return ok([ '', 'Windows IP Configuration', '', kv('Host Name', h.hostname), kv('Primary Dns Suffix', h.dnsSuffix), '', `Ethernet adapter ${h.nic}:`, '',
    kv('Description', h.nicDesc ?? 'Ethernet'), kv('Physical Address', h.mac), kv('DHCP Enabled', 'Yes'), kv('IPv4 Address', `${h.ip}(Preferred)`),
    kv('Subnet Mask', '255.255.255.0'), kv('Default Gateway', h.gateway), kv('DHCP Server', h.dns), kv('DNS Servers', h.dns) ].join('\n') + '\n');
}
/** ipconfig's dotted labels, exactly as Windows prints them. */
const IPC_LABEL: Record<string, string> = {
  'Host Name': 'Host Name . . . . . . . . . . . . ', 'Primary Dns Suffix': 'Primary Dns Suffix  . . . . . . . ',
  'Description': 'Description . . . . . . . . . . . ', 'Physical Address': 'Physical Address. . . . . . . . . ',
  'DHCP Enabled': 'DHCP Enabled. . . . . . . . . . . ', 'IPv4 Address': 'IPv4 Address. . . . . . . . . . . ',
  'Subnet Mask': 'Subnet Mask . . . . . . . . . . . ', 'Default Gateway': 'Default Gateway . . . . . . . . . ',
  'DHCP Server': 'DHCP Server . . . . . . . . . . . ', 'DNS Servers': 'DNS Servers . . . . . . . . . . . ',
  'Connection-specific DNS Suffix': 'Connection-specific DNS Suffix  . ',
};

function dir(args: string[], s: Session): Result {
  const target = args.find((a) => !a.startsWith('-')) ?? '.';
  const abs = resolvePath(s, target);
  const ents = listDir(s, abs);
  if (!ents) return fail(`Get-ChildItem : Cannot find path '${abs}' because it does not exist.`);
  const rows = ents.map((e) => `${e.dir ? 'd-----' : '-a----'}         11/4/2026   9:00 AM ${e.dir ? ''.padStart(14) : String(e.size).padStart(14)} ${e.name}`);
  return ok(`\n    Directory: ${abs.replace(/\\$/, '')}\n\nMode                 LastWriteTime         Length Name\n----                 -------------         ------ ----\n${rows.join('\n')}\n\n`);
}

function notRecognized(name: string, tip?: string): Result {
  return fail(`${name} : The term '${name}' is not recognized as the name of a cmdlet, function, script file, or operable program. Check the spelling of the name, or if a path was included, verify that the path is correct and try again.` + (tip ? `\n(Lab tip: on Windows use  ${tip})` : ''));
}

export const WINDOWS_TIPS: Record<string, string> = {
  ls: '', grep: 'findstr  or  Select-String', awk: 'Select-String, or use the Ubuntu terminal', 'ip': 'ipconfig', ss: 'netstat -ano', uname: 'systeminfo',
  hostnamectl: 'systeminfo', who: 'query user', last: 'query user', head: 'Select-Object -First 5', tail: 'Get-Content <file> -Tail 5', wc: 'Measure-Object',
  sort: '', uniq: 'Sort-Object -Unique', sudo: 'an "Run as administrator" window (not needed in this lab)', python3: 'the Ubuntu terminal for Python scripts', traceroute: 'tracert', dig: 'nslookup',
};

export const windows: Record<string, CommandFn> = {
  ipconfig: (a, _i, s) => ipconfig(a, s),
  netstat: (a, _i, s) => netstat(a, s),
  tasklist: (a, _i, s) => tasklist(a, s),
  systeminfo: (_a, _i, s) => systeminfo(s),
  query: (a, _i, s) => (a[0]?.toLowerCase() === 'user' ? windows.quser([], null, s) : fail('Invalid parameter(s)\nQUERY { USER | SESSION | PROCESS }')),
  quser: (_a, _i, s) => ok(` USERNAME              SESSIONNAME        ID  STATE   IDLE TIME  LOGON TIME\n>${s.host.user.padEnd(22)}console             1  Active      none   ${s.host.logonTime}\n`),
  whoami: (_a, _i, s) => ok(`${s.host.dnsSuffix.split('.')[0]}\\${s.host.user}\n`),
  hostname: (_a, _i, s) => ok(s.host.hostname + '\n'),
  findstr: (a, i, s) => findstr(a, i, s),
  'select-string': (a, i, s) => {
    let pat = ''; const files: string[] = [];
    for (let k = 0; k < a.length; k++) { const x = a[k].toLowerCase(); if (x === '-pattern') pat = a[++k]; else if (x === '-path') files.push(a[++k]); else if (!pat) pat = a[k]; else files.push(a[k]); }
    const re = new RegExp(pat, 'i'); const out: string[] = [];
    if (files.length) for (const f of files) { const t = readFile(s, f); if (t === null) return fail(`Select-String : Cannot find path '${resolvePath(s, f)}' because it does not exist.`); t.split('\n').forEach((l, n) => re.test(l) && out.push(`${f}:${n + 1}:${l}`)); }
    else (asText(i) ?? '').split('\n').forEach((l) => re.test(l) && out.push(l));
    return ok(out.length ? '\n' + out.join('\n') + '\n\n' : '');
  },
  'get-content': (a, _i, s) => {
    const f = a.find((x) => !x.startsWith('-')); if (!f) return fail('Get-Content : Missing an argument for parameter \'Path\'.');
    const t = readFile(s, f); if (t === null || isDir(s, f)) return fail(`Get-Content : Cannot find path '${resolvePath(s, f)}' because it does not exist.`);
    const ti = a.findIndex((x) => /^-tail$|^-last$/i.test(x)), hi = a.findIndex((x) => /^-head$|^-totalcount$|^-first$/i.test(x));
    const ls = t.replace(/\n$/, '').split('\n');
    const sel = ti >= 0 ? ls.slice(-parseInt(a[ti + 1], 10)) : hi >= 0 ? ls.slice(0, parseInt(a[hi + 1], 10)) : ls;
    return ok(sel.join('\n') + '\n');
  },
  type: (a, _i, s) => { const t = a[0] ? readFile(s, a[0]) : null; return t === null ? fail('The system cannot find the file specified.') : ok(t.endsWith('\n') ? t : t + '\n'); },
  'get-childitem': (a, _i, s) => dir(a, s),
  'set-location': (a, _i, s) => { const abs = resolvePath(s, a[0] ?? s.host.home); if (!isDir(s, abs)) return fail(`Set-Location : Cannot find path '${abs}' because it does not exist.`); s.cwd = abs; return ok(''); },
  'get-location': (_a, _i, s) => ok(`\nPath\n----\n${s.cwd}\n\n`),
  'clear-host': () => ({ out: '', clear: true }),
  'write-output': (a) => ok(a.join(' ') + '\n'),
  'get-date': () => ok('\nThursday, November 5, 2026 9:30:12 AM\n\n'),
  'get-process': (a, _i, s) => {
    let st = procObjects(s);
    const name = a.find((x) => !x.startsWith('-'));
    if (name) { st = { ...st, objs: st.objs.filter((o) => compare(o.Name, '-like', name)) }; if (!st.objs.length) return fail(`Get-Process : Cannot find a process with the name "${name}". Verify the process name and call the cmdlet again.`); }
    return ok(st);
  },
  'get-nettcpconnection': (a, _i, s) => {
    const si = a.findIndex((x) => x.toLowerCase() === '-state'); const want = si >= 0 ? a[si + 1].toLowerCase() : '';
    const objs: Obj[] = s.host.socks.filter((k) => k.proto === 'tcp').filter((k) => !want || (want === 'listen' ? k.state === 'LISTEN' : k.state === 'ESTABLISHED'))
      .map((k) => ({ LocalAddress: k.local, LocalPort: k.lport, RemoteAddress: k.remote ?? '0.0.0.0', RemotePort: k.rport ?? 0, State: k.state === 'LISTEN' ? 'Listen' : 'Established', OwningProcess: k.pid }));
    return ok({ objs, cols: ['LocalAddress', 'LocalPort', 'RemoteAddress', 'RemotePort', 'State', 'OwningProcess'] });
  },
  'sort-object': (a, i) => {
    if (i === null || typeof i === 'string') { const ls = (i ?? '').replace(/\n$/, '').split('\n'); ls.sort(); if (a.some((x) => /^-desc/i.test(x))) ls.reverse(); return ok(ls.join('\n') + '\n'); }
    const desc = a.some((x) => /^-desc/i.test(x)); const unique = a.some((x) => /^-uniq/i.test(x));
    const p = a.filter((x) => !x.startsWith('-')).map((x) => x.split(',')).flat()[0];
    const k = p ? key(i.objs, i.cols, p) : i.cols[0];
    const numish = (v: unknown) => isNum(v) || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
    let objs = [...i.objs].sort((x, y) => { const a1 = x[k], b1 = y[k]; const c = numish(a1) && numish(b1) ? Number(a1) - Number(b1) : String(a1).localeCompare(String(b1)); return desc ? -c : c; });
    if (unique) objs = objs.filter((o, n) => n === 0 || o[k] !== objs[n - 1][k]);
    return ok({ objs, cols: i.cols });
  },
  'select-object': (a, i) => {
    let first: number | null = null, last: number | null = null; const props: string[] = [];
    for (let k = 0; k < a.length; k++) { const x = a[k].toLowerCase(); if (x === '-first') first = parseInt(a[++k], 10); else if (x === '-last') last = parseInt(a[++k], 10); else if (x === '-property') props.push(...a[++k].split(',')); else props.push(...a[k].split(',')); }
    const clean = props.map((p) => p.trim()).filter(Boolean);
    if (i === null || typeof i === 'string') { let ls = (i ?? '').replace(/\n$/, '').split('\n'); if (first !== null) ls = ls.slice(0, first); if (last !== null) ls = ls.slice(-last); return ok(ls.join('\n') + '\n'); }
    let objs = i.objs; if (first !== null) objs = objs.slice(0, first); if (last !== null) objs = objs.slice(-last);
    const cols = clean.length ? clean.map((c) => key(i.objs, i.cols, c)) : i.cols;
    return ok({ objs: objs.map((o) => Object.fromEntries(cols.map((c) => [c, o[c] ?? '']))), cols, view: i.view && clean.length === 0 ? i.view : undefined });
  },
  'where-object': (a, i) => {
    if (i === null || typeof i === 'string') return fail('Where-Object : this lab supports Where-Object on objects, e.g. Get-Process | Where-Object CPU -gt 10');
    let p: string, op: string, v: string;
    const block = a.join(' ').match(/\{\s*\$_\.(\w+)\s+(-\w+)\s+['"]?([^'"}]*?)['"]?\s*\}/);
    if (block) [, p, op, v] = block; else if (a.length >= 3) [p, op, v] = a; else return fail('Where-Object : expected  Where-Object { $_.CPU -gt 10 }');
    const k = key(i.objs, i.cols, p);
    return ok({ ...i, objs: i.objs.filter((o) => compare(o[k], op, v)) });
  },
  'format-table': (a, i) => {
    if (i === null || typeof i === 'string') return ok(i ?? '');
    // Format-Table a, b, c shows only those columns (in that order), like PowerShell; -AutoSize/-Wrap are accepted and ignored
    const props = a.filter((x) => !x.startsWith('-')).flatMap((x) => x.split(',')).map((x) => x.trim()).filter((x) => x && x !== '*');
    return ok({ ...i, cols: props.length ? props.map((p) => key(i.objs, i.cols, p)) : i.cols, view: 'table' });
  },
  'format-list': (a, i) => {
    if (i === null || typeof i === 'string') return ok(i ?? '');
    const props = a.filter((x) => !x.startsWith('-')).flatMap((x) => x.split(',')).filter((x) => x && x !== '*');
    const all = Object.keys(i.objs[0] ?? {});
    const cols = props.length ? props.map((p) => key(i.objs, i.cols, p)) : a.includes('*') ? all : i.cols;
    return ok({ ...i, cols, view: 'list' });
  },
  'measure-object': (_a, i) => { const n = i === null ? 0 : typeof i === 'string' ? i.replace(/\n$/, '').split('\n').filter(Boolean).length : i.objs.length; return ok(`\nCount    : ${n}\nAverage  :\nSum      :\nMaximum  :\nMinimum  :\nProperty :\n\n`); },
  ping: (a, _i, s) => {
    const target = a.filter((x) => !x.startsWith('-') && !/^\d+$/.test(x)).pop(); if (!target) return fail('Usage: ping target_name');
    const ip = resolveName(target, s.host); if (!ip) return fail(`Ping request could not find host ${target}. Please check the name and try again.`);
    if (!labReachable(s.host, ip)) return ok(`\nPinging ${target} [${ip}] with 32 bytes of data:\nGeneral failure.\nGeneral failure.\nGeneral failure.\nGeneral failure.\n\nPing statistics for ${ip}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),\n(Lab tip: this training lab has no internet access. Try the gateway ${s.host.gateway}.)\n`);
    const r = [1, 2, 3, 4].map((k) => Math.max(1, Math.round(rtt(ip, k))));
    return ok(`\nPinging ${target}${target === ip ? '' : ` [${ip}]`} with 32 bytes of data:\n${r.map((t) => `Reply from ${ip}: bytes=32 time${t <= 1 ? '<1' : '=' + t}ms TTL=${ip === s.host.ip ? 128 : 127}`).join('\n')}\n\nPing statistics for ${ip}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = ${Math.min(...r)}ms, Maximum = ${Math.max(...r)}ms, Average = ${Math.round(r.reduce((x, y) => x + y) / 4)}ms\n`);
  },
  tracert: (a, _i, s) => {
    const target = a.filter((x) => !x.startsWith('-')).pop(); const ip = target ? resolveName(target, s.host) : null;
    if (!target || !ip) return fail(`Unable to resolve target system name ${target ?? ''}.`);
    const hops = [s.host.gateway, ...(labReachable(s.host, ip) && ip !== s.host.gateway ? [ip] : [])];
    const lines = hops.map((h, k) => `  ${k + 1}    <1 ms    <1 ms    <1 ms  ${h}`);
    if (!labReachable(s.host, ip)) lines.push('  2     *        *        *     Request timed out.', '(Lab tip: traffic stops at the lab gateway; there is no internet in this lab.)');
    return ok(`\nTracing route to ${target} [${ip}]\nover a maximum of 30 hops:\n\n${lines.join('\n')}\n\nTrace complete.\n`);
  },
  nslookup: (a, _i, s) => {
    const name = a.find((x) => !x.startsWith('-')); if (!name) return fail('Usage: nslookup <name>');
    const ip = resolveName(name, s.host);
    return ip ? ok(`Server:  DC-01.${s.host.dnsSuffix}\nAddress:  ${s.host.dns}\n\nName:    ${name}\nAddress:  ${ip}\n\n`) : fail(`Server:  DC-01.${s.host.dnsSuffix}\nAddress:  ${s.host.dns}\n\n*** DC-01.${s.host.dnsSuffix} can't find ${name}: Non-existent domain`);
  },
  python: () => fail('Python was not found; run without arguments to install from the Microsoft Store.\n(Lab tip: run Python scripts in the Ubuntu terminal with python3)'),
  python3: () => windows.python([], null, null as unknown as Session),
  notepad: () => fail('Notepad is not available in this lab. Use  type <file>  or  Get-Content <file>.'),
  'get-help': () => ({ out: '' }), // replaced by the runner's help
};

export const WIN_ALIASES: Record<string, string> = {
  ls: 'get-childitem', dir: 'get-childitem', gci: 'get-childitem', cd: 'set-location', chdir: 'set-location', sl: 'set-location', pwd: 'get-location', gl: 'get-location',
  cls: 'clear-host', clear: 'clear-host', echo: 'write-output', cat: 'get-content', gc: 'get-content', more: 'type', ps: 'get-process', gps: 'get-process',
  sort: 'sort-object', select: 'select-object', where: 'where-object', '?': 'where-object', ft: 'format-table', fl: 'format-list', ipcsv: 'import-csv', group: 'group-object', gsv: 'get-service', sls: 'select-string', measure: 'measure-object',
  'ipconfig.exe': 'ipconfig', 'netstat.exe': 'netstat', 'tasklist.exe': 'tasklist', 'findstr.exe': 'findstr', 'quser.exe': 'quser', 'whoami.exe': 'whoami', help: 'get-help',
};

export { notRecognized };
