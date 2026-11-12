// Day 8 scenario pack: Manual Checking and Verification (CS-ICT251101 Element 3, PC 3.1–3.4). Practice missions + Activities 8.1–8.4.
// Answers follow SOC-SOP-04 (~/day8/soc_verification_sop.txt) and the files written by _build/day08_data.py.
import type { Mission, ScenarioPack, Worksheet } from './types';

type G = Record<string, { ok: boolean; hint?: string }>;
const filled = (v?: string) => !!v && v.trim().length > 0;
const has = (v: string | undefined, ...re: RegExp[]) => !!v && re.some((r) => r.test(v));
const YN = ['', 'Yes', 'No'];

// ---------------------------------------------------------------- practice missions (repeat the demo videos)
const p81: Mission = {
  id: 'd8-demo1', day: 8, kind: 'practice', title: 'Practice: Demo 1 · Verify the Detection', subtitle: 'Repeat Video 1 with the school samples', minutes: 10,
  video: 'Day08_Demo1_Verify_the_Detection.mp4', hosts: ['demo-linux'],
  intro: 'Hash each sample, compare it with the console, and look it up in the threat intelligence list, like Video 1.',
  steps: [
    { id: 'console', host: 'demo-linux', text: 'What did the console report? (ID, host, threat, hash)', try: 'cut -d, -f1,2,3,6 ~/demo8/demo_detections.csv', match: [/^(cut|cat)\b.*demo_detections/] },
    { id: 'hash', host: 'demo-linux', text: 'Compute the SHA-256 of every sample yourself.', try: 'sha256sum ~/demo8/samples/*', why: 'DV-3: the hash on disk is different from the console hash: the file changed after the detection.', match: [/^sha256sum\b.*demo8/] },
    { id: 'intel', host: 'demo-linux', text: 'Look one hash up in the threat intelligence list (change the hash).', try: 'grep -i "^0" ~/demo8/demo_threat_intel.txt', match: [/^grep\b.*demo_threat_intel/] },
  ],
};
const p82: Mission = {
  id: 'd8-demo2', day: 8, kind: 'practice', title: 'Practice: Demo 2 · Check the Action', subtitle: 'Repeat Video 2 with the school action events', minutes: 10,
  video: 'Day08_Demo2_Check_the_Action.mp4', hosts: ['demo-win', 'demo-linux'],
  intro: 'Read the action events (1117, 1118, 1119) and compare them with the after-action check, like Video 2.',
  steps: [
    { id: 'events', host: 'demo-win', text: 'The action events from the Defender logs.', try: String.raw`Import-Csv demo8\demo_remediation_events.csv | Format-Table event_id, host, action, detail`, match: [/import-csv\b.*demo_remediation_events/i] },
    { id: 'post', host: 'demo-linux', text: 'Is the file really gone?', try: 'cat ~/demo8/demo_post_check.csv', why: 'MKT-PC-04: event 1117 says quarantined, but the file is still present: NOT VERIFIED. Escalate.', match: [/^(cat|grep)\b.*demo_post_check/] },
    { id: 'rule', host: 'demo-linux', text: 'Read rule V2.', try: 'grep -A10 "^V2  CHECK" ~/day8/soc_verification_sop.txt', match: [/^grep\b.*V2.*soc_verification_sop/] },
  ],
};
const p83: Mission = {
  id: 'd8-demo3', day: 8, kind: 'practice', title: 'Practice: Demo 3 · Update, Then Scan the Infected System', subtitle: 'Repeat Video 3 on WKS-TRN-07', minutes: 15,
  video: 'Day08_Demo3_Update_and_Scan.mp4', hosts: ['demo-win'],
  intro: 'See why the SOP says update first and scan fully: a quick scan before the update misses the infection, like Video 3.',
  steps: [
    { id: 'ver', host: 'demo-win', text: 'Which signature, engine and platform versions are installed?', try: 'Get-MpComputerStatus | Format-List AntivirusSignatureVersion, AMEngineVersion, AMProductVersion', match: [/get-mpcomputerstatus/i] },
    { id: 'quick', host: 'demo-win', text: 'Try a quick scan with the old signatures.', try: 'Start-MpScan -ScanType QuickScan', why: 'No threats found: the old signatures do not know it, and a quick scan does not look in AppData\\Roaming\\Updater.', match: [/start-mpscan\b(?!.*full)/i] },
    { id: 'update', host: 'demo-win', text: 'Update the signatures (rule V3).', try: 'Update-MpSignature', match: [/update-mpsignature/i] },
    { id: 'full', host: 'demo-win', text: 'Now a full scan (rule V4).', try: 'Start-MpScan -ScanType FullScan', match: [/start-mpscan\b.*fullscan/i] },
    { id: 'verify', host: 'demo-win', text: 'What was found, and did the action work?', try: 'Get-MpThreatDetection | Format-List Resources, ActionSuccess, ThreatStatusID', match: [/get-mpthreatdetection/i] },
    { id: 'gone', host: 'demo-win', text: 'Is the file really gone?', try: String.raw`Test-Path C:\Users\trainee07\AppData\Roaming\Updater\uhelper.exe`, match: [/test-path\b.*uhelper/i] },
  ],
};

