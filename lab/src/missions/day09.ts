// Day 9 scenario pack: Case Follow-up and Escalation (CS-ICT251101 Element 4, PC 4.1–4.3). Practice missions + Activities 9.1–9.4.
// Answers follow SOC-SOP-05 (~/day9/soc_followup_sop.txt) and the files written by _build/day09_data.py.
import type { Mission, ScenarioPack, Worksheet } from './types';

type G = Record<string, { ok: boolean; hint?: string }>;
const filled = (v?: string) => !!v && v.trim().length > 0;
const has = (v: string | undefined, ...re: RegExp[]) => !!v && re.some((r) => r.test(v));
const num = (v?: string) => { const m = (v ?? '').match(/\d+/); return m ? Number(m[0]) : NaN; };
const YN = ['', 'Yes', 'No'];
export const AUTH = ['', 'Chief Information Security Officer (CISO)', 'Information Security Manager', 'Security solution vendor', 'IT Department Manager'];

// ---------------------------------------------------------------- practice missions (repeat the demo videos)
const p91: Mission = {
  id: 'd9-demo1', day: 9, kind: 'practice', title: 'Practice: Demo 1 · Verify Results with the Stakeholder', subtitle: 'Repeat Video 1 with the school cases', minutes: 10,
  video: 'Day09_Demo1_Verify_with_Stakeholder.mp4', hosts: ['demo-linux'],
  intro: 'Read the closed-out cases and what each stakeholder said, and decide: close, re-open, or follow up, like Video 1.',
  steps: [
    { id: 'cases', host: 'demo-linux', text: 'The cases waiting for confirmation.', try: 'cut -d, -f1,2,4,5 ~/demo9/demo_case_results.csv', match: [/^(cut|cat)\b.*demo_case_results/] },
    { id: 'replies', host: 'demo-linux', text: 'What did the stakeholders say?', try: 'cat ~/demo9/demo_replies.txt', why: 'DC-2: the Free Converter window still appears = symptoms remain: re-open and re-check LAB-PC-15.', match: [/^(cat|grep)\b.*demo_replies/] },
    { id: 'rule', host: 'demo-linux', text: 'Read rule F1.4.', try: 'grep -A6 "^F1.4" ~/day9/soc_followup_sop.txt', match: [/^grep\b.*F1.*soc_followup_sop/] },
  ],
};
const p92: Mission = {
  id: 'd9-demo2', day: 9, kind: 'practice', title: 'Practice: Demo 2 · Find the Failed Actions', subtitle: 'Repeat Video 2 with demo_scan_logs.csv', minutes: 10,
  video: 'Day09_Demo2_Find_Failed_Actions.mp4', hosts: ['demo-linux', 'demo-win'],
  intro: 'Search the scan logs for the five failure event IDs in rule F2, like Video 2.',
  steps: [
    { id: 'rule', host: 'demo-linux', text: 'Which events are failed actions? (F2)', try: 'grep -A10 "^F2  CHECK" ~/day9/soc_followup_sop.txt', match: [/^grep\b.*F2.*soc_followup_sop/] },
    { id: 'grep', host: 'demo-linux', text: 'Find them in the scan log.', try: 'grep -E ",(1118|1119|1002|1005|2001)," ~/demo9/demo_scan_logs.csv', why: 'REG-PC-01 (1118 file in use) and MKT-PC-04 (1005 engine error).', match: [/^grep\b.*111.*demo_scan_logs/] },
    { id: 'ps', host: 'demo-win', text: 'The same in PowerShell.', try: String.raw`Import-Csv demo9\demo_scan_logs.csv | Group-Object event_id`, match: [/import-csv\b.*demo_scan_logs/i] },
  ],
};
const p93: Mission = {
  id: 'd9-demo3', day: 9, kind: 'practice', title: 'Practice: Demo 3 · Escalate to the Appropriate Authority', subtitle: 'Repeat Video 3: rules E1–E4', minutes: 10,
  video: 'Day09_Demo3_Escalate.mp4', hosts: ['demo-linux'],
  intro: 'Apply the escalation rules in order to the two school failures and fill in the escalation record, like Video 3.',
  steps: [
    { id: 'rules', host: 'demo-linux', text: 'Read the escalation rules E1–E4.', try: 'grep -A16 "^Check the rules" ~/day9/soc_followup_sop.txt', match: [/^grep\b.*(Check the rules|E\d|F3).*soc_followup_sop/] },
    { id: 'tpl', host: 'demo-linux', text: 'Read the escalation record template.', try: 'cat ~/day9/escalation_template.txt', match: [/^(cat|less|head)\b.*escalation_template/] },
  ],
};

