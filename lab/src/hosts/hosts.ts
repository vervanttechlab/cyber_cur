// Lab hosts: the two demo hosts (identical to the Day 2 demo videos) and per-seat activity hosts.
import type { Host, Proc, Sock } from '../shell/types';
import { DAY2_ASSETS, DAY2_DEMO, DAY3_FILES, DAY4_FILES, DAY5_FILES, DAY6_FILES, DAY7_FILES, DAY8_FILES, DAY9_FILES, DAY3_DEMO, DAY4_DEMO, DAY5_DEMO, DAY6_DEMO, DAY7_DEMO, DAY8_DEMO, DAY9_DEMO, linuxSystemFiles } from './files';
import { day9Seat, type Day9Facts } from './day9seat';
import { day8Seat, plant, type Day8Facts } from './day8seat';
import { day7Seat, applyDay7, type Day7Facts } from './day7seat';
import { day6Seat, type Day6Facts } from './day6seat';
import { day5Seat, type Day5Facts } from './day5seat';
import { windowsSecurity, type WinSecFacts } from './winsec';

const put = (files: Record<string, string>, dir: (n: string) => string) => // n may contain a subfolder (samples/x): Windows paths use \
 Object.fromEntries(Object.entries(files).map(([n, c]) => [dir(n), c]));
const winFiles = (user: string) => ({
  ...put(DAY2_ASSETS, (n) => `C:\\Users\\${user}\\assets\\${n}`),
  ...put(DAY3_FILES, (n) => `C:\\Users\\${user}\\day3\\${n}`),
  ...put(DAY4_FILES, (n) => `C:\\Users\\${user}\\day4\\${n}`),
  ...put(DAY5_FILES, (n) => `C:\\Users\\${user}\\day5\\${n}`),
  ...put(DAY6_FILES, (n) => `C:\\Users\\${user}\\day6\\${n}`),
  ...put(DAY7_FILES, (n) => `C:\\Users\\${user}\\day7\\${n}`),
  ...put(DAY8_FILES, (n) => `C:\\Users\\${user}\\day8\\${n.replace(/\//g, '\\')}`),
  ...put(DAY9_FILES, (n) => `C:\\Users\\${user}\\day9\\${n}`),
});
const linFiles = (user: string, demo: boolean) => ({
  ...put(DAY2_ASSETS, (n) => `/home/${user}/assets/${n}`),
  ...(demo ? put(DAY2_DEMO, (n) => `/home/${user}/demo/${n}`) : {}),
  ...(demo ? put(DAY3_DEMO, (n) => `/home/${user}/demo3/${n}`) : {}),
  ...(demo ? put(DAY4_DEMO, (n) => `/home/${user}/demo4/${n}`) : {}),
  ...(demo ? put(DAY5_DEMO, (n) => `/home/${user}/demo5/${n}`) : {}),
  ...(demo ? put(DAY6_DEMO, (n) => `/home/${user}/demo6/${n}`) : {}),
  ...(demo ? put(DAY7_DEMO, (n) => `/home/${user}/demo7/${n}`) : {}),
  ...(demo ? put(DAY8_DEMO, (n) => `/home/${user}/demo8/${n}`) : {}),
  ...(demo ? put(DAY9_DEMO, (n) => `/home/${user}/demo9/${n}`) : {}),
  ...put(DAY3_FILES, (n) => `/home/${user}/day3/${n}`),
  ...put(DAY4_FILES, (n) => `/home/${user}/day4/${n}`),
  ...put(DAY5_FILES, (n) => `/home/${user}/day5/${n}`),
  ...put(DAY6_FILES, (n) => `/home/${user}/day6/${n}`),
  ...put(DAY7_FILES, (n) => `/home/${user}/day7/${n}`),
  ...put(DAY8_FILES, (n) => `/home/${user}/day8/${n}`),
  ...put(DAY9_FILES, (n) => `/home/${user}/day9/${n}`),
});

