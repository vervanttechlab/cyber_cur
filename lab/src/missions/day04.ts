// Day 4 scenario pack: Security Solutions and Log Management (Activities 4.1–4.4).
// Answers follow the Day 4 Student Handout (solution roles, severity scale) and the asset files.
import type { Mission, ScenarioPack, Worksheet } from './types';
import { DAY4_FILES } from '../hosts/files';
import { parseCsv } from '../shell/windows2';

const filled = (v?: string) => !!v && v.trim().length > 0;
const has = (v: string | undefined, ...re: RegExp[]) => !!v && re.some((r) => r.test(v));

const TOOLS = ['', 'AV', 'Firewall', 'NGFW', 'WAF', 'IDS', 'IPS', 'DLP', 'EDR', 'MDR', 'NDR', 'SIEM', 'SOAR', 'XDR', 'Threat intelligence', 'OT/ICS security', 'IoT security'];

// ---------------------------------------------------------------- 4.1 Which tool would catch it?
const SCEN: [string, string, string[]][] = [
  ['s1', 'SQL injection to the online banking login page', ['WAF']],
  ['s2', 'Employee emails a spreadsheet of customer TINs to a personal account', ['DLP']],
  ['s3', 'A laptop runs a macro that launches PowerShell', ['EDR', 'XDR']],
  ['s4', 'A CCTV camera starts scanning the internal network', ['IoT security', 'NDR', 'IDS']],
  ['s5', 'Someone on the internet tries RDP on the public IP', ['Firewall', 'NGFW', 'IPS']],
  ['s6', '20 failed VPN logins, then a success, then a file-server login at 2 AM', ['SIEM', 'XDR']],
  ['s7', 'A water utility PLC receives a command from an unknown workstation', ['OT/ICS security']],
  ['s8', 'A user downloads a known malicious file', ['AV', 'EDR']],
];
const ws41: Worksheet = {
  id: 'ws-4.1', title: 'Activity 4.1 · Which tool would catch it?',
  intro: 'Choose the best detecting solution and a second layer (defense in depth). Be ready to defend your choice.',
  tables: [{ id: 't', columns: [{ id: 'p', label: 'Primary solution', kind: 'select', options: TOOLS }, { id: 's', label: 'Second layer', kind: 'select', options: TOOLS }], rows: SCEN.map(([id, label]) => ({ id, label })) }],
  grade(v) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    let right = 0, tried = 0;
    for (const [id, , want] of SCEN) {
      if (filled(v[`t.${id}.p`])) { tried++; const ok = want.includes(v[`t.${id}.p`]); if (ok) right++; r[`t.${id}.p`] = { ok, hint: 'Which layer is built to see this kind of activity? See the Layers of Defense table.' }; }
      if (filled(v[`t.${id}.s`])) r[`t.${id}.s`] = { ok: v[`t.${id}.s`] !== v[`t.${id}.p`], hint: 'The second layer should be a different tool from the primary.' };
    }
    if (tried) r._found = { ok: right >= 6, hint: `${right} of 8 primary solutions correct (the criteria need at least 6).` };
    return r;
  },
};
const act41: Mission = {
  id: 'd4-act4.1', day: 4, kind: 'activity', title: 'Activity 4.1 · Which Tool Would Catch It?', subtitle: 'Pair · 30 min', minutes: 30, hosts: ['seat-linux'],
  video: 'Day04_Demo4_Which_Tool_Would_Catch_It.mp4', // supplemental: the only Day 3–9 activity without a demo video
  intro: 'A worksheet activity: discuss each scenario with your partner, then record your own answers.',
  steps: [{ id: 'discuss', manual: true, text: 'Discuss the eight scenarios with your partner.', match: [] }],
  worksheet: ws41,
};

