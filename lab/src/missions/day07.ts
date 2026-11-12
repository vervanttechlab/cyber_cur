// Day 7 scenario pack: Security Solution Status Check (CS-ICT251101 Element 2, PC 2.1–2.3). Practice missions + Activities 7.1–7.4.
// Answers follow SOC-SOP-03 (~/day7/soc_status_sop.txt) and the files written by _build/day07_data.py.
import type { Mission, ScenarioPack, Worksheet } from './types';

type G = Record<string, { ok: boolean; hint?: string }>;
const filled = (v?: string) => !!v && v.trim().length > 0;
const has = (v: string | undefined, ...re: RegExp[]) => !!v && re.some((r) => r.test(v));
const num = (v?: string) => { const m = (v ?? '').match(/\d+/); return m ? Number(m[0]) : NaN; };
const YN = ['', 'Yes', 'No'];
const WAZUH = String.raw`Get-Content "C:\Program Files (x86)\ossec-agent\ossec.log" -Tail 4`;

// ---------------------------------------------------------------- practice missions (repeat the demo videos)
const p71: Mission = {
  id: 'd7-demo1', day: 7, kind: 'practice', title: 'Practice: Demo 1 · Is It Installed?', subtitle: 'Repeat Video 1 with the school coverage report', minutes: 10,
  video: 'Day07_Demo1_Is_It_Installed.mp4', hosts: ['demo-linux'],
  intro: 'Compare the list of endpoints with the console\'s coverage report and find the gaps, like Video 1.',
  steps: [
    { id: 'rules', host: 'demo-linux', text: 'Which solutions does each host type need? (Section A)', try: 'grep -A4 "Host type" ~/day7/soc_status_sop.txt', match: [/^grep\b.*Host type.*soc_status_sop/] },
    { id: 'list', host: 'demo-linux', text: 'The endpoints the school owns.', try: 'cut -d, -f1,3,4 ~/demo7/demo_endpoints.csv', match: [/^(cut|cat)\b.*demo_endpoints/] },
    { id: 'report', host: 'demo-linux', text: 'What the security console reports.', try: 'cat ~/demo7/demo_coverage.csv', why: 'MKT-PC-04 is not in the report at all: never enrolled. LAB-PC-15 has no EDR, but Tier 3 test PCs do not need it.', match: [/^(cat|grep|cut)\b.*demo_coverage/] },
    { id: 'gaps', host: 'demo-linux', text: 'Every "Not installed".', try: 'grep "Not installed" ~/demo7/demo_coverage.csv', match: [/^grep\b.*Not installed.*demo_coverage/] },
  ],
};
const p72: Mission = {
  id: 'd7-demo2', day: 7, kind: 'practice', title: 'Practice: Demo 2 · Is It Operational?', subtitle: 'Repeat Video 2 with demo_agent_health.csv', minutes: 10,
  video: 'Day07_Demo2_Is_It_Operational.mp4', hosts: ['demo-linux', 'demo-win'],
  intro: 'Check every agent against the six operational checks B1–B6, like Video 2.',
  steps: [
    { id: 'rules', host: 'demo-linux', text: 'The six operational checks (Section B).', try: 'grep "^B[1-6]" ~/day7/soc_status_sop.txt', match: [/^grep\b.*B.*soc_status_sop/] },
    { id: 'health', host: 'demo-win', text: 'The health export of the school agents.', try: String.raw`Import-Csv demo7\demo_agent_health.csv | Format-Table check_id, host, solution, service, realtime, last_checkin, content_date`, why: 'DH-2: signatures from 10-30 (B4). DH-3: Falcon Stopped (B1) and silent since 06:40 (B3).', match: [/import-csv\b.*demo_agent_health/i] },
  ],
};
const p73: Mission = {
  id: 'd7-demo3', day: 7, kind: 'practice', title: 'Practice: Demo 3 · Check a Workstation and Its Clean-up Policy', subtitle: 'Repeat Video 3 on WKS-TRN-07', minutes: 10,
  video: 'Day07_Demo3_Can_It_Clean.mp4', hosts: ['demo-win'],
  intro: 'Check that every required solution is installed and working on the demo workstation, then read whether Defender is allowed to clean, like Video 3.',
  steps: [
    { id: 'svc', host: 'demo-win', text: 'Are the security services installed and running?', try: 'Get-Service', match: [/^\s*(get-service|gsv)\b/i] },
    { id: 'status', host: 'demo-win', text: 'Is Defender operational?', try: 'Get-MpComputerStatus | Format-List RealTimeProtectionEnabled, IsTamperProtected, AntivirusSignatureLastUpdated', match: [/get-mpcomputerstatus/i] },
    { id: 'wazuh', host: 'demo-win', text: 'Is the Wazuh agent still talking to the SIEM?', try: WAZUH, match: [/(get-content|cat|gc|type)\b.*ossec\.log/i] },
    { id: 'prefs', host: 'demo-win', text: 'What will Defender DO when it finds a threat?', try: 'Get-MpPreference | Format-List HighThreatDefaultAction, SevereThreatDefaultAction, ExclusionPath', why: 'HighThreatDefaultAction 6 = Allow: a High threat would be detected but NOT cleaned (rule C1). Report it.', match: [/get-mppreference/i] },
  ],
};