// ---------------------------------------------------------------- 9.1 Verify results with the stakeholder (PC 4.1)
export const OUT = ['', 'Confirmed resolved', 'Symptoms remain', 'No reply'];
export const NEXT91 = ['', 'Close the case', 'Re-open and re-check the host', 'Try again after 2 hours', 'Email the stakeholder\'s supervisor'];
export const KEY91: Record<string, [RegExp, string, string]> = {
  'C-01': [/maria|reyes/i, OUT[1], NEXT91[1]], 'C-02': [/carlo|diaz/i, OUT[2], NEXT91[2]], 'C-03': [/leo|uy|dev team/i, OUT[3], NEXT91[4]],
  'C-04': [/rosa|mendoza/i, OUT[1], NEXT91[1]], 'C-05': [/alvin|jimenez/i, OUT[1], NEXT91[1]],
};
const ws91: Worksheet = {
  id: 'ws-9.1', title: 'Activity 9.1 · Stakeholder verification (SOC-SOP-05 F1)',
  intro: 'For each case in ~/day9/case_results.csv: the stakeholder (stakeholder_directory.csv), their reply (stakeholder_replies.txt), and the next step (rule F1.4).',
  tables: [{ id: 'c', columns: [{ id: 'who', label: 'Stakeholder' }, { id: 'o', label: 'Reply', kind: 'select', options: OUT }, { id: 'n', label: 'Next step', kind: 'select', options: NEXT91 }], rows: Object.keys(KEY91).map((id) => ({ id, label: id })) }],
  fields: [{ id: 'msg', label: 'Write what you tell Maria Reyes (C-01) on the phone: what was found, what was done, what she must do.', kind: 'area', wide: true }],
  grade(v) {
    const r: G = {};
    for (const [id, [who, o, n]] of Object.entries(KEY91)) {
      if (filled(v[`c.${id}.who`])) r[`c.${id}.who`] = { ok: who.test(v[`c.${id}.who`] ?? ''), hint: 'Look the host up in stakeholder_directory.csv.' };
      if (filled(v[`c.${id}.o`])) r[`c.${id}.o`] = { ok: v[`c.${id}.o`] === o, hint: 'Read the reply in stakeholder_replies.txt.' };
      if (filled(v[`c.${id}.n`])) r[`c.${id}.n`] = { ok: v[`c.${id}.n`] === n, hint: 'Rule F1.4. For "no reply", count the attempts.' };
    }
    if (filled(v.msg)) r.msg = { ok: has(v.msg, /trojan|malware|payslip|virus/i) && has(v.msg, /quarantin|removed|gone|deleted/i) && !has(v.msg, /password\s*(is|:)/i), hint: 'Plain words: what was found, what the antivirus did, what she must do. Never a password.' };
    return r;
  },
};
const act91: Mission = {
  id: 'd9-act9.1', day: 9, kind: 'activity', title: 'Activity 9.1 · Verify Results with the Stakeholder', subtitle: 'Individual, hands-on · 45 min', minutes: 45, hosts: ['seat-linux', 'seat-win'],
  intro: 'A case closes only when the stakeholder confirms the result. Contact, record, and decide (PC 4.1).',
  steps: [
    { id: 'rule', host: 'seat-linux', text: 'Read rule F1.', try: 'grep -A18 "^F1  VERIFY" ~/day9/soc_followup_sop.txt', match: [/^(grep|cat)\b.*soc_followup_sop/] },
    { id: 'cases', host: 'seat-linux', text: 'The cases to verify.', try: 'cut -d, -f1,2,4,5 ~/day9/case_results.csv', match: [/^(cut|cat)\b.*case_results/] },
    { id: 'who', host: 'seat-win', text: 'Who is the stakeholder for each host?', try: String.raw`Import-Csv day9\stakeholder_directory.csv | Format-Table`, match: [/import-csv\b.*stakeholder_directory/i] },
    { id: 'reply', host: 'seat-linux', text: 'Read one reply (change the case ID).', try: 'grep -A3 "CASE C-02" ~/day9/stakeholder_replies.txt', match: [/^(grep|cat)\b.*stakeholder_replies/] },
  ],
  worksheet: ws91,
};