// ---------------------------------------------------------------- 4.2 Identify the alert source
const ALERT_KEY: Record<string, { src: string; sev: string[] }> = {
  'A-1001': { src: 'AV', sev: ['High', 'Critical'] }, 'A-1002': { src: 'Firewall', sev: ['Medium', 'Low'] }, 'A-1003': { src: 'WAF', sev: ['Critical', 'High', 'Medium'] },
  'A-1004': { src: 'SIEM', sev: ['High'] }, 'A-1005': { src: 'EDR', sev: ['Critical'] }, 'A-1006': { src: 'DLP', sev: ['High'] },
  'A-1007': { src: 'NDR', sev: ['Medium'] }, 'A-1008': { src: 'SIEM', sev: ['Informational'] }, 'A-1009': { src: 'AV', sev: ['Low'] }, 'A-1010': { src: 'SIEM', sev: ['High'] },
};
const alertRows = parseCsv(DAY4_FILES['multi_source_alerts.csv']).slice(1).map((r) => r[0]);
const ALERT_ASSET = Object.fromEntries(parseCsv(DAY4_FILES['multi_source_alerts.csv']).slice(1).map((r) => [r[0], r[5]]));
const ws42: Worksheet = {
  id: 'ws-4.2', title: 'Activity 4.2 · Alert sources and urgency',
  intro: 'One row per alert in ~/day4/multi_source_alerts.csv. Map each vendor severity to the common scale from the handout, then rank 1 (most urgent) to 10.',
  tables: [{ id: 'a', columns: [{ id: 'src', label: 'Source', kind: 'select', options: ['', 'SIEM', 'AV', 'Firewall', 'WAF', 'DLP', 'EDR', 'NDR'] }, { id: 'asset', label: 'Affected asset' }, { id: 'sev', label: 'Normalized severity', kind: 'select', options: ['', 'Critical', 'High', 'Medium', 'Low', 'Informational'] }, { id: 'rank', label: 'Rank' }], rows: alertRows.map((id) => ({ id, label: id })) }],
  grade(v) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    for (const id of alertRows) {
      const k = ALERT_KEY[id];
      if (filled(v[`a.${id}.src`])) r[`a.${id}.src`] = { ok: v[`a.${id}.src`] === k.src, hint: 'Look at the product column: which kind of tool is it?' };
      if (filled(v[`a.${id}.asset`])) r[`a.${id}.asset`] = { ok: (v[`a.${id}.asset`] ?? '').toUpperCase().includes(ALERT_ASSET[id]), hint: 'Use the host column.' };
      if (filled(v[`a.${id}.sev`])) r[`a.${id}.sev`] = { ok: k.sev.includes(v[`a.${id}.sev`]), hint: 'Map the vendor value with the Severity Classifications table (e.g. Wazuh 10–12 = High).' };
    }
    const rank = (id: string) => parseInt(v[`a.${id}.rank`] ?? '', 10);
    if (!Number.isNaN(rank('A-1005'))) r['a.A-1005.rank'] = { ok: rank('A-1005') <= 2, hint: 'Active ransomware belongs at the top.' };
    if (!Number.isNaN(rank('A-1008'))) r['a.A-1008.rank'] = { ok: rank('A-1008') >= 9, hint: 'A successful signature update is informational.' };
    return r;
  },
};
const act42: Mission = {
  id: 'd4-act4.2', day: 4, kind: 'activity', title: 'Activity 4.2 · Identify the Alert Source', subtitle: 'Individual · 45 min', minutes: 45, hosts: ['seat-win', 'seat-linux'],
  intro: 'Instead of a spreadsheet, read the SIEM export with PowerShell (Import-Csv) or Linux tools. Then fill in the table.',
  steps: [
    { id: 'csv-ps', host: 'seat-win', text: 'Windows: load the CSV as objects and show the key columns.', try: 'Import-Csv day4\\multi_source_alerts.csv | Select-Object alert_id, product, vendor_severity, host | Format-Table', match: [/import-csv\b.*multi_source_alerts/i] },
    { id: 'csv-linux', host: 'seat-linux', text: 'Linux: show the same columns with cut.', try: 'cut -d, -f1,3,5,6 ~/day4/multi_source_alerts.csv', match: [/^(cut|awk|cat|head)\b.*multi_source_alerts/] },
    { id: 'details', host: 'seat-win', text: 'Read the full details of one alert.', try: 'Import-Csv day4\\multi_source_alerts.csv | Where-Object alert_id -eq A-1005 | Format-List', match: [/import-csv\b.*multi_source_alerts.*(where|\?)/i] },
  ],
  worksheet: ws42,
};