// ---------------------------------------------------------------- 7.1 Is it installed? (coverage)
export const GAP = ['', 'No gap', 'Gap: AV missing', 'Gap: EDR missing', 'Gap: SIEM agent missing', 'Gap: not enrolled'];
export const KEY71: Record<string, string> = {
  'DC-01': GAP[1], 'FS-01': GAP[1], 'FS-02': GAP[3], 'CORE-DB-01': GAP[4], 'WEB-01': GAP[1], 'SCAN-01': GAP[1], 'PAY-PC-02': GAP[1], 'FIN-PC-03': GAP[1],
  'HR-LT-07': GAP[1], 'ENG-PC-11': GAP[3], 'QA-PC-05': GAP[1], 'MKT-PC-09': GAP[1], 'LOAN-PC-08': GAP[1], 'LOAN-PC-03': GAP[5], 'IT-PC-01': GAP[1], 'ADM-PC-02': GAP[1], 'DEV-PC-02': GAP[1],
};
const ws71: Worksheet = {
  id: 'ws-7.1', title: 'Activity 7.1 · Coverage check (SOC-SOP-03 Section A)',
  intro: 'One row per host in ~/day7/endpoint_inventory.csv. Compare with ~/day7/coverage_report.csv and the required-solutions table.',
  tables: [{ id: 'c', columns: [{ id: 'g', label: 'Coverage', kind: 'select', options: GAP }], rows: Object.keys(KEY71).map((id) => ({ id, label: id })) }],
  fields: [
    { id: 'count', label: 'How many hosts have a coverage gap?', kind: 'text' },
    { id: 'siem', label: 'Which Tier 1 server sends NO logs to the SIEM, and why does that matter?', kind: 'area', wide: true },
    { id: 'dev', label: 'DEV-PC-02 has no EDR. Why is that not a gap?', kind: 'area', wide: true },
  ],
  grade(v) {
    const r: G = {};
    for (const [h, want] of Object.entries(KEY71)) if (filled(v[`c.${h}.g`])) r[`c.${h}.g`] = { ok: v[`c.${h}.g`] === want, hint: 'Check the host type in endpoint_inventory.csv against the Section A table, and look for hosts missing from the report.' };
    if (filled(v.count)) r.count = { ok: num(v.count) === 4, hint: 'Three "Not installed" that are required, plus one host the console has never seen.' };
    if (filled(v.siem)) r.siem = { ok: has(v.siem, /CORE-DB-01/i), hint: 'Which Tier 1 server has siem_wazuh = Not installed?' };
    if (filled(v.dev)) r.dev = { ok: has(v.dev, /tier\s*3|test|isolated|not required/i), hint: 'Read the Tier 3 row of the Section A table.' };
    return r;
  },
};
const act71: Mission = {
  id: 'd7-act7.1', day: 7, kind: 'activity', title: 'Activity 7.1 · Is It Installed? Coverage Check', subtitle: 'Individual, hands-on · 45 min', minutes: 45, hosts: ['seat-linux', 'seat-win'],
  intro: 'Check that every host has the security solutions the SOP requires (PC 2.1), including hosts the console has never seen.',
  steps: [
    { id: 'rules', host: 'seat-linux', text: 'Which solutions does each host type need?', try: 'grep -A4 "Host type" ~/day7/soc_status_sop.txt', match: [/^(grep|cat)\b.*soc_status_sop/] },
    { id: 'hosts', host: 'seat-linux', text: 'List the endpoints and their type.', try: 'cut -d, -f1,3,4 ~/day7/endpoint_inventory.csv', match: [/^(cut|cat|awk)\b.*endpoint_inventory/] },
    { id: 'report', host: 'seat-linux', text: 'Read the console coverage report.', try: 'cat ~/day7/coverage_report.csv', match: [/^(cat|cut|awk|head)\b.*coverage_report/] },
    { id: 'count', host: 'seat-linux', text: 'Count the hosts in each file: is one missing from the report?', try: 'wc -l ~/day7/endpoint_inventory.csv ~/day7/coverage_report.csv', match: [/^wc\b.*(endpoint_inventory|coverage_report)/] },
    { id: 'ps', host: 'seat-win', text: 'Windows: which hosts have no EDR?', try: String.raw`Import-Csv day7\coverage_report.csv | Where-Object edr_falcon -eq "Not installed"`, match: [/import-csv\b.*coverage_report.*(where|\?)/i] },
  ],
  worksheet: ws71,
};

