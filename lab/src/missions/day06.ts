// Day 6 scenario pack: Alert Triage and Ticketing (CS-ICT251101 Element 1, PC 1.4–1.5). Practice missions + Activities 6.1–6.4.
// Answers follow SOC-SOP-02 (~/day6/soc_triage_sop.txt) and the files written by _build/day06_data.py.
import type { Mission, ScenarioPack, Worksheet } from './types';

type G = Record<string, { ok: boolean; hint?: string }>;
const filled = (v?: string) => !!v && v.trim().length > 0;
const has = (v: string | undefined, ...re: RegExp[]) => !!v && re.some((r) => r.test(v));
const num = (v?: string) => { const m = (v ?? '').match(/\d+/); return m ? Number(m[0]) : NaN; };

export const DISP = ['', 'Confirmed', 'Blocked', 'False positive', 'Routine'];
export const THREAT = ['', 'Critical', 'High', 'Medium', 'Low', '-'];
export const PRIO = ['', 'P1', 'P2', 'P3', 'P4', '-'];
const YN = ['', 'Yes', 'No'];

// ---------------------------------------------------------------- practice missions (repeat the demo videos)
const p61: Mission = {
  id: 'd6-demo1', day: 6, kind: 'practice', title: 'Practice: Demo 1 · Assess Alerts Against Criteria', subtitle: 'Repeat Video 1 with the school demo alerts', minutes: 10,
  video: 'Day06_Demo1_Assess_Alerts.mp4', hosts: ['demo-linux', 'demo-win'],
  intro: 'Read the priority matrix, the alert details and the asset tiers, then assess the six school alerts, like Video 1.',
  steps: [
    { id: 'matrix', host: 'demo-linux', text: 'Read the priority matrix (STEP 5) in SOC-SOP-02.', try: 'grep -A6 "PRIORITY MATRIX" ~/day6/soc_triage_sop.txt', match: [/^grep\b.*(PRIORITY|STEP).*soc_triage_sop/] },
    { id: 'details', host: 'demo-win', text: 'What really happened? Show the details of every demo alert.', try: String.raw`Import-Csv demo6\demo_alert_details.csv | Format-List alert_id, result, details`, match: [/import-csv\b.*demo_alert_details/i] },
    { id: 'tiers', host: 'demo-win', text: 'How important is each computer? Show the asset tiers.', try: String.raw`Import-Csv demo6\demo_assets.csv | Format-Table host, role, tier`, why: 'REG-PC-01 holds student records: Tier 1. So the confirmed data leak D5-04 (High) becomes P1.', match: [/import-csv\b.*demo_assets/i] },
  ],
};
const p62: Mission = {
  id: 'd6-demo2', day: 6, kind: 'practice', title: 'Practice: Demo 2 · True Positive, False Positive or Routine?', subtitle: 'Repeat Video 2 with demo_borderline.csv', minutes: 10,
  video: 'Day06_Demo2_True_or_False_Positive.mp4', hosts: ['demo-win', 'demo-linux'],
  intro: 'Check three borderline alerts against the change calendar and the routine list before you decide, like Video 2.',
  steps: [
    { id: 'list', host: 'demo-win', text: 'Read the three borderline alerts in full.', try: String.raw`Import-Csv demo6\demo_borderline.csv | Format-List alert_id, rule_name, host, user, details`, match: [/import-csv\b.*demo_borderline/i] },
    { id: 'changes', host: 'demo-linux', text: 'Is there an approved change for any of them?', try: 'cat ~/demo6/demo_changes.txt', why: 'CHG-3101 covers DB-1 (same host, same person, inside the window): routine. 203.0.113.35 is the VPN gateway: DB-2 is a false positive.', match: [/^(cat|grep|less|head)\b.*demo_changes/] },
    { id: 'routine', host: 'demo-linux', text: 'Read the routine list (STEP 1).', try: 'grep "^RT" ~/day6/soc_triage_sop.txt', match: [/^grep\b.*RT.*soc_triage_sop/] },
  ],
};
const p63: Mission = {
  id: 'd6-demo3', day: 6, kind: 'practice', title: 'Practice: Demo 3 · Write the Ticket', subtitle: 'Repeat Video 3: the LIB-PC-02 ransomware ticket', minutes: 15,
  video: 'Day06_Demo3_Write_the_Ticket.mp4', hosts: ['demo-linux'],
  intro: 'Collect every alert and report about LIB-PC-02, then fill in the ticket template, like Video 3.',
  steps: [
    { id: 'template', host: 'demo-linux', text: 'Read the ticket template.', try: 'cat ~/day6/ticket_template.txt', match: [/^(cat|less|head)\b.*ticket_template/] },
    { id: 'alerts', host: 'demo-linux', text: 'Every demo alert about LIB-PC-02.', try: 'grep LIB-PC-02 ~/demo5/demo_alert_queue.csv', why: 'D5-02 (ransom note) and D5-06 (agent keep-alive, routine). Only D5-02 belongs on the ticket.', match: [/^grep\b.*LIB-PC-02.*demo_alert_queue/] },
    { id: 'evidence', host: 'demo-linux', text: 'The evidence for D5-02.', try: 'grep D5-02 ~/demo6/demo_alert_details.csv', match: [/^grep\b.*D5-02.*demo_alert_details/] },
    { id: 'report', host: 'demo-linux', text: 'The phone report about the same PC.', try: 'grep -A7 "REPORT DR-1" ~/demo5/demo_incident_reports.txt', match: [/^grep\b.*DR-1.*demo_incident_reports/] },
  ],
};

