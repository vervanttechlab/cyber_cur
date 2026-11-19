// Practice missions that repeat the Day 3 and Day 4 demo videos on the demo hosts (~/demo3, ~/demo4).
import type { Mission } from './types';
import { DAY3 } from './day03';
import { DAY4 } from './day04';

const p31: Mission = {
  id: 'd3-demo1', day: 3, kind: 'practice', title: 'Practice: Demo 1 · From Behavior to Malware Type', subtitle: 'Repeat Video 1 with the ~/demo3 cards', minutes: 10,
  video: 'Day03_Demo1_Malware_Behavior.mp4', hosts: ['demo-linux'],
  intro: 'Read the three demo cards, match each one to the malware table, and name the tactic and urgency, just like Video 1.',
  steps: [
    { id: 'cards', host: 'demo-linux', text: 'Read the three demo behavior cards.', try: 'cat ~/demo3/demo_behavior_cards.txt', match: [/^(cat|less|more)\b.*demo_behavior_cards/] },
    { id: 'table', host: 'demo-linux', text: 'Open the malware table from the handout.', try: 'cat ~/demo3/malware_types_cheatsheet.txt', match: [/^(cat|less|more)\b.*malware_types_cheatsheet/] },
    { id: 'a', host: 'demo-linux', text: 'Show only card A (the line and the two after it).', try: 'grep -A2 "^DEMO A " ~/demo3/demo_behavior_cards.txt', why: 'Infected installers on a share = Virus · Lateral Movement · High.', match: [/^grep\b.*-A\s?\d.*DEMO A/] },
    { id: 'b', host: 'demo-linux', text: 'Show card B.', try: 'grep -A2 "^DEMO B " ~/demo3/demo_behavior_cards.txt', why: 'A flood after an IRC command = Botnet agent · Impact · High.', match: [/^grep\b.*-A\s?\d.*DEMO B/] },
    { id: 'c', host: 'demo-linux', text: 'Show card C.', try: 'grep -A2 "^DEMO C " ~/demo3/demo_behavior_cards.txt', why: 'A service that accepts remote commands = Backdoor/RAT · Persistence · Critical.', match: [/^grep\b.*-A\s?\d.*DEMO C/] },
  ],
};
const p32: Mission = {
  id: 'd3-demo2', day: 3, kind: 'practice', title: 'Practice: Demo 2 · Mapping to the Kill Chain', subtitle: 'Repeat Video 2 with "The Enrollment Form"', minutes: 10,
  video: 'Day03_Demo2_Kill_Chain_Mapping.mp4', hosts: ['demo-linux'],
  intro: 'Read the demo narrative, list the log sources, then map the seven events to the seven phases (use Notes if you like).',
  steps: [
    { id: 'read', host: 'demo-linux', text: 'Read the demo incident narrative.', try: 'cat ~/demo3/demo_incident_narrative.txt', match: [/^(cat|less|more)\b.*demo_incident_narrative/] },
    { id: 'logs', host: 'demo-linux', text: 'List which events came from a log, with line numbers.', try: 'grep -n "log:" ~/demo3/demo_incident_narrative.txt', why: 'Events 1–2 have no log: reconnaissance and weaponization are usually invisible.', match: [/^grep\b.*log.*demo_incident_narrative/] },
    { id: 'map', manual: true, text: 'Map events 1–7 to the seven phases, and decide the earliest point the attack could be stopped.', match: [] },
  ],
};
const p33: Mission = {
  id: 'd3-demo3', day: 3, kind: 'practice', title: 'Practice: Demo 3 · IOC or IOA, ATT&CK IDs', subtitle: 'Repeat Video 3 with the demo indicators', minutes: 10,
  video: 'Day03_Demo3_IOC_IOA_and_ATTACK.mp4', hosts: ['demo-linux'],
  intro: 'Sort the six demo indicators into IOC or IOA, then look up one technique on attack.mitre.org in your browser.',
  steps: [
    { id: 'read', host: 'demo-linux', text: 'Read the six demo indicators.', try: 'cat ~/demo3/demo_indicators.txt', match: [/^(cat|less|more)\b.*demo_indicators/] },
    { id: 'behav', host: 'demo-linux', text: 'Find the indicators that describe behavior.', try: 'grep -n -E "running|started|logs in" ~/demo3/demo_indicators.txt', why: 'Lines 2, 4 and 6 describe behavior: IOAs. The rest are artifacts: IOCs.', match: [/^grep\b.*demo_indicators/] },
    { id: 'attack', manual: true, link: 'https://attack.mitre.org/techniques/T1059/007/', text: 'Open T1059.007 (JavaScript) on attack.mitre.org and read its Detection section.', match: [] },
  ],
};