// ---------------------------------------------------------------- 8.1 Verify the detection (PC 3.1)
export const VERD = ['', 'Verified malicious', 'False positive', 'Hash mismatch', 'Unknown - escalate'];
export const KEY81: Record<string, [string, string, string]> = { // hash matches console, disk hash in threat intel, verdict
  'V-01': ['Yes', 'Yes', VERD[1]], 'V-02': ['Yes', 'No', VERD[2]], 'V-03': ['No', 'No', VERD[3]], 'V-04': ['Yes', 'Yes', VERD[1]], 'V-05': ['Yes', 'No', VERD[4]],
};
const ws81: Worksheet = {
  id: 'ws-8.1', title: 'Activity 8.1 · Detection verification (SOC-SOP-04 V1)',
  intro: 'Compute each sample\'s SHA-256, compare it with console_sha256 in ~/day8/detections_to_verify.csv, then look it up in threat_intel_hashes.txt and known_good_hashes.txt.',
  tables: [{ id: 'v', columns: [{ id: 'm', label: 'Hash = console?', kind: 'select', options: YN }, { id: 'i', label: 'In threat intel?', kind: 'select', options: YN }, { id: 'v', label: 'Verdict', kind: 'select', options: VERD }], rows: Object.keys(KEY81).map((id) => ({ id, label: id })) }],
  fields: [
    { id: 'changed', label: 'Which sample changed after it was detected? What does that tell you?', kind: 'area', wide: true },
    { id: 'fp', label: 'Which detection is a false positive, and what proves it?', kind: 'area', wide: true },
  ],
  grade(v) {
    const r: G = {};
    for (const [id, k] of Object.entries(KEY81)) ['m', 'i', 'v'].forEach((c, i) => {
      if (filled(v[`v.${id}.${c}`])) r[`v.${id}.${c}`] = { ok: v[`v.${id}.${c}`] === k[i], hint: ['Compare your sha256sum output with console_sha256.', 'grep the hash you computed in threat_intel_hashes.txt.', 'Rule V1.2 first (mismatch), then V1.3: intel, known-good, or neither.'][i] };
    });
    if (filled(v.changed)) r.changed = { ok: has(v.changed, /V-?03|payslip/i), hint: 'Which computed hash is different from the console hash?' };
    if (filled(v.fp)) r.fp = { ok: has(v.fp, /V-?02|putty/i) && has(v.fp, /known.?good|vendor|official/i), hint: 'Which hash is in known_good_hashes.txt?' };
    return r;
  },
};
const act81: Mission = {
  id: 'd8-act8.1', day: 8, kind: 'activity', title: 'Activity 8.1 · Verify the Detection', subtitle: 'Individual, hands-on · 60 min', minutes: 60, hosts: ['seat-linux', 'seat-win'],
  intro: 'Do not trust the console blindly. Check five detections yourself with their file hashes (PC 3.1).',
  steps: [
    { id: 'rule', host: 'seat-linux', text: 'Read rule V1.', try: 'grep -A12 "^V1  CHECK" ~/day8/soc_verification_sop.txt', match: [/^(grep|cat)\b.*soc_verification_sop/] },
    { id: 'console', host: 'seat-linux', text: 'What did the console report?', try: 'cut -d, -f1,2,3,6 ~/day8/detections_to_verify.csv', match: [/^(cut|cat|awk)\b.*detections_to_verify/] },
    { id: 'hash', host: 'seat-linux', text: 'Compute the SHA-256 of every sample.', try: 'sha256sum ~/day8/samples/*', match: [/^sha256sum\b.*day8/] },
    { id: 'intel', host: 'seat-linux', text: 'Look a hash up in the threat intelligence and known-good lists (change the hash).', try: 'grep -i dd4fbfe5 ~/day8/threat_intel_hashes.txt ~/day8/known_good_hashes.txt', match: [/^grep\b.*(threat_intel|known_good)/] },
    { id: 'win', host: 'seat-win', text: 'Windows: the same hash with Get-FileHash.', try: String.raw`Get-FileHash day8\samples\V-01_invoice_scan.exe.sample`, match: [/get-filehash\b/i] },
  ],
  worksheet: ws81,
};