// ------------------------------------------------------------------ Windows building blocks
function winBase(): Proc[] {
  return [
    { pid: 0, name: 'System Idle Process', user: 'SYSTEM', cpu: 0, mem: 0, rssKB: 8, session: 'Services' },
    { pid: 4, name: 'System', user: 'SYSTEM', cpu: 6.2, mem: 0, rssKB: 140, session: 'Services', handles: 3120 },
    { pid: 112, name: 'Registry', user: 'SYSTEM', cpu: 0.5, mem: 0, rssKB: 61204, session: 'Services', handles: 0 },
    { pid: 452, name: 'smss.exe', user: 'SYSTEM', cpu: 0.1, mem: 0, rssKB: 1180, session: 'Services', handles: 57 },
    { pid: 588, name: 'csrss.exe', user: 'SYSTEM', cpu: 1.4, mem: 0, rssKB: 5420, session: 'Services', handles: 612 },
    { pid: 672, name: 'wininit.exe', user: 'SYSTEM', cpu: 0.2, mem: 0, rssKB: 6830, session: 'Services', handles: 168 },
    { pid: 720, name: 'services.exe', user: 'SYSTEM', cpu: 3.9, mem: 0, rssKB: 10324, session: 'Services', handles: 701 },
    { pid: 748, name: 'lsass.exe', user: 'SYSTEM', cpu: 4.4, mem: 0, rssKB: 21880, session: 'Services', handles: 1490, services: 'KeyIso, SamSs, VaultSvc' },
    { pid: 1012, name: 'svchost.exe', user: 'NETWORK SERVICE', cpu: 2.6, mem: 0, rssKB: 13420, session: 'Services', handles: 1120, services: 'RpcEptMapper, RpcSs' },
    { pid: 1588, name: 'svchost.exe', user: 'LOCAL SERVICE', cpu: 0.3, mem: 0, rssKB: 7104, session: 'Services', handles: 190, services: 'W32Time' },
    { pid: 2290, name: 'wazuh-agent.exe', user: 'SYSTEM', cpu: 3.1, mem: 0, rssKB: 18210, session: 'Services', handles: 402, services: 'WazuhSvc' },
    { pid: 2604, name: 'SecurityHealthService.exe', user: 'SYSTEM', cpu: 0.7, mem: 0, rssKB: 12920, session: 'Services', handles: 380, services: 'SecurityHealthService' },
    { pid: 4720, name: 'winlogon.exe', user: 'SYSTEM', cpu: 0.4, mem: 0, rssKB: 9740, session: 'Console', handles: 270 },
    { pid: 6252, name: 'svchost.exe', user: 'LOCAL SERVICE', cpu: 1.9, mem: 0, rssKB: 11400, session: 'Services', handles: 330, services: 'CDPSvc' },
    { pid: 6610, name: 'powershell.exe', user: 'trainee', cpu: 2.1, mem: 0, rssKB: 71230, session: 'Console', handles: 620 },
    { pid: 6624, name: 'conhost.exe', user: 'trainee', cpu: 0.6, mem: 0, rssKB: 15322, session: 'Console', handles: 250 },
  ];
}