// ---------------------------------------------------------------- 7.2 Is it operational? (health)
export const CHECKS = ['', '-', 'B1 Service', 'B2 Real-time', 'B3 Check-in', 'B4 Content', 'B5 Version', 'B6 Tamper protection'];
export const KEY72: Record<string, [string, string]> = {
  'H-01': ['Not operational', 'B6 Tamper protection'], 'H-02': ['Operational', '-'], 'H-03': ['Operational', '-'], 'H-04': ['Operational', '-'], 'H-05': ['Operational', '-'],
  'H-06': ['Not operational', 'B5 Version'], 'H-07': ['Not operational', 'B3 Check-in'], 'H-08': ['Not operational', 'B2 Real-time'], 'H-09': ['Operational', '-'],
  'H-10': ['Not operational', 'B4 Content'], 'H-11': ['Not operational', 'B1 Service'], 'H-12': ['Operational', '-'], 'H-13': ['Operational', '-'], 'H-14': ['Operational', '-'],
};
const ws72: Worksheet = {
  id: 'ws-7.2', title: 'Activity 7.2 · Health check at 09:30 (SOC-SOP-03 Section B)',
  intro: 'One row per check in ~/day7/agent_health.csv. Apply B1–B6; write the first check that fails.',
  tables: [{ id: 'h', columns: [{ id: 'v', label: 'Status', kind: 'select', options: ['', 'Operational', 'Not operational'] }, { id: 'f', label: 'Failed check', kind: 'select', options: CHECKS }], rows: Object.keys(KEY72).map((id) => ({ id, label: id })) }],
  fields: [
    { id: 'count', label: 'How many checks are NOT operational?', kind: 'text' },
    { id: 'why07', label: 'One of them is explained by Day 5\'s incident. Which one, and why?', kind: 'area', wide: true },
  ],
  grade(v) {
    const r: G = {};
    for (const [id, [st, chk]] of Object.entries(KEY72)) {
      if (filled(v[`h.${id}.v`])) r[`h.${id}.v`] = { ok: v[`h.${id}.v`] === st, hint: 'All six checks must pass: service, real-time, check-in (60 min), content (from 11-02), version, tamper.' };
      if (filled(v[`h.${id}.f`])) r[`h.${id}.f`] = { ok: v[`h.${id}.f`] === chk, hint: 'Which value breaks a B rule? "-" if none.' };
    }
    if (filled(v.count)) r.count = { ok: num(v.count) === 6, hint: 'Count the rows that fail at least one check.' };
    if (filled(v.why07)) r.why07 = { ok: has(v.why07, /H-?07|FIN-PC-03/i) && has(v.why07, /unplug|network|disconnect|isolat|ransom/i), hint: 'Which PC did the SOC tell the user to unplug on Day 5?' };
    return r;
  },
};
const act72: Mission = {
  id: 'd7-act7.2', day: 7, kind: 'activity', title: 'Activity 7.2 · Is It Operational? Health Check', subtitle: 'Individual, hands-on · 60 min', minutes: 60, hosts: ['seat-win', 'seat-linux'],
  intro: 'An installed agent is not always a working agent. Check every agent against the six operational checks (PC 2.2).',
  steps: [
    { id: 'rules', host: 'seat-linux', text: 'Read the six operational checks.', try: 'grep -A8 "^B1" ~/day7/soc_status_sop.txt', match: [/^grep\b.*B\d?.*soc_status_sop/] },
    { id: 'table', host: 'seat-win', text: 'Show the health export.', try: String.raw`Import-Csv day7\agent_health.csv | Format-Table check_id, host, solution, version, service, realtime, last_checkin, content_date, tamper`, match: [/import-csv\b.*agent_health/i] },
    { id: 'stopped', host: 'seat-win', text: 'Any service not running?', try: String.raw`Import-Csv day7\agent_health.csv | Where-Object service -ne Running`, match: [/import-csv\b.*agent_health.*(where|\?).*service/i] },
    { id: 'old', host: 'seat-linux', text: 'Any check-in before 08:30 or content before November?', try: 'grep -E "08:[0-2][0-9]|2026-10-" ~/day7/agent_health.csv', match: [/^grep\b.*agent_health/] },
  ],
  worksheet: ws72,
};