const p41: Mission = {
  id: 'd4-demo1', day: 4, kind: 'practice', title: 'Practice: Demo 1 · Alert Sources and Severity', subtitle: 'Repeat Video 1 with demo_alerts.csv', minutes: 10,
  video: 'Day04_Demo1_Alert_Sources.mp4', hosts: ['demo-win', 'demo-linux'],
  intro: 'Read the demo SIEM export, name the source of each alert, and normalize the severities, like Video 1.',
  steps: [
    { id: 'table', host: 'demo-win', text: 'Show the key columns of the demo alerts.', try: String.raw`Import-Csv demo4\demo_alerts.csv | Select-Object alert_id, product, vendor_severity, host | Format-Table`, match: [/import-csv\b.*demo_alerts/i] },
    { id: 'd01', host: 'demo-win', text: 'Read every field of alert D-01.', try: String.raw`Import-Csv demo4\demo_alerts.csv | Where-Object alert_id -eq D-01 | Format-List`, why: 'The vendor says Severe, but it is the EICAR test file, already quarantined: normalize to Low.', match: [/import-csv\b.*demo_alerts.*(where|\?)/i] },
    { id: 'cut', host: 'demo-linux', text: 'Linux: the same columns with cut.', try: 'cut -d, -f1,3,5,6 ~/demo4/demo_alerts.csv', match: [/^(cut|awk)\b.*demo_alerts/] },
  ],
};
const p42: Mission = {
  id: 'd4-demo2', day: 4, kind: 'practice', title: 'Practice: Demo 2 · Log Hunt: Password Spray', subtitle: 'Repeat Video 2 with the demo logs', minutes: 15,
  video: 'Day04_Demo2_Log_Hunt_Password_Spray.mp4', hosts: ['demo-linux', 'demo-win'],
  intro: 'Follow the password spray from the firewall log into the Windows events, like Video 2.',
  steps: [
    { id: 'head', host: 'demo-linux', text: 'Read the first lines of the demo firewall log.', try: 'head -3 ~/demo4/demo_firewall.log', match: [/^head\b.*demo_firewall/] },
    { id: 'smb', host: 'demo-linux', text: 'Who connected to the file server on SMB (445)?', try: "grep ':445 ' ~/demo4/demo_firewall.log | awk '{print $6}' | cut -d= -f2 | cut -d: -f1 | sort | uniq -c", why: '10.10.30.25, a VPN address, made 10 connections.', match: [/445.*demo_firewall/] },
    { id: 'fails', host: 'demo-linux', text: 'Count failed logons (4625) per account.', try: "awk -F, '$3 == 4625 {print $5}' ~/demo4/demo_security_events.csv | sort | uniq -c", why: 'Nine accounts, one failure each: a password spray.', match: [/4625.*demo_security_events/] },
    { id: 'after', host: 'demo-linux', text: 'Find the success and what happened next.', try: 'grep -E ",(4624|5140|4688|4698)," ~/demo4/demo_security_events.csv', why: 'svc_print logged on, opened Payroll, created a scheduled task.', match: [/(4624|4698).*demo_security_events/] },
    { id: 'ps', host: 'demo-win', text: 'The same count in PowerShell.', try: String.raw`Import-Csv demo4\demo_security_events.csv | Where-Object event_id -eq 4625 | Group-Object account`, match: [/import-csv\b.*demo_security_events.*4625/i] },
  ],
};
const p43: Mission = {
  id: 'd4-demo3', day: 4, kind: 'practice', title: 'Practice: Demo 3 · Security Console with PowerShell', subtitle: 'Repeat Video 3 on WKS-TRN-07', minutes: 10,
  video: 'Day04_Demo3_Security_Console_PowerShell.mp4', hosts: ['demo-win'],
  intro: 'Check Defender, its history and logs, the newest logon and the Wazuh agent on the demo workstation, like Video 3.',
  steps: [
    { id: 'status', host: 'demo-win', text: 'Defender status.', try: 'Get-MpComputerStatus | Format-List RealTimeProtectionEnabled, AntivirusSignatureVersion, AntivirusSignatureLastUpdated', match: [/get-mpcomputerstatus/i] },
    { id: 'threat', host: 'demo-win', text: 'Protection history.', try: 'Get-MpThreat', why: 'Defender found the EICAR test file.', match: [/get-mpthreat\b(?!detection)/i] },
    { id: 'detect', host: 'demo-win', text: 'Detection details.', try: 'Get-MpThreatDetection', match: [/get-mpthreatdetection/i] },
    { id: 'deflog', host: 'demo-win', text: 'Defender log events 1116 and 1117.', try: "Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'; Id=1116,1117} | Format-List TimeCreated, Id, Message", match: [/get-winevent\b.*defender/i] },
    { id: 'logon', host: 'demo-win', text: 'The newest logon (4624).', try: "Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4624} -MaxEvents 1 | Format-List TimeCreated, Message", match: [/get-winevent\b.*security.*4624/i] },
    { id: 'wazuh', host: 'demo-win', text: 'Wazuh agent status.', try: 'Get-Service Wazuh*', match: [/get-service\b.*wazuh/i] },
  ],
};

DAY3.missions.unshift(p31, p32, p33);
DAY4.missions.unshift(p41, p42, p43);
export const PRACTICE34 = [p31, p32, p33, p41, p42, p43];
