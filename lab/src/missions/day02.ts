// Day 2 scenario pack: practice versions of Demo Videos 1–3 and Activities 2.1–2.4.
import type { Mission, ScenarioPack, Worksheet } from './types';
import { LOG_COUNTER } from '../shell/pyports';
import { DAY2_ASSETS } from '../hosts/files';

const has = (v: string | undefined, ...needles: (string | RegExp)[]) => !!v && needles.some((n) => (typeof n === 'string' ? v.toLowerCase().includes(n.toLowerCase()) : n.test(v)));
const filled = (v?: string) => !!v && v.trim().length > 0;

// ---------------------------------------------------------------- practice missions (demo hosts)
const practice1: Mission = {
  id: 'd2-demo1', day: 2, kind: 'practice', title: 'Practice: Demo 1 · Monitoring Commands', subtitle: 'Repeat Video 1 on the demo workstation and VM', minutes: 15,
  video: 'Day02_Demo1_Monitoring_Commands.mp4', hosts: ['demo-win', 'demo-linux'],
  intro: 'Type the same commands you saw in Video 1. Your screen should match the video. Use the Windows tab first, then the Ubuntu tab.',
  steps: [
    { id: 'ipconfig', host: 'demo-win', text: 'Show the full network configuration of WKS-TRN-07.', try: 'ipconfig /all', why: 'IPv4 Address 10.10.20.57 is private; the default gateway is 10.10.20.1.', match: [/^ipconfig(\.exe)?\s+\/all/i] },
    { id: 'netstat', host: 'demo-win', text: 'List the ports that are LISTENING, with their process IDs.', try: 'netstat -ano | findstr LISTENING', why: 'Port 3389 (Remote Desktop) is listening, owned by PID 1180.', match: [/netstat\s+-\w*o\w*.*\|\s*(findstr|select-string|sls)\s+.*listen/i] },
    { id: 'tasklist', host: 'demo-win', text: 'Find which service PID 1180 is running.', try: 'tasklist /svc /fi "PID eq 1180"', why: 'svchost.exe is hosting TermService: Remote Desktop is enabled.', match: [/tasklist.*\/fi\s+.*pid\s+eq\s+1180/i] },
    { id: 'getprocess', host: 'demo-win', text: 'Show the top 5 processes by CPU in PowerShell.', try: 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, Id, CPU', why: 'MsMpEng is Microsoft Defender, so the antivirus is running.', match: [/(get-process|gps|ps)\s*\|\s*(sort-object|sort)\s+cpu.*desc/i] },
    { id: 'systeminfo', host: 'demo-win', text: 'Show the OS name, version and boot time.', try: 'systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"System Boot Time"', why: 'Windows 11 Enterprise, build 22631.', match: [/^systeminfo/i] },
    { id: 'quser', host: 'demo-win', text: 'Check who is logged in.', try: 'query user', why: 'trainee07 is logged in at the console.', match: [/^(query\s+user|quser)/i] },
    { id: 'ipa', host: 'demo-linux', text: 'Switch to the Ubuntu tab. Show the IP address.', try: 'ip a', why: 'enp0s3 has 10.10.20.80/24. Ignore lo (loopback).', match: [/^ip\s+a(d(d(r)?)?)?\b/] },
    { id: 'iproute', host: 'demo-linux', text: 'Show the default gateway.', try: 'ip route | grep default', why: 'Same gateway as the workstation: same LAN.', match: [/^ip\s+r(o(u(te?)?)?)?\b/] },
    { id: 'ss', host: 'demo-linux', text: 'List listening ports WITHOUT sudo.', try: 'ss -tunap | grep LISTEN', why: 'The process column is empty: normal users cannot see root processes.', match: [/^ss\s+-\w*\s*(\|.*listen)?/i] },
    { id: 'sudoss', host: 'demo-linux', text: 'Run it again WITH sudo.', try: 'sudo ss -tunap | grep LISTEN', why: 'The service name is inside `users:(("…"))` at the end of each line: 22 = sshd, 80 = apache2, 53 = systemd-resolve (local DNS). No tasklist step needed on Linux.', match: [/^sudo\s+ss\s+-\w*p/] },
    { id: 'ps', host: 'demo-linux', text: 'Show the busiest processes.', try: 'ps aux --sort=-%cpu | head -5', why: 'apache2 runs as www-data, which is normal for a web server.', match: [/^ps\s+(aux|-ef)/] },
    { id: 'hostnamectl', host: 'demo-linux', text: 'Show the OS and kernel version.', try: 'hostnamectl', why: 'Ubuntu 24.04.1 LTS, kernel 6.8.0-48.', match: [/^(hostnamectl|uname\s+-a)/] },
    { id: 'last', host: 'demo-linux', text: 'Check who is logged in now and recently.', try: 'last -n 3', why: 'trainee logged in from 10.10.20.57, the Windows workstation.', match: [/^(last|who)\b/] },
  ],
};

const practice2: Mission = {
  id: 'd2-demo2', day: 2, kind: 'practice', title: 'Practice: Demo 2 · Web Log Investigation', subtitle: 'Repeat Video 2 on demo_access.log', minutes: 15,
  video: 'Day02_Demo2_Web_Log_Investigation.mp4', hosts: ['demo-linux'],
  intro: 'You are in ~/demo on the Ubuntu VM. Follow the same method as Video 2: count, group by IP, follow the status codes, read the user agents.',
  steps: [
    { id: 'wc', host: 'demo-linux', text: 'How many requests are in the log?', try: 'wc -l demo_access.log', why: '17 lines = 17 requests.', match: [/^wc\s+-l\s+.*demo_access\.log/] },
    { id: 'head', host: 'demo-linux', text: 'Look at the first 3 lines (the normal baseline).', try: 'head -n 3 demo_access.log', why: 'Normal browsers, normal pages, status 200.', match: [/^head\b.*demo_access\.log/] },
    { id: 'count', host: 'demo-linux', text: 'Count requests per IP, busiest first.', try: "awk '{print $1}' demo_access.log | sort | uniq -c | sort -rn", why: '198.51.100.140 has 8 requests: the top talker.', match: [/uniq\s+-c/] },
    { id: 'grepip', host: 'demo-linux', text: 'Show everything the top talker did.', try: 'grep 198.51.100.140 demo_access.log', why: 'Six 401s in six seconds, then 302 and dashboard 200: brute force that SUCCEEDED.', match: [/^grep\s+.*198\.51\.100\.140/] },
    { id: 'zgrab', host: 'demo-linux', text: 'Find the scanner by its user agent.', try: 'grep -i zgrab demo_access.log', why: 'All 404: probing for files that do not exist. Failed, but record the IP.', match: [/^grep\s+.*zgrab/i] },
    { id: 'xss', host: 'demo-linux', text: 'Find the script-injection attempt.', try: "grep -i 'script' demo_access.log", why: '403 = blocked by the web application firewall.', match: [/^grep\s+.*script/i] },
  ],
};

const practice3: Mission = {
  id: 'd2-demo3', day: 2, kind: 'practice', title: 'Practice: Demo 3 · Read Before You Run', subtitle: 'Repeat Video 3 with failed_login_counter.py', minutes: 10,
  video: 'Day02_Demo3_Read_Before_You_Run.mp4', hosts: ['demo-linux'],
  intro: 'Read the script first and answer the three questions in your head: what does it READ, CHANGE, CONNECT to? Only then run it.',
  steps: [
    { id: 'read', host: 'demo-linux', text: 'Read the script WITHOUT running it.', try: 'cat -n failed_login_counter.py', why: 'Line 19: open(sys.argv[1]) reads only the file you name. Imports: only sys and collections.', match: [/^(cat|less|more|head|tail)\b.*failed_login_counter\.py/] },
    { id: 'imports', host: 'demo-linux', text: 'Double-check: does it import anything that can connect out?', try: 'grep -n import failed_login_counter.py', why: 'No socket, requests or urllib: it connects nowhere.', match: [/^grep\b.*(import|socket|requests|http).*failed_login_counter\.py/] },
    { id: 'run', host: 'demo-linux', text: 'Now run it on the demo auth log.', try: 'python3 failed_login_counter.py auth_demo.log', why: '203.0.113.45 failed 7 times with many user names: brute force.', match: [/^python3\s+.*failed_login_counter\.py\s+\S+/] },
    { id: 'check57', host: 'demo-linux', text: 'Check the one failure from 10.10.20.57.', try: 'grep 10.10.20.57 auth_demo.log', why: 'One typo, then Accepted: a normal user.', match: [/^grep\s+.*10\.10\.20\.57/] },
  ],
};

// ---------------------------------------------------------------- Activity 2.1
const ROWS21 = [
  { id: 'ip', label: 'IP address' }, { id: 'gw', label: 'Default gateway' }, { id: 'ports', label: 'Number of listening TCP ports' },
  { id: 'procs', label: '3 running processes' }, { id: 'os', label: 'OS version' }, { id: 'user', label: 'Logged-in user' },
];
const CMD_OK: Record<string, [RegExp, RegExp]> = {
  ip: [/ipconfig/i, /\bip\s+a|ifconfig|hostname\s+-I/], gw: [/ipconfig|route\s+print/i, /ip\s+r(oute)?|route\s+-n/],
  ports: [/netstat|get-nettcpconnection/i, /\bss\b|netstat/], procs: [/tasklist|get-process|\bps\b|gps/i, /\bps\b|top/],
  os: [/systeminfo|winver|ver\b/i, /hostnamectl|uname|os-release|lsb_release/], user: [/query\s+user|quser|whoami/i, /\bwho\b|whoami|last|\bw\b/],
};
const ws21: Worksheet = {
  id: 'ws-2.1', title: 'Activity 2.1 · Command table',
  intro: 'Run the commands on YOUR hosts (WKS-LAB and ubuntu-lab tabs) and record what you find. Pin the outputs as evidence.',
  tables: [
    { id: 't', title: 'Windows · your WKS-LAB workstation', columns: [{ id: 'wc', label: 'Command used' }, { id: 'wr', label: 'Result' }], rows: ROWS21 },
    { id: 't', title: 'Linux · your ubuntu-lab VM', columns: [{ id: 'lc', label: 'Command used' }, { id: 'lr', label: 'Result' }], rows: ROWS21 },
  ],
  fields: [{ id: 'analysis', label: 'Analysis: Which listening ports did you find on each host? Which service do they belong to? Is any of them unexpected?', kind: 'area', wide: true }],
  grade(v, { facts, hosts }) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    for (const row of ROWS21) {
      if (filled(v[`t.${row.id}.wc`])) r[`t.${row.id}.wc`] = { ok: CMD_OK[row.id][0].test(v[`t.${row.id}.wc`]), hint: 'Which Windows command shows this? See slide 5.' };
      if (filled(v[`t.${row.id}.lc`])) r[`t.${row.id}.lc`] = { ok: CMD_OK[row.id][1].test(v[`t.${row.id}.lc`]), hint: 'Which Linux command shows this? See slide 5.' };
    }
    const procOk = (txt: string | undefined, os: 'seat-win' | 'seat-linux') => {
      const names = (txt ?? '').split(/[,;\n]+/).map((x) => x.trim().toLowerCase().replace(/\.exe$/, '')).filter(Boolean);
      const known = hosts[os].procs.map((p) => p.name.toLowerCase().replace(/\.exe$/, ''));
      return names.length >= 3 && names.slice(0, 3).every((n) => known.some((k) => k === n || k.startsWith(n)));
    };
    const W = facts.win, L = facts.linux;
    const set = (k: string, ok: boolean, hint: string) => { if (filled(v[k])) r[k] = { ok, hint }; };
    set('t.ip.wr', has(v['t.ip.wr'], W.ip), 'Look for "IPv4 Address" in ipconfig.');
    set('t.ip.lr', has(v['t.ip.lr'], L.ip), 'Look for "inet" on enp0s3 (not lo).');
    set('t.gw.wr', has(v['t.gw.wr'], W.gateway), 'Look for "Default Gateway".');
    set('t.gw.lr', has(v['t.gw.lr'], L.gateway), 'Look for "default via" in ip route.');
    set('t.ports.wr', (v['t.ports.wr'] ?? '').match(/\d+/)?.[0] === String(W.listening), 'Count the TCP lines that say LISTENING.');
    set('t.ports.lr', (v['t.ports.lr'] ?? '').match(/\d+/)?.[0] === String(L.listening), 'Count the tcp LISTEN lines in ss.');
    set('t.procs.wr', procOk(v['t.procs.wr'], 'seat-win'), 'Write 3 image names from tasklist, separated by commas.');
    set('t.procs.lr', procOk(v['t.procs.lr'], 'seat-linux'), 'Write 3 process names from ps aux, separated by commas.');
    set('t.os.wr', has(v['t.os.wr'], W.build, W.os.replace('Microsoft ', '')), 'Use the "OS Name" / "OS Version" lines.');
    set('t.os.lr', has(v['t.os.lr'], L.os.match(/\d+\.\d+/)![0]), 'Use "Operating System" from hostnamectl.');
    set('t.user.wr', has(v['t.user.wr'], W.user), 'Use query user.');
    set('t.user.lr', has(v['t.user.lr'], L.user), 'Use who.');
    if (filled(v.analysis)) r.analysis = { ok: has(v.analysis, String(W.unexpected.port)) && has(v.analysis, String(L.unexpected.port)), hint: 'Each of your hosts has one listening port that deserves a closer look. Did you name both, and the service behind each? (Ubuntu: the service is the name inside users:(("…")) in sudo ss -tunap.)' };
    return r;
  },
};
const act21: Mission = {
  id: 'd2-act2.1', day: 2, kind: 'activity', title: 'Activity 2.1 · Windows and Linux Command Lab', subtitle: 'Individual, hands-on · 90 min', minutes: 90, hosts: ['seat-win', 'seat-linux'],
  intro: 'These are YOUR lab hosts. Their values are different from the demo and from your classmates. Collect the six facts on BOTH hosts.',
  steps: [
    { id: 'w-ip', host: 'seat-win', text: 'Windows: IP address and default gateway.', try: 'ipconfig', match: [/^ipconfig/i] },
    { id: 'w-ports', host: 'seat-win', text: 'Windows: listening ports and their PIDs.', try: 'netstat -ano | findstr LISTENING', match: [/^netstat/i, /get-nettcpconnection/i] },
    { id: 'w-procs', host: 'seat-win', text: 'Windows: running processes (and which process owns any port you are unsure about).', try: 'tasklist /svc', match: [/^tasklist|^get-process|^gps|^ps\b/i] },
    { id: 'w-os', host: 'seat-win', text: 'Windows: OS version.', try: 'systeminfo', match: [/^systeminfo/i] },
    { id: 'w-user', host: 'seat-win', text: 'Windows: logged-in user.', try: 'query user', match: [/^(query\s+user|quser|whoami)/i] },
    { id: 'l-ip', host: 'seat-linux', text: 'Linux: IP address and default gateway.', try: 'ip a   then   ip route', match: [/^ip\s+(a|r)/] },
    { id: 'l-ports', host: 'seat-linux', text: 'Linux: listening ports with process names (remember sudo). The service name is inside `users:(("…"))` at the end of each line, so unlike Windows (netstat, then tasklist) no second command is needed. Unknown name? `ps aux | grep` followed by the name shows its full command line.', try: 'sudo ss -tunap | grep LISTEN', match: [/^sudo\s+ss/] },
    { id: 'l-procs', host: 'seat-linux', text: 'Linux: running processes.', try: 'ps aux', match: [/^ps\b/] },
    { id: 'l-os', host: 'seat-linux', text: 'Linux: OS version.', try: 'hostnamectl', match: [/^(hostnamectl|uname|cat\s+\/etc\/os-release)/] },
    { id: 'l-user', host: 'seat-linux', text: 'Linux: logged-in user.', try: 'who', match: [/^(who|w|last|whoami)\b/] },
  ],
  worksheet: ws21,
};

