// Day 5 scenario pack: Checking for Alerts (CS-ICT251101 Element 1, PC 1.1–1.3). Practice missions + Activities 5.1–5.4.
// Answers follow SOC-SOP-01 (~/day5/soc_alert_sop.txt) and the asset files written by _build/day05_data.py.
import type { Mission, ScenarioPack, Worksheet } from './types';
import { DAY5_FILES } from '../hosts/files';
import { parseCsv } from '../shell/windows2';

type G = Record<string, { ok: boolean; hint?: string }>;
const filled = (v?: string) => !!v && v.trim().length > 0;
const has = (v: string | undefined, ...re: RegExp[]) => !!v && re.some((r) => r.test(v));
const num = (v?: string) => { const m = (v ?? '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };

// ---------------------------------------------------------------- practice missions (repeat the demo videos on the demo hosts)
const p51: Mission = {
  id: 'd5-demo1', day: 5, kind: 'practice', title: 'Practice: Demo 1 · Receive Alerts per SOP', subtitle: 'Repeat Video 1 with demo_alert_queue.csv', minutes: 10,
  video: 'Day05_Demo1_Receive_Alerts_per_SOP.mp4', hosts: ['demo-win', 'demo-linux'],
  intro: 'Read the SOP time limits, list the New alerts, and decide which ones are over the limit at 09:30, like Video 1.',
  steps: [
    { id: 'sop', host: 'demo-linux', text: 'Read the acknowledgment time limits in the SOP (rule A2).', try: 'grep -A7 "^A2" ~/day5/soc_alert_sop.txt', match: [/^grep\b.*A2.*soc_alert_sop/] },
    { id: 'queue', host: 'demo-win', text: 'Show the demo queue: ID, time received, severity, status.', try: String.raw`Import-Csv demo5\demo_alert_queue.csv | Format-Table alert_id, received, severity, host, status`, match: [/import-csv\b.*demo_alert_queue(?!.*(where-object|\?))/i] },
    { id: 'new', host: 'demo-win', text: 'Only the alerts nobody has acknowledged yet.', try: String.raw`Import-Csv demo5\demo_alert_queue.csv | Where-Object status -eq New | Format-Table alert_id, received, severity, rule_name`, why: 'D5-04 (High) has waited 26 min: about 3 left. D5-05 (High) 8 min, but it is a red flag (Virus:). D5-03 (Low) is fine. D5-06 is Informational: no acknowledgment needed.', match: [/import-csv\b.*demo_alert_queue.*(where|\?).*new/i] },
    { id: 'red', host: 'demo-linux', text: 'Which demo alerts are red flags?', try: 'grep -E "Ransom|Virus" ~/demo5/demo_alert_queue.csv', why: 'D5-02 (ransom note) and D5-05 (Virus:) are red flags: escalate them first.', match: [/^grep\b.*(ransom|virus).*demo_alert_queue/i] },
  ],
};
const p52: Mission = {
  id: 'd5-demo2', day: 5, kind: 'practice', title: 'Practice: Demo 2 · Receive an Incident Report', subtitle: 'Repeat Video 2 with demo_incident_reports.txt', minutes: 10,
  video: 'Day05_Demo2_Incident_Report_Intake.mp4', hosts: ['demo-linux'],
  intro: 'List the channels, read each report and decide: red flag, social engineering, or not a security matter, like Video 2.',
  steps: [
    { id: 'chan', host: 'demo-linux', text: 'Which channel did each demo report come from?', try: 'grep -E "^(=== REPORT|CHANNEL)" ~/demo5/demo_incident_reports.txt', match: [/^grep\b.*CHANNEL.*demo_incident_reports/] },
    { id: 'dr2', host: 'demo-linux', text: 'Read report DR-2 (the SMS).', try: 'grep -A7 "REPORT DR-2" ~/demo5/demo_incident_reports.txt', why: 'It asks for a password and an OTP: SOP rule B3 = social engineering. Do not comply; call back on the directory number.', match: [/^grep\b.*DR-2.*demo_incident_reports/] },
    { id: 'b3', host: 'demo-linux', text: 'Read the SOP rules for reports from people (Section B).', try: 'grep -A3 "^B3" ~/day5/soc_alert_sop.txt', match: [/^grep\b.*B\d.*soc_alert_sop/] },
  ],
};
const p53: Mission = {
  id: 'd5-demo3', day: 5, kind: 'practice', title: 'Practice: Demo 3 · Red Flags: Ransomware or PE Infection?', subtitle: 'Repeat Video 3 with demo_edr_events.csv', minutes: 15,
  video: 'Day05_Demo3_Red_Flags_Ransomware_PE.mp4', hosts: ['demo-linux', 'demo-win'],
  intro: 'Count what each host did, then match it to the red flags R1–R4 and V1–V3 in the SOP, like Video 3.',
  steps: [
    { id: 'count', host: 'demo-linux', text: 'Count the actions per host.', try: 'cut -d, -f2,5 ~/demo5/demo_edr_events.csv | sort | uniq -c', why: 'LIB-PC-02: 5 renames + 1 create. MKT-PC-04: 3 modified executables. REG-PC-01: 3 modified DLLs.', match: [/^cut\b.*demo_edr_events/] },
    { id: 'ext', host: 'demo-linux', text: 'How many files got the new .crypt9 extension?', try: 'grep -c "crypt9" ~/demo5/demo_edr_events.csv', why: '5 files renamed to the same new extension in 24 seconds: red flag R1.', match: [/^grep\b.*crypt9.*demo_edr_events/] },
    { id: 'signer', host: 'demo-win', text: 'Who signed the processes that made the changes?', try: String.raw`Import-Csv demo5\demo_edr_events.csv | Group-Object signer`, why: 'REG-PC-01 changes come from TiWorker.exe signed by Microsoft Windows: Windows Update, approved, not a red flag.', match: [/import-csv\b.*demo_edr_events.*group-object/i] },
    { id: 'virus', host: 'demo-win', text: 'Show the antivirus detection.', try: String.raw`Import-Csv demo5\demo_edr_events.csv | Where-Object detection -like "Virus*" | Format-Table time, host, path, detection`, why: 'Virus:Win32/Sality.AT on files that keygen.exe modified: PE infection (V1 + V2).', match: [/import-csv\b.*demo_edr_events.*detection/i] },
  ],
};

// ---------------------------------------------------------------- 5.1 Receive detection alerts per SOP
const SLA: Record<string, number> = { Critical: 15, High: 30, Medium: 120, Low: 480 };
const queue = parseCsv(DAY5_FILES['alert_queue.csv']).slice(1).map((r) => ({ id: r[0], received: r[1], severity: r[5], host: r[6], status: r[7], ack: r[8] }));
const mins = (a: string, b: string) => { const t = (s: string) => { const [h, m, x] = s.slice(11).split(':').map(Number); return h * 60 + m + x / 60; }; return t(b) - t(a); };
const NOW = '2026-11-05 09:30:00';
export const Q51 = queue.map((q) => {
  const m = mins(q.received, q.status === 'New' ? NOW : q.ack);
  const lim = SLA[q.severity];
  return { ...q, minutes: m, within: lim === undefined ? 'N/A (Informational)' : m <= lim ? 'Yes' : 'No - breach' };
});
const ws51: Worksheet = {
  id: 'ws-5.1', title: 'Activity 5.1 · Alert receipt log (now = 09:30)',
  intro: 'One row per alert in ~/day5/alert_queue.csv. Minutes = acknowledged time − received time; for a New alert, 09:30 − received time. Compare with the SOP limits (rule A2).',
  fieldsFirst: true,
  fields: [
    { id: 'newCount', label: 'How many alerts are still New (not acknowledged)?', kind: 'text' },
    { id: 'late', label: 'Which ACKNOWLEDGED alert was acknowledged too late?', kind: 'text' },
    { id: 'first', label: 'Which alert must you handle first right now, and why?', kind: 'area', wide: true },
    { id: 'red', label: 'Which alerts are red flags (Section C)? Write the IDs and R/V codes.', kind: 'area', wide: true },
  ],
  tables: [{ id: 'q', columns: [{ id: 'min', label: 'Minutes (to ack, or waiting)' }, { id: 'sla', label: 'Within SLA?', kind: 'select', options: ['', 'Yes', 'No - breach', 'N/A (Informational)'] }], rows: Q51.map((q) => ({ id: q.id, label: `${q.id} · ${q.severity} · ${q.status}` })) }],
  grade(v) {
    const r: G = {};
    for (const q of Q51) {
      const mk = `q.${q.id}.min`, sk = `q.${q.id}.sla`;
      if (filled(v[mk])) r[mk] = { ok: Math.abs(num(v[mk]) - q.minutes) <= 1, hint: q.status === 'New' ? 'New alert: 09:30 minus the received time.' : 'Acknowledged time minus received time.' };
      if (filled(v[sk])) r[sk] = { ok: v[sk] === q.within, hint: 'Compare the minutes with the SOP limit for this severity (rule A2).' };
    }
    if (filled(v.newCount)) r.newCount = { ok: num(v.newCount) === Q51.filter((q) => q.status === 'New').length, hint: 'Filter status = New and count the rows.' };
    if (filled(v.late)) r.late = { ok: has(v.late, /Q-?5005/i) && !has(v.late, /Q-?500[1-4]/i), hint: 'Which acknowledged alert took longer than its limit? Critical = 15 minutes.' };
    if (filled(v.first)) r.first = { ok: has(v.first, /Q-?5011/i), hint: 'A Critical red flag whose 15-minute limit is about to run out.' };
    if (filled(v.red)) r.red = { ok: ['5005', '5007', '5008', '5011'].every((x) => (v.red ?? '').includes(x)), hint: 'Look for ransomware signs (rename, shadow copy) and PE infection signs (Virus:, writes to installers).' };
    return r;
  },
};
const act51: Mission = {
  id: 'd5-act5.1', day: 5, kind: 'activity', title: 'Activity 5.1 · Receive Detection Alerts per SOP', subtitle: 'Individual, hands-on · 60 min', minutes: 60, hosts: ['seat-win', 'seat-linux'],
  intro: 'It is 09:30 on your shift. Read the SOP, check the alert queue, and record each alert\'s receipt against the SOP time limits.',
  steps: [
    { id: 'sop', host: 'seat-linux', text: 'Read the SOP rules for detection alerts (Section A).', try: 'grep -A7 "^A2" ~/day5/soc_alert_sop.txt', match: [/^(grep|cat|less|head)\b.*soc_alert_sop/] },
    { id: 'new', host: 'seat-win', text: 'List the New alerts with their time and severity.', try: String.raw`Import-Csv day5\alert_queue.csv | Where-Object status -eq New | Format-Table alert_id, received, severity, host, rule_name`, match: [/import-csv\b.*alert_queue.*(where|\?).*new/i] },
    { id: 'acked', host: 'seat-win', text: 'List the acknowledged alerts with both times.', try: String.raw`Import-Csv day5\alert_queue.csv | Where-Object status -eq Acknowledged | Format-Table alert_id, received, acknowledged, severity`, match: [/import-csv\b.*alert_queue.*acknowledged/i] },
    { id: 'linux', host: 'seat-linux', text: 'The same New list on Linux.', try: 'grep ",New," ~/day5/alert_queue.csv | cut -d, -f1,2,6,7', match: [/^grep\b.*new.*alert_queue/i] },
    { id: 'redsop', host: 'seat-linux', text: 'Read the red flags R1–R4 and V1–V3 (Section C).', try: 'grep -A20 "^SECTION C" ~/day5/soc_alert_sop.txt', match: [/^grep\b.*SECTION C.*soc_alert_sop/] },
  ],
  worksheet: ws51,
};

// ---------------------------------------------------------------- 5.2 Receive incident reports
const CHANNELS = ['', 'Phone call', 'Walk-in', 'Email', 'SMS', 'Chat', 'Video conference'];
const TYPES = ['', 'Security incident - red flag', 'Security incident', 'Social engineering attempt', 'Not a security matter'];
const NEXT = ['', 'Escalate immediately to the Shift Lead', 'Record and create a ticket', 'Do not comply; verify by callback and report', 'Record and redirect to IT Helpdesk'];
export const IR52: Record<string, { ch: string; asset: RegExp; type: string; next: string }> = {
  'IR-01': { ch: 'Phone call', asset: /FIN-PC-03/i, type: TYPES[1], next: NEXT[1] },
  'IR-02': { ch: 'Walk-in', asset: /ENG-PC-11|QA-PC-05|FS-01/i, type: TYPES[1], next: NEXT[1] },
  'IR-03': { ch: 'Email', asset: /grace|mailbox|email|lim/i, type: TYPES[2], next: NEXT[2] },
  'IR-04': { ch: 'SMS', asset: /admin|console|soc|otp|pin|ramon/i, type: TYPES[3], next: NEXT[3] },
  'IR-05': { ch: 'Chat', asset: /printer|3rd|third/i, type: TYPES[4], next: NEXT[4] },
  'IR-06': { ch: 'Video conference', asset: /LOAN-PC-08/i, type: TYPES[2], next: NEXT[2] },
};
const ws52: Worksheet = {
  id: 'ws-5.2', title: 'Activity 5.2 · Incident report intake',
  intro: 'One row per report in ~/day5/incident_reports.txt. Follow SOC-SOP-01 Section B (and Section C for red flags).',
  tables: [{ id: 'r', columns: [
    { id: 'ch', label: 'Channel', kind: 'select', options: CHANNELS }, { id: 'who', label: 'Reporter and callback' }, { id: 'asset', label: 'Affected computer / account' },
    { id: 'type', label: 'Type', kind: 'select', options: TYPES }, { id: 'next', label: 'Next step per SOP', kind: 'select', options: NEXT },
  ], rows: Object.keys(IR52).map((id) => ({ id, label: id })) }],
  fields: [
    { id: 'match', label: 'Which two reports describe the same incidents as alerts in Activity 5.1? Name the alert IDs.', kind: 'area', wide: true },
    { id: 'advice', label: 'What first-response advice do you give the IR-01 caller (SOP Section C)?', kind: 'area', wide: true },
  ],
  grade(v) {
    const r: G = {};
    for (const [id, k] of Object.entries(IR52)) {
      const f = (c: string) => `r.${id}.${c}`;
      if (filled(v[f('ch')])) r[f('ch')] = { ok: v[f('ch')] === k.ch, hint: 'Read the CHANNEL line of the report.' };
      if (filled(v[f('who')])) r[f('who')] = { ok: (v[f('who')] ?? '').trim().length >= 4, hint: 'Write the name/department and the callback number.' };
      if (filled(v[f('asset')])) r[f('asset')] = { ok: k.asset.test(v[f('asset')] ?? ''), hint: 'Which PC, account or device does the report mention?' };
      if (filled(v[f('type')])) r[f('type')] = { ok: v[f('type')] === k.type, hint: 'Red flag (Section C)? A request for a password/OTP (B3)? A hardware fault (B4)?' };
      if (filled(v[f('next')])) r[f('next')] = { ok: v[f('next')] === k.next, hint: 'Match the type to the SOP rule: C = escalate, B3 = do not comply, B4 = redirect.' };
    }
    if (filled(v.match)) r.match = { ok: has(v.match, /IR-?01/i) && has(v.match, /IR-?02/i) && has(v.match, /5005|5011/) && has(v.match, /5007|5008/), hint: 'Compare the computer names in the reports with the hosts in the alert queue.' };
    if (filled(v.advice)) {
      // telling the caller to shut down is wrong, unless it is "do NOT shut down"
      const off = /shut ?down|power off|turn off the (pc|computer)/i, negated = /(not|n't|never|huwag)\s+(\w+\s+){0,2}(shut ?down|power off|turn off the (pc|computer))/i;
      r.advice = { ok: has(v.advice, /unplug|disconnect|network|cable|wi-?fi/i) && (!off.test(v.advice ?? '') || negated.test(v.advice ?? '')), hint: 'SOP: unplug the network cable / turn off Wi-Fi, do NOT shut down, never pay.' };
    }
    return r;
  },
};
const act52: Mission = {
  id: 'd5-act5.2', day: 5, kind: 'activity', title: 'Activity 5.2 · Receive Incident Reports', subtitle: 'Individual · 45 min', minutes: 45, hosts: ['seat-linux', 'seat-win'],
  intro: 'Six people contacted the SOC through six different channels. Record each report the way SOC-SOP-01 Section B requires.',
  steps: [
    { id: 'chan', host: 'seat-linux', text: 'List each report and its channel.', try: 'grep -E "^(=== REPORT|CHANNEL)" ~/day5/incident_reports.txt', match: [/^grep\b.*(CHANNEL|REPORT).*incident_reports/] },
    { id: 'read', host: 'seat-linux', text: 'Read one report in full (change the ID for each one).', try: 'grep -A9 "REPORT IR-04" ~/day5/incident_reports.txt', match: [/^grep\b.*IR-0\d.*incident_reports/] },
    { id: 'ps', host: 'seat-win', text: 'Windows: find who sent each report.', try: String.raw`Select-String -Path day5\incident_reports.txt -Pattern "FROM"`, match: [/select-string\b.*incident_reports/i, /findstr\b.*incident_reports/i] },
    { id: 'sopb', host: 'seat-linux', text: 'Read the SOP rules for reports from people (Section B).', try: 'grep -A18 "^SECTION B" ~/day5/soc_alert_sop.txt', match: [/^grep\b.*SECTION B.*soc_alert_sop/] },
  ],
  worksheet: ws52,
};

// ---------------------------------------------------------------- 5.3 Red flag check: ransomware or PE infection?
const VERD = ['', 'Ransomware red flag', 'PE infection red flag', 'No red flag (approved software)'];
export const H53: Record<string, { v: string; codes: RegExp[] }> = {
  'FIN-PC-03': { v: VERD[1], codes: [/R1/i, /R2/i, /R3/i] },
  'ENG-PC-11': { v: VERD[2], codes: [/V1/i] },
  'QA-PC-05': { v: VERD[2], codes: [/V2/i, /V3/i] },
  'FS-02': { v: VERD[3], codes: [] },
  'HR-LT-07': { v: VERD[3], codes: [] },
};
const ws53: Worksheet = {
  id: 'ws-5.3', title: 'Activity 5.3 · Red flag check',
  intro: 'Use ~/day5/edr_file_events.csv and SOC-SOP-01 Section C. For each host: verdict and the red-flag codes you saw (R1–R4, V1–V3, or "none").',
  tables: [{ id: 'h', columns: [{ id: 'v', label: 'Verdict', kind: 'select', options: VERD }, { id: 'codes', label: 'Red-flag codes' }], rows: Object.keys(H53).map((id) => ({ id, label: id })) }],
  fields: [
    { id: 'renamed', label: 'FIN-PC-03: how many files were renamed?', kind: 'text' },
    { id: 'ext', label: 'FIN-PC-03: the new extension and the ransom note file name', kind: 'text' },
    { id: 'firstR', label: 'FIN-PC-03: time of the first rename, and the process that did it', kind: 'text' },
    { id: 'modified', label: 'ENG-PC-11: how many installer files were modified?', kind: 'text' },
    { id: 'source', label: 'Where did the PE infection start? (host and file)', kind: 'text' },
    { id: 'why', label: 'Why are FS-02 and HR-LT-07 NOT red flags?', kind: 'area', wide: true },
  ],
  grade(v) {
    const r: G = {};
    for (const [h, k] of Object.entries(H53)) {
      const vk = `h.${h}.v`, ck = `h.${h}.codes`;
      if (filled(v[vk])) r[vk] = { ok: v[vk] === k.v, hint: 'Who made the changes? Unsigned process or approved, signed software?' };
      if (filled(v[ck])) r[ck] = { ok: k.codes.length ? k.codes.some((c) => c.test(v[ck] ?? '')) && !has(v[ck], k.v.startsWith('Ransom') ? /V\d/i : /R\d/i) : has(v[ck], /none|n\/a|-|0|wala/i), hint: k.codes.length ? 'Match what the events show to the SOP codes.' : 'Approved software: no red-flag code.' };
    }
    if (filled(v.renamed)) r.renamed = { ok: num(v.renamed) === 24, hint: 'Count the Rename actions on FIN-PC-03 (share + Documents).' };
    if (filled(v.ext)) r.ext = { ok: has(v.ext, /lockd/i) && has(v.ext, /README_RESTORE_FILES/i), hint: 'Look at new_path, and at the Create actions on FIN-PC-03.' };
    if (filled(v.firstR)) r.firstR = { ok: has(v.firstR, /08:24:51/) && has(v.firstR, /svcupd/i), hint: 'The earliest Rename row: its time and process.' };
    if (filled(v.modified)) r.modified = { ok: num(v.modified) === 9, hint: 'Count the Modify actions on ENG-PC-11.' };
    if (filled(v.source)) r.source = { ok: has(v.source, /ENG-PC-11/i) && has(v.source, /pdfreader_setup/i), hint: 'Which host modified the installers first, with which program?' };
    if (filled(v.why)) r.why = { ok: has(v.why, /approved|signed|backup|windows update|scbackup|tiworker/i), hint: 'Check the process and the signer against the approved list in Section C.' };
    return r;
  },
};
const act53: Mission = {
  id: 'd5-act5.3', day: 5, kind: 'activity', title: 'Activity 5.3 · Red Flag Check: Ransomware or PE Infection?', subtitle: 'Individual, hands-on · 75 min', minutes: 75, hosts: ['seat-linux', 'seat-win'],
  intro: 'The EDR export covers five hosts from this morning. Decide which show ransomware red flags, which show a PE infection, and which are normal approved activity.',
  steps: [
    { id: 'count', host: 'seat-linux', text: 'Count the actions per host.', try: 'cut -d, -f2,5 ~/day5/edr_file_events.csv | sort | uniq -c', match: [/^(cut|awk)\b.*edr_file_events/] },
    { id: 'renames', host: 'seat-linux', text: 'Look at the renames: old name, new name, process.', try: 'grep ",Rename," ~/day5/edr_file_events.csv | cut -d, -f1,3,6,7 | head', match: [/^grep\b.*rename.*edr_file_events/i] },
    { id: 'notes', host: 'seat-linux', text: 'Look for ransom note files and backup deletion.', try: 'grep -E "README|vssadmin" ~/day5/edr_file_events.csv', match: [/^grep\b.*(readme|vssadmin|restore).*edr_file_events/i] },
    { id: 'signer', host: 'seat-win', text: 'Group the events by signer: approved or unsigned?', try: String.raw`Import-Csv day5\edr_file_events.csv | Group-Object signer`, match: [/import-csv\b.*edr_file_events.*group-object/i] },
    { id: 'virus', host: 'seat-win', text: 'Show the antivirus detections.', try: String.raw`Import-Csv day5\edr_file_events.csv | Where-Object detection -like "Virus*" | Format-Table time, host, path, detection`, match: [/import-csv\b.*edr_file_events.*detection/i] },
    { id: 'pe', host: 'seat-win', text: 'Which installers did ENG-PC-11 modify?', try: String.raw`Import-Csv day5\edr_file_events.csv | Where-Object action -eq Modify | Format-Table time, host, process, path`, match: [/import-csv\b.*edr_file_events.*modify/i] },
  ],
  worksheet: ws53,
};

// ---------------------------------------------------------------- 5.4 Check for alerts on your own workstation (per seat)
const ws54: Worksheet = {
  id: 'ws-5.4', title: 'Activity 5.4 · My workstation check',
  intro: 'Use YOUR WKS-LAB workstation: C:\\Users\\<you>\\day5\\my_edr_events.csv and your Documents folder. Every seat is different.',
  fields: [
    { id: 'verdict', label: 'Red flag found?', kind: 'select', options: ['', 'Ransomware red flag', 'PE infection red flag', 'No red flag'] },
    { id: 'codes', label: 'Red-flag codes (R1–R4 / V1–V3, or "none")', kind: 'text' },
    { id: 'count', label: 'How many files were renamed or modified by the suspicious (or approved) process?', kind: 'text' },
    { id: 'first', label: 'Time of the first such event (HH:MM:SS)', kind: 'text' },
    { id: 'process', label: 'Process file name', kind: 'text' },
    { id: 'detail', label: 'Ransomware: new extension + note file name. PE: detection name. None: which approved software?', kind: 'text' },
    { id: 'action', label: 'Action per SOP', kind: 'select', options: ['', 'Escalate immediately to the Shift Lead (local 4401)', 'Record in the shift log; no escalation'] },
  ],
  grade(v, { facts }) {
    const f = facts.day5, r: G = {};
    const want = f.kind === 'ransomware' ? 'Ransomware red flag' : f.kind === 'pe' ? 'PE infection red flag' : 'No red flag';
    if (filled(v.verdict)) r.verdict = { ok: v.verdict === want, hint: 'Are the changes made by an unsigned process, or by approved signed software?' };
    if (filled(v.codes)) r.codes = { ok: f.kind === 'ransomware' ? has(v.codes, /R1|R2/i) : f.kind === 'pe' ? has(v.codes, /V1|V2/i) : has(v.codes, /none|n\/a|-|0|wala/i), hint: 'Match what you saw to SOC-SOP-01 Section C.' };
    // ransomware: the process also created the note, so "renames + note" is accepted too
    if (filled(v.count)) r.count = { ok: num(v.count) === f.count || (f.kind === 'ransomware' && num(v.count) === f.count + 1), hint: 'Count the Rename / Modify / Create rows of that process.' };
    if (filled(v.first)) r.first = { ok: (v.first ?? '').includes(f.first), hint: 'The earliest row of that process (Rename, Modify or Create).' };
    if (filled(v.process)) r.process = { ok: (v.process ?? '').toLowerCase().includes(f.process.toLowerCase()), hint: 'The file name at the end of the process path.' };
    if (filled(v.detail)) r.detail = { ok: f.kind === 'ransomware' ? (v.detail ?? '').includes(f.ext!) && (v.detail ?? '').toLowerCase().includes(f.note!.toLowerCase()) : f.kind === 'pe' ? (v.detail ?? '').toLowerCase().includes(f.detection!.split('/')[1].split('.')[0].toLowerCase()) : has(v.detail, /safecopy|scbackup|backup/i), hint: f.kind === 'ransomware' ? 'Get-ChildItem Documents shows both.' : f.kind === 'pe' ? 'Look at the detection column.' : 'Which signed program made the changes?' };
    if (filled(v.action)) r.action = { ok: v.action.startsWith(f.kind === 'none' ? 'Record' : 'Escalate'), hint: 'Red flags are escalated immediately; approved activity is only recorded.' };
    return r;
  },
};
const act54: Mission = {
  id: 'd5-act5.4', day: 5, kind: 'activity', title: 'Activity 5.4 · Check for Alerts on Your Workstation', subtitle: 'Individual, hands-on · 45 min', minutes: 45, hosts: ['seat-win'],
  intro: 'Apply the red-flag check to YOUR OWN WKS-LAB workstation. Your classmates have different evidence, so do your own work.',
  steps: [
    { id: 'signer', host: 'seat-win', text: 'Group your EDR events by signer.', try: String.raw`Import-Csv day5\my_edr_events.csv | Group-Object signer`, match: [/import-csv\b.*my_edr_events.*group-object/i] },
    { id: 'all', host: 'seat-win', text: 'Show every event: time, process, action, path.', try: String.raw`Import-Csv day5\my_edr_events.csv | Format-Table time, process, action, path, new_path`, match: [/import-csv\b.*my_edr_events.*format-(table|list)/i] },
    { id: 'docs', host: 'seat-win', text: 'Look at your Documents folder.', try: 'Get-ChildItem Documents', match: [/(get-childitem|dir|ls|gci)\b.*documents/i] },
    { id: 'count', host: 'seat-win', text: 'Count the events of each process.', try: String.raw`Import-Csv day5\my_edr_events.csv | Group-Object process`, match: [/import-csv\b.*my_edr_events.*(group-object\s+process|where|\?|measure-object)/i] },
  ],
  worksheet: ws54,
};

export const DAY5: ScenarioPack = { day: 5, title: 'Day 5 · Checking for Alerts', missions: [p51, p52, p53, act51, act52, act53, act54] };
