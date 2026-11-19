// Trainer answer key for the CTM Virtual Lab (Day 2): per-seat Activity 2.1 values + fixed answers for 2.2–2.4.
// Output: lab/trainer/Day02_Virtual_Lab_Answer_Key.html  (trainer only; do not put it in the trainee Day folder)
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { seatHosts } = await server.ssrLoadModule('/src/hosts/hosts.ts');
const { LOG_COUNTER } = await server.ssrLoadModule('/src/shell/pyports.ts');
const { DAY2_ASSETS } = await server.ssrLoadModule('/src/hosts/files.ts');
const { Q51, IR52, H53 } = await server.ssrLoadModule('/src/missions/day05.ts');
const { KEY61, KEY62 } = await server.ssrLoadModule('/src/missions/day06.ts');
const { KEY71, KEY72, KEY73 } = await server.ssrLoadModule('/src/missions/day07.ts');
const { KEY81, KEY82, KEY83 } = await server.ssrLoadModule('/src/missions/day08.ts');
const { KEY91, KEY92, KEY93 } = await server.ssrLoadModule('/src/missions/day09.ts');
await server.close();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const seats = Array.from({ length: 40 }, (_, i) => seatHosts(i + 1).facts);
const rows = seats.map((f) => `<tr><td><b>${String(f.seat).padStart(2, '0')}</b></td>
  <td>${f.win.hostname}<br>${f.win.ip} · gw ${f.win.gateway}</td><td>${f.win.listening}</td><td>${esc(f.win.os.replace('Microsoft ', ''))}<br>build ${f.win.build}</td><td>${f.win.user}</td>
  <td class="u"><b>${f.win.unexpected.port}</b> · ${esc(f.win.unexpected.proc)} (PID ${f.win.unexpected.pid})<br><small>${esc(f.win.unexpected.why)}</small></td>
  <td>${f.linux.hostname}<br>${f.linux.ip} · gw ${f.linux.gateway}</td><td>${f.linux.listening}</td><td>${esc(f.linux.os)}<br>${f.linux.kernel}</td><td>${f.linux.user}</td>
  <td class="u"><b>${f.linux.unexpected.port}</b> · ${esc(f.linux.unexpected.proc)} (PID ${f.linux.unexpected.pid})<br><small>${esc(f.linux.unexpected.why)}</small></td></tr>`).join('');
