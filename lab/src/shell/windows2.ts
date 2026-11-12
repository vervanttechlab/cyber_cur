// PowerShell cmdlets added for Day 4 (log and security-solution work):
// Import-Csv, Group-Object, Get-WinEvent, Get-MpComputerStatus, Get-MpThreat, Get-MpThreatDetection, Get-Service.
import type { CommandFn, Obj, Result, Session } from './types';
import { readFile, resolvePath } from './vfs';

import { isDir } from './vfs';
import { sha256 } from './sha256';

/** Lab clock: Thursday 2026-11-05, 09:30 + minutes (Day 8 actions happen during the 09:30 shift). */
function labTime(_s: Session, minutes: number): string {
  const t = 9 * 60 + 30 + minutes, h = Math.floor(t / 60) % 24, m = t % 60;
  return `11/5/2026 ${h % 12 || 12}:${String(m).padStart(2, '0')}:00 ${h < 12 ? 'AM' : 'PM'}`;
}
function addEvent(s: Session, id: number, level: 'Information' | 'Warning' | 'Error', message: string, minutes: number) {
  (s.host.winEvents ??= []).push({ log: 'Microsoft-Windows-Windows Defender/Operational', time: labTime(s, minutes), id, level, message, provider: 'Microsoft-Windows-Windows Defender' });
}

const ok = (out: Result['out']): Result => ({ out });
const fail = (err: string, code = 1): Result => ({ out: '', err, code });