// ---------------------------------------------------------------- 7.3 Can it clean or delete the issue?
const CAN = ['', 'Yes', 'No', 'Re-image'];
const WHY = ['', 'OK (action 1, 2, 3 or 10)', 'C1 Action code', 'C2 Exclusion', 'C3 Detect only', 'C4 Re-image'];
const NEXT = ['', 'Verify the action in the log', 'Report to Shift Lead: cannot clean', 'Report: re-image by IT'];
export const KEY73: Record<string, [string, string, string]> = {
  'D7-01': ['Re-image', WHY[5], NEXT[3]], 'D7-02': ['No', WHY[3], NEXT[2]], 'D7-03': ['Yes', WHY[1], NEXT[1]], 'D7-04': ['No', WHY[2], NEXT[2]],
  'D7-05': ['Yes', WHY[1], NEXT[1]], 'D7-06': ['Re-image', WHY[5], NEXT[3]], 'D7-07': ['No', WHY[2], NEXT[2]], 'D7-08': ['Yes', WHY[1], NEXT[1]],
};
const ws73: Worksheet = {
  id: 'ws-7.3', title: 'Activity 7.3 · Can it clean or delete the issue? (Section C)',
  intro: 'For each detection in ~/day7/open_detections.csv, read the host\'s policy in ~/day7/security_policies.csv: action code for that severity, exclusions, EDR mode.',
  tables: [{ id: 'd', columns: [{ id: 'c', label: 'Can clean?', kind: 'select', options: CAN }, { id: 'w', label: 'Reason', kind: 'select', options: WHY }, { id: 'n', label: 'Next step', kind: 'select', options: NEXT }], rows: Object.keys(KEY73).map((id) => ({ id, label: id })) }],
  fields: [{ id: 'detect', label: 'Which host\'s EDR raises alerts but cannot stop anything? (rule C3)', kind: 'text' }],
  grade(v) {
    const r: G = {};
    for (const [id, k] of Object.entries(KEY73)) ['c', 'w', 'n'].forEach((c, i) => {
      if (filled(v[`d.${id}.${c}`])) r[`d.${id}.${c}`] = { ok: v[`d.${id}.${c}`] === k[i], hint: 'Severity -> the matching *_action column; then exclusions; ransomware and rootkits always mean re-image.' };
    });
    if (filled(v.detect)) r.detect = { ok: has(v.detect, /QA-PC-05/i), hint: 'Look at the edr_mode column.' };
    return r;
  },
};
const act73: Mission = {
  id: 'd7-act7.3', day: 7, kind: 'activity', title: 'Activity 7.3 · Can It Clean or Delete the Issue?', subtitle: 'Individual, hands-on · 60 min', minutes: 60, hosts: ['seat-win', 'seat-linux'],
  intro: 'A solution can detect a threat and still be unable to remove it. Check each open detection against the host\'s policy (PC 2.3).',
  steps: [
    { id: 'codes', host: 'seat-linux', text: 'Read the action codes and rules C1–C4.', try: 'grep -A22 "^SECTION C" ~/day7/soc_status_sop.txt', match: [/^grep\b.*SECTION C.*soc_status_sop/] },
    { id: 'det', host: 'seat-win', text: 'The open detections.', try: String.raw`Import-Csv day7\open_detections.csv | Format-Table detection_id, host, threat, severity, last_action`, match: [/import-csv\b.*open_detections/i] },
    { id: 'pol', host: 'seat-win', text: 'The policies of those hosts.', try: String.raw`Import-Csv day7\security_policies.csv | Format-Table`, match: [/import-csv\b.*security_policies/i] },
    { id: 'one', host: 'seat-linux', text: 'Look up one host\'s policy (change the host).', try: 'grep LOAN-PC-08 ~/day7/security_policies.csv', match: [/^grep\b.*security_policies/] },
  ],
  worksheet: ws73,
};

