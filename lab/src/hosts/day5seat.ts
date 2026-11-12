// Day 5, Activity 5.4: each seat's own workstation evidence (EDR file events + Documents folder).
// Seat % 3 picks the case: 0 = ransomware red flag, 1 = PE infection red flag, 2 = no red flag (approved software).
// Uses its own random stream, so the Day 2–4 seat values (and their answer key) never change.
import type { Host } from '../shell/types';

export type Day5Kind = 'ransomware' | 'pe' | 'none';
export interface Day5Facts {
  kind: Day5Kind;
  count: number;          // files renamed (ransomware) / executables modified (PE) / approved changes (none)
  first: string;          // time of the first suspicious (or first approved) event, HH:MM:SS
  process: string;        // file name of the responsible process
  ext?: string;           // ransomware: new extension
  note?: string;          // ransomware: ransom note file name
  detection?: string;     // PE: antivirus detection name
}

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
const hms = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');

const DOCS = ['Attendance_Nov', 'Client_List', 'Meeting_Notes', 'Quotation_2026', 'Training_Plan', 'Inventory', 'Sales_Report', 'Leave_Forms', 'Budget_Draft', 'Contacts', 'Project_Status', 'Invoice_Log'];
const EXT = ['.kz7', '.vaultx', '.r4nd', '.enc26', '.lck9'];
const NOTES = ['README_RESTORE_FILES.txt', 'HOW_TO_DECRYPT.txt', 'RECOVER_YOUR_DATA.txt'];
const RPROC = ['updsvc.exe', 'winlogs.exe', 'dllhostx.exe', 'taskmgrs.exe'];
const VIRUS = ['Virus:Win32/Neshta.A', 'Virus:Win32/Sality.AT', 'Virus:Win32/Expiro.gen!F'];
const DROPPER = ['freevpn_setup.exe', 'mediaplayer_setup.exe', 'pdfconvert_setup.exe', 'keygen_tool.exe'];
const TOOLS = ['putty.exe', 'notepadpp_setup.exe', 'zipper.exe', 'vlc_setup.exe', 'wireshark_setup.exe', 'teamviewer_setup.exe', 'python_setup.exe', 'git_setup.exe'];

const HEAD = 'time,host,process,signer,action,path,new_path,detection';
const ext = (n: string) => (/Notes|Plan|Forms|Status/.test(n) ? 'docx' : 'xlsx');

/** Adds C:\Users\<user>\day5\my_edr_events.csv and the Documents folder to the seat workstation. */
export function day5Seat(h: Host, seat: number): Day5Facts {
  const r = rng(seat * 104729 + 55);
  const kind: Day5Kind = (['ransomware', 'pe', 'none'] as const)[seat % 3];
  const u = h.user, home = `C:\\Users\\${u}`, day = '2026-11-05';
  const rows: string[][] = [];
  const add = (sec: number, process: string, signer: string, action: string, path: string, newPath = '', det = '') => rows.push([`${day} ${hms(sec)}`, h.hostname, process, signer, action, path, newPath, det]);
  const files: Record<string, string> = {};
  // routine activity on every seat
  add(8 * 3600 + 1210, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'Microsoft Corporation', 'Create', `${home}\\Downloads\\SOC_Shift_Schedule.pdf`);
  add(8 * 3600 + 1820, 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE', 'Microsoft Corporation', 'Modify', `${home}\\Documents\\Client_List.xlsx`);
  const start = 9 * 3600 + Math.floor(r() * 18) * 60 + Math.floor(r() * 60); // 09:00–09:17
  let facts: Day5Facts;
  const docs = [...DOCS].sort(() => r() - 0.5);
  if (kind === 'ransomware') {
    const n = 6 + Math.floor(r() * 6), e = pick(r, EXT), note = pick(r, NOTES), p = pick(r, RPROC);
    const proc = `${home}\\AppData\\Local\\Temp\\${p}`;
    add(start - 7, `${home}\\Downloads\\Shipping_Notice.pdf.exe`, 'Unsigned', 'ProcessStart', proc);
    docs.slice(0, n).forEach((d, i) => {
      const f = `${home}\\Documents\\${d}.${ext(d)}`;
      add(start + i * 3, proc, 'Unsigned', 'Rename', f, f + e);
      files[f + e] = `[encrypted content - training simulation]\n`;
    });
    add(start + n * 3 + 1, proc, 'Unsigned', 'Create', `${home}\\Documents\\${note}`);
    files[`${home}\\Documents\\${note}`] = `YOUR FILES ARE ENCRYPTED (${e})\n\nThis is a TRAINING SIMULATION in the CTM Virtual Lab. No real files were harmed.\nA real ransom note demands payment. Never pay or contact the attacker:\nfollow SOC-SOP-01 Section C and escalate to the Shift Lead.\n`;
    docs.slice(n).forEach((d) => { files[`${home}\\Documents\\${d}.${ext(d)}`] = 'lab document\n'; });
    facts = { kind, count: n, first: hms(start), process: p, ext: e, note };
  } else if (kind === 'pe') {
    const n = 4 + Math.floor(r() * 5), det = pick(r, VIRUS), drop = pick(r, DROPPER);
    const proc = `${home}\\Downloads\\${drop}`;
    add(start - 20, 'C:\\Windows\\explorer.exe', 'Microsoft Windows', 'ProcessStart', proc);
    [...TOOLS].sort(() => r() - 0.5).slice(0, n).forEach((t, i) => add(start + i * 11, proc, 'Unsigned', 'Modify', `${home}\\Tools\\${t}`));
    add(start + n * 11 + 40, 'C:\\ProgramData\\Microsoft\\Windows Defender\\MsMpEng.exe', 'Microsoft Windows', 'Quarantine', `${home}\\Tools\\${TOOLS[0]}`, '', det);
    DOCS.slice(0, 6).forEach((d) => { files[`${home}\\Documents\\${d}.${ext(d)}`] = 'lab document\n'; });
    facts = { kind, count: n, first: hms(start), process: drop, detection: det };
  } else {
    const n = 5 + Math.floor(r() * 5);
    const bk = 'C:\\Program Files\\SafeCopy\\scbackup.exe';
    docs.slice(0, n).forEach((d, i) => add(start + i * 9, bk, 'SafeCopy Software Inc.', 'Create', `D:\\Backup\\${day}\\${d}.${ext(d)}.scbak`));
    add(start + n * 9 + 30, 'C:\\Windows\\WinSxS\\amd64_tiworker\\TiWorker.exe', 'Microsoft Windows', 'Modify', 'C:\\Windows\\System32\\ntdll.dll');
    DOCS.slice(0, 6).forEach((d) => { files[`${home}\\Documents\\${d}.${ext(d)}`] = 'lab document\n'; });
    facts = { kind, count: n, first: hms(start), process: 'scbackup.exe' };
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  files[`${home}\\day5\\my_edr_events.csv`] = [HEAD, ...rows.map((x) => x.join(','))].join('\n') + '\n';
  h.files = { ...h.files, ...files };
  return facts;
}