// ---------------------------------------------------------------- Activity 2.2
const ws22: Worksheet = {
  id: 'ws-2.2', title: 'Activity 2.2 · Zones and port forwarding rules',
  intro: 'Read ~/assets/lab_network_topology.txt. Identify the zones, then judge each forwarding rule.',
  tables: [
    { id: 'z', title: 'Zones', columns: [{ id: 'zone', label: 'Zone' }, { id: 'range', label: 'Network range' }, { id: 'dev', label: 'Devices' }], rows: [{ id: '1' }, { id: '2' }, { id: '3' }] },
    { id: 'r', title: 'Port forwarding rules', columns: [{ id: 'v', label: 'Acceptable / Risky', kind: 'select', options: ['', 'Acceptable', 'Risky'] }, { id: 'why', label: 'Reason' }], rows: [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: `Rule ${n}` })) },
  ],
  grade(v) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    const zones = ['1', '2', '3'].map((i) => ({ i, z: v[`z.${i}.zone`] ?? '', rg: v[`z.${i}.range`] ?? '', d: v[`z.${i}.dev`] ?? '' }));
    for (const z of zones) {
      if (!filled(z.z) && !filled(z.rg)) continue;
      const isDmz = /dmz/i.test(z.z), isLan = /lan|internal/i.test(z.z), isWan = /wan|internet|outside|external/i.test(z.z);
      const ok = (isDmz && z.rg.includes('172.16.10.0/24')) || (isLan && z.rg.includes('10.10.0.0/16')) || (isWan && /203\.0\.113/.test(z.rg + z.d));
      r[`z.${z.i}.range`] = { ok, hint: 'Match each zone with the range written beside it in the topology file.' };
    }
    const want: Record<string, string> = { '1': 'Acceptable', '2': 'Acceptable', '3': 'Acceptable', '4': 'Risky', '5': 'Risky' };
    for (const n of Object.keys(want)) {
      if (filled(v[`r.${n}.v`])) r[`r.${n}.v`] = { ok: v[`r.${n}.v`] === want[n], hint: 'Ask: what service is exposed to the whole internet, and should it be?' };
      if ((n === '4' || n === '5') && filled(v[`r.${n}.why`])) r[`r.${n}.why`] = { ok: has(v[`r.${n}.why`], 'internet', 'expos', 'public', 'outside', 'attack'), hint: 'Mention the exposure to the internet.' };
    }
    return r;
  },
};
const act22: Mission = {
  id: 'd2-act2.2', day: 2, kind: 'activity', title: 'Activity 2.2 · Reading a Network Topology', subtitle: 'Pair · 45 min', minutes: 45, hosts: ['seat-linux'],
  intro: 'Open the topology file on your Ubuntu VM. Discuss with your partner, but each of you records your own worksheet.',
  steps: [
    { id: 'open', host: 'seat-linux', text: 'Open the topology file.', try: 'cat ~/assets/lab_network_topology.txt', match: [/^(cat|less|more)\b.*lab_network_topology/] },
    { id: 'rules', host: 'seat-linux', text: 'Show only the forwarding rules (lines with an arrow).', try: "grep -- '->' ~/assets/lab_network_topology.txt", match: [/^grep\b.*(->|rule|forward).*topology/i] },
  ],
  worksheet: ws22,
};

