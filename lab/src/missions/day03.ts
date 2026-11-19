// Day 3 scenario pack: The Cyber Threat Landscape and Attack Frameworks (Activities 3.1–3.4).
// Answers follow the Day 3 Student Handout (malware types, Kill Chain phases, ATT&CK tactics, IOC vs IOA).
import type { Mission, ScenarioPack, Worksheet } from './types';

const filled = (v?: string) => !!v && v.trim().length > 0;
const has = (v: string | undefined, ...re: RegExp[]) => !!v && re.some((r) => r.test(v));

const TACTICS = ['', 'Reconnaissance', 'Resource Development', 'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Evasion', 'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control', 'Exfiltration', 'Impact'];
const TYPES = ['', 'Virus', 'Worm', 'Trojan', 'Ransomware', 'Spyware / Infostealer', 'Backdoor / RAT', 'Botnet agent', 'Cryptominer', 'Fileless malware', 'Rootkit'];
const URG = ['', 'Low', 'Medium', 'High', 'Critical'];

// ---------------------------------------------------------------- 3.1 Malware behavior matching
const CARD_KEY: Record<string, { type: string[]; tactic: string[]; clue: RegExp }> = {
  '1': { type: ['Ransomware'], tactic: ['Impact'], clue: /locked|vssadmin|shadow|readme/i },
  '2': { type: ['Fileless malware'], tactic: ['Execution'], clue: /encoded|powershell|winword|word/i },
  '3': { type: ['Worm'], tactic: ['Lateral Movement'], clue: /445|smb|245|spread|many hosts/i },
  '4': { type: ['Cryptominer'], tactic: ['Impact'], clue: /cpu|mining|3333|pool/i },
  '5': { type: ['Backdoor / RAT', 'Botnet agent'], tactic: ['Command and Control'], clue: /60 ?s|every|beacon|interval/i },
  '6': { type: ['Trojan'], tactic: ['Persistence'], clue: /activator|scheduled task|logon|fake/i },
  '7': { type: ['Spyware / Infostealer'], tactic: ['Credential Access', 'Exfiltration', 'Collection'], clue: /login data|cookies|chrome|paste|upload/i },
  '8': { type: ['Rootkit'], tactic: ['Defense Evasion'], clue: /defender|driver|1102|cleared|disabled/i },
};
const ws31: Worksheet = {
  id: 'ws-3.1', title: 'Activity 3.1 · Malware behavior matching',
  intro: 'One row per card in ~/day3/malware_behavior_cards.txt. Use the malware types and ATT&CK tactics from the Day 3 handout.',
  tables: [{ id: 'c', columns: [{ id: 'type', label: 'Malware type', kind: 'select', options: TYPES }, { id: 'tac', label: 'ATT&CK tactic', kind: 'select', options: TACTICS }, { id: 'urg', label: 'Urgency', kind: 'select', options: URG }, { id: 'clue', label: 'Key clue' }], rows: ['1', '2', '3', '4', '5', '6', '7', '8'].map((n) => ({ id: n, label: `Card ${n}` })) }],
  grade(v) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    let right = 0, tried = 0;
    for (const [n, k] of Object.entries(CARD_KEY)) {
      if (filled(v[`c.${n}.type`])) { tried++; const ok = k.type.includes(v[`c.${n}.type`]); if (ok) right++; r[`c.${n}.type`] = { ok, hint: 'Compare the card with the "Behaviors you may see" column of the malware table.' }; }
      if (filled(v[`c.${n}.tac`])) r[`c.${n}.tac`] = { ok: k.tactic.includes(v[`c.${n}.tac`]), hint: 'What is the attacker trying to achieve at this moment?' };
      if (filled(v[`c.${n}.clue`])) r[`c.${n}.clue`] = { ok: k.clue.test(v[`c.${n}.clue`]), hint: 'Quote the detail on the card that proves your answer.' };
    }
    if (filled(v['c.1.urg'])) r['c.1.urg'] = { ok: v['c.1.urg'] === 'Critical', hint: 'Files are being encrypted right now.' };
    if (tried) r._found = { ok: right >= 6, hint: `${right} of 8 malware types correct (the criteria need at least 6).` };
    return r;
  },
};
const act31: Mission = {
  id: 'd3-act3.1', day: 3, kind: 'activity', title: 'Activity 3.1 · Malware Behavior Matching', subtitle: 'Individual · 40 min', minutes: 40, hosts: ['seat-linux'],
  intro: 'Read the eight behavior cards in your terminal, then fill in the matching table in your Lab Notebook.',
  steps: [
    { id: 'open', host: 'seat-linux', text: 'Open the behavior cards.', try: 'cat ~/day3/malware_behavior_cards.txt', match: [/^(cat|less|more)\b.*malware_behavior_cards/] },
    { id: 'clues', host: 'seat-linux', text: 'Search the cards for tell-tale commands and ports.', try: 'grep -n -iE "vssadmin|EncodedCommand|445|3333|1102" ~/day3/malware_behavior_cards.txt', match: [/^grep\b.*malware_behavior_cards/] },
  ],
  worksheet: ws31,
};