// ---------------------------------------------------------------- 6.1 Assess alerts against criteria (the Day 5 queue)
export const KEY61: Record<string, [string, string, string, string, string]> = { // disposition, threat, tier, priority, ticket
  'Q-5001': ['Confirmed', 'High', '1', 'P1', 'Yes'], 'Q-5002': ['Blocked', 'Medium', '2', 'P3', 'No'], 'Q-5003': ['Blocked', 'Low', '1', 'P3', 'No'],
  'Q-5004': ['Blocked', 'Medium', '1', 'P2', 'No'], 'Q-5005': ['Confirmed', 'Critical', '2', 'P1', 'Yes'], 'Q-5006': ['Confirmed', 'High', '1', 'P1', 'Yes'],
  'Q-5007': ['Confirmed', 'Critical', '2', 'P1', 'Yes'], 'Q-5008': ['Confirmed', 'Critical', '2', 'P1', 'Yes'], 'Q-5009': ['Routine', '-', '1', '-', 'No'],
  'Q-5010': ['Blocked', 'Medium', '2', 'P3', 'No'], 'Q-5011': ['Confirmed', 'Critical', '2', 'P1', 'Yes'], 'Q-5012': ['Routine', '-', '1', '-', 'No'],
  'Q-5013': ['Blocked', 'Low', '3', 'P4', 'No'],
};
const HINT61 = {
  disp: 'STEP 1 routine list first; then read the result and details: did it happen (Confirmed), was it stopped (Blocked), or was it harmless (False positive)? Red flags are always Confirmed.',
  threat: 'STEP 3: red flag = Critical; confirmed compromise or data out = High; blocked attempt = Medium; nuisance = Low. Routine = "-".',
  tier: 'Look up the AFFECTED asset (alert_details.csv) in asset_inventory.csv.',
  prio: 'STEP 5 matrix: threat row x tier column. Routine and false positive = "-".',
  ticket: 'T1: a ticket only for Confirmed detections.',
};
const ws61: Worksheet = {
  id: 'ws-6.1', title: 'Activity 6.1 · Assessment of the Day 5 queue',
  intro: 'One row per alert in ~/day5/alert_queue.csv. Use ~/day6/alert_details.csv, ~/day6/asset_inventory.csv and SOC-SOP-02 STEPS 1–5.',
  tables: [{ id: 'a', columns: [
    { id: 'disp', label: 'Detection', kind: 'select', options: DISP }, { id: 'threat', label: 'Threat', kind: 'select', options: THREAT },
    { id: 'tier', label: 'Asset tier', kind: 'select', options: ['', '1', '2', '3'] }, { id: 'prio', label: 'Priority', kind: 'select', options: PRIO },
    { id: 'ticket', label: 'Ticket?', kind: 'select', options: YN },
  ], rows: Object.keys(KEY61).map((id) => ({ id, label: id })) }],
  fields: [
    { id: 'count', label: 'How many incident tickets do you open? (rule T2: one per incident)', kind: 'text' },
    { id: 'linked', label: 'Which alerts are linked to the FIN-PC-03 ticket?', kind: 'text' },
    { id: 'q5012', label: 'Why is Q-5012 routine? (RT code and evidence)', kind: 'area', wide: true },
  ],
  grade(v) {
    const r: G = {};
    const cols = ['disp', 'threat', 'tier', 'prio', 'ticket'] as const;
    for (const [id, k] of Object.entries(KEY61)) cols.forEach((c, i) => {
      const f = `a.${id}.${c}`;
      if (!filled(v[f])) return;
      // Q-5010: the firewall (Tier 1) raised it, but the affected asset is MKT-PC-09 (Tier 2); P2 from the firewall's tier is accepted too
      const ok = v[f] === k[i] || (id === 'Q-5010' && ((c === 'tier' && v[f] === '1') || (c === 'prio' && v[f] === 'P2')));
      r[f] = { ok, hint: HINT61[c] };
    });
    if (filled(v.count)) r.count = { ok: num(v.count) === 4, hint: 'Six Confirmed alerts, but rule T2 links alerts about the same incident to one ticket.' };
    if (filled(v.linked)) r.linked = { ok: has(v.linked, /5005/) && has(v.linked, /5011/) && !has(v.linked, /500[1-46-9]|501[02-3]/), hint: 'Which Confirmed alerts are on FIN-PC-03?' };
    if (filled(v.q5012)) r.q5012 = { ok: has(v.q5012, /RT3|CHG-?1142|vendor/i), hint: 'Compare the source IP and the time with the routine list.' };
    return r;
  },
};
const act61: Mission = {
  id: 'd6-act6.1', day: 6, kind: 'activity', title: 'Activity 6.1 · Assess Alerts Against Pre-identified Criteria', subtitle: 'Individual, hands-on · 75 min', minutes: 75, hosts: ['seat-win', 'seat-linux'],
  intro: 'Yesterday you received the Day 5 queue. Today assess every alert: routine, detection, threat, asset tier, priority and ticket.',
  steps: [
    { id: 'sop', host: 'seat-linux', text: 'Read the routine list and the detection criteria (STEPS 1–2).', try: 'grep -A22 "^STEP 1" ~/day6/soc_triage_sop.txt', match: [/^(grep|cat|less|head)\b.*soc_triage_sop/] },
    { id: 'details', host: 'seat-win', text: 'What really happened in each alert?', try: String.raw`Import-Csv day6\alert_details.csv | Format-Table alert_id, affected_asset, result`, match: [/import-csv\b.*alert_details/i] },
    { id: 'full', host: 'seat-win', text: 'Read the full details of one alert (change the ID).', try: String.raw`Import-Csv day6\alert_details.csv | Where-Object alert_id -eq Q-5001 | Format-List`, match: [/import-csv\b.*alert_details.*(where|\?)/i] },
    { id: 'tiers', host: 'seat-win', text: 'Show the asset tiers.', try: String.raw`Import-Csv day6\asset_inventory.csv | Format-Table host, role, tier`, match: [/import-csv\b.*asset_inventory/i] },
    { id: 'matrix', host: 'seat-linux', text: 'Read the priority matrix and the ticket rules (STEP 5).', try: 'grep -A22 "PRIORITY MATRIX" ~/day6/soc_triage_sop.txt', match: [/^grep\b.*(PRIORITY|STEP 5).*soc_triage_sop/] },
  ],
  worksheet: ws61,
};

