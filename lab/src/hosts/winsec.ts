// Windows security data for the lab workstations (Day 4): event logs, Microsoft Defender state, services.
import type { DefenderState, DefenderThreat, Host, WinEvent } from '../shell/types';

const THREATS = [
  (u: string): Omit<DefenderThreat, 'time'> => ({ threatId: 2147519003, name: 'Virus:DOS/EICAR_Test_File', severityId: 5, resource: `C:\\Users\\${u}\\Downloads\\eicar_test.txt`, process: 'C:\\Windows\\explorer.exe', user: u, action: 'Quarantined' }),
  (u: string): Omit<DefenderThreat, 'time'> => ({ threatId: 2147735505, name: 'Trojan:Win32/Wacatac.B!ml', severityId: 5, resource: `C:\\Users\\${u}\\Downloads\\invoice_nov.exe`, process: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', user: u, action: 'Quarantined' }),
  (u: string): Omit<DefenderThreat, 'time'> => ({ threatId: 268173, name: 'PUA:Win32/Presenoker', severityId: 1, resource: `C:\\Users\\${u}\\Downloads\\FreeConverterSetup.exe`, process: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', user: u, action: 'Blocked' }),
  (u: string): Omit<DefenderThreat, 'time'> => ({ threatId: 2147685180, name: 'HackTool:Win32/AutoKMS', severityId: 4, resource: `C:\\Users\\${u}\\Downloads\\Office_Activator\\KMSAuto.exe`, process: 'C:\\Windows\\explorer.exe', user: u, action: 'Quarantined' }),
];
const SEV = ['Unknown', 'Low', 'Moderate', 'Moderate', 'High', 'Severe'];

/** "11/5/2026 7:44 AM" + offset seconds -> "11/5/2026 7:44:12 AM" */
export function winTime(base: string, offsetSec: number): string {
  const m = base.match(/^(\d+\/\d+\/\d+),? (\d+):(\d+)(?::(\d+))? (AM|PM)$/);
  if (!m) return base;
  const t = ((parseInt(m[2], 10) % 12) + (m[5] === 'PM' ? 12 : 0)) * 3600 + parseInt(m[3], 10) * 60 + (m[4] ? parseInt(m[4], 10) : 0) + offsetSec;
  const h24 = Math.floor(t / 3600) % 24, mi = Math.floor((t % 3600) / 60), se = t % 60;
  return `${m[1]} ${h24 % 12 || 12}:${String(mi).padStart(2, '0')}:${String(se).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

export interface WinSecFacts { threat: DefenderThreat | null; logon4624: string }

/** Fill a Windows host with event logs, Defender state and services. threatIdx selects the seat's Defender detection. */
export function windowsSecurity(h: Host, threatIdx: number | null, seed: number): WinSecFacts {
  const u = h.user, host = h.hostname, logon = h.logonTime;
  const SEC = 'Security', DEF = 'Microsoft-Windows-Windows Defender/Operational';
  const ev = (log: string, off: number, id: number, level: WinEvent['level'], message: string): WinEvent => ({
    log, time: winTime(logon, off), id, level, message,
    provider: log === SEC ? 'Microsoft-Windows-Security-Auditing' : log === 'System' ? 'Service Control Manager' : log === 'Application' ? 'Application' : 'Microsoft-Windows-Windows Defender',
  });
  const thOff = 1500 + (seed % 7) * 97;
  const threat = threatIdx === null ? null : { ...THREATS[threatIdx](u), time: winTime(logon, thOff) };
  const events: WinEvent[] = [
    ev(SEC, -240, 4624, 'Information', `An account was successfully logged on.\n\nLogon Information:\n\tLogon Type:\t\t5\nNew Logon:\n\tAccount Name:\t\tSYSTEM\n\tAccount Domain:\t\tNT AUTHORITY`),
    ev(SEC, -12, 4625, 'Information', `An account failed to log on.\n\nAccount For Which Logon Failed:\n\tAccount Name:\t\t${u}\n\tAccount Domain:\t\tLAB\nFailure Information:\n\tFailure Reason:\t\tUnknown user name or bad password.\n\tLogon Type:\t\t2`),
    ev(SEC, 0, 4624, 'Information', `An account was successfully logged on.\n\nLogon Information:\n\tLogon Type:\t\t2\nNew Logon:\n\tAccount Name:\t\t${u}\n\tAccount Domain:\t\tLAB\nNetwork Information:\n\tWorkstation Name:\t${host}`),
    ev(SEC, 31, 4688, 'Information', `A new process has been created.\n\nCreator Subject:\n\tAccount Name:\t\t${u}\nProcess Information:\n\tNew Process Name:\tC:\\Windows\\explorer.exe`),
    ev(SEC, 420, 4688, 'Information', `A new process has been created.\n\nCreator Subject:\n\tAccount Name:\t\t${u}\nProcess Information:\n\tNew Process Name:\tC:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`),
    ev(DEF, 120, 2000, 'Information', 'Microsoft Defender Antivirus security intelligence version updated.\n\n\tCurrent security intelligence Version: 1.421.112.0\n\tPrevious security intelligence Version: 1.421.89.0'),
    ev(DEF, 300, 1000, 'Information', 'Microsoft Defender Antivirus scan has started.\n\n\tScan Type: Antimalware\n\tScan Parameters: Quick Scan'),
    ev(DEF, 540, 1001, 'Information', 'Microsoft Defender Antivirus scan has finished.\n\n\tScan Type: Antimalware\n\tScan Parameters: Quick Scan\n\tScan Time: 0:04:00'),
    ev('System', -300, 7036, 'Information', 'The Microsoft Defender Antivirus Service service entered the running state.'),
    ev('Application', 600, 1000, 'Information', 'Lab application log entry.'),
  ];
  if (threat) {
    events.push(ev(DEF, thOff, 1116, 'Warning', `Microsoft Defender Antivirus has detected malware or other potentially unwanted software.\n\n\tName: ${threat.name}\n\tSeverity: ${SEV[threat.severityId]}\n\tPath: file:_${threat.resource}\n\tDetection Origin: Local machine\n\tUser: LAB\\${u}\n\tProcess Name: ${threat.process}`));
    events.push(ev(DEF, thOff + 2, 1117, 'Information', `Microsoft Defender Antivirus has taken action to protect this machine from malware or other potentially unwanted software.\n\n\tName: ${threat.name}\n\tSeverity: ${SEV[threat.severityId]}\n\tPath: file:_${threat.resource}\n\tAction: ${threat.action}`));
  }
  const defender: DefenderState = { realTime: true, signatureVersion: '1.421.112.0', signatureUpdated: winTime(logon, 120), lastQuickScan: winTime(logon, 540), threats: threat ? [threat] : [] };
  const rdp = h.socks.some((k) => k.lport === 3389 && k.state === 'LISTEN');
  const vnc = h.procs.some((p) => p.name === 'tvnserver.exe');
  const run = (name: string, display: string, on = true) => ({ name, display, status: (on ? 'Running' : 'Stopped') as 'Running' | 'Stopped' });
  const services = [
    run('EventLog', 'Windows Event Log'), run('mpssvc', 'Windows Defender Firewall'), run('Spooler', 'Print Spooler'),
    run('TermService', 'Remote Desktop Services', rdp), ...(vnc ? [run('tvnserver', 'TightVNC Server')] : []),
    run('WazuhSvc', 'Wazuh'), run('WinDefend', 'Microsoft Defender Antivirus Service'),
  ];
  Object.assign(h, { winEvents: events, defender, services });
  return { threat, logon4624: winTime(logon, 0) };
}

export const SEVERITY_NAME = SEV;