// ---------------------------------------------------------------- 3.2 Kill Chain mapping
const PHASES = [['recon', 'Reconnaissance', ['1']], ['weap', 'Weaponization', ['2']], ['deliv', 'Delivery', ['3']], ['exploit', 'Exploitation', ['4']], ['install', 'Installation', ['5']], ['c2', 'Command & Control', ['6']], ['actions', 'Actions on Objectives', ['7', '8', '9']]] as const;
const ws32: Worksheet = {
  id: 'ws-3.2', title: 'Activity 3.2 · Kill Chain map',
  intro: 'Place each numbered event from ~/day3/Incident_Narrative_Kill_Chain.txt in its phase, and name the log source that shows it.',
  tables: [{ id: 'k', columns: [{ id: 'ev', label: 'Event no(s).' }, { id: 'src', label: 'Evidence / log source' }], rows: PHASES.map(([id, label]) => ({ id, label })) }],
  fields: [{ id: 'stop', label: 'Earliest point the attack could have been stopped, and how:', kind: 'area', wide: true }],
  grade(v) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    for (const [id, , evs] of PHASES) {
      const got = (v[`k.${id}.ev`] ?? '').match(/\d+/g) ?? [];
      if (got.length) r[`k.${id}.ev`] = { ok: got.length === evs.length && evs.every((e) => got.includes(e)), hint: 'Re-read the attacker activity column of the Kill Chain table in the handout.' };
    }
    if (filled(v['k.deliv.src'])) r['k.deliv.src'] = { ok: has(v['k.deliv.src'], /email|gateway|mail/i), hint: 'Which tool logged the email?' };
    if (filled(v['k.exploit.src'])) r['k.exploit.src'] = { ok: has(v['k.exploit.src'], /edr|endpoint/i), hint: 'Which tool saw EXCEL.EXE start PowerShell?' };
    if (filled(v['k.c2.src'])) r['k.c2.src'] = { ok: has(v['k.c2.src'], /firewall|fw|ndr|network/i), hint: 'Which tool saw the connections every 5 minutes?' };
    if (filled(v.stop)) r.stop = { ok: has(v.stop, /deliver|email|gateway|attachment|\b3\b|exploit|edr|powershell|\b4\b|enable content|macro/i), hint: 'Look at events 3 and 4: what could the email gateway or the EDR alert have triggered?' };
    return r;
  },
};
const act32: Mission = {
  id: 'd3-act3.2', day: 3, kind: 'activity', title: 'Activity 3.2 · Kill Chain Mapping', subtitle: 'Group (3–4) · 60 min', minutes: 60, hosts: ['seat-linux'],
  intro: 'Read "The Payroll Email" narrative with your group. Each member records the Kill Chain map in their own notebook.',
  steps: [
    { id: 'open', host: 'seat-linux', text: 'Read the incident narrative.', try: 'cat ~/day3/Incident_Narrative_Kill_Chain.txt', match: [/^(cat|less|more)\b.*Incident_Narrative/] },
    { id: 'sources', host: 'seat-linux', text: 'List which tool logged each event.', try: 'grep -n -iE "log:" ~/day3/Incident_Narrative_Kill_Chain.txt', match: [/^grep\b.*Incident_Narrative/] },
  ],
  worksheet: ws32,
};