const lc = LOG_COUNTER.run(DAY2_ASSETS['web_access.log']);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Virtual Lab Answer Key Days 2-9</title><style>
body{font-family:Calibri,Arial,sans-serif;font-size:10.5pt;color:#1B2A41;margin:20px} h1{color:#1F3864;margin:0} h2{color:#1F3864;margin-top:22px}
table{border-collapse:collapse;width:100%} th,td{border:1px solid #D5E0EE;padding:4px 6px;vertical-align:top;text-align:left} th{background:#1F3864;color:#fff}
tr:nth-child(even) td{background:#F6F8FB} .u{background:#FFF4D6!important} small{color:#5B6B82} pre{font-family:Consolas,monospace;font-size:9.5pt;background:#F6F8FB;border:1px solid #D5E0EE;padding:8px}
.warn{background:#FDEDEC;border:1px solid #C0392B;padding:8px;border-radius:6px}
</style></head><body>
<p style="color:#2E75B6;font-weight:bold;margin:0">CYBER THREAT MONITORING LEVEL I · CTM VIRTUAL LAB · TRAINER ONLY</p>
<h1>Day 2 Answer Key</h1>
<p class="warn"><b>Do not distribute.</b> Each trainee's seat number gives them unique hosts. Use this key to check Activity 2.1 worksheets and to spot copied answers (a seat with another seat's IP or ports copied).</p>
<h2>Activity 2.1 · per seat</h2>
<table><tr><th>Seat</th><th>Windows host / IP</th><th>TCP listening</th><th>OS</th><th>User</th><th>Unexpected (Windows)</th><th>Linux host / IP</th><th>TCP listening</th><th>OS</th><th>User</th><th>Unexpected (Linux)</th></tr>${rows}</table>
<h2>Activity 2.2 · zones and rules (same for everyone)</h2>
<table><tr><th>Zone</th><th>Range</th><th>Devices</th></tr>
<tr><td>WAN / Internet (outside)</td><td>203.0.113.0/24 (ISP router 203.0.113.1, firewall outside 203.0.113.10)</td><td>ISP router, NGFW FW-01 outside interface</td></tr>
<tr><td>DMZ</td><td>172.16.10.0/24</td><td>WEB-01 172.16.10.5 (Apache/PHP), MAIL-01 172.16.10.6</td></tr>
<tr><td>Internal LAN</td><td>10.10.0.0/16</td><td>DC-01, FILE-01, DB-01, SIEM-01, user PCs 10.10.20.0/24, branch VPN 10.10.30.0/24</td></tr></table>
<p>Rules 1–3 <b>Acceptable</b> (public web and mail services published to the DMZ). Rule 4 <b>Risky</b>: RDP to the Domain Controller exposed to the internet. Rule 5 <b>Risky</b>: the core banking MySQL database exposed to the internet.</p>
<h2>Activity 2.3 · suspicious requests (same for everyone)</h2>
<table><tr><th>Lines</th><th>Source IP</th><th>Attempted</th><th>Status</th><th>Succeeded?</th></tr>
<tr><td>4–6</td><td>198.51.100.23</td><td>SQL injection on /login.php (sqlmap)</td><td>403</td><td>No</td></tr>
<tr><td>7–10</td><td>203.0.113.77</td><td>Nikto scanner probing /admin/, /phpmyadmin/, /.env, /backup.zip</td><td>404</td><td>No</td></tr>
<tr><td>11</td><td>192.0.2.90</td><td>Path traversal ../../../../etc/passwd (curl)</td><td>400</td><td>No</td></tr>
<tr class="u"><td>13–15</td><td>198.51.100.200</td><td>Web shell /uploads/img_2041.php running whoami, cat config.php (python-requests)</td><td>200</td><td><b>Yes: most urgent</b></td></tr></table>
<h2>Activity 2.4 · log_counter.py</h2>
<p>Reads only the file named on the command line (sys.argv[1]); changes nothing (prints only); connects nowhere (imports sys and collections only). Output on web_access.log:</p>
<pre>${esc(lc)}</pre>

<h1 style="margin-top:34px">Day 3 Answer Key</h1>
<h2>Activity 3.1 · malware behavior cards</h2>
<table><tr><th>Card</th><th>Malware type</th><th>ATT&amp;CK tactic</th><th>Urgency (guide)</th><th>Key clue</th></tr>
<tr><td>1</td><td>Ransomware</td><td>Impact</td><td>Critical</td><td>*.locked renames, vssadmin delete shadows, ransom note</td></tr>
<tr><td>2</td><td>Fileless malware</td><td>Execution</td><td>High</td><td>winword.exe → powershell -nop -w hidden -EncodedCommand, then outbound 443</td></tr>
<tr><td>3</td><td>Worm</td><td>Lateral Movement</td><td>Critical</td><td>245 internal hosts on TCP 445 in 10 min; copies on 12 hosts</td></tr>
<tr><td>4</td><td>Cryptominer</td><td>Impact</td><td>Medium</td><td>98% CPU for 3 days; mining pool port 3333</td></tr>
<tr><td>5</td><td>Backdoor / RAT (or botnet agent)</td><td>Command and Control</td><td>High</td><td>every 60 s exactly, ~300 bytes, 24 h (beaconing)</td></tr>
<tr><td>6</td><td>Trojan</td><td>Persistence</td><td>High</td><td>fake "Activator"; scheduled task runs hidden binary at logon</td></tr>
<tr><td>7</td><td>Spyware / Infostealer</td><td>Credential Access (Exfiltration accepted)</td><td>High</td><td>reads Chrome Login Data and Cookies, uploads ZIP</td></tr>
<tr><td>8</td><td>Rootkit</td><td>Defense Evasion</td><td>Critical</td><td>Defender turned off, unknown kernel driver, logs cleared (1102)</td></tr></table>
<h2>Activity 3.2 · Kill Chain ("The Payroll Email")</h2>
<p>Reconnaissance 1 · Weaponization 2 · Delivery 3 (email gateway) · Exploitation 4 (EDR) · Installation 5 (EDR) · Command &amp; Control 6 (firewall) · Actions on Objectives 7, 8, 9 (Windows logs, firewall). Earliest realistic stop: Delivery (block or quarantine the .xlsm at the email gateway, user reporting) or Exploitation (act on the EDR alert for EXCEL.EXE spawning encoded PowerShell at 09:31 and isolate HR-PC04).</p>
<h2>Activity 3.3 · ATT&amp;CK</h2>
<table><tr><th>Behavior</th><th>Tactic</th><th>Technique</th></tr>
<tr><td>Opened malicious email attachment</td><td>Initial Access</td><td>T1566.001 Phishing: Spearphishing Attachment (T1204.002 User Execution: Malicious File also accepted, under Execution)</td></tr>
<tr><td>PowerShell encoded command</td><td>Execution</td><td>T1059.001 Command and Scripting Interpreter: PowerShell (T1027 Obfuscated Files or Information also accepted)</td></tr>
<tr><td>Run registry key</td><td>Persistence</td><td>T1547.001 Boot or Logon Autostart Execution: Registry Run Keys / Startup Folder</td></tr>
<tr><td>Dumped LSASS memory</td><td>Credential Access</td><td>T1003.001 OS Credential Dumping: LSASS Memory</td></tr>
<tr><td>RDP to the file server</td><td>Lateral Movement</td><td>T1021.001 Remote Services: Remote Desktop Protocol</td></tr>
<tr><td>Files encrypted, ransom note</td><td>Impact</td><td>T1486 Data Encrypted for Impact</td></tr></table>
<h2>Activity 3.4 · IOC or IOA</h2>
<p>Hash: IOC · Excel.exe starting cmd.exe: IOA · Domain in DNS logs: IOC · 30 failures then 1 success: IOA · README_RESTORE_FILES.txt: IOC · vssadmin delete shadows: IOA. IOAs describe behavior, which attackers cannot change as easily as an IP, domain or hash.</p>

<h1 style="margin-top:34px">Day 4 Answer Key</h1>
<h2>Activity 4.1 · primary solution (second layers vary)</h2>
<p>SQL injection: WAF · TINs emailed out: DLP · macro launches PowerShell: EDR · CCTV scanning: IoT security (NDR accepted) · internet RDP attempts: Firewall/NGFW · VPN failures then 2 AM file-server login: SIEM · PLC command: OT/ICS security · known malicious download: AV.</p>
<h2>Activity 4.2 · alert sources</h2>
<table><tr><th>Alert</th><th>Source</th><th>Asset</th><th>Normalized</th></tr>
<tr><td>A-1001</td><td>AV</td><td>HR-PC04</td><td>High (Critical acceptable)</td></tr><tr><td>A-1002</td><td>Firewall</td><td>FW-01</td><td>Medium (Low acceptable: blocked)</td></tr>
<tr><td>A-1003</td><td>WAF</td><td>WEB-01</td><td>Critical by vendor; blocked, so High/Medium defensible</td></tr><tr><td>A-1004</td><td>SIEM</td><td>FILE-01</td><td>High (Wazuh 12)</td></tr>
<tr><td>A-1005</td><td>EDR</td><td>ACCT-PC09</td><td>Critical, rank 1</td></tr><tr><td>A-1006</td><td>DLP</td><td>MAIL-01</td><td>High</td></tr>
<tr><td>A-1007</td><td>NDR</td><td>SALES-PC01</td><td>Medium</td></tr><tr><td>A-1008</td><td>SIEM</td><td>DC-01</td><td>Informational (Wazuh 3), last</td></tr>
<tr><td>A-1009</td><td>AV</td><td>DEV-PC02</td><td>Low</td></tr><tr><td>A-1010</td><td>SIEM</td><td>FILE-01</td><td>High (Wazuh 12); links to A-1004</td></tr></table>
<h2>Activity 4.3 · brute force to compromise</h2>
<p>Attacker 198.51.100.150 (14 firewall connections to 3389 via rule NAT-RDP-Vendor-Temp) · 12 failed logons (4625): administrator ×2, admin ×2, vendor ×8 · success 2026-11-04 02:03:41, account <b>vendor</b>, logon type 10 (RDP) · after: cmd.exe, whoami.exe, <i>net user helpdesk2 /add</i>, 4720 helpdesk2 created, 4732 helpdesk2 added to Administrators, PowerShell download of t.exe from 198.51.100.150, and DC-01 connected out to 198.51.100.150:443 at 02:11:30 · phases reached: Exploitation, Installation, Command &amp; Control · DC-01 is compromised.</p>
<h2>Activity 4.4 · per seat (WKS-LAB-NN)</h2>
<table><tr><th>Seat</th><th>Defender threat</th><th>File</th><th>Action</th><th>Event 1116 time</th><th>Own 4624 logon (type 2)</th><th>Wazuh</th></tr>
${seats.map((f) => `<tr><td><b>${String(f.seat).padStart(2, '0')}</b></td><td>${esc(f.day4.threat.name)}</td><td><small>${esc(f.day4.threat.resource)}</small></td><td>${f.day4.threat.action}</td><td>${esc(f.day4.threat.time)}</td><td>${esc(f.day4.logon4624)} · ${f.win.user}</td><td>Running</td></tr>`).join('')}
</table>
<h1 style="margin-top:34px">Day 5 Answer Key</h1>
<h2>Activity 5.1 · alert receipt log (now = 09:30; SOP A2 limits: Critical 15, High 30, Medium 120, Low 480 min)</h2>
<table><tr><th>Alert</th><th>Severity</th><th>Status</th><th>Received</th><th>Acknowledged</th><th>Minutes</th><th>Within SLA?</th></tr>
${Q51.map((q) => `<tr${q.within.startsWith('No') ? ' class="u"' : ''}><td><b>${q.id}</b> · ${esc(q.host)}</td><td>${q.severity}</td><td>${q.status}</td><td>${q.received.slice(11)}</td><td>${q.ack ? q.ack.slice(11) : '(waiting at 09:30)'}</td><td>${Math.floor(q.minutes)} (accept ±1)</td><td><b>${q.within}</b></td></tr>`).join('')}</table>
<p>New alerts: <b>${Q51.filter((q) => q.status === 'New').length}</b> · acknowledged late: <b>Q-5005</b> (Critical, 23 min 52 s) · handle first: <b>Q-5011</b> (Critical ransomware red flag R3, about 3 minutes left) · red flags: <b>Q-5005</b> (R1 mass rename) and <b>Q-5011</b> (R3 shadow copy deletion) on FIN-PC-03; <b>Q-5007</b> (V1 SMB writes to installers) and <b>Q-5008</b> (V2 Virus:Win32/Neshta.A).</p>
<h2>Activity 5.2 · incident report intake</h2>
<table><tr><th>Report</th><th>Channel</th><th>Type</th><th>Next step per SOP</th></tr>
${Object.entries(IR52).map(([id, k]) => `<tr><td><b>${id}</b></td><td>${k.ch}</td><td>${k.type}</td><td>${k.next}</td></tr>`).join('')}</table>
<p>Same incidents as 5.1: <b>IR-01</b> = Q-5005/Q-5011 (FIN-PC-03 ransomware) · <b>IR-02</b> = Q-5007/Q-5008 (PE infection from \\FS-01\Installers). IR-01 advice: unplug the network cable or turn off Wi-Fi, do NOT shut down, never pay; escalate to the Shift Lead (local 4401). IR-04 is social engineering (B3): never send an OTP; call back on the directory number.</p>
<h2>Activity 5.3 · red flag check</h2>
<table><tr><th>Host</th><th>Verdict</th><th>Codes</th></tr>
${Object.entries(H53).map(([h, k]) => `<tr><td><b>${h}</b></td><td>${k.v}</td><td>${k.codes.map((c) => c.source).join(', ') || 'none'}</td></tr>`).join('')}</table>
<p>FIN-PC-03: <b>24</b> files renamed to <b>.lockd</b> (12 on \\FS-01\Finance + 12 in Documents), note <b>README_RESTORE_FILES.txt</b> (3 copies), first rename <b>08:24:51</b> by <b>svcupd.exe</b> (unsigned, in AppData\Local\Temp), vssadmin shadow deletion blocked 09:18:02. ENG-PC-11: <b>9</b> installers in \\FS-01\Installers modified by <b>pdfreader_setup.exe</b> (started 08:39:02): the infection source. QA-PC-05: Virus:Win32/Neshta.A quarantined twice after running an installer from the share (V2, V3). FS-02 (SafeCopy scbackup.exe) and HR-LT-07 (Windows Update TiWorker.exe) are approved signed software: no red flag.</p>
<h2>Activity 5.4 · per seat (WKS-LAB-NN: day5\my_edr_events.csv and Documents)</h2>
<table><tr><th>Seat</th><th>Verdict</th><th>Count</th><th>First event</th><th>Process</th><th>Detail</th><th>Action</th></tr>
${seats.map((f) => { const d = f.day5; return `<tr${d.kind !== 'none' ? ' class="u"' : ''}><td><b>${String(f.seat).padStart(2, '0')}</b></td><td>${d.kind === 'ransomware' ? 'Ransomware red flag (R1, R2)' : d.kind === 'pe' ? 'PE infection red flag (V1, V2)' : 'No red flag'}</td><td>${d.count}${d.kind === 'ransomware' ? ` renamed (accept ${d.count + 1} with the note)` : d.kind === 'pe' ? ' modified' : ' backup files'}</td><td>${d.first}</td><td>${esc(d.process)}</td><td>${esc(d.kind === 'ransomware' ? `${d.ext} · ${d.note}` : d.kind === 'pe' ? d.detection : 'SafeCopy backup + Windows Update (approved)')}</td><td>${d.kind === 'none' ? 'Record in shift log' : 'Escalate immediately'}</td></tr>`; }).join('')}
</table>
<h1 style="margin-top:34px">Day 6 Answer Key</h1>
<h2>Activity 6.1 · assessment of the Day 5 queue (SOC-SOP-02)</h2>
<table><tr><th>Alert</th><th>Detection</th><th>Threat</th><th>Tier</th><th>Priority</th><th>Ticket</th></tr>
${Object.entries(KEY61).map(([id, k]) => `<tr${k[4] === 'Yes' ? ' class="u"' : ''}><td><b>${id}</b></td>${k.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</table>
<p><b>4 tickets</b> (rule T2): FIN-PC-03 ransomware = Q-5005 + Q-5011 (+ report IR-01) · PE infection = Q-5007 + Q-5008 (+ IR-02) · DC-01 account compromise = Q-5001 · payroll data leak = Q-5006. Q-5008 and Q-5011 were quarantined/blocked but are red flags, so Confirmed. Q-5010: affected asset is MKT-PC-09 (Tier 2) = P3; P2 accepted. Q-5012 routine: RT3, approved vendor scan from 198.51.100.23 on Thursday 09:24 (CHG-1142).</p>
<h2>Activity 6.2 · borderline alerts</h2>
<table><tr><th>Alert</th><th>Verdict</th><th>Why</th><th>Ticket</th></tr>
${Object.entries(KEY62).map(([id, v]) => `<tr${v === 'Confirmed' ? ' class="u"' : ''}><td><b>${id}</b></td><td>${v}</td><td>${({ 'B-01': 'RT5: CHG-2201 monthly AV test, rmendoza on IT-PC-01, inside 10:00-10:30', 'B-02': 'RT5: CHG-2203, signed deploy_patches.ps1, ajimenez on ADM-PC-02, inside 09:00-12:00', 'B-03': '203.0.113.20 is VPN-GW-01 (Davao): logon through the company VPN', 'B-04': 'helpdesk3 added to Domain Admins by svc_backup at 02:14; no approved change (CHG-2209 is pending and for 11-06); link to the Q-5001 ticket', 'B-05': 'RT2: SCAN-01 10.10.1.60, Thursday 08:20-08:47', 'B-06': 'restored from quarantine, ran, beacons every 60 s; High on Tier 2 = P2', 'B-07': 'loan account numbers; none passes the Luhn check', 'B-08': 'normal search "select committee"; 200 search page; no SQL syntax' })[id]}</td><td>${v === 'Confirmed' ? 'Yes' : 'No'}</td></tr>`).join('')}</table>
<h2>Activity 6.3 · ticket INC-20261105-101</h2>
<p>Title: Ransomware activity on FIN-PC-03 · Linked: Q-5005, Q-5011, IR-01 · Asset: FIN-PC-03, accounting workstation, Tier 2 (plus \\FS-01\Finance share) · Category: Ransomware · Priority: <b>P1</b> · Evidence: 24 files renamed to .lockd by svcupd.exe (unsigned, AppData\Local\Temp), README_RESTORE_FILES.txt (3), vssadmin delete shadows blocked 09:18:02 · Actions: caller told to unplug the network cable / turn off Wi-Fi and not to shut down; Shift Lead called (local 4401) · Assigned: <b>Shift Lead</b> · Status: New.</p>
<h2>Activity 6.4 · per seat (WKS-LAB-NN: day6\my_alerts.csv, Tier 2)</h2>
<table><tr><th>Seat</th><th>Alert 1</th><th>Alert 2</th><th>Alert 3</th><th>Alert 4</th><th>Alert 5</th><th>Tickets</th></tr>
${seats.map((f) => `<tr><td><b>${String(f.seat).padStart(2, '0')}</b></td>${f.day6.alerts.map((a) => `<td${a.ticket === 'Yes' ? ' class="u"' : ''}><b>${a.disp}</b> · ${a.priority}<br><small>${esc(a.rule)}</small></td>`).join('')}<td>${f.day6.tickets}</td></tr>`).join('')}
</table>
<h1 style="margin-top:34px">Day 7 Answer Key</h1>
<h2>Activity 7.1 · coverage (SOC-SOP-03 Section A)</h2>
<p>${Object.entries(KEY71).map(([h, g]) => g === 'No gap' ? h : `<b style="color:#C0392B">${h}: ${g}</b>`).join(' · ')}</p>
<p><b>4 gaps.</b> CORE-DB-01 (Tier 1 core banking database) has no Wazuh agent: the SIEM receives nothing from it. LOAN-PC-03 is in the inventory but not in the console report (never enrolled). DEV-PC-02 has no EDR, but Tier 3 test PCs do not need one.</p>
<h2>Activity 7.2 · health at 09:30 (Section B)</h2>
<table><tr><th>Check</th><th>Status</th><th>Failed check</th></tr>${Object.entries(KEY72).map(([id, [s, f]]) => `<tr${s !== 'Operational' ? ' class="u"' : ''}><td><b>${id}</b></td><td>${s}</td><td>${f}</td></tr>`).join('')}</table>
<p><b>6 not operational.</b> H-07 (FIN-PC-03 Falcon, last check-in 08:21) is explained by Day 5: the user unplugged the network cable after the ransomware, so the agent cannot check in.</p>
<h2>Activity 7.3 · can it clean? (Section C)</h2>
<table><tr><th>Detection</th><th>Can clean?</th><th>Reason</th><th>Next step</th></tr>${Object.entries(KEY73).map(([id, k]) => `<tr${k[0] !== 'Yes' ? ' class="u"' : ''}><td><b>${id}</b></td><td>${k[0]}</td><td>${k[1]}</td><td>${k[2]}</td></tr>`).join('')}</table>
<p>D7-02: LOAN-PC-08 excludes C:\Users\aramos\Downloads. D7-04: DEV-PC-02 low action 6 (Allow). D7-07: PAY-PC-02 severe action 9 (No action). D7-05: IT-PC-01 excludes only C:\SecTest, so Tools is still protected. EDR in Detect only mode: <b>QA-PC-05</b>.</p>
<h2>Activity 7.4 · per seat (WKS-LAB-NN)</h2>
<table><tr><th>Seat</th><th>Falcon (EDR)</th><th>Wazuh connected</th><th>Last keep-alive</th><th>High action</th><th>Exclusion</th><th>Can clean (Downloads)</th><th>Report</th></tr>
${seats.map((f) => { const d = f.day7; return `<tr><td><b>${String(f.seat).padStart(2, '0')}</b></td><td${d.edr !== 'Running' ? ' class="u"' : ''}>${d.edr}</td><td${d.wazuhConnected ? '' : ' class="u"'}>${d.wazuhConnected ? 'Yes' : 'No'}</td><td>${d.lastKeepalive}</td><td${[1, 2, 3, 10].includes(d.high) ? '' : ' class="u"'}>${d.high}</td><td><small>${esc(d.exclusion ?? 'none')}</small></td><td${d.canClean ? '' : ' class="u"'}>${d.canClean ? 'Yes' : 'No'}</td><td>Yes</td></tr>`; }).join('')}
</table>
<h1 style="margin-top:34px">Day 8 Answer Key</h1>
<h2>Activity 8.1 · verify the detection (SOC-SOP-04 V1)</h2>
<table><tr><th>Detection</th><th>Hash = console?</th><th>In threat intel?</th><th>Verdict</th></tr>${Object.entries(KEY81).map(([id, k]) => `<tr${k[2] !== 'Verified malicious' ? ' class="u"' : ''}><td><b>${id}</b></td><td>${k[0]}</td><td>${k[1]}</td><td>${k[2]}</td></tr>`).join('')}</table>
<p>V-03 payslip_viewer: the file on disk is different from the file the console saw (it changed after the detection). V-02 putty: the hash is published in known_good_hashes.txt (official release) = false positive. V-05 sync.exe: in neither list = escalate to Tier 2.</p>
<h2>Activity 8.2 · check the action (V2)</h2>
<table><tr><th>Host</th><th>Result</th><th>Next step</th></tr>${Object.entries(KEY82).map(([h, k]) => `<tr${k[0] !== 'Action verified' ? ' class="u"' : ''}><td><b>${h}</b></td><td>${k[0]}</td><td>${k[1]}</td></tr>`).join('')}</table>
<p>IT-PC-01: event 1117 says removed, but the after-action check found the file still present = not verified. LOAN-PC-08 (1118, file in use) and PAY-PC-02 (1119, access denied) failed.</p>
<h2>Activity 8.3 · updates (V3)</h2>
<table><tr><th>Host</th><th>Status</th><th>Action</th></tr>${Object.entries(KEY83).map(([h, k]) => `<tr${k[0] !== 'Up to date' ? ' class="u"' : ''}><td><b>${h}</b></td><td>${k[0]}</td><td>${k[1]}</td></tr>`).join('')}</table>
<p>Every trainee workstation: before 1.421.112.0, after Update-MpSignature 1.421.130.0, Defender event 2000.</p>
<h2>Activity 8.4 · scan of the infected workstation (V4: update, full scan, verify)</h2>
<table><tr><th>Seat</th><th>Threat</th><th>Path</th><th>Quick scan enough?</th><th>Needs the update?</th><th>Result</th><th>File after</th><th>Next step</th></tr>
${seats.map((f) => { const d = f.day8; return `<tr${d.fails ? ' class="u"' : ''}><td><b>${String(f.seat).padStart(2, '0')}</b></td><td>${esc(d.name)}</td><td><small>${esc(d.path)}</small></td><td>${d.quick ? 'yes' : 'no'}</td><td>${d.needsUpdate ? 'yes' : 'no'}</td><td>${d.fails ? 'Failed (1118, file in use)' : 'Quarantined (1117)'}</td><td>${d.fails ? 'still present' : 'gone'}</td><td>${d.fails ? 'Escalate to Tier 2' : 'Record in the shift log'}</td></tr>`; }).join('')}
</table>
<h1 style="margin-top:34px">Day 9 Answer Key</h1>
<h2>Activity 9.1 · stakeholder verification (SOC-SOP-05 F1)</h2>
<table><tr><th>Case</th><th>Stakeholder</th><th>Reply</th><th>Next step</th></tr>${Object.entries(KEY91).map(([id, k]) => `<tr${k[2] !== 'Close the case' ? ' class="u"' : ''}><td><b>${id}</b></td><td>${({ 'C-01': 'Maria Reyes (local 2410)', 'C-02': 'Carlo Diaz (local 3155)', 'C-03': 'Leo Uy, Dev Team (local 3170)', 'C-04': 'Rosa Mendoza (local 4120)', 'C-05': 'Alvin Jimenez (local 4135)' })[id]}</td><td>${k[1]}</td><td>${k[2]}</td></tr>`).join('')}</table>
<p>C-02: the same virus pop-up returns when the QA tools folder opens = symptoms remain: re-open and re-check QA-PC-05. C-03: two calls without an answer (13:20, 15:25) = email the supervisor. The C-01 message must say what was found (trojan in payslip_viewer.exe), what was done (quarantined, file gone) and what to do (restart; report anything unusual) - never a password.</p>
<h2>Activity 9.2 · failed actions (F2)</h2>
<p>${Object.entries(KEY92).map(([l, f]) => f === 'Yes' ? `<b style="color:#C0392B">${l}</b>` : l).join(' · ')}</p>
<p><b>6 failed actions</b>: LOAN-PC-08 1118, PAY-PC-02 1119, LOAN-PC-03 1005, FIN-PC-03 1118, MKT-PC-09 2001, ENG-PC-11 1002. IT-PC-01's 1117 means the action was taken.</p>
<h2>Activity 9.3 · escalation (F3, first matching rule)</h2>
<table><tr><th>Host</th><th>Rule</th><th>Escalate to</th><th>Why</th></tr>${Object.entries(KEY93).map(([h, k]) => `<tr><td><b>${h}</b></td><td>${k[0]}</td><td>${k[1]}</td><td>${({ 'LOAN-PC-08': 'Tier 2, not a red flag, file in use', 'PAY-PC-02': 'Tier 1 payroll workstation', 'LOAN-PC-03': 'engine error 1005 = the product failed', 'FIN-PC-03': 'ransomware reached the Tier 1 FS-01 Finance share', 'MKT-PC-09': 'update failed 2001 = the product failed', 'ENG-PC-11': 'scan stopped on a red-flag host (PE infection source)' })[h]}</td></tr>`).join('')}</table>
<p>FIN-PC-03 record: to the CISO · rule E1 · impact: the \\FS-01\Finance share is still encrypted · needed: a decision on isolating FS-01 and restoring from backup / incident response · target 15 minutes · follow up at 11:35 (called 11:20).</p>
<h2>Activity 9.4 · per seat (day9\my_scan_log.csv)</h2>
<table><tr><th>Seat</th><th>Failed actions</th><th>IT Department Manager (E4)</th><th>Vendor case (E3)</th></tr>
${seats.map((f) => { const d = f.day9; return `<tr><td><b>${String(f.seat).padStart(2, '0')}</b></td><td>${d.failures.map((x) => `${x.event} (${x.rule})`).join(', ')}</td><td>${d.failures.some((x) => x.rule === 'E4') ? 'Yes' : 'No'}</td><td>${d.vendorCase ? 'Yes' : 'No'}</td></tr>`; }).join('')}
</table>
</body></html>`;
mkdirSync(resolve(root, 'trainer'), { recursive: true });
const out = resolve(root, 'trainer', 'Virtual_Lab_Answer_Key_Days_2-9.html');
writeFileSync(out, html);
console.log('wrote', out);