// ------------------------------------------------------------------ demo hosts (match demos.py exactly)
export function demoWindows(): Host {
  const user = 'trainee07';
  const procs: Proc[] = [
    ...winBase(),
    { pid: 1180, name: 'svchost.exe', user: 'NETWORK SERVICE', cpu: 12.77, mem: 0, rssKB: 22840, session: 'Services', handles: 940, services: 'TermService' },
    { pid: 3324, name: 'MsMpEng.exe', user: 'SYSTEM', cpu: 412.53, mem: 0, rssKB: 198420, session: 'Services', handles: 1360, services: 'WinDefend' },
    { pid: 5120, name: 'explorer.exe', user, cpu: 128.09, mem: 0, rssKB: 145332, session: 'Console', handles: 2911 },
    { pid: 7344, name: 'msedge.exe', user, cpu: 96.41, mem: 0, rssKB: 210448, session: 'Console', handles: 1688 },
    { pid: 8012, name: 'OneDrive.exe', user, cpu: 8.3, mem: 0, rssKB: 68320, session: 'Console', handles: 940 },
  ];
  const socks: Sock[] = [
    { proto: 'tcp', local: '0.0.0.0', lport: 135, state: 'LISTEN', pid: 1012 },
    { proto: 'tcp', local: '0.0.0.0', lport: 445, state: 'LISTEN', pid: 4 },
    { proto: 'tcp', local: '0.0.0.0', lport: 3389, state: 'LISTEN', pid: 1180 },
    { proto: 'tcp', local: '0.0.0.0', lport: 5040, state: 'LISTEN', pid: 6252 },
    { proto: 'tcp', local: '0.0.0.0', lport: 49664, state: 'LISTEN', pid: 748 },
    { proto: 'tcp', local: '10.10.20.57', lport: 139, state: 'LISTEN', pid: 4 },
    { proto: 'tcp', local: '10.10.20.57', lport: 49701, remote: '10.10.1.10', rport: 445, state: 'ESTABLISHED', pid: 4 },
    { proto: 'tcp', local: '10.10.20.57', lport: 49733, remote: '10.10.1.50', rport: 1514, state: 'ESTABLISHED', pid: 2290 },
    { proto: 'udp', local: '0.0.0.0', lport: 123, state: 'UNCONN', pid: 1588 },
    { proto: 'udp', local: '0.0.0.0', lport: 5353, state: 'UNCONN', pid: 7344 },
  ];
  const h: Host = {
    id: 'demo-win', os: 'windows', hostname: 'WKS-TRN-07', user, ip: '10.10.20.57', prefix: 24, gateway: '10.10.20.1', dns: '10.10.1.10', dnsSuffix: 'lab.local',
    mac: '00-0C-29-4F-7A-21', nic: 'Ethernet0', nicDesc: 'Intel(R) 82574L Gigabit Network Connection',
    osName: 'Microsoft Windows 11 Enterprise', osVersion: '10.0.22631 N/A Build 22631', bootTime: '11/5/2026, 7:42:18 AM', logonTime: '11/5/2026 7:44 AM',
    procs: procs.map((p) => (p.user === 'trainee' ? { ...p, user } : p)), socks, files: winFiles(user), home: `C:\\Users\\${user}`, startDir: `C:\\Users\\${user}`,
    note: 'Demo workstation from Video 1',
  };
  h.files = { ...h.files, ...put(DAY3_DEMO, (n) => `C:\\Users\\${user}\\demo3\\${n}`), ...put(DAY4_DEMO, (n) => `C:\\Users\\${user}\\demo4\\${n}`), ...put(DAY5_DEMO, (n) => `C:\\Users\\${user}\\demo5\\${n}`), ...put(DAY6_DEMO, (n) => `C:\\Users\\${user}\\demo6\\${n}`), ...put(DAY7_DEMO, (n) => `C:\\Users\\${user}\\demo7\\${n}`), ...put(DAY8_DEMO, (n) => `C:\\Users\\${user}\\demo8\\${n.replace(/\//g, '\\')}`), ...put(DAY9_DEMO, (n) => `C:\\Users\\${user}\\demo9\\${n}`) };
  windowsSecurity(h, 0, 0); // demo workstation: EICAR test file detection (matches demo_alerts.csv D-01)
  // Day 7 Video 3: Falcon running and Wazuh connected, but HighThreatDefaultAction 6 (Allow): Defender cannot clean a High threat
  applyDay7(h, { edr: 'Running', wazuhConnected: true, keepalive: 9 * 60 + 15, high: 6, severe: 3, exclusion: null });
  // Day 8 Video 3: hidden in AppData\Roaming (full scan only), only the latest signatures know it, quarantine succeeds
  plant(h, { path: 'C:\\Users\\trainee07\\AppData\\Roaming\\Updater\\uhelper.exe', name: 'Trojan:Win32/Vigorf.A', threatId: 2147735503, severityId: 5, quick: false, needsUpdate: true, fails: false });
  return h;
}