/** RFC-4180-ish CSV parser (quoted fields, doubled quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') { q = true; continue; }
    if (c === ',') { row.push(f); f = ''; continue; }
    if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; continue; }
    if (c === '\r') continue;
    f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}

function argAfter(args: string[], name: string): string | undefined {
  const i = args.findIndex((a) => a.toLowerCase() === name.toLowerCase());
  return i >= 0 ? args[i + 1] : undefined;
}

const LOGS: Record<string, string> = {
  security: 'Security', system: 'System', application: 'Application',
  'microsoft-windows-windows defender/operational': 'Microsoft-Windows-Windows Defender/Operational',
};

export const windowsExtra: Record<string, CommandFn> = {
  'import-csv': (a, _i, s) => {
    const f = argAfter(a, '-Path') ?? a.find((x) => !x.startsWith('-'));
    if (!f) return fail("Import-Csv : Missing an argument for parameter 'Path'.");
    const t = readFile(s, f);
    if (t === null) return fail(`Import-Csv : Could not find file '${resolvePath(s, f)}'.`);
    const [head, ...rows] = parseCsv(t);
    const objs: Obj[] = rows.map((r) => Object.fromEntries(head.map((h, k) => [h, r[k] ?? ''])));
    return ok({ objs, cols: head, view: head.length > 4 ? 'list' : 'table' });
  },
  'group-object': (a, i) => {
    if (i === null || typeof i === 'string') return fail('Group-Object : this lab groups objects, e.g. Import-Csv file.csv | Group-Object account');
    const p = a.find((x) => !x.startsWith('-'));
    if (!p) return fail('Group-Object : specify a property, e.g. Group-Object account');
    const keys = Object.keys(i.objs[0] ?? {});
    const k = keys.find((x) => x.toLowerCase() === p.toLowerCase()) ?? p;
    const groups = new Map<string, Obj[]>();
    for (const o of i.objs) { const v = String(o[k] ?? ''); if (!groups.has(v)) groups.set(v, []); groups.get(v)!.push(o); }
    const first = keys[0] ?? k;
    const objs: Obj[] = [...groups.entries()].map(([name, g]) => ({ Count: g.length, Name: name, Group: (`{@{${first}=${g[0][first]}...}` + (g.length > 1 ? ', ...}' : '}')).slice(0, 44) }));
    if (a.some((x) => /^-noel/i.test(x))) return ok({ objs: objs.map(({ Count, Name }) => ({ Count, Name })), cols: ['Count', 'Name'] });
    return ok({ objs, cols: ['Count', 'Name', 'Group'] });
  },
  'get-winevent': (a, _i, s) => {
    const evs = s.host.winEvents ?? [];
    let log = argAfter(a, '-LogName');
    let id: number[] | null = null;
    const fh = argAfter(a, '-FilterHashtable');
    if (fh) {
      const ln = fh.match(/LogName\s*=\s*['"]([^'"]+)['"]/i); if (ln) log = ln[1];
      const idm = fh.match(/\bId\s*=\s*([\d,\s]+)/i); if (idm) id = idm[1].split(',').map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x));
    }
    if (a.some((x) => /^-listlog$/i.test(x))) {
      const counts = Object.values(LOGS).map((l) => ({ LogMode: 'Circular', MaximumSizeInBytes: 20971520, RecordCount: evs.filter((e) => e.log === l).length, LogName: l }));
      return ok({ objs: counts, cols: ['LogMode', 'MaximumSizeInBytes', 'RecordCount', 'LogName'] });
    }
    if (!log) return fail("Get-WinEvent : specify a log, e.g.  Get-WinEvent -LogName Security -MaxEvents 5\n(Lab tip: logs here are Security, System, Application and \"Microsoft-Windows-Windows Defender/Operational\")");
    const name = LOGS[log.toLowerCase()];
    if (!name) return fail(`Get-WinEvent : There is not an event log on the localhost computer that matches "${log}".`);
    if (name === 'Security' && !/^(administrator|trainee)/i.test(s.host.user)) return fail('Get-WinEvent : Attempted to perform an unauthorized operation.');
    // newest first, by real time ("11/5/2026 9:52:00 AM" must sort before "11/5/2026 10:09:00 AM", which string order gets wrong)
    const when = (t: string) => { const m = t.match(/(\d+)\/(\d+)\/(\d+),? (\d+):(\d+)(?::(\d+))? (AM|PM)/); return m ? Date.UTC(+m[3], +m[1] - 1, +m[2], (+m[4] % 12) + (m[7] === 'PM' ? 12 : 0), +m[5], +(m[6] ?? 0)) : 0; };
    let list = evs.filter((e) => e.log === name).slice().sort((x, y) => when(y.time) - when(x.time));
    if (id) list = list.filter((e) => id!.includes(e.id));
    const max = argAfter(a, '-MaxEvents'); if (max) list = list.slice(0, parseInt(max, 10));
    if (!list.length) return fail('Get-WinEvent : No events were found that match the specified selection criteria.');
    const objs: Obj[] = list.map((e) => ({ TimeCreated: e.time, Id: e.id, LevelDisplayName: e.level, Message: e.message, ProviderName: e.provider, LogName: e.log }));
    return ok({ objs, cols: ['TimeCreated', 'Id', 'LevelDisplayName', 'Message'], header: `ProviderName: ${list[0].provider}` });
  },
  'get-mpcomputerstatus': (_a, _i, s) => {
    const d = s.host.defender; if (!d) return fail('Get-MpComputerStatus : Microsoft Defender is not installed on this host.');
    const o: Obj = {
      AMRunningMode: d.realTime ? 'Normal' : 'Passive', AMServiceEnabled: 'True', AntispywareEnabled: 'True', AntivirusEnabled: 'True',
      AntivirusSignatureLastUpdated: d.signatureUpdated, AntivirusSignatureVersion: d.signatureVersion, BehaviorMonitorEnabled: d.realTime ? 'True' : 'False',
      ComputerState: d.threats.length ? 2 : 0, IsTamperProtected: 'True', QuickScanEndTime: d.lastQuickScan, RealTimeProtectionEnabled: d.realTime ? 'True' : 'False',
      AMEngineVersion: d.engineVersion ?? '1.1.24090.11', AMProductVersion: d.platformVersion ?? '4.18.24090.11',
    };
    return ok({ objs: [o], cols: Object.keys(o), view: 'list' });
  },
  'get-mpthreat': (_a, _i, s) => {
    const d = s.host.defender; if (!d) return fail('Get-MpThreat : Microsoft Defender is not installed on this host.');
    const objs: Obj[] = d.threats.map((t) => ({ CategoryID: t.name.startsWith('PUA') ? 27 : 8, DidThreatExecute: 'False', IsActive: 'False', Resources: `{file:_${t.resource}}`, RollupStatus: 33, SeverityID: t.severityId, ThreatID: t.threatId, ThreatName: t.name }));
    return ok({ objs, cols: ['CategoryID', 'DidThreatExecute', 'IsActive', 'Resources', 'RollupStatus', 'SeverityID', 'ThreatID', 'ThreatName'], view: 'list' });
  },
  'get-mpthreatdetection': (_a, _i, s) => {
    const d = s.host.defender; if (!d) return fail('Get-MpThreatDetection : Microsoft Defender is not installed on this host.');
    const objs: Obj[] = d.threats.map((t, k) => ({ ActionSuccess: t.action === 'Failed' ? 'False' : 'True', DetectionID: `{${((t.threatId * 7919 + k) >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(-8)}-6A2B-4C1D-9E0F-${String(t.threatId).padStart(12, '0')}}`, DetectionSourceTypeID: 3, DomainUser: `LAB\\${t.user}`, InitialDetectionTime: t.time, ProcessName: t.process, Resources: `{file:_${t.resource}}`, ThreatID: t.threatId, ThreatStatusID: t.action === 'Blocked' ? 6 : t.action === 'Failed' ? 102 : 3 }));
    return ok({ objs, cols: ['ActionSuccess', 'DetectionID', 'DetectionSourceTypeID', 'DomainUser', 'InitialDetectionTime', 'ProcessName', 'Resources', 'ThreatID', 'ThreatStatusID'], view: 'list' });
  },
  // ---------------- Day 8: manual checking and verification
  'get-filehash': (a, _i, s) => {
    const f = argAfter(a, '-Path') ?? a.find((x, k) => !x.startsWith('-') && !/^-algorithm$/i.test(a[k - 1] ?? ''));
    if (!f) return fail("Get-FileHash : Missing an argument for parameter 'Path'.");
    const alg = (argAfter(a, '-Algorithm') ?? 'SHA256').toUpperCase();
    if (alg !== 'SHA256') return fail(`Get-FileHash : (lab) only SHA256 is available here, not ${alg}.`);
    const text = readFile(s, f);
    if (text === null) return fail(`Get-FileHash : Cannot find path '${resolvePath(s, f)}' because it does not exist.`);
    return ok({ objs: [{ Algorithm: 'SHA256', Hash: sha256(text).toUpperCase(), Path: resolvePath(s, f) }], cols: ['Algorithm', 'Hash', 'Path'] });
  },
  'test-path': (a, _i, s) => {
    const f = argAfter(a, '-Path') ?? a.find((x) => !x.startsWith('-'));
    if (!f) return fail("Test-Path : Missing an argument for parameter 'Path'.");
    return ok(readFile(s, f) !== null || isDir(s, f) ? 'True\n' : 'False\n');
  },
  'update-mpsignature': (_a, _i, s) => {
    const d = s.host.defender; if (!d) return fail('Update-MpSignature : Microsoft Defender is not installed on this host.');
    const latest = s.host.scan?.latestSignature ?? d.signatureVersion;
    const before = d.signatureVersion;
    if (before === latest) return ok(`[lab] Security intelligence is already the latest version (${latest}).\n`);
    d.signatureVersion = latest; d.signatureUpdated = labTime(s, 1);
    addEvent(s, 2000, 'Information', `Microsoft Defender Antivirus security intelligence version updated.\n\n\tCurrent security intelligence Version: ${latest}\n\tPrevious security intelligence Version: ${before}`, 1);
    return ok(`[lab] Security intelligence updated: ${before} -> ${latest}\n`);
  },
  'start-mpscan': (a, _i, s) => {
    const d = s.host.defender; if (!d) return fail('Start-MpScan : Microsoft Defender is not installed on this host.');
    const type = (argAfter(a, '-ScanType') ?? 'QuickScan').toLowerCase();
    if (!['quickscan', 'fullscan'].includes(type)) return fail(`Start-MpScan : Cannot bind parameter 'ScanType'. Use QuickScan or FullScan.`);
    const full = type === 'fullscan', label = full ? 'Full Scan' : 'Quick Scan';
    const st = (s.host.scan ??= { latestSignature: d.signatureVersion, scans: 0 });
    st.scans++;
    const t0 = 2 + st.scans * 20, dur = full ? 17 : 4;
    addEvent(s, 1000, 'Information', `Microsoft Defender Antivirus scan has started.\n\n\tScan Type: Antimalware\n\tScan Parameters: ${label}`, t0);
    const p = st.planted;
    let found = '';
    if (p && !p.found && (full || p.quick) && (!p.needsUpdate || d.signatureVersion === st.latestSignature)) {
      p.found = true;
      const sev = ['Unknown', 'Low', 'Moderate', 'Moderate', 'High', 'Severe'][p.severityId];
      const when = labTime(s, t0 + 2);
      d.threats.push({ threatId: p.threatId, name: p.name, severityId: p.severityId, resource: p.path, process: 'Unknown', user: s.host.user, time: when, action: p.fails ? 'Failed' : 'Quarantined' });
      addEvent(s, 1116, 'Warning', `Microsoft Defender Antivirus has detected malware or other potentially unwanted software.\n\n\tName: ${p.name}\n\tSeverity: ${sev}\n\tPath: file:_${p.path}\n\tDetection Origin: Local machine\n\tDetection Type: Concrete\n\tDetection Source: ${label}`, t0 + 2);
      if (p.fails) addEvent(s, 1118, 'Warning', `Microsoft Defender Antivirus has encountered a non-critical error when taking action on malware or other potentially unwanted software.\n\n\tName: ${p.name}\n\tPath: file:_${p.path}\n\tAction: Quarantine\n\tError Code: 0x80070020\n\tError description: The process cannot access the file because it is being used by another process.`, t0 + 3);
      else {
        addEvent(s, 1117, 'Information', `Microsoft Defender Antivirus has taken action to protect this machine from malware or other potentially unwanted software.\n\n\tName: ${p.name}\n\tPath: file:_${p.path}\n\tAction: Quarantine\n\tAction Status: No additional actions required`, t0 + 3);
        const key = Object.keys(s.host.files).find((k) => k.toLowerCase() === p.path.toLowerCase());
        if (key) delete s.host.files[key];
      }
      found = ` 1 threat detected: ${p.name}.`;
    }
    addEvent(s, 1001, 'Information', `Microsoft Defender Antivirus scan has finished.\n\n\tScan Type: Antimalware\n\tScan Parameters: ${label}\n\tScan Time: 0:${String(dur).padStart(2, '0')}:00`, t0 + dur);
    if (!full) d.lastQuickScan = labTime(s, t0 + dur);
    return ok(`[lab] ${label} finished.${found || ' No threats found.'} Check with Get-MpThreat and the Defender event log.\n`);
  },
  // Day 7: the policy that decides whether Defender can clean or delete a threat (SOC-SOP-03 Section C)
  'get-mppreference': (_a, _i, s) => {
    const d = s.host.defender; if (!d) return fail('Get-MpPreference : Microsoft Defender is not installed on this host.');
    const p = d.prefs ?? { low: 2, moderate: 2, high: 2, severe: 3, exclusions: [] };
    const o: Obj = {
      DisableRealtimeMonitoring: d.realTime ? 'False' : 'True', ExclusionExtension: '', ExclusionPath: p.exclusions.length ? `{${p.exclusions.join(', ')}}` : '',
      HighThreatDefaultAction: p.high, LowThreatDefaultAction: p.low, ModerateThreatDefaultAction: p.moderate, PUAProtection: 1,
      SevereThreatDefaultAction: p.severe, SignatureUpdateInterval: 8, UnknownThreatDefaultAction: 0,
    };
    return ok({ objs: [o], cols: Object.keys(o), view: 'list' });
  },
  'get-service': (a, _i, s) => {
    let svcs = s.host.services ?? [];
    const n = a.find((x) => !x.startsWith('-'));
    if (n) { const re = new RegExp('^' + n.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i'); svcs = svcs.filter((x) => re.test(x.name) || re.test(x.display)); if (!svcs.length) return fail(`Get-Service : Cannot find any service with service name '${n}'.`); }
    return ok({ objs: svcs.map((x) => ({ Status: x.status, Name: x.name, DisplayName: x.display })), cols: ['Status', 'Name', 'DisplayName'] });
  },
};