// ---------------------------------------------------------------- 8.2 Check the action (PC 3.2)
export const ACT = ['', 'Action verified', 'Not verified', 'Failed'];
const NEXT = ['', 'Record in the shift log', 'Escalate to Tier 2'];
export const KEY82: Record<string, [string, string]> = {
  'HR-LT-07': [ACT[1], NEXT[1]], 'QA-PC-05': [ACT[1], NEXT[1]], 'LOAN-PC-08': [ACT[3], NEXT[2]], 'IT-PC-01': [ACT[2], NEXT[2]], 'PAY-PC-02': [ACT[3], NEXT[2]], 'DEV-PC-02': [ACT[1], NEXT[1]],
};
const ws82: Worksheet = {
  id: 'ws-8.2', title: 'Activity 8.2 · Action verification (SOC-SOP-04 V2)',
  intro: 'For each host: the action event in ~/day8/remediation_events.csv and the after-action check in ~/day8/post_action_check.csv.',
  tables: [{ id: 'a', columns: [{ id: 'v', label: 'Result', kind: 'select', options: ACT }, { id: 'n', label: 'Next step', kind: 'select', options: NEXT }], rows: Object.keys(KEY82).map((id) => ({ id, label: id })) }],
  fields: [{ id: 'it', label: 'IT-PC-01 has event 1117 "No additional actions required". Why is it still not verified?', kind: 'area', wide: true }],
  grade(v) {
    const r: G = {};
    for (const [h, [res, nx]] of Object.entries(KEY82)) {
      if (filled(v[`a.${h}.v`])) r[`a.${h}.v`] = { ok: v[`a.${h}.v`] === res, hint: '1118/1119 = Failed. 1117 but the file is still present = Not verified. 1117 and the file gone = verified.' };
      if (filled(v[`a.${h}.n`])) r[`a.${h}.n`] = { ok: v[`a.${h}.n`] === nx, hint: 'Rule V2.3: anything not verified or failed is escalated.' };
    }
    if (filled(v.it)) r.it = { ok: has(v.it, /still|present|exists|not gone|yes/i), hint: 'Read post_action_check.csv for IT-PC-01.' };
    return r;
  },
};
const act82: Mission = {
  id: 'd8-act8.2', day: 8, kind: 'activity', title: 'Activity 8.2 · Check the Action', subtitle: 'Individual, hands-on · 45 min', minutes: 45, hosts: ['seat-win', 'seat-linux'],
  intro: 'The security solution says it acted. Check the action event and the host itself (PC 3.2).',
  steps: [
    { id: 'rule', host: 'seat-linux', text: 'Read rule V2.', try: 'grep -A10 "^V2  CHECK" ~/day8/soc_verification_sop.txt', match: [/^(grep|cat)\b.*soc_verification_sop/] },
    { id: 'events', host: 'seat-win', text: 'The action events.', try: String.raw`Import-Csv day8\remediation_events.csv | Format-Table event_id, host, action, detail`, match: [/import-csv\b.*remediation_events/i] },
    { id: 'post', host: 'seat-linux', text: 'The after-action check: is each file gone?', try: 'cat ~/day8/post_action_check.csv', match: [/^(cat|cut|grep)\b.*post_action_check/] },
    { id: 'fails', host: 'seat-linux', text: 'Only the failure events.', try: 'grep -E "^111[89]," ~/day8/remediation_events.csv', match: [/^grep\b.*remediation_events/] },
  ],
  worksheet: ws82,
};

