// Ubuntu command set for the simulated lab VM.
import type { CommandFn, Result, Session, Sock, Value } from './types';
import { readFile, resolvePath, isDir, listDir, glob, writeFile } from './vfs';
import * as T from './text';
import { SCRIPTS } from './pyports';
import { labReachable, resolveName, rtt } from './net';
import { sha256 } from './sha256';

const txt = (v: Value | null): string | null => (v === null ? null : typeof v === 'string' ? v : v.objs.map((o) => Object.values(o).join(' ')).join('\n') + '\n');
const ok = (out: string): Result => ({ out });
const fail = (err: string, code = 1): Result => ({ out: '', err, code });
const nl = (s: string) => (s.endsWith('\n') || s === '' ? s : s + '\n');

export interface LinuxCtx { root: boolean }
const ctx: LinuxCtx = { root: false };

function reader(s: Session) {
  return (p: string) => {
    const abs = resolvePath(s, p);
    if (abs.startsWith('/var/log/') && !ctx.root && /btmp|syslog$/.test(abs)) return null;
    return isDir(s, p) ? null : readFile(s, p);
  };
}
function expand(s: Session, args: string[]) { return args.flatMap((a) => (a.startsWith('-') ? [a] : glob(s, a))); }
const wrap = (fn: (a: string[], i: string | null, r: T.Reader) => T.TR, name: string): CommandFn => (args, stdin, s) => {
  const a = expand(s, args);
  for (const f of a.filter((x) => !x.startsWith('-'))) if (isDir(s, f) && name !== 'grep') return fail(`${name}: ${f}: Is a directory`);
  const r = fn(a, txt(stdin), reader(s));
  return { out: r.out, err: r.err, code: r.code };
};

const SERVICE: Record<number, string> = { 22: 'ssh', 53: 'domain', 80: 'http', 443: 'https', 3306: 'mysql', 25: 'smtp', 631: 'ipp' };

function ssLine(k: Sock, numeric: boolean, showProc: boolean, s: Session): string {
  const p = s.host.procs.find((x) => x.pid === k.pid);
  const visible = showProc && p && (ctx.root || p.user === s.host.user);
  const port = (n?: number) => (n === undefined ? '*' : numeric ? String(n) : SERVICE[n] ?? String(n));
  const local = `${k.local}:${port(k.lport)}`;
  const peer = k.state === 'ESTABLISHED' ? `${k.remote}:${port(k.rport)}` : k.local.includes('*') || k.local === '[::]' ? '*:*' : '0.0.0.0:*';
  const state = k.state === 'ESTABLISHED' ? 'ESTAB' : k.state;
  const sendq = k.sendq ?? (k.state === 'LISTEN' ? 128 : 0);
  const proc = visible ? `    users:(("${p!.name}",pid=${k.pid},fd=${k.fd ?? 3}))` : '';
  return `${k.proto.padEnd(6)}${state.padEnd(7)}${String(k.recvq ?? 0).padEnd(7)}${String(sendq).padEnd(7)}${local.padStart(16)}${peer.padStart(18)}${proc}`.trimEnd();
}