// ---------------------------------------------------------------- 4.3 Log hunt
const ws43: Worksheet = {
  id: 'ws-4.3', title: 'Activity 4.3 · Brute force to compromise',
  intro: 'Combine ~/day4/firewall.log and ~/day4/windows_security_events.csv.',
  fields: [
    { id: 'ip', label: 'Attacker source IP', kind: 'text' },
    { id: 'fails', label: 'Number of failed attempts (Event 4625)', kind: 'text' },
    { id: 'accts', label: 'Targeted account(s)', kind: 'text' },
    { id: 'success', label: 'Successful logon: time and account', kind: 'text' },
    { id: 'after', label: 'Actions after logon (Event IDs 4688, 4720, 4732)', kind: 'area', wide: true },
    { id: 'kc', label: 'Kill Chain phase(s) reached', kind: 'text' },
    { id: 'verdict', label: 'Is DC-01 compromised? Why?', kind: 'area', wide: true },
  ],
  grade(v) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    if (filled(v.ip)) r.ip = { ok: has(v.ip, /198\.51\.100\.150/), hint: 'Which source IP has the most connections to port 3389?' };
    if (filled(v.fails)) r.fails = { ok: (v.fails ?? '').match(/\d+/)?.[0] === '12', hint: 'Count only Event ID 4625 rows.' };
    if (filled(v.accts)) r.accts = { ok: has(v.accts, /vendor/i) && has(v.accts, /admin/i), hint: 'Group the 4625 rows by account.' };
    if (filled(v.success)) r.success = { ok: has(v.success, /02:03:41|2:03/) && has(v.success, /vendor/i), hint: 'Find the 4624 from the attacker IP.' };
    if (filled(v.after)) r.after = { ok: has(v.after, /helpdesk2/i) && has(v.after, /admin/i), hint: 'What did 4720 and 4732 create and change?' };
    if (filled(v.kc)) r.kc = { ok: has(v.kc, /install|command|c2|actions/i), hint: 'A new admin account and a download from the attacker go beyond exploitation.' };
    if (filled(v.verdict)) r.verdict = { ok: has(v.verdict, /yes|compromis/i), hint: 'Successful logon + new admin account = ?' };
    return r;
  },
};
const act43: Mission = {
  id: 'd4-act4.3', day: 4, kind: 'activity', title: 'Activity 4.3 · Log Hunt: Brute Force to Compromise', subtitle: 'Individual, hands-on · 75 min', minutes: 75, hosts: ['seat-linux', 'seat-win'],
  intro: 'Follow the attack across two log sources. Use Linux tools, PowerShell, or both.',
  steps: [
    { id: 'fw', host: 'seat-linux', text: 'Firewall: which source IP connects most to TCP 3389?', try: "grep ':3389 ' ~/day4/firewall.log | awk '{print $6}' | cut -d= -f2 | cut -d: -f1 | sort | uniq -c", match: [/3389.*firewall\.log|firewall\.log.*3389/] },
    { id: 'fails', host: 'seat-linux', text: 'Windows events: count the failed logons (4625) per account.', try: "awk -F, '$3 == 4625 {print $5}' ~/day4/windows_security_events.csv | sort | uniq -c", match: [/4625.*windows_security_events|windows_security_events.*4625/] },
    { id: 'ps-fails', host: 'seat-win', text: 'Same count in PowerShell.', try: 'Import-Csv day4\\windows_security_events.csv | Where-Object event_id -eq 4625 | Group-Object account', match: [/import-csv\b.*windows_security_events.*4625/i] },
    { id: 'after', host: 'seat-linux', text: 'What happened after the successful logon?', try: 'grep -E ",(4624|4688|4720|4732)," ~/day4/windows_security_events.csv', match: [/(4624|4688|4720|4732).*windows_security_events/] },
    { id: 'egress', host: 'seat-linux', text: 'Did DC-01 connect back to the attacker?', try: 'grep 198.51.100.150 ~/day4/firewall.log | grep -v 3389', match: [/198\.51\.100\.150.*firewall\.log/] },
  ],
  worksheet: ws43,
};