// ---------------------------------------------------------------- 9.2 Check the scan logs for failed actions (PC 4.2)
export const KEY92: Record<string, string> = { // row label (time host) -> failed?
  '11:02 HR-LT-07': 'No', '11:05 LOAN-PC-08': 'Yes', '11:09 PAY-PC-02': 'Yes', '11:12 LOAN-PC-03': 'Yes', '11:15 IT-PC-01': 'No', '11:20 FIN-PC-03': 'Yes', '11:24 DEV-PC-02': 'No',
  '11:27 MKT-PC-09': 'Yes', '11:31 ENG-PC-11': 'Yes', '11:34 DC-01': 'No', '11:38 FS-01': 'No', '11:42 ADM-PC-02': 'No', '11:58 ADM-PC-02': 'No',
};
const rowId = (label: string) => label.replace(/[^A-Za-z0-9]/g, '');
const ws92: Worksheet = {
  id: 'ws-9.2', title: 'Activity 9.2 · Failed actions in the scan logs (SOC-SOP-05 F2)',
  intro: 'One row per line of ~/day9/scan_logs.csv. A failed action is event 1118, 1119, 1002, 1005 or 2001.',
  tables: [{ id: 's', columns: [{ id: 'f', label: 'Failed action?', kind: 'select', options: YN }], rows: Object.keys(KEY92).map((l) => ({ id: rowId(l), label: l })) }],
  fields: [
    { id: 'count', label: 'How many failed actions?', kind: 'text' },
    { id: 'why1117', label: 'IT-PC-01 shows event 1117. Why is it not a failure?', kind: 'text' },
  ],
  grade(v) {
    const r: G = {};
    for (const [l, want] of Object.entries(KEY92)) { const k = `s.${rowId(l)}.f`; if (filled(v[k])) r[k] = { ok: v[k] === want, hint: 'Compare the event_id with the list in rule F2.' }; }
    if (filled(v.count)) r.count = { ok: num(v.count) === 6, hint: 'grep -E ",(1118|1119|1002|1005|2001)," and count.' };
    if (filled(v.why1117)) r.why1117 = { ok: has(v.why1117, /action taken|success|worked|not a fail/i), hint: 'What does 1117 mean?' };
    return r;
  },
};
const act92: Mission = {
  id: 'd9-act9.2', day: 9, kind: 'activity', title: 'Activity 9.2 · Check the Scan Logs for Failed Actions', subtitle: 'Individual, hands-on · 45 min', minutes: 45, hosts: ['seat-linux', 'seat-win'],
  intro: 'Search the security solution\'s scan logs for every failed action (PC 4.2).',
  steps: [
    { id: 'rule', host: 'seat-linux', text: 'Which events are failed actions?', try: 'grep -A10 "^F2  CHECK" ~/day9/soc_followup_sop.txt', match: [/^grep\b.*F2.*soc_followup_sop/] },
    { id: 'all', host: 'seat-linux', text: 'Read the scan log.', try: 'cat ~/day9/scan_logs.csv', match: [/^(cat|cut|head)\b.*scan_logs/] },
    { id: 'grep', host: 'seat-linux', text: 'Only the failures.', try: 'grep -E ",(1118|1119|1002|1005|2001)," ~/day9/scan_logs.csv', match: [/^grep\b.*scan_logs/] },
    { id: 'ps', host: 'seat-win', text: 'Count each event ID in PowerShell.', try: String.raw`Import-Csv day9\scan_logs.csv | Group-Object event_id`, match: [/import-csv\b.*scan_logs/i] },
  ],
  worksheet: ws92,
};