// ---------------------------------------------------------------- Activity 2.3
const SUSP: Record<string, { status: string; succeeded: 'Yes' | 'No' }> = {
  '198.51.100.23': { status: '403', succeeded: 'No' },
  '203.0.113.77': { status: '404', succeeded: 'No' },
  '192.0.2.90': { status: '400', succeeded: 'No' },
  '198.51.100.200': { status: '200', succeeded: 'Yes' },
};
const ws23: Worksheet = {
  id: 'ws-2.3', title: 'Activity 2.3 · Suspicious requests',
  intro: 'One row per suspicious source IP (or per suspicious line). Leave normal traffic out.',
  tables: [{ id: 's', columns: [{ id: 'line', label: 'Line(s)' }, { id: 'ip', label: 'Source IP' }, { id: 'what', label: 'What was attempted' }, { id: 'st', label: 'Status' }, { id: 'ok', label: 'Succeeded?', kind: 'select', options: ['', 'Yes', 'No'] }], rows: [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n) })) }],
  fields: [{ id: 'urgent', label: 'Which finding is the MOST urgent, and why?', kind: 'area', wide: true }],
  grade(v) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    const seen = new Set<string>();
    for (const n of ['1', '2', '3', '4', '5', '6']) {
      const ip = (v[`s.${n}.ip`] ?? '').trim();
      if (!ip) continue;
      const exp = SUSP[ip];
      r[`s.${n}.ip`] = { ok: !!exp, hint: 'Is this IP really suspicious? Check its requests and user agent again.' };
      if (!exp) continue;
      seen.add(ip);
      if (filled(v[`s.${n}.st`])) r[`s.${n}.st`] = { ok: (v[`s.${n}.st`] ?? '').includes(exp.status), hint: 'Read the status code right after the request in quotes.' };
      if (filled(v[`s.${n}.ok`])) r[`s.${n}.ok`] = { ok: v[`s.${n}.ok`] === exp.succeeded, hint: 'Status 200 means it worked; 4xx means it did not.' };
    }
    r._found = { ok: seen.size === Object.keys(SUSP).length, hint: `You have found ${seen.size} of ${Object.keys(SUSP).length} suspicious sources.` };
    if (filled(v.urgent)) r.urgent = { ok: has(v.urgent, '198.51.100.200', 'web shell', 'webshell', 'img_2041'), hint: 'Which attack SUCCEEDED (status 200)?' };
    return r;
  },
};
const act23: Mission = {
  id: 'd2-act2.3', day: 2, kind: 'activity', title: 'Activity 2.3 · Web Access Log Investigation', subtitle: 'Individual · 60 min', minutes: 60, hosts: ['seat-linux'],
  intro: 'Investigate ~/assets/web_access.log with the method from Video 2. Find the SQL injection, the path traversal, the scanner and the web shell.',
  steps: [
    { id: 'open', host: 'seat-linux', text: 'Open the log and read it once.', try: 'cat -n ~/assets/web_access.log', match: [/^(cat|less|more|head)\b.*web_access\.log/] },
    { id: 'count', host: 'seat-linux', text: 'Count requests per IP.', try: "awk '{print $1}' ~/assets/web_access.log | sort | uniq -c | sort -rn", match: [/uniq\s+-c/] },
    { id: 'status', host: 'seat-linux', text: 'Look at the status codes (field 9).', try: "awk '{print $1, $9, $7}' ~/assets/web_access.log", match: [/awk\b.*\$9/] },
    { id: 'agents', host: 'seat-linux', text: 'Search for attack-tool user agents.', try: 'grep -iE "sqlmap|nikto|curl|python" ~/assets/web_access.log', match: [/^grep\b.*(sqlmap|nikto|curl|python)/i] },
  ],
  worksheet: ws23,
};