// ---------------------------------------------------------------- 3.3 ATT&CK (real website)
const ATTACK: [string, string, string[], string[]][] = [
  ['b1', 'User opened a malicious email attachment', ['Initial Access', 'Execution'], ['T1566.001', 'T1566', 'T1204.002', 'T1204']],
  ['b2', 'PowerShell ran an encoded command', ['Execution', 'Defense Evasion'], ['T1059.001', 'T1059', 'T1027']],
  ['b3', 'Malware created a Run registry key', ['Persistence', 'Privilege Escalation'], ['T1547.001', 'T1547']],
  ['b4', 'Attacker dumped passwords from LSASS memory', ['Credential Access'], ['T1003.001', 'T1003']],
  ['b5', 'Attacker used RDP to log in to the file server', ['Lateral Movement'], ['T1021.001', 'T1021']],
  ['b6', 'Files were encrypted and a ransom note was dropped', ['Impact'], ['T1486']],
];
const ws33: Worksheet = {
  id: 'ws-3.3', title: 'Activity 3.3 · ATT&CK mapping',
  intro: 'Look each behavior up on attack.mitre.org (Enterprise matrix). Record the tactic, technique ID and name.',
  tables: [{ id: 'a', columns: [{ id: 'tac', label: 'Tactic', kind: 'select', options: TACTICS }, { id: 'id', label: 'Technique ID' }, { id: 'name', label: 'Technique name' }], rows: ATTACK.map(([id, label]) => ({ id, label })) }],
  fields: [{ id: 'rec', label: 'One Detection or Mitigation recommendation you found (and its technique):', kind: 'area', wide: true }],
  grade(v) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    for (const [id, , tac, ids] of ATTACK) {
      if (filled(v[`a.${id}.tac`])) r[`a.${id}.tac`] = { ok: tac.includes(v[`a.${id}.tac`]), hint: 'Which column of the Enterprise matrix is it in?' };
      const t = (v[`a.${id}.id`] ?? '').toUpperCase().match(/T\d{4}(\.\d{3})?/)?.[0];
      if (filled(v[`a.${id}.id`])) r[`a.${id}.id`] = { ok: !!t && ids.includes(t), hint: 'Use the technique ID exactly as written on the ATT&CK page, e.g. T1059.001.' };
    }
    return r;
  },
};
const act33: Mission = {
  id: 'd3-act3.3', day: 3, kind: 'activity', title: 'Activity 3.3 · Exploring MITRE ATT&CK', subtitle: 'Individual, hands-on · 60 min', minutes: 60, hosts: ['seat-linux'],
  intro: 'This activity uses the real ATT&CK website in your browser (the lab itself has no internet). Record your findings in the Lab Notebook.',
  steps: [
    { id: 'site', manual: true, text: 'Open attack.mitre.org in your browser and select the Enterprise matrix.', link: 'https://attack.mitre.org/matrices/enterprise/', match: [] },
    { id: 'page', manual: true, text: 'Open one technique page and find its Detection or Mitigation section.', match: [] },
  ],
  worksheet: ws33,
};

// ---------------------------------------------------------------- 3.4 IOC or IOA
const IND: [string, string, 'IOC' | 'IOA'][] = [
  ['i1', 'SHA-256 hash of a known ransomware file', 'IOC'], ['i2', 'Excel.exe starting cmd.exe', 'IOA'], ['i3', 'Domain "update-microsoft-secure.example" in DNS logs', 'IOC'],
  ['i4', '30 failed logins followed by 1 successful login', 'IOA'], ['i5', 'File named README_RESTORE_FILES.txt on the desktop', 'IOC'], ['i6', 'vssadmin delete shadows /all /quiet', 'IOA'],
];
const ws34: Worksheet = {
  id: 'ws-3.4', title: 'Activity 3.4 · IOC or IOA?',
  tables: [{ id: 'x', columns: [{ id: 'v', label: 'IOC / IOA', kind: 'select', options: ['', 'IOC', 'IOA'] }], rows: IND.map(([id, label]) => ({ id, label })) }],
  fields: [{ id: 'why', label: 'Why are IOAs more durable for detection?', kind: 'area', wide: true }],
  grade(v) {
    const r: Record<string, { ok: boolean; hint?: string }> = {};
    for (const [id, , want] of IND) if (filled(v[`x.${id}.v`])) r[`x.${id}.v`] = { ok: v[`x.${id}.v`] === want, hint: 'Evidence left behind (IOC), or behavior of an attack in progress (IOA)?' };
    if (filled(v.why)) r.why = { ok: has(v.why, /behavi|change|harder|hard to|ip|hash|domain/i), hint: 'Think: how easily can an attacker change an IP or a hash, compared with how the attack behaves?' };
    return r;
  },
};
const act34: Mission = {
  id: 'd3-act3.4', day: 3, kind: 'activity', title: 'Activity 3.4 · IOC or IOA?', subtitle: 'Pair · 20 min', minutes: 20, hosts: ['seat-linux'],
  intro: 'Discuss each indicator with your partner, then record your own answers.',
  steps: [{ id: 'discuss', manual: true, text: 'Classify the six indicators with your partner.', match: [] }],
  worksheet: ws34,
};

export const DAY3: ScenarioPack = { day: 3, title: 'Day 3 · Threat Landscape and Attack Frameworks', missions: [act31, act32, act33, act34] };
