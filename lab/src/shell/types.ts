// Core types for the simulated lab hosts and the mini shell.

export type OS = 'windows' | 'linux';

export interface Proc {
  pid: number;
  name: string;          // image name, e.g. svchost.exe / apache2
  user: string;
  cpu: number;           // Windows: CPU seconds; Linux: %CPU
  mem: number;           // Linux %MEM
  rssKB: number;         // working set / RSS in KB
  vszKB?: number;
  handles?: number;
  cmd?: string;          // Linux full command line
  tty?: string;
  stat?: string;
  start?: string;        // HH:MM
  time?: string;         // M:SS
  services?: string;     // Windows services hosted (tasklist /svc)
  session?: 'Services' | 'Console';
}

export interface Sock {
  proto: 'tcp' | 'udp';
  local: string;         // ip or 0.0.0.0 / * / 127.0.0.53%lo
  lport: number;
  remote?: string;       // for established
  rport?: number;
  state: 'LISTEN' | 'ESTABLISHED' | 'UNCONN';
  pid: number;
  fd?: number;
  recvq?: number;
  sendq?: number;        // Linux listen backlog shown in Send-Q
}

export interface Host {
  id: string;
  os: OS;
  hostname: string;
  user: string;
  ip: string;
  prefix: number;
  gateway: string;
  dns: string;
  dnsSuffix: string;
  mac: string;
  nic: string;           // Ethernet0 / enp0s3
  nicDesc?: string;
  osName: string;        // Microsoft Windows 11 Enterprise / Ubuntu 24.04.1 LTS
  osVersion: string;     // 10.0.22631 N/A Build 22631 / 24.04.1
  kernel?: string;       // 6.8.0-48-generic
  bootTime: string;      // Windows: 11/5/2026, 7:42:18 AM ; Linux: Thu Nov  5 07:42
  logonTime: string;     // Windows: 11/5/2026 7:44 AM ; Linux: 2026-11-05 07:58
  loginFrom?: string;    // Linux: where the trainee session comes from
  lastLog?: string[];    // Linux `last` lines (without wtmp footer)
  procs: Proc[];
  socks: Sock[];
  files: Record<string, string>; // absolute path -> content
  home: string;
  startDir: string;
  note?: string;         // shown in UI: what this host is
  winEvents?: WinEvent[];            // Windows event logs (Get-WinEvent)
  defender?: DefenderState;          // Microsoft Defender (Get-MpComputerStatus / Get-MpThreat*)
  services?: { name: string; display: string; status: 'Running' | 'Stopped' }[];
  scan?: ScanState;                  // Day 8: what Update-MpSignature and Start-MpScan can find on this host
}

export interface WinEvent { log: string; time: string; id: number; level: 'Information' | 'Warning' | 'Error'; provider: string; message: string }
export interface DefenderThreat { threatId: number; name: string; severityId: number; resource: string; process: string; user: string; time: string; action: 'Quarantined' | 'Removed' | 'Blocked' | 'Failed' }
/** Get-MpPreference: default action codes per threat severity (1 Clean, 2 Quarantine, 3 Remove, 6 Allow, 8 User defined, 9 No action, 10 Block). */
export interface DefenderPrefs { low: number; moderate: number; high: number; severe: number; exclusions: string[] }
export interface DefenderState { realTime: boolean; signatureVersion: string; signatureUpdated: string; lastQuickScan: string; threats: DefenderThreat[]; prefs?: DefenderPrefs; engineVersion?: string; platformVersion?: string }

/** Day 8: an infection that only a scan finds. quick = a quick scan reaches its folder; needsUpdate = only the latest signatures know it;
 *  fails = the action fails (file in use). latest = the versions in the vendor bulletin (Update-MpSignature installs them). */
export interface PlantedThreat { path: string; name: string; threatId: number; severityId: number; quick: boolean; needsUpdate: boolean; fails: boolean; found?: boolean }
export interface ScanState { latestSignature: string; planted?: PlantedThreat; scans: number }

export type Obj = Record<string, string | number>;
export interface ObjStream { objs: Obj[]; cols: string[]; view?: 'table' | 'list'; header?: string }
export type Value = string | ObjStream;

export interface Result { out: Value; err?: string; code?: number; clear?: boolean }

export interface Session {
  host: Host;
  cwd: string;
  history: string[];
  sudoWarned?: boolean;
}

export type CommandFn = (args: string[], stdin: Value | null, s: Session) => Result;