// ---------------------------------------------------------------- 6.2 True positive, false positive or routine?
export const KEY62: Record<string, string> = { 'B-01': 'Routine', 'B-02': 'Routine', 'B-03': 'False positive', 'B-04': 'Confirmed', 'B-05': 'Routine', 'B-06': 'Confirmed', 'B-07': 'False positive', 'B-08': 'False positive' };
const ws62: Worksheet = {
  id: 'ws-6.2', title: 'Activity 6.2 · Borderline alerts',
  intro: 'Use ~/day6/borderline_alerts.csv, change_calendar.txt, asset_inventory.csv and the routine list. Write the evidence that proves your verdict.',
  tables: [{ id: 'b', columns: [{ id: 'v', label: 'Verdict', kind: 'select', options: ['', 'Confirmed', 'False positive', 'Routine'] }, { id: 'ev', label: 'Evidence / RT code' }, { id: 't', label: 'Ticket?', kind: 'select', options: YN }], rows: Object.keys(KEY62).map((id) => ({ id, label: id })) }],
  fields: [
    { id: 'b04', label: 'B-04 belongs to an incident you already ticketed in 6.1. Which alert, and why?', kind: 'area', wide: true },
    { id: 'chg', label: 'CHG-2209 is about new accounts on DC-01. Why does it NOT make B-04 routine?', kind: 'area', wide: true },
    { id: 'b06', label: 'B-06: priority?', kind: 'select', options: PRIO },
  ],
  grade(v) {
    const r: G = {};
    for (const [id, want] of Object.entries(KEY62)) {
      if (filled(v[`b.${id}.v`])) r[`b.${id}.v`] = { ok: v[`b.${id}.v`] === want, hint: 'Check the change calendar, the asset inventory (who owns that IP?) and the routine list before deciding.' };
      if (filled(v[`b.${id}.ev`])) r[`b.${id}.ev`] = { ok: want === 'Routine' ? has(v[`b.${id}.ev`], /RT\d|CHG-?\d+/i) : (v[`b.${id}.ev`] ?? '').trim().length >= 8, hint: want === 'Routine' ? 'Name the RT code or the approved change.' : 'Write the fact that proves it.' };
      if (filled(v[`b.${id}.t`])) r[`b.${id}.t`] = { ok: v[`b.${id}.t`] === (want === 'Confirmed' ? 'Yes' : 'No'), hint: 'T1: only Confirmed detections get a ticket.' };
    }
    if (filled(v.b04)) r.b04 = { ok: has(v.b04, /Q-?5001|svc_backup/i), hint: 'Which account added helpdesk3? Where did you see that account in 6.1?' };
    if (filled(v.chg)) r.chg = { ok: has(v.chg, /pending|not (yet )?approved|11-06|tomorrow|jtorres|different/i), hint: 'Read the status, date and person of CHG-2209 (rule RT5).' };
    if (filled(v.b06)) r.b06 = { ok: v.b06 === 'P2', hint: 'Confirmed High on a Tier 2 workstation.' };
    return r;
  },
};
const act62: Mission = {
  id: 'd6-act6.2', day: 6, kind: 'activity', title: 'Activity 6.2 · True Positive, False Positive or Routine?', subtitle: 'Individual, hands-on · 60 min', minutes: 60, hosts: ['seat-win', 'seat-linux'],
  intro: 'Eight alerts that look suspicious. Check the evidence before you decide: only real detections become tickets.',
  steps: [
    { id: 'list', host: 'seat-win', text: 'Read the eight borderline alerts in full.', try: String.raw`Import-Csv day6\borderline_alerts.csv | Format-List alert_id, rule_name, host, user, details`, match: [/import-csv\b.*borderline_alerts/i] },
    { id: 'changes', host: 'seat-linux', text: 'Read the change calendar: which changes are APPROVED?', try: 'cat ~/day6/change_calendar.txt', match: [/^(cat|grep|less|head)\b.*change_calendar/] },
    { id: 'ip', host: 'seat-linux', text: 'Who owns the IP addresses in the alerts? (change the IP)', try: 'grep 203.0.113.20 ~/day6/asset_inventory.csv', match: [/^grep\b.*\d+\.\d+\.\d+\.\d+.*asset_inventory/] },
    { id: 'routine', host: 'seat-linux', text: 'Read the routine list.', try: 'grep -A1 "^RT" ~/day6/soc_triage_sop.txt', match: [/^grep\b.*RT.*soc_triage_sop/] },
  ],
  worksheet: ws62,
};