// ---------------------------------------------------------------- 8.3 Check and patch the updates (PC 3.3)
export const UPD = ['', 'Up to date', 'Signatures out of date', 'Engine out of date', 'Platform out of date'];
const UACT = ['', 'None', 'Update-MpSignature now', 'Request the update from IT'];
export const KEY83: Record<string, [string, string]> = {
  'DC-01': [UPD[1], UACT[1]], 'FS-01': [UPD[2], UACT[2]], 'PAY-PC-02': [UPD[1], UACT[1]], 'FIN-PC-03': [UPD[2], UACT[2]],
  'HR-LT-07': [UPD[3], UACT[3]], 'QA-PC-05': [UPD[2], UACT[2]], 'LOAN-PC-08': [UPD[4], UACT[3]], 'IT-PC-01': [UPD[1], UACT[1]],
};
const ws83: Worksheet = {
  id: 'ws-8.3', title: 'Activity 8.3 · Updates (SOC-SOP-04 V3)',
  intro: 'Compare ~/day8/update_status.csv with ~/day8/vendor_bulletin.txt. Then update YOUR workstation and verify it.',
  tables: [{ id: 'u', columns: [{ id: 's', label: 'Status', kind: 'select', options: UPD }, { id: 'a', label: 'Action', kind: 'select', options: UACT }], rows: Object.keys(KEY83).map((id) => ({ id, label: id })) }],
  fields: [
    { id: 'before', label: 'My workstation: signature version BEFORE the update', kind: 'text' },
    { id: 'after', label: 'My workstation: signature version AFTER Update-MpSignature', kind: 'text' },
    { id: 'event', label: 'Which Defender event ID records the update?', kind: 'text' },
  ],
  grade(v, { facts }) {
    const r: G = {};
    for (const [h, [st, a]] of Object.entries(KEY83)) {
      if (filled(v[`u.${h}.s`])) r[`u.${h}.s`] = { ok: v[`u.${h}.s`] === st, hint: 'Compare all three version columns with the bulletin.' };
      if (filled(v[`u.${h}.a`])) r[`u.${h}.a`] = { ok: v[`u.${h}.a`] === a, hint: 'Rule V3.2: signatures you update now; engine and platform go to IT.' };
    }
    if (filled(v.before)) r.before = { ok: (v.before ?? '').includes(facts.day8.sigBefore), hint: 'Get-MpComputerStatus | Format-List AntivirusSignatureVersion' };
    if (filled(v.after)) r.after = { ok: (v.after ?? '').includes(facts.day8.sigAfter), hint: 'Run Update-MpSignature, then check the version again.' };
    if (filled(v.event)) r.event = { ok: /\b2000\b/.test(v.event ?? ''), hint: 'Get-WinEvent on the Defender Operational log: the "security intelligence version updated" event.' };
    return r;
  },
};
const act83: Mission = {
  id: 'd8-act8.3', day: 8, kind: 'activity', title: 'Activity 8.3 · Check and Patch the Updates', subtitle: 'Individual, hands-on · 45 min', minutes: 45, hosts: ['seat-win', 'seat-linux'],
  intro: 'Check the security solution versions against the vendor bulletin, then patch your own workstation and verify it (PC 3.3).',
  steps: [
    { id: 'bulletin', host: 'seat-linux', text: 'Read the vendor bulletin.', try: 'cat ~/day8/vendor_bulletin.txt', match: [/^(cat|head|grep)\b.*vendor_bulletin/] },
    { id: 'fleet', host: 'seat-win', text: 'The versions on each host.', try: String.raw`Import-Csv day8\update_status.csv | Format-Table`, match: [/import-csv\b.*update_status/i] },
    { id: 'mine', host: 'seat-win', text: 'My workstation\'s versions.', try: 'Get-MpComputerStatus | Format-List AntivirusSignatureVersion, AMEngineVersion, AMProductVersion', match: [/get-mpcomputerstatus/i] },
    { id: 'update', host: 'seat-win', text: 'Update the signatures.', try: 'Update-MpSignature', match: [/update-mpsignature/i] },
    { id: 'verify', host: 'seat-win', text: 'Verify: the update event.', try: "Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'; Id=2000} -MaxEvents 1 | Format-List TimeCreated, Message", match: [/get-winevent\b.*2000/i] },
  ],
  worksheet: ws83,
};