// ---------------------------------------------------------------- Activity 2.4
const top3 = LOG_COUNTER.run(DAY2_ASSETS['web_access.log']).trim().split('\n').slice(1, 4).map((l) => l.trim().split(/\s+/)[0]);
const ws24: Worksheet = {
  id: 'ws-2.4', title: 'Activity 2.4 · Script analysis',
  intro: 'Answer the three questions BEFORE you run the script. Then run it and record the top 3 IPs.',
  fieldsFirst: true,
  fields: [
    { id: 'reads', label: 'What does the script read?', kind: 'area', wide: true },
    { id: 'changes', label: 'What does it change / connect to?', kind: 'area', wide: true },
  ],
  tables: [{ id: 'top', title: 'Top 3 IP addresses by request count', columns: [{ id: 'ip', label: 'IP address' }, { id: 'codes', label: 'Status codes received' }], rows: [{ id: '1' }, { id: '2' }, { id: '3' }] }],
  grade(v) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    if (filled(v.reads)) r.reads = { ok: has(v.reads, 'argv', 'command line', 'file', 'log'), hint: 'Look at the open(...) line.' };
    if (filled(v.changes)) r.changes = { ok: has(v.changes, /\bno(thing|ne|where|t)?\b/i), hint: 'Look for write, delete, socket, requests or URLs. Are there any?' };
    const entered = ['1', '2', '3'].map((n) => (v[`top.${n}.ip`] ?? '').trim());
    ['1', '2', '3'].forEach((n, i) => { if (entered[i]) r[`top.${n}.ip`] = { ok: top3.includes(entered[i]), hint: 'Run the script and read the first three data rows.' }; });
    return r;
  },
};
const act24: Mission = {
  id: 'd2-act2.4', day: 2, kind: 'activity', title: 'Activity 2.4 · Read and Run a Monitoring Script', subtitle: 'Individual, hands-on · 45 min', minutes: 45, hosts: ['seat-linux'],
  intro: 'Use the three questions from Video 3 on ~/assets/log_counter.py. Read first; run second; then compare with your Activity 2.3 findings.',
  steps: [
    { id: 'read', host: 'seat-linux', text: 'Read log_counter.py WITHOUT running it.', try: 'cat -n ~/assets/log_counter.py', match: [/^(cat|less|more|head)\b.*log_counter\.py/] },
    { id: 'imports', host: 'seat-linux', text: 'Check what it imports.', try: 'grep -n import ~/assets/log_counter.py', match: [/^grep\b.*import.*log_counter/] },
    { id: 'run', host: 'seat-linux', text: 'Run it on the web log.', try: 'cd ~/assets && python3 log_counter.py web_access.log', match: [/python3\s+\S*log_counter\.py\s+\S*web_access\.log/] },
  ],
  worksheet: ws24,
};

export const DAY2: ScenarioPack = { day: 2, title: 'Day 2 · Computing and Network Foundations', missions: [practice1, practice2, practice3, act21, act22, act23, act24] };