// ---------------------------------------------------------------- 6.3 Write the ticket
const CATS = ['', 'Ransomware', 'PE infection', 'Account compromise', 'Data leak', 'Malware', 'Other'];
const ws63: Worksheet = {
  id: 'ws-6.3', title: 'Activity 6.3 · Incident ticket INC-20261105-101 (FIN-PC-03)',
  intro: 'Use ~/day6/ticket_template.txt. Collect every alert and report about FIN-PC-03 from Days 5 and 6 first.',
  fields: [
    { id: 'title', label: 'Title', kind: 'text', placeholder: '<what happened> on <host>' },
    { id: 'linked', label: 'Linked alerts and reports (rule T2)', kind: 'text' },
    { id: 'asset', label: 'Affected asset (host, role, tier)', kind: 'text' },
    { id: 'cat', label: 'Category', kind: 'select', options: CATS },
    { id: 'prio', label: 'Priority', kind: 'select', options: PRIO },
    { id: 'evidence', label: 'Evidence that confirms the detection', kind: 'area', wide: true },
    { id: 'actions', label: 'Actions taken (Level I)', kind: 'area', wide: true },
    { id: 'assign', label: 'Assigned to', kind: 'select', options: ['', 'Shift Lead', 'Tier 2 analyst', 'IT Helpdesk'] },
    { id: 'status', label: 'Status', kind: 'select', options: ['', 'New', 'Closed'] },
  ],
  grade(v) {
    const r: G = {};
    if (filled(v.title)) r.title = { ok: has(v.title, /ransom/i) && has(v.title, /FIN-PC-03/i), hint: 'What happened, on which host?' };
    if (filled(v.linked)) r.linked = { ok: has(v.linked, /5005/) && has(v.linked, /5011/) && has(v.linked, /IR-?01/i), hint: 'Two alerts from the queue and one phone report are about FIN-PC-03.' };
    if (filled(v.asset)) r.asset = { ok: has(v.asset, /FIN-PC-03/i) && has(v.asset, /tier\s*2|\b2\b/i), hint: 'Look up FIN-PC-03 in asset_inventory.csv.' };
    if (filled(v.cat)) r.cat = { ok: v.cat === 'Ransomware', hint: 'Which red flag family is it?' };
    if (filled(v.prio)) r.prio = { ok: v.prio === 'P1', hint: 'Critical threat = P1 on any tier.' };
    if (filled(v.evidence)) r.evidence = { ok: has(v.evidence, /24|lockd/i) && has(v.evidence, /README|note|vssadmin|shadow/i), hint: 'Counts and names: renamed files, extension, ransom note, shadow copy deletion.' };
    if (filled(v.actions)) r.actions = { ok: has(v.actions, /unplug|network|wi-?fi|disconnect/i) && has(v.actions, /shift lead|escalat|4401/i), hint: 'What did the SOP tell you to say to the caller, and whom did you call?' };
    if (filled(v.assign)) r.assign = { ok: v.assign === 'Shift Lead', hint: 'P1 tickets go to the Shift Lead.' };
    if (filled(v.status)) r.status = { ok: v.status === 'New', hint: 'Level I never closes an incident ticket.' };
    return r;
  },
};
const act63: Mission = {
  id: 'd6-act6.3', day: 6, kind: 'activity', title: 'Activity 6.3 · Issue the Ticket', subtitle: 'Individual, hands-on · 45 min', minutes: 45, hosts: ['seat-linux', 'seat-win'],
  intro: 'The detection on FIN-PC-03 is confirmed. Gather every piece of evidence and issue the incident ticket as SOC-SOP-02 requires (PC 1.5).',
  steps: [
    { id: 'template', host: 'seat-linux', text: 'Read the ticket template.', try: 'cat ~/day6/ticket_template.txt', match: [/^(cat|less|head)\b.*ticket_template/] },
    { id: 'alerts', host: 'seat-linux', text: 'Every queue alert about FIN-PC-03.', try: 'grep FIN-PC-03 ~/day5/alert_queue.csv', match: [/^grep\b.*FIN-PC-03.*alert_queue/] },
    { id: 'details', host: 'seat-linux', text: 'Their details.', try: 'grep FIN-PC-03 ~/day6/alert_details.csv', match: [/^grep\b.*FIN-PC-03.*alert_details/] },
    { id: 'report', host: 'seat-linux', text: 'The phone report about the same PC.', try: 'grep -A9 "REPORT IR-01" ~/day5/incident_reports.txt', match: [/^grep\b.*IR-01.*incident_reports/] },
    { id: 'asset', host: 'seat-win', text: 'Role and tier of FIN-PC-03.', try: String.raw`Import-Csv day6\asset_inventory.csv | Where-Object host -eq FIN-PC-03 | Format-List`, match: [/import-csv\b.*asset_inventory.*FIN-PC-03/i] },
  ],
  worksheet: ws63,
};