function linuxBase(user: string, ip: string, from: string): { procs: Proc[]; socks: Sock[] } {
  const procs: Proc[] = [
    { pid: 1, name: 'systemd', user: 'root', cpu: 0.1, mem: 0.6, vszKB: 167748, rssKB: 12904, cmd: '/sbin/init splash', stat: 'Ss', start: '07:42', time: '0:02' },
    { pid: 580, name: 'systemd-network', user: 'systemd-network', cpu: 0, mem: 0.4, vszKB: 19004, rssKB: 8120, cmd: '/usr/lib/systemd/systemd-networkd', stat: 'Ss', start: '07:42', time: '0:00' },
    { pid: 612, name: 'systemd-resolve', user: 'systemd-resolve', cpu: 0, mem: 0.6, vszKB: 21456, rssKB: 12784, cmd: '/usr/lib/systemd/systemd-resolved', stat: 'Ss', start: '07:42', time: '0:00' },
    { pid: 840, name: 'cron', user: 'root', cpu: 0, mem: 0.1, vszKB: 6824, rssKB: 2700, cmd: '/usr/sbin/cron -f -P', stat: 'Ss', start: '07:42', time: '0:00' },
    { pid: 901, name: 'sshd', user: 'root', cpu: 0.3, mem: 0.4, vszKB: 15432, rssKB: 8920, cmd: 'sshd: /usr/sbin/sshd -D', stat: 'Ss', start: '07:42', time: '0:01' },
    { pid: 1047, name: 'apache2', user: 'root', cpu: 0, mem: 0.5, vszKB: 6520, rssKB: 10240, cmd: '/usr/sbin/apache2 -k start', stat: 'Ss', start: '07:43', time: '0:00' },
    { pid: 1052, name: 'apache2', user: 'www-data', cpu: 1.2, mem: 0.9, vszKB: 197184, rssKB: 18232, cmd: '/usr/sbin/apache2 -k start', stat: 'S', start: '07:43', time: '0:03' },
    { pid: 2210, name: 'sshd', user: 'root', cpu: 0, mem: 0.5, vszKB: 17220, rssKB: 10912, cmd: `sshd: ${user} [priv]`, stat: 'Ss', start: '07:58', time: '0:00' },
    { pid: 2214, name: 'sshd', user, cpu: 0, mem: 0.3, vszKB: 17480, rssKB: 6880, cmd: `sshd: ${user}@pts/0`, stat: 'S', start: '07:58', time: '0:00' },
    { pid: 2215, name: 'bash', user, cpu: 0.2, mem: 0.3, vszKB: 11204, rssKB: 5480, cmd: '-bash', tty: 'pts/0', stat: 'Ss', start: '07:58', time: '0:00' },
  ];
  const socks: Sock[] = [
    { proto: 'tcp', local: '127.0.0.53%lo', lport: 53, state: 'LISTEN', pid: 612, fd: 14, sendq: 4096 },
    { proto: 'tcp', local: '0.0.0.0', lport: 22, state: 'LISTEN', pid: 901, fd: 3, sendq: 128 },
    { proto: 'tcp', local: '*', lport: 80, state: 'LISTEN', pid: 1047, fd: 4, sendq: 511 },
    { proto: 'tcp', local: ip, lport: 22, remote: from, rport: 50112, state: 'ESTABLISHED', pid: 2210, fd: 4, sendq: 0 },
    { proto: 'udp', local: '127.0.0.53%lo', lport: 53, state: 'UNCONN', pid: 612, fd: 13, sendq: 0 },
    { proto: 'udp', local: `${ip}%enp0s3`, lport: 68, state: 'UNCONN', pid: 580, fd: 22, sendq: 0 },
  ];
  return { procs, socks };
}

export function demoLinux(): Host {
  const user = 'trainee', ip = '10.10.20.80';
  const { procs, socks } = linuxBase(user, ip, '10.10.20.57');
  return {
    id: 'demo-linux', os: 'linux', hostname: 'ubuntu-lab', user, ip, prefix: 24, gateway: '10.10.20.1', dns: '127.0.0.53', dnsSuffix: 'lab.local',
    mac: '08:00:27:3a:9c:51', nic: 'enp0s3', osName: 'Ubuntu 24.04.1 LTS', osVersion: '24.04.1', kernel: '6.8.0-48-generic',
    bootTime: 'Thu Nov  5 07:42', logonTime: '2026-11-05 07:58', loginFrom: '10.10.20.57',
    lastLog: [
      'trainee  pts/0        10.10.20.57      Thu Nov  5 07:58   still logged in',
      'trainee  pts/0        10.10.20.57      Wed Nov  4 14:15 - 16:02  (01:47)',
      'reboot   system boot  6.8.0-48-generic Thu Nov  5 07:42   still running',
    ],
    procs, socks, files: { ...linFiles(user, true), ...linuxSystemFiles('ubuntu-lab', 'Ubuntu 24.04.1 LTS', user, ip) },
    home: `/home/${user}`, startDir: `/home/${user}/demo`, note: 'Demo VM from Videos 1–3',
  };
}