// ---------------------------------------------------------------- 4.4 Explore a security console (PowerShell view)
const ws44: Worksheet = {
  id: 'ws-4.4', title: 'Activity 4.4 · Console exploration notes',
  intro: 'Record what you found on YOUR WKS-LAB workstation. (On a real Windows PC the same data is in Windows Security and Event Viewer.)',
  tables: [{ id: 'n', columns: [{ id: 'f', label: 'What I found' }], rows: [
    { id: 'status', label: 'Defender status (real-time protection, signature version)' },
    { id: 'history', label: 'Protection history: threat name, file, action' },
    { id: 'def', label: 'Defender Operational log: Event 1116 / 1117 time' },
    { id: 'sec', label: 'Security log: my own 4624 logon (time, account)' },
    { id: 'wazuh', label: 'Wazuh agent service status' },
  ] }],
  grade(v, { facts }) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    const t = facts.day4.threat;
    const timeOf = (s: string) => s.replace(/^\S+ /, '').replace(/:\d\d (AM|PM)$/, '');
    if (filled(v['n.status.f'])) r['n.status.f'] = { ok: has(v['n.status.f'], /true|on|enabled|normal/i) || has(v['n.status.f'], /1\.421\.112/), hint: 'Look at RealTimeProtectionEnabled and AntivirusSignatureVersion.' };
    if (t && filled(v['n.history.f'])) r['n.history.f'] = { ok: (v['n.history.f'] ?? '').toLowerCase().includes(t.name.split(':')[1].split('/')[1].split('!')[0].toLowerCase()), hint: 'Get-MpThreat shows the ThreatName; Get-MpThreatDetection shows the file.' };
    if (t && filled(v['n.def.f'])) r['n.def.f'] = { ok: (v['n.def.f'] ?? '').includes(timeOf(t.time)), hint: 'Filter the Defender Operational log for Id 1116.' };
    if (filled(v['n.sec.f'])) r['n.sec.f'] = { ok: (v['n.sec.f'] ?? '').includes(timeOf(facts.day4.logon4624)) && has(v['n.sec.f'], new RegExp(facts.win.user, 'i')), hint: 'Filter the Security log for Id 4624 with Logon Type 2 and your account.' };
    if (filled(v['n.wazuh.f'])) r['n.wazuh.f'] = { ok: has(v['n.wazuh.f'], /running/i), hint: 'Get-Service Wazuh*' };
    return r;
  },
};
const act44: Mission = {
  id: 'd4-act4.4', day: 4, kind: 'activity', title: 'Activity 4.4 · Explore a Security Console', subtitle: 'Individual, hands-on · 45 min', minutes: 45, hosts: ['seat-win'],
  intro: 'Use PowerShell on your WKS-LAB workstation to read the same data that Windows Security and Event Viewer show.',
  steps: [
    { id: 'status', host: 'seat-win', text: 'Check Microsoft Defender status.', try: 'Get-MpComputerStatus | Format-List RealTimeProtectionEnabled, AntivirusSignatureVersion, AntivirusSignatureLastUpdated', match: [/get-mpcomputerstatus/i] },
    { id: 'history', host: 'seat-win', text: 'Protection history: what did Defender find?', try: 'Get-MpThreat', match: [/get-mpthreat\b(?!detection)/i] },
    { id: 'detect', host: 'seat-win', text: 'Which file, which user, and when?', try: 'Get-MpThreatDetection', match: [/get-mpthreatdetection/i] },
    { id: 'deflog', host: 'seat-win', text: 'Defender Operational log: find Event IDs 1116 / 1117.', try: 'Get-WinEvent -FilterHashtable @{LogName=\'Microsoft-Windows-Windows Defender/Operational\'; Id=1116,1117} | Format-List TimeCreated, Id, Message', match: [/get-winevent\b.*defender/i] },
    { id: 'seclog', host: 'seat-win', text: 'Security log: find your own logon (4624).', try: 'Get-WinEvent -FilterHashtable @{LogName=\'Security\'; Id=4624} | Format-List TimeCreated, Message', match: [/get-winevent\b.*security.*4624|get-winevent\b.*4624.*security/i] },
    { id: 'wazuh', host: 'seat-win', text: 'Is the Wazuh agent running?', try: 'Get-Service Wazuh*', match: [/get-service\b.*wazuh/i, /gsv\b.*wazuh/i] },
  ],
  worksheet: ws44,
};

export const DAY4: ScenarioPack = { day: 4, title: 'Day 4 · Security Solutions and Log Management', missions: [act41, act42, act43, act44] };