// ---------------------------------------------------------------- 6.4 Triage your own workstation alerts (per seat)
const ws64: Worksheet = {
  id: 'ws-6.4', title: 'Activity 6.4 · My workstation alerts',
  intro: 'Use YOUR WKS-LAB workstation: C:\\Users\\<you>\\day6\\my_alerts.csv. Alerts 1–5 are the rows in file order. Your workstation is Tier 2.',
  tables: [{ id: 'm', columns: [{ id: 'disp', label: 'Detection', kind: 'select', options: DISP }, { id: 'prio', label: 'Priority', kind: 'select', options: PRIO }, { id: 'ticket', label: 'Ticket?', kind: 'select', options: YN }], rows: [1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: `Alert ${n}` })) }],
  fields: [
    { id: 'count', label: 'How many incident tickets do you open? (rule T2)', kind: 'text' },
    { id: 'first', label: 'Which alert do you handle first? (alert ID)', kind: 'text' },
  ],
  grade(v, { facts }) {
    const r: G = {}, al = facts.day6.alerts;
    al.forEach((a, i) => {
      const f = (c: string) => `m.${i + 1}.${c}`;
      if (filled(v[f('disp')])) r[f('disp')] = { ok: v[f('disp')] === a.disp, hint: 'Routine list first, then: did it happen, was it stopped, or was it harmless?' };
      if (filled(v[f('prio')])) r[f('prio')] = { ok: v[f('prio')] === a.priority, hint: 'Tier 2 column of the matrix; routine and false positive = "-".' };
      if (filled(v[f('ticket')])) r[f('ticket')] = { ok: v[f('ticket')] === a.ticket, hint: 'Only Confirmed detections get a ticket.' };
    });
    if (filled(v.count)) r.count = { ok: num(v.count) === facts.day6.tickets, hint: 'All five alerts are on the same workstation: rule T2.' };
    const order = ['P1', 'P2', 'P3', 'P4'];
    const best = [...al].filter((a) => a.priority !== '-').sort((x, y) => order.indexOf(x.priority) - order.indexOf(y.priority) || (y.disp === 'Confirmed' ? 1 : 0) - (x.disp === 'Confirmed' ? 1 : 0))[0];
    if (filled(v.first) && best) r.first = { ok: (v.first ?? '').toUpperCase().includes(best.id), hint: 'The highest priority (and Confirmed before Blocked).' };
    return r;
  },
};
const act64: Mission = {
  id: 'd6-act6.4', day: 6, kind: 'activity', title: 'Activity 6.4 · Triage Your Own Alerts', subtitle: 'Individual, hands-on · 45 min', minutes: 45, hosts: ['seat-win'],
  intro: 'Five alerts were raised on YOUR workstation this morning. Assess each one with SOC-SOP-02. Every seat has different alerts.',
  steps: [
    { id: 'list', host: 'seat-win', text: 'List your five alerts.', try: String.raw`Import-Csv day6\my_alerts.csv | Format-Table alert_id, source, rule_name`, match: [/import-csv\b.*my_alerts.*format-table/i] },
    { id: 'full', host: 'seat-win', text: 'Read every detail.', try: String.raw`Import-Csv day6\my_alerts.csv | Format-List alert_id, time, rule_name, details`, match: [/import-csv\b.*my_alerts.*format-list/i] },
    { id: 'tier', host: 'seat-win', text: 'Your workstation\'s tier.', try: String.raw`Import-Csv day6\asset_inventory.csv | Where-Object host -like "WKS-LAB*"`, match: [/import-csv\b.*asset_inventory.*(wks|lab)/i] },
    { id: 'rt', host: 'seat-win', text: 'The routine list on Windows.', try: String.raw`Select-String -Path day6\soc_triage_sop.txt -Pattern "^RT"`, match: [/select-string\b.*soc_triage_sop/i, /findstr\b.*soc_triage_sop/i] },
  ],
  worksheet: ws64,
};

export const DAY6: ScenarioPack = { day: 6, title: 'Day 6 · Alert Triage and Ticketing', missions: [p61, p62, p63, act61, act62, act63, act64] };