export const linux: Record<string, CommandFn> = {
  pwd: (_a, _i, s) => ok(s.cwd + '\n'),
  cd: (a, _i, s) => {
    const target = a[0] ?? '~';
    const abs = resolvePath(s, target);
    if (!isDir(s, abs)) return fail(`bash: cd: ${target}: No such file or directory`);
    s.cwd = abs; return ok('');
  },
  ls: (a, _i, s) => {
    const long = a.some((x) => /^-\w*l/.test(x)); const all = a.some((x) => /^-\w*a/.test(x));
    const targets = expand(s, a.filter((x) => !x.startsWith('-')));
    const out: string[] = [];
    for (const t of targets.length ? targets : ['.']) {
      const ents = listDir(s, t);
      if (!ents) { if (readFile(s, t) !== null) { out.push(t); continue; } return fail(`ls: cannot access '${t}': No such file or directory`, 2); }
      const list = all ? [{ name: '.', dir: true, size: 4096, path: '' }, { name: '..', dir: true, size: 4096, path: '' }, ...ents] : ents;
      if (targets.length > 1) out.push(`${t}:`);
      if (long) {
        out.push(`total ${list.reduce((n, e) => n + Math.ceil(e.size / 4096) * 4, 0)}`);
        for (const e of list) out.push(`${e.dir ? 'drwxr-xr-x' : e.name.endsWith('.py') ? '-rwxr-xr-x' : '-rw-r--r--'} ${e.dir ? 2 : 1} ${s.host.user} ${s.host.user} ${String(e.size).padStart(5)} Nov  4 09:00 ${e.name}`);
      } else out.push(list.map((e) => e.name).join('  '));
    }
    return ok(out.join('\n') + '\n');
  },
  cat: (a, i, s) => {
    const files = expand(s, a.filter((x) => x !== '-n'));
    const number = a.includes('-n');
    if (!files.length) return ok(txt(i) ?? '');
    let out = ''; const errs: string[] = [];
    for (const f of files) {
      if (isDir(s, f)) { errs.push(`cat: ${f}: Is a directory`); continue; }
      const t = reader(s)(f);
      if (t === null) { errs.push(resolvePath(s, f).startsWith('/var/log/') ? `cat: ${f}: Permission denied` : `cat: ${f}: No such file or directory`); continue; }
      out += number ? t.split('\n').filter((_, k, arr) => k < arr.length - 1 || arr[k] !== '').map((l, k) => `${String(k + 1).padStart(6)}\t${l}`).join('\n') + '\n' : nl(t);
    }
    return { out, err: errs.join('\n') || undefined, code: errs.length ? 1 : 0 };
  },
  grep: wrap(T.grep, 'grep'), awk: wrap(T.awk, 'awk'), sort: wrap(T.sort, 'sort'), uniq: wrap(T.uniq, 'uniq'),
  wc: wrap(T.wc, 'wc'), head: wrap(T.head, 'head'), tail: wrap(T.tail, 'tail'), cut: wrap(T.cut, 'cut'),
  echo: (a) => ok(a.join(' ') + '\n'),
  whoami: (_a, _i, s) => ok((ctx.root ? 'root' : s.host.user) + '\n'),
  id: (_a, _i, s) => ok(ctx.root ? 'uid=0(root) gid=0(root) groups=0(root)\n' : `uid=1000(${s.host.user}) gid=1000(${s.host.user}) groups=1000(${s.host.user}),4(adm),27(sudo)\n`),
  hostname: (a, _i, s) => ok((a.includes('-I') ? s.host.ip + ' ' : s.host.hostname) + '\n'),
  uname: (a, _i, s) => {
    const h = s.host, k = h.kernel ?? '6.8.0-48-generic', ver = `#${k.split('-')[1]}-Ubuntu SMP PREEMPT_DYNAMIC`;
    if (a.includes('-a')) return ok(`Linux ${h.hostname} ${k} ${ver} x86_64 x86_64 x86_64 GNU/Linux\n`);
    if (a.includes('-r')) return ok(k + '\n');
    if (a.includes('-n')) return ok(h.hostname + '\n');
    if (a.includes('-m')) return ok('x86_64\n');
    return ok('Linux\n');
  },
  hostnamectl: (_a, _i, s) => ok([
    ` Static hostname: ${s.host.hostname}`, '       Icon name: computer-vm', '         Chassis: vm', '  Virtualization: oracle',
    `Operating System: ${s.host.osName}`, `          Kernel: Linux ${s.host.kernel}`, '    Architecture: x86-64', ' Hardware Vendor: innotek GmbH', '  Hardware Model: VirtualBox',
  ].join('\n') + '\n'),
  ip: (a, _i, s) => {
    const h = s.host, sub = a.find((x) => !x.startsWith('-')) ?? '';
    const bcast = h.ip.split('.').slice(0, 3).join('.') + '.255';
    if (/^a(d(d(r(e(ss?)?)?)?)?)?$/.test(sub)) return ok([
      '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000',
      '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00',
      '    inet 127.0.0.1/8 scope host lo',
      '       valid_lft forever preferred_lft forever',
      `2: ${h.nic}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000`,
      `    link/ether ${h.mac} brd ff:ff:ff:ff:ff:ff`,
      `    inet ${h.ip}/${h.prefix} brd ${bcast} scope global dynamic ${h.nic}`,
      '       valid_lft 85912sec preferred_lft 85912sec',
    ].join('\n') + '\n');
    if (/^r(o(u(te?)?)?)?$/.test(sub)) return ok(`default via ${h.gateway} dev ${h.nic} proto dhcp src ${h.ip} metric 100\n${h.ip.split('.').slice(0, 3).join('.')}.0/${h.prefix} dev ${h.nic} proto kernel scope link src ${h.ip} metric 100\n`);
    if (sub === 'link' || sub === 'l') return ok(`1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 state UNKNOWN\n2: ${h.nic}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\n    link/ether ${h.mac} brd ff:ff:ff:ff:ff:ff\n`);
    return fail('Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\n       ip a      (show addresses)\n       ip route  (show routes)', 255);
  },
  ss: (a, _i, s) => {
    const flags = a.filter((x) => x.startsWith('-')).join('').replace(/-/g, '');
    const t = flags.includes('t'), u = flags.includes('u'), l = flags.includes('l'), all = flags.includes('a');
    const numeric = flags.includes('n'), proc = flags.includes('p');
    let socks = s.host.socks.filter((k) => (!t && !u) || (t && k.proto === 'tcp') || (u && k.proto === 'udp'));
    if (l) socks = socks.filter((k) => k.state !== 'ESTABLISHED');
    else if (!all) socks = socks.filter((k) => k.state === 'ESTABLISHED');
    const head = `Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:Port${proc ? ' Process' : ''}`;
    return ok([head, ...socks.map((k) => ssLine(k, numeric, proc, s))].join('\n') + '\n');
  },
  netstat: () => fail("Command 'netstat' not found, but can be installed with:\nsudo apt install net-tools\n(Lab tip: on modern Ubuntu use  ss -tunap  instead.)", 127),
  ps: (a, _i, s) => {
    const sortArg = a.find((x) => x.startsWith('--sort='))?.slice(7) ?? '';
    let procs = [...s.host.procs];
    const desc = sortArg.startsWith('-'), key = sortArg.replace(/^[-+]/, '');
    if (key) procs.sort((x, y) => { const v = key === '%cpu' ? x.cpu - y.cpu : key === '%mem' ? x.mem - y.mem : x.pid - y.pid; return desc ? -v : v; });
    if (a.some((x) => /^-?e?f$|^-ef$/.test(x)) && !a.includes('aux')) {
      return ok(['UID          PID    PPID  C STIME TTY          TIME CMD', ...procs.map((p) => `${p.user.padEnd(8)} ${String(p.pid).padStart(7)} ${String(p.pid === 1 ? 0 : 1).padStart(7)}  0 ${p.start ?? '07:42'} ${(p.tty ?? '?').padEnd(8)} 00:00:0${Math.min(9, Math.round(p.cpu))} ${p.cmd ?? p.name}`)].join('\n') + '\n');
    }
    const rows = procs.map((p) => `${(p.user.length > 8 ? p.user.slice(0, 7) + '+' : p.user).padEnd(8)}${String(p.pid).padStart(8)}${p.cpu.toFixed(1).padStart(5)}${p.mem.toFixed(1).padStart(5)}${String(p.vszKB ?? 0).padStart(7)}${String(p.rssKB).padStart(6)} ${(p.tty ?? '?').padEnd(8)} ${(p.stat ?? 'S').padEnd(4)} ${(p.start ?? '07:42').padEnd(5)} ${(p.time ?? '0:00').padStart(6)} ${p.cmd ?? p.name}`);
    return ok(['USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND', ...rows].join('\n') + '\n');
  },
  top: () => fail('top: interactive programs are not available in this lab.\n(Lab tip: use  ps aux --sort=-%cpu | head -5)'),
  who: (_a, _i, s) => ok(`${s.host.user.padEnd(8)} pts/0        ${s.host.logonTime} (${s.host.loginFrom})\n`),
  w: (_a, _i, s) => ok(` 09:30:12 up  1:48,  1 user,  load average: 0.08, 0.05, 0.01\nUSER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT\n${s.host.user.padEnd(8)} pts/0    ${(s.host.loginFrom ?? '').padEnd(16)} ${s.host.logonTime.slice(11)}    0.00s  0.05s  0.00s w\n`),
  last: (a, _i, s) => {
    const nIdx = a.indexOf('-n'); const n = nIdx >= 0 ? parseInt(a[nIdx + 1], 10) : /^-\d+$/.test(a[0] ?? '') ? parseInt(a[0].slice(1), 10) : Infinity;
    const ls = (s.host.lastLog ?? []).slice(0, n);
    return ok(ls.join('\n') + '\n\nwtmp begins Mon Nov  2 08:00:01 2026\n');
  },
  date: () => ok('Thu Nov  5 09:30:12 AM PST 2026\n'),
  uptime: () => ok(' 09:30:12 up  1:48,  1 user,  load average: 0.08, 0.05, 0.01\n'),
  ping: (a, _i, s) => {
    const target = a.filter((x) => !x.startsWith('-') && !/^\d+$/.test(x)).pop();
    if (!target) return fail('ping: usage error: Destination address required', 1);
    const ip = resolveName(target, s.host);
    if (!ip) return fail(`ping: ${target}: Temporary failure in name resolution`, 2);
    if (!labReachable(s.host, ip)) return fail(`ping: connect: Network is unreachable\n(Lab tip: this training lab has no internet access. Try the gateway ${s.host.gateway}.)`, 2);
    const c = 4; const out = [`PING ${target} (${ip}) 56(84) bytes of data.`];
    for (let i = 1; i <= c; i++) out.push(`64 bytes from ${ip}: icmp_seq=${i} ttl=${ip === s.host.ip ? 64 : 63} time=${rtt(ip, i)} ms`);
    out.push('', `--- ${target} ping statistics ---`, `${c} packets transmitted, ${c} received, 0% packet loss, time 3005ms`);
    return ok(out.join('\n') + '\n');
  },
  traceroute: (a, _i, s) => {
    const target = a.filter((x) => !x.startsWith('-')).pop();
    const ip = target ? resolveName(target, s.host) : null;
    if (!target || !ip) return fail(`traceroute: unknown host ${target ?? ''}`, 1);
    const hops = [s.host.gateway, ...(labReachable(s.host, ip) && ip !== s.host.gateway ? [ip] : [])];
    const out = [`traceroute to ${target} (${ip}), 30 hops max, 60 byte packets`, ...hops.map((h, i) => ` ${i + 1}  ${h} (${h})  ${rtt(h, 1)} ms  ${rtt(h, 2)} ms  ${rtt(h, 3)} ms`)];
    if (!labReachable(s.host, ip)) out.push(' 2  * * *', ' 3  * * *', '(Lab tip: traffic stops at the lab gateway; there is no internet in this lab.)');
    return ok(out.join('\n') + '\n');
  },
  dig: (a, _i, s) => {
    const name = a.find((x) => !x.startsWith('-') && !x.startsWith('@')) ?? '.';
    const ip = resolveName(name, s.host);
    return ok([`; <<>> DiG 9.18.28-0ubuntu0.24.04.1-Ubuntu <<>> ${name}`, ';; global options: +cmd', ';; Got answer:', `;; ->>HEADER<<- opcode: QUERY, status: ${ip ? 'NOERROR' : 'NXDOMAIN'}, id: 41822`, '', ';; QUESTION SECTION:', `;${name}.\t\t\tIN\tA`, ...(ip ? ['', ';; ANSWER SECTION:', `${name}.\t\t300\tIN\tA\t${ip}`] : []), '', `;; SERVER: ${s.host.dns}#53(${s.host.dns}) (UDP)`, ';; WHEN: Thu Nov 05 09:30:12 PST 2026'].join('\n') + '\n');
  },
  nslookup: (a, _i, s) => {
    const name = a.find((x) => !x.startsWith('-'));
    if (!name) return fail('Usage: nslookup <name>');
    const ip = resolveName(name, s.host);
    return ip ? ok(`Server:\t\t${s.host.dns}\nAddress:\t${s.host.dns}#53\n\nNon-authoritative answer:\nName:\t${name}\nAddress: ${ip}\n`) : fail(`Server:\t\t${s.host.dns}\nAddress:\t${s.host.dns}#53\n\n** server can't find ${name}: NXDOMAIN`);
  },
  python: () => fail("Command 'python' not found, did you mean:\n  command 'python3' from deb python3\n(Lab tip: type python3)", 127),
  python3: (a, _i, s) => {
    if (a[0] === '--version' || a[0] === '-V') return ok('Python 3.12.3\n');
    if (!a.length) return fail('Interactive Python is not available in this lab.\n(Lab tip: run a script, e.g.  python3 log_counter.py web_access.log)');
    const file = a[0], abs = resolvePath(s, file);
    const code = readFile(s, file);
    if (code === null) return fail(`python3: can't open file '${abs}': [Errno 2] No such file or directory`, 2);
    const script = SCRIPTS.find((x) => abs.endsWith('/' + x.name));
    if (!script) return fail(`(Lab: only the provided lab scripts can be run here.)`);
    if (a.length !== 2) return { out: script.usage + '\n', code: 1 };
    const data = readFile(s, a[1]);
    if (data === null) return fail(`Traceback (most recent call last):\n  File "${abs}", line 20, in <module>\n    with open(sys.argv[1], encoding="utf-8") as log:\n         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\nFileNotFoundError: [Errno 2] No such file or directory: '${a[1]}'`);
    return ok(script.run(data));
  },
  less: (a, i, s) => linux.cat(a, i, s), more: (a, i, s) => linux.cat(a, i, s),
  nano: () => fail('Text editors are not available in this lab. Use  cat  or  less  to read a file.'),
  vi: () => fail('Text editors are not available in this lab. Use  cat  or  less  to read a file.'),
  vim: () => fail('Text editors are not available in this lab. Use  cat  or  less  to read a file.'),
  man: (a) => fail(`No manual entry for ${a[0] ?? ''} in this lab. Try the Missions panel hints, or  ${a[0] ?? 'command'} --help.`),
  // Day 8: verify a sample's hash (output format identical to GNU coreutils)
  sha256sum: (a, i, s) => {
    const files = a.filter((x) => !x.startsWith('-'));
    if (!files.length) { const t = txt(i); return t === null ? fail('sha256sum: (lab) give a file name, e.g. sha256sum ~/day8/samples/*') : ok(`${sha256(t)}  -\n`); }
    let out = ''; const errs: string[] = [];
    for (const f of expand(s, files)) {
      if (isDir(s, f)) { errs.push(`sha256sum: ${f}: Is a directory`); continue; }
      const t = readFile(s, f);
      if (t === null) errs.push(`sha256sum: ${f}: No such file or directory`); else out += `${sha256(t)}  ${f}\n`;
    }
    return { out, err: errs.join('\n') || undefined, code: errs.length ? 1 : 0 };
  },
  touch: (a, _i, s) => { for (const f of a) if (readFile(s, f) === null) writeFile(s, f, ''); return ok(''); },
  rm: () => fail('rm: lab files are protected. Nothing was deleted.'),
  sudo: () => ok(''), // handled in the runner (needs to re-dispatch)
  clear: () => ({ out: '', clear: true }),
};

export function withRoot<T>(fn: () => T): T { const prev = ctx.root; ctx.root = true; try { return fn(); } finally { ctx.root = prev; } }

export const LINUX_TIPS: Record<string, string> = {
  ipconfig: 'ip a', netstat: 'ss -tunap', tasklist: 'ps aux', systeminfo: 'hostnamectl  or  uname -a', findstr: 'grep', type: 'cat',
  dir: 'ls -l', cls: 'clear', 'get-process': 'ps aux', 'query': 'who', 'tracert': 'traceroute', 'get-content': 'cat',
};