// ---------------------------------------------------------------- 7.4 Check your own workstation (per seat)
const ws74: Worksheet = {
  id: 'ws-7.4', title: 'Activity 7.4 · My workstation status check',
  intro: 'Use YOUR WKS-LAB workstation. Every seat is different. "Now" is 09:30.',
  fields: [
    { id: 'av', label: 'Defender (AV): installed and operational?', kind: 'select', options: ['', 'Installed and operational', 'Installed, not operational', 'Not installed'] },
    { id: 'edr', label: 'CrowdStrike Falcon (EDR) service', kind: 'select', options: ['', 'Running', 'Stopped', 'Not installed'] },
    { id: 'wazuh', label: 'Wazuh agent connected to the SIEM right now?', kind: 'select', options: YN },
    { id: 'keep', label: 'Time of the last acknowledged keep-alive (HH:MM)', kind: 'text' },
    { id: 'high', label: 'HighThreatDefaultAction code', kind: 'text' },
    { id: 'clean', label: 'Could Defender clean a High threat in your Downloads folder?', kind: 'select', options: YN },
    { id: 'reason', label: 'Why (action code, exclusion)?', kind: 'text' },
    { id: 'report', label: 'Anything to report to the Shift Lead?', kind: 'select', options: YN },
  ],
  grade(v, { facts }) {
    const f = facts.day7, r: G = {};
    if (filled(v.av)) r.av = { ok: v.av === 'Installed and operational', hint: 'Get-MpComputerStatus: real-time, tamper protection, signature date.' };
    if (filled(v.edr)) r.edr = { ok: v.edr === f.edr, hint: 'Get-Service: look for CSFalconService. Missing from the list = not installed.' };
    if (filled(v.wazuh)) r.wazuh = { ok: v.wazuh === (f.wazuhConnected ? 'Yes' : 'No'), hint: 'The service can be Running while the agent has lost its manager: read the last lines of ossec.log.' };
    if (filled(v.keep)) r.keep = { ok: (v.keep ?? '').includes(f.lastKeepalive), hint: 'The last "Keep alive acknowledged" line.' };
    if (filled(v.high)) r.high = { ok: num(v.high) === f.high, hint: 'Get-MpPreference | Format-List HighThreatDefaultAction' };
    if (filled(v.clean)) r.clean = { ok: v.clean === (f.canClean ? 'Yes' : 'No'), hint: 'Rule C1 (codes 1, 2, 3, 10) and rule C2 (ExclusionPath).' };
    if (filled(v.reason)) r.reason = { ok: f.canClean ? has(v.reason, /\b(1|2|3|10)\b|quarantine|remove|clean|block/i) : (!([1, 2, 3, 10].includes(f.high)) ? has(v.reason, new RegExp(`\\b${f.high}\\b|allow|no action`, 'i')) : has(v.reason, /exclu|downloads/i)), hint: 'Quote the action code, or the exclusion.' };
    if (filled(v.report)) r.report = { ok: v.report === (f.report ? 'Yes' : 'No'), hint: 'Report any missing or stopped solution, a disconnected agent, or a policy that cannot clean.' };
    return r;
  },
};
const act74: Mission = {
  id: 'd7-act7.4', day: 7, kind: 'activity', title: 'Activity 7.4 · Check Your Own Workstation', subtitle: 'Individual, hands-on · 45 min', minutes: 45, hosts: ['seat-win'],
  intro: 'Run the full SOC-SOP-03 check on YOUR WKS-LAB workstation: installed, operational, and able to clean.',
  steps: [
    { id: 'svc', host: 'seat-win', text: 'Which security services exist, and are they running?', try: 'Get-Service', match: [/^\s*(get-service|gsv)\b/i] },
    { id: 'status', host: 'seat-win', text: 'Is Defender operational?', try: 'Get-MpComputerStatus | Format-List RealTimeProtectionEnabled, IsTamperProtected, AntivirusSignatureLastUpdated', match: [/get-mpcomputerstatus/i] },
    { id: 'wazuh', host: 'seat-win', text: 'Is the Wazuh agent connected?', try: WAZUH, match: [/(get-content|cat|gc|type)\b.*ossec\.log/i] },
    { id: 'prefs', host: 'seat-win', text: 'Can Defender clean? Read its policy.', try: 'Get-MpPreference | Format-List HighThreatDefaultAction, SevereThreatDefaultAction, ExclusionPath', match: [/get-mppreference/i] },
  ],
  worksheet: ws74,
};

export const DAY7: ScenarioPack = { day: 7, title: 'Day 7 · Security Solution Status Check', missions: [p71, p72, p73, act71, act72, act73, act74] };