// ---------------------------------------------------------------- 9.3 Escalate to the appropriate authority (PC 4.3)
export const KEY93: Record<string, [string, string]> = {
  'LOAN-PC-08': ['E4', AUTH[4]], 'PAY-PC-02': ['E2', AUTH[2]], 'LOAN-PC-03': ['E3', AUTH[3]], 'FIN-PC-03': ['E1', AUTH[1]], 'MKT-PC-09': ['E3', AUTH[3]], 'ENG-PC-11': ['E2', AUTH[2]],
};
const ws93: Worksheet = {
  id: 'ws-9.3', title: 'Activity 9.3 · Escalation (SOC-SOP-05 F3)',
  intro: 'For each failed action from 9.2, apply E1–E4 IN ORDER (first match wins). Use asset tiers (~/day6/asset_inventory.csv) and the Day 5–6 red flags. Then write the escalation record for FIN-PC-03.',
  tables: [{ id: 'e', columns: [{ id: 'r', label: 'Rule', kind: 'select', options: ['', 'E1', 'E2', 'E3', 'E4'] }, { id: 'a', label: 'Escalate to', kind: 'select', options: AUTH }], rows: Object.keys(KEY93).map((id) => ({ id, label: id })) }],
  fields: [
    { id: 'to', label: 'FIN-PC-03 record · Escalated to', kind: 'select', options: AUTH },
    { id: 'impact', label: 'Impact: what is still at risk?', kind: 'area', wide: true },
    { id: 'need', label: 'What is needed from them?', kind: 'area', wide: true },
    { id: 'target', label: 'Response target (minutes)', kind: 'text' },
    { id: 'follow', label: 'Follow-up time if no response (called at 11:20)', kind: 'text' },
  ],
  grade(v) {
    const r: G = {};
    for (const [h, [rule, a]] of Object.entries(KEY93)) {
      if (filled(v[`e.${h}.r`])) r[`e.${h}.r`] = { ok: v[`e.${h}.r`] === rule, hint: 'Check E1 first, then E2, E3, E4. Was this host a red flag? Is it Tier 1? Did the product itself fail?' };
      if (filled(v[`e.${h}.a`])) r[`e.${h}.a`] = { ok: v[`e.${h}.a`] === a, hint: 'Each rule names one authority.' };
    }
    if (filled(v.to)) r.to = { ok: v.to === AUTH[1], hint: 'Ransomware reached the Tier 1 file server FS-01: rule E1.' };
    if (filled(v.impact)) r.impact = { ok: has(v.impact, /FS-01|finance share|share/i) && has(v.impact, /encrypt|ransom/i), hint: 'Read the FIN-PC-03 line of scan_logs.csv.' };
    if (filled(v.need)) r.need = { ok: has(v.need, /decision|isolat|disconnect|restore|backup|incident response|approv/i), hint: 'What decision or action do you need from the CISO?' };
    if (filled(v.target)) r.target = { ok: num(v.target) === 15, hint: 'Rule F3 response targets.' };
    if (filled(v.follow)) r.follow = { ok: /11:3[0-5]/.test(v.follow ?? ''), hint: '11:20 + the CISO target.' };
    return r;
  },
};
const act93: Mission = {
  id: 'd9-act9.3', day: 9, kind: 'activity', title: 'Activity 9.3 · Escalate to the Appropriate Authority', subtitle: 'Individual, hands-on · 60 min', minutes: 60, hosts: ['seat-linux', 'seat-win'],
  intro: 'Every failed action goes to the right person. Apply the escalation rules in order and write the escalation record (PC 4.3).',
  steps: [
    { id: 'rules', host: 'seat-linux', text: 'Read rules E1–E4.', try: 'grep -A16 "^Check the rules" ~/day9/soc_followup_sop.txt', match: [/^grep\b.*(Check the rules|E\d|F3).*soc_followup_sop/] },
    { id: 'tiers', host: 'seat-win', text: 'The tiers of the failed hosts.', try: String.raw`Import-Csv day6\asset_inventory.csv | Format-Table host, role, tier`, match: [/import-csv\b.*asset_inventory/i] },
    { id: 'red', host: 'seat-linux', text: 'Which of them were red flags on Day 5?', try: 'grep -E "FIN-PC-03|ENG-PC-11|QA-PC-05" ~/day5/edr_file_events.csv | cut -d, -f2,5,8 | sort | uniq -c', match: [/^grep\b.*edr_file_events/] },
    { id: 'tpl', host: 'seat-linux', text: 'Read the escalation record template.', try: 'cat ~/day9/escalation_template.txt', match: [/^(cat|less|head)\b.*escalation_template/] },
  ],
  worksheet: ws93,
};