// ------------------------------------------------------------------ per-seat activity hosts
function rng(seed: number) { let a = seed * 2654435761 >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pad2 = (n: number) => String(n).padStart(2, '0');

export interface SeatUnexpected { port: number; proc: string; pid: number; why: string }
export interface SeatFacts {
  seat: number;
  day4: WinSecFacts;
  day5: Day5Facts;
  day6: Day6Facts;
  day7: Day7Facts;
  day8: Day8Facts;
  day9: Day9Facts;
  win: { hostname: string; ip: string; gateway: string; listening: number; os: string; build: string; user: string; unexpected: SeatUnexpected };
  linux: { hostname: string; ip: string; gateway: string; listening: number; os: string; kernel: string; user: string; unexpected: SeatUnexpected };
}

const WIN_VARIANTS = [
  (pid: number): [Proc, Sock, string] => [{ pid, name: 'svchost.exe', user: 'NETWORK SERVICE', cpu: 5.12, mem: 0, rssKB: 22100, session: 'Services', handles: 910, services: 'TermService' }, { proto: 'tcp', local: '0.0.0.0', lport: 3389, state: 'LISTEN', pid }, 'Remote Desktop (TermService) enabled on a workstation'],
  (pid: number): [Proc, Sock, string] => [{ pid, name: 'tvnserver.exe', user: 'SYSTEM', cpu: 3.48, mem: 0, rssKB: 15610, session: 'Services', handles: 260, services: 'tvnserver' }, { proto: 'tcp', local: '0.0.0.0', lport: 5900, state: 'LISTEN', pid }, 'VNC remote-control server (TightVNC) listening'],
  (pid: number): [Proc, Sock, string] => [{ pid, name: 'svch0st.exe', user: 'trainee', cpu: 7.91, mem: 0, rssKB: 9320, session: 'Console', handles: 140 }, { proto: 'tcp', local: '0.0.0.0', lport: 4444, state: 'LISTEN', pid }, '"svch0st.exe" (zero, not o) imitating svchost, listening on 4444'],
  (pid: number): [Proc, Sock, string] => [{ pid, name: 'python.exe', user: 'trainee', cpu: 1.75, mem: 0, rssKB: 24400, session: 'Console', handles: 210 }, { proto: 'tcp', local: '0.0.0.0', lport: 8080, state: 'LISTEN', pid }, 'Python web server left running on 8080'],
];
const LIN_VARIANTS = [
  (pid: number, user: string): [Proc, Sock, string] => [{ pid, name: 'mysqld', user: 'mysql', cpu: 0.6, mem: 4.8, vszKB: 1795620, rssKB: 389120, cmd: '/usr/sbin/mysqld', stat: 'Ssl', start: '07:43', time: '0:04' }, { proto: 'tcp', local: '0.0.0.0', lport: 3306, state: 'LISTEN', pid, fd: 22, sendq: 151 }, 'MySQL database listening on all interfaces (0.0.0.0:3306)'],
  (pid: number, user: string): [Proc, Sock, string] => [{ pid, name: 'python3', user, cpu: 0.1, mem: 0.8, vszKB: 31520, rssKB: 16240, cmd: 'python3 -m http.server 8000', tty: 'pts/1', stat: 'S+', start: '08:02', time: '0:00' }, { proto: 'tcp', local: '0.0.0.0', lport: 8000, state: 'LISTEN', pid, fd: 3, sendq: 5 }, 'python3 http.server sharing files on 8000'],
  (pid: number): [Proc, Sock, string] => [{ pid, name: 'nc', user: 'www-data', cpu: 0, mem: 0.1, vszKB: 3640, rssKB: 1820, cmd: 'nc -lvnp 4444', stat: 'S', start: '03:12', time: '0:00' }, { proto: 'tcp', local: '0.0.0.0', lport: 4444, state: 'LISTEN', pid, fd: 3, sendq: 1 }, 'netcat listener on 4444 started by www-data at 03:12 (very suspicious)'],
  (pid: number): [Proc, Sock, string] => [{ pid, name: 'vsftpd', user: 'root', cpu: 0, mem: 0.2, vszKB: 9300, rssKB: 4200, cmd: '/usr/sbin/vsftpd /etc/vsftpd.conf', stat: 'Ss', start: '07:42', time: '0:00' }, { proto: 'tcp', local: '0.0.0.0', lport: 21, state: 'LISTEN', pid, fd: 3, sendq: 32 }, 'FTP server (cleartext logins) listening on 21'],
];

export function seatHosts(seat: number): { win: Host; linux: Host; facts: SeatFacts } {
  const r = rng(seat * 7919 + 17);
  const pid = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo));
  const n2 = pad2(seat);
  const wUser = `trainee${n2}`, lUser = `trainee${n2}`;
  const wIp = `10.10.20.${100 + seat}`, lIp = `10.10.20.${150 + seat}`;
  const win11 = seat % 2 === 1;
  const wOs = win11 ? 'Microsoft Windows 11 Enterprise' : 'Microsoft Windows 10 Enterprise';
  const wBuild = win11 ? '10.0.22631 N/A Build 22631' : '10.0.19045 N/A Build 19045';
  const [wvProc, wvSock, wvWhy] = WIN_VARIANTS[seat % 4](pid(3000, 9000));
  const wProcs: Proc[] = [
    ...winBase().map((p) => (p.user === 'trainee' ? { ...p, user: wUser } : p)),
    { pid: pid(3100, 3900), name: 'MsMpEng.exe', user: 'SYSTEM', cpu: Math.round((180 + r() * 300) * 100) / 100, mem: 0, rssKB: 190000 + pid(0, 20000), session: 'Services', handles: 1300, services: 'WinDefend' },
    { pid: pid(4000, 5600), name: 'explorer.exe', user: wUser, cpu: Math.round((40 + r() * 120) * 100) / 100, mem: 0, rssKB: 140000, session: 'Console', handles: 2800 },
    { pid: pid(7000, 7900), name: 'msedge.exe', user: wUser, cpu: Math.round((20 + r() * 80) * 100) / 100, mem: 0, rssKB: 205000, session: 'Console', handles: 1700 },
    { pid: pid(8000, 8900), name: 'Teams.exe', user: wUser, cpu: Math.round((10 + r() * 30) * 100) / 100, mem: 0, rssKB: 160000, session: 'Console', handles: 1200 },
    { ...wvProc, user: wvProc.user === 'trainee' ? wUser : wvProc.user },
  ];
  const wSocks: Sock[] = [
    { proto: 'tcp', local: '0.0.0.0', lport: 135, state: 'LISTEN', pid: 1012 },
    { proto: 'tcp', local: '0.0.0.0', lport: 445, state: 'LISTEN', pid: 4 },
    { proto: 'tcp', local: '0.0.0.0', lport: 5040, state: 'LISTEN', pid: 6252 },
    wvSock,
    { proto: 'tcp', local: '0.0.0.0', lport: 49664, state: 'LISTEN', pid: 748 },
    { proto: 'tcp', local: wIp, lport: 139, state: 'LISTEN', pid: 4 },
    { proto: 'tcp', local: wIp, lport: 49000 + pid(100, 900), remote: '10.10.1.10', rport: 445, state: 'ESTABLISHED', pid: 4 },
    { proto: 'tcp', local: wIp, lport: 49000 + pid(100, 900), remote: '10.10.1.50', rport: 1514, state: 'ESTABLISHED', pid: 2290 },
    { proto: 'udp', local: '0.0.0.0', lport: 123, state: 'UNCONN', pid: 1588 },
  ].sort((a, b) => (a.state === b.state ? (a.local === b.local ? a.lport - b.lport : a.local.localeCompare(b.local)) : a.state === 'LISTEN' ? -1 : 1)) as Sock[];
  const hex = () => Math.floor(r() * 256).toString(16).padStart(2, '0').toUpperCase();
  const win: Host = {
    id: 'seat-win', os: 'windows', hostname: `WKS-LAB-${n2}`, user: wUser, ip: wIp, prefix: 24, gateway: '10.10.20.1', dns: '10.10.1.10', dnsSuffix: 'lab.local',
    mac: `00-0C-29-${hex()}-${hex()}-${hex()}`, nic: 'Ethernet0', nicDesc: 'Intel(R) 82574L Gigabit Network Connection', osName: wOs, osVersion: wBuild,
    bootTime: '11/5/2026, 7:40:02 AM', logonTime: `11/5/2026 7:${pad2(41 + (seat % 15))} AM`, procs: wProcs, socks: wSocks, files: winFiles(wUser),
    home: `C:\\Users\\${wUser}`, startDir: `C:\\Users\\${wUser}`, note: `Your lab workstation (seat ${n2})`,
  };

  const lin22 = seat % 3 === 0;
  const lOs = lin22 ? 'Ubuntu 22.04.5 LTS' : 'Ubuntu 24.04.1 LTS', kernel = lin22 ? '5.15.0-125-generic' : '6.8.0-48-generic';
  const base = linuxBase(lUser, lIp, wIp);
  const [lvProc, lvSock, lvWhy] = LIN_VARIANTS[(seat * 3 + 1) % 4](pid(1100, 2100), lUser);
  const lProcs = [...base.procs, lvProc].sort((a, b) => a.pid - b.pid);
  const lSocks = [...base.socks.slice(0, 3), lvSock, ...base.socks.slice(3)];
  const linuxHost: Host = {
    id: 'seat-linux', os: 'linux', hostname: `ubuntu-lab-${n2}`, user: lUser, ip: lIp, prefix: 24, gateway: '10.10.20.1', dns: '127.0.0.53', dnsSuffix: 'lab.local',
    mac: `08:00:27:${hex().toLowerCase()}:${hex().toLowerCase()}:${hex().toLowerCase()}`, nic: 'enp0s3', osName: lOs, osVersion: lOs.match(/[\d.]+/)![0], kernel,
    bootTime: 'Thu Nov  5 07:42', logonTime: '2026-11-05 07:58', loginFrom: wIp,
    lastLog: [
      `${lUser.padEnd(8)} pts/0        ${wIp.padEnd(16)} Thu Nov  5 07:58   still logged in`,
      `${lUser.padEnd(8)} pts/0        ${wIp.padEnd(16)} Wed Nov  4 13:20 - 16:44  (03:24)`,
      `reboot   system boot  ${kernel.padEnd(16)} Thu Nov  5 07:42   still running`,
    ],
    procs: lProcs, socks: lSocks, files: { ...linFiles(lUser, false), ...linuxSystemFiles(`ubuntu-lab-${n2}`, lOs, lUser, lIp) },
    home: `/home/${lUser}`, startDir: `/home/${lUser}`, note: `Your Ubuntu lab VM (seat ${n2})`,
  };
  const sec = windowsSecurity(win, (seat * 5 + 2) % 4, seat);
  const d5 = day5Seat(win, seat);
  const d6 = day6Seat(win, seat);
  const d7 = day7Seat(win, seat);
  const d8 = day8Seat(win, seat);
  const d9 = day9Seat(win, seat, d8);
  const listenCount = (h: Host) => h.socks.filter((k) => k.proto === 'tcp' && k.state === 'LISTEN').length;
  const facts: SeatFacts = {
    seat,
    day4: sec,
    day5: d5,
    day6: d6,
    day7: d7,
    day8: d8,
    day9: d9,
    win: { hostname: win.hostname, ip: wIp, gateway: win.gateway, listening: listenCount(win), os: wOs, build: wBuild.match(/Build (\d+)/)![1], user: wUser, unexpected: { port: wvSock.lport, proc: wvProc.name, pid: wvProc.pid, why: wvWhy } },
    linux: { hostname: linuxHost.hostname, ip: lIp, gateway: linuxHost.gateway, listening: listenCount(linuxHost), os: lOs, kernel, user: lUser, unexpected: { port: lvSock.lport, proc: lvProc.name, pid: lvProc.pid, why: lvWhy } },
  };
  return { win, linux: linuxHost, facts };
}