// ---------------------------------------------------------------- 8.4 Scan the infected system (PC 3.4, per seat)
const ws84: Worksheet = {
  id: 'ws-8.4', title: 'Activity 8.4 · Scan of my infected workstation (SOC-SOP-04 V4)',
  intro: 'Your WKS-LAB workstation is infected. Follow V4: update first, full scan, then verify. Every seat is different.',
  fields: [
    { id: 'name', label: 'Threat name found', kind: 'text' },
    { id: 'path', label: 'File path', kind: 'text', wide: true },
    { id: 'type', label: 'Scan type the SOP requires on an infected system', kind: 'select', options: ['', 'Quick scan', 'Full scan'] },
    { id: 'result', label: 'Result of the action', kind: 'select', options: ['', 'Quarantined', 'Failed'] },
    { id: 'present', label: 'Is the file still present afterwards (Test-Path)?', kind: 'select', options: YN },
    { id: 'next', label: 'Next step', kind: 'select', options: NEXT },
  ],
  grade(v, { facts }) {
    const f = facts.day8, r: G = {};
    if (filled(v.name)) r.name = { ok: (v.name ?? '').toLowerCase().includes(f.name.split(':')[1].split('!')[0].toLowerCase()), hint: 'Get-MpThreat shows the ThreatName.' };
    if (filled(v.path)) r.path = { ok: (v.path ?? '').toLowerCase().includes(f.path.split('\\').pop()!.toLowerCase()), hint: 'Get-MpThreatDetection: Resources.' };
    if (filled(v.type)) r.type = { ok: v.type === 'Full scan', hint: 'Rule V4.2.' };
    if (filled(v.result)) r.result = { ok: v.result === (f.fails ? 'Failed' : 'Quarantined'), hint: 'ActionSuccess, ThreatStatusID, and events 1117 / 1118.' };
    if (filled(v.present)) r.present = { ok: v.present === (f.fails ? 'Yes' : 'No'), hint: 'Test-Path "<the file path>"' };
    if (filled(v.next)) r.next = { ok: v.next === (f.fails ? NEXT[2] : NEXT[1]), hint: 'A failed action is escalated (Day 9).' };
    return r;
  },
};
const act84: Mission = {
  id: 'd8-act8.4', day: 8, kind: 'activity', title: 'Activity 8.4 · Scan the Infected System', subtitle: 'Individual, hands-on · 60 min', minutes: 60, hosts: ['seat-win'],
  intro: 'Use the security solution to scan your infected workstation the way SOC-SOP-04 V4 says, and verify the result (PC 3.4).',
  steps: [
    { id: 'rule', host: 'seat-win', text: 'Read rule V4.', try: String.raw`Select-String -Path day8\soc_verification_sop.txt -Pattern "^V4"`, match: [/select-string\b.*soc_verification_sop/i, /get-content\b.*soc_verification_sop/i] },
    { id: 'update', host: 'seat-win', text: 'Update the signatures first.', try: 'Update-MpSignature', match: [/update-mpsignature/i] },
    { id: 'scan', host: 'seat-win', text: 'Run a full scan.', try: 'Start-MpScan -ScanType FullScan', match: [/start-mpscan\b.*fullscan/i] },
    { id: 'found', host: 'seat-win', text: 'What was found and what happened to it?', try: 'Get-MpThreatDetection | Format-List Resources, ActionSuccess, ThreatStatusID', match: [/get-mpthreat(detection)?\b/i] },
    { id: 'events', host: 'seat-win', text: 'Read the scan events.', try: "Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'; Id=1001,1116,1117,1118} -MaxEvents 4 | Format-List TimeCreated, Id, Message", match: [/get-winevent\b.*(1116|1117|1118|1001)/i] },
    { id: 'gone', host: 'seat-win', text: 'Is the file gone? (paste its path)', try: String.raw`Test-Path "C:\Users\<you>\<folder>\<file>.exe"`, match: [/test-path\b/i] },
  ],
  worksheet: ws84,
};

export const DAY8: ScenarioPack = { day: 8, title: 'Day 8 · Manual Checking and Verification', missions: [p81, p82, p83, act81, act82, act83, act84] };