// ---------------------------------------------------------------- 9.4 Follow up your own workstation (per seat)
const ws94: Worksheet = {
  id: 'ws-9.4', title: 'Activity 9.4 · My workstation follow-up',
  intro: 'Use YOUR workstation\'s scan log: C:\\Users\\<you>\\day9\\my_scan_log.csv (after yesterday\'s scan). Your workstation is Tier 2 and its threat is not a red flag. Every seat is different.',
  fields: [
    { id: 'count', label: 'How many failed actions?', kind: 'text' },
    { id: 'events', label: 'Their event IDs', kind: 'text' },
    { id: 'it', label: 'Do you escalate to the IT Department Manager (rule E4)?', kind: 'select', options: YN },
    { id: 'vendor', label: 'Do you open a vendor support case (rule E3)?', kind: 'select', options: YN },
  ],
  grade(v, { facts }) {
    const f = facts.day9, r: G = {};
    const ids = f.failures.map((x) => x.event);
    if (filled(v.count)) r.count = { ok: num(v.count) === ids.length, hint: 'Count the 1118, 1119, 1002, 1005 and 2001 rows.' };
    if (filled(v.events)) { const got = ((v.events ?? '').match(/\d{4}/g) ?? []).map(Number); r.events = { ok: ids.every((e) => got.includes(e)) && got.every((e) => ids.includes(e)), hint: 'List exactly the failure event IDs from your log.' }; }
    if (filled(v.it)) r.it = { ok: v.it === (f.failures.some((x) => x.rule === 'E4') ? 'Yes' : 'No'), hint: 'E4: failed actions on a business computer (1118, 1002).' };
    if (filled(v.vendor)) r.vendor = { ok: v.vendor === (f.vendorCase ? 'Yes' : 'No'), hint: 'E3: the product itself failed (1005, 2001).' };
    return r;
  },
};
const act94: Mission = {
  id: 'd9-act9.4', day: 9, kind: 'activity', title: 'Activity 9.4 · Follow Up Your Own Workstation', subtitle: 'Individual, hands-on · 30 min', minutes: 30, hosts: ['seat-win'],
  intro: 'Check YOUR workstation\'s scan log after yesterday\'s scan, find the failed actions and decide whom to escalate them to.',
  steps: [
    { id: 'log', host: 'seat-win', text: 'Read your scan log.', try: String.raw`Import-Csv day9\my_scan_log.csv | Format-Table time, event_id, detail`, match: [/import-csv\b.*my_scan_log/i] },
    { id: 'groups', host: 'seat-win', text: 'Count each event ID.', try: String.raw`Import-Csv day9\my_scan_log.csv | Group-Object event_id`, match: [/import-csv\b.*my_scan_log.*group-object/i] },
    { id: 'rules', host: 'seat-win', text: 'Read the escalation rules on Windows.', try: String.raw`Select-String -Path day9\soc_followup_sop.txt -Pattern "^  E"`, match: [/select-string\b.*soc_followup_sop/i] },
  ],
  worksheet: ws94,
};

export const DAY9: ScenarioPack = { day: 9, title: 'Day 9 · Case Follow-up and Escalation', missions: [p91, p92, p93, act91, act92, act93, act94] };
