# CTM Virtual Lab

A safe practice environment for Cyber Threat Monitoring Level I trainees. It simulates a Windows workstation (PowerShell) and an Ubuntu server inside the browser. Trainees run the same commands they saw in the demo videos, record their analysis in a Lab Notebook, and export it to submit to the trainer. Nothing they type touches their own computer or any real network.

## For the trainer

1. **Give trainees the lab.** Use either:
   - **Web:** host the `dist/` folder on any static host (GitHub Pages, Netlify, a school server) and share the link, or
   - **Offline PC:** copy `release/CTM_Virtual_Lab_<version>_portable.exe` to the PC. It runs without installing anything.
2. **Assign seat numbers 01–40.** With sync on, put them in the Sheet's Roster tab: trainees then type only their name and email, and anyone not on the Roster gets the next free seat automatically. Offline, trainees type the seat you give them. Each seat gets its own hosts, with a different IP, different PIDs and a different "unexpected" listening service, so copied answers are easy to spot.
3. **Collect the exported notebooks** (`DayNN_Lab_Notebook_<name>_SeatNN.doc`, one per day; trainees choose the day at the top of the lab). Each one contains the worksheets with the lab's ✓/✗ checks, the pinned evidence, notes, and the full command log.
4. **Use the answer key** in `trainer/Virtual_Lab_Answer_Key_Days_2-9.html` (run `npm run answer-key` to regenerate it). It is for the trainer only, so never put it in a trainee Day folder.

## Updates without a new .exe

The desktop app loads the lab from the website in `electron/web.json` (https://vervanttechlab.github.io/ctm-virtual-lab/, GitHub Pages, repo `vervanttechlab/ctm-virtual-lab`). If the website cannot be reached, it opens the copy built into the `.exe` (title bar: "offline copy").

- **Publish an update:** `npm run publish:web` (runs the unit tests and the full browser suite first and stops on any failure; then builds and force-pushes `dist/` to the Pages repo). Every app gets it the next time it starts; web users get it on reload. Only the web build is published, never `trainer/` or the curriculum documents.
- **A new `.exe` is only needed** when `electron/` changes (start-up logic, website address) or to refresh the offline copy.
- Saved progress is per origin: the website and the offline copy keep separate local copies. With sync on, signing in restores progress from the Google Sheet either way.
- `node e2e/electron.web.mjs` checks the start-up path (website reachable / down / not configured).

## Accounts, saved progress and day locking

- **Sign-in:** when `src/sync.config.json` holds the trainer's Apps Script URL, trainees sign in with name and email (the seat comes from the Roster tab), and a 6-digit code is emailed to them. There are no passwords. Progress is saved to the trainer's Google Sheet and restored on any computer. With no URL, or with "Work offline", progress stays on that computer only.
- **Setup:** follow `sync/README_Sync_Setup.txt`. The server code is `sync/Code.gs`. `npm run sync:dev` runs that same `Code.gs` locally on fake Google services, so you can test without deploying; open the lab with `?sync=http://localhost:4180/exec`.
- **Open Days:** with sync on, Activities work only for a signed-in trainee on a day listed in the Sheet's Settings > Open Days (`2`, `2,3`, `ALL`; empty = closed). The lab checks it every minute and on window focus. Practice missions and the Workspace are always open, also offline. Without a sync URL there is no gate.
- **Locking:** Day 2 is always open. A later day unlocks when every activity of the previous day is finished, meaning every step is done and "Check my answers" has been used. The Workspace is always open, and trainer emails (set in the Sheet's Settings tab) see every day.

## Workspace (free practice)

Choose **Workspace · free practice (not graded)** in the day selector. It gives you four terminals: copies of the demo hosts (WKS-TRN-07, ubuntu-lab) and copies of your own seat hosts. The left panel has a one-click cheat sheet of every demo command.

The Workspace is **not linked to any activity**: nothing typed there is logged, checked, pinned or exported, and files made there never appear on the activity hosts. Use **Reset workspace** for fresh copies.

This is where the trainer performs the Day 2 demos live, following `Day_02_…/Day02_Live_Demo_Script.pdf`. The demo videos are now the trainees' reviewer.

## What's inside

**Day 2: Computing and Network Foundations**

| Mission | Hosts | Mirrors |
|---|---|---|
| Practice: Demo 1 · Monitoring Commands | WKS-TRN-07, ubuntu-lab (demo hosts) | Video 1 |
| Practice: Demo 2 · Web Log Investigation | ubuntu-lab, `~/demo/demo_access.log` | Video 2 |
| Practice: Demo 3 · Read Before You Run | ubuntu-lab, `~/demo/failed_login_counter.py` | Video 3 |
| Activity 2.1 · Command Lab | the trainee's WKS-LAB-NN + ubuntu-lab-NN | Student Activities 2.1 |
| Activity 2.2 · Network Topology | ubuntu-lab-NN, `~/assets/lab_network_topology.txt` | 2.2 |
| Activity 2.3 · Web Access Log | ubuntu-lab-NN, `~/assets/web_access.log` | 2.3 |
| Activity 2.4 · Monitoring Script | ubuntu-lab-NN, `~/assets/log_counter.py` | 2.4 |

**Day 3: Threat Landscape and Attack Frameworks** (files in `~/day3`)

| Mission | What trainees do |
|---|---|
| Activity 3.1 · Malware Behavior Matching | Read the 8 behavior cards in the terminal, then fill in the matching worksheet |
| Activity 3.2 · Kill Chain Mapping | Read "The Payroll Email" narrative, then fill in the Kill Chain worksheet |
| Activity 3.3 · Exploring MITRE ATT&CK | Use the real attack.mitre.org in the browser, then fill in the ATT&CK worksheet |
| Activity 3.4 · IOC or IOA? | Worksheet only |

**Day 4: Security Solutions and Log Management** (files in `~/day4` and `C:\Users\traineeNN\day4`)

| Mission | What trainees do |
|---|---|
| Activity 4.1 · Which Tool Would Catch It? | Worksheet only |
| Activity 4.2 · Identify the Alert Source | Read the SIEM export with `Import-Csv` or `cut`, then record source, severity and rank |
| Activity 4.3 · Log Hunt | Search the firewall log and Windows security events with grep/awk or PowerShell, then record the findings |
| Activity 4.4 · Explore a Security Console | Run `Get-MpComputerStatus`, `Get-MpThreat`, `Get-MpThreatDetection`, `Get-WinEvent` and `Get-Service` on their own workstation. Each seat has its own Defender detection and logon time. |

**Day 5: Checking for Alerts** (files in `~/day5` and `C:\Users\traineeNN\day5`; CS-ICT251101 Element 1, PC 1.1–1.3)

| Mission | What trainees do |
|---|---|
| Practice: Demos 1–3 | Repeat the three Day 5 videos on the demo hosts (`~/demo5`, `demo5\`) |
| Activity 5.1 · Receive Detection Alerts per SOP | Read `alert_queue.csv` against SOP rule A2 at 09:30: minutes, SLA breaches, red flags, what to handle first |
| Activity 5.2 · Receive Incident Reports | Record six reports (phone, walk-in, email, SMS, chat, video conference); spot the red flags and the OTP social-engineering request |
| Activity 5.3 · Red Flag Check | `edr_file_events.csv`: ransomware (R1–R4), PE infection (V1–V3), and two approved look-alikes |
| Activity 5.4 · Check Your Workstation | Per seat (`src/hosts/day5seat.ts`): ransomware, PE infection or no red flag, each with its own count, time, process and names |

Activities need the trainer to open the day (Settings > Open Days) when sync is on. The Day 5 data comes from `_build/day05_data.py`.

**Day 6: Alert Triage and Ticketing** (files in `~/day6` and `C:\Users\traineeNN\day6`; CS-ICT251101 Element 1, PC 1.4–1.5)

| Mission | What trainees do |
|---|---|
| Practice: Demos 1–3 | Repeat the three Day 6 videos on the demo hosts (`~/demo6`, `demo6\`) |
| Activity 6.1 · Assess Alerts Against Pre-identified Criteria | Assess the Day 5 queue with SOC-SOP-02: routine, detection, threat, asset tier, priority matrix, ticket (4 incidents) |
| Activity 6.2 · True Positive, False Positive or Routine? | Eight borderline alerts against the change calendar, asset inventory and routine list |
| Activity 6.3 · Issue the Ticket | Ticket INC-20261105-101 for the FIN-PC-03 ransomware, linking Q-5005, Q-5011 and IR-01 |
| Activity 6.4 · Triage Your Own Alerts | Per seat (`src/hosts/day6seat.ts`): five workstation alerts (routine, false positive, blocked, confirmed + one extra) |

The Day 6 data comes from `_build/day06_data.py`.

**Day 7: Security Solution Status Check** (files in `~/day7` and `C:\Users\traineeNN\day7`; CS-ICT251101 Element 2, PC 2.1–2.3)

| Mission | What trainees do |
|---|---|
| Practice: Demos 1–3 | Repeat the three Day 7 videos (`~/demo7`, and the WKS-TRN-07 status check) |
| Activity 7.1 · Is It Installed? | Inventory vs console coverage report: 4 gaps, including a host never enrolled |
| Activity 7.2 · Is It Operational? | 14 agent checks against B1–B6 (service, real-time, check-in, content, version, tamper) |
| Activity 7.3 · Can It Clean or Delete? | 8 detections vs host policies: action codes, exclusions, detect-only, re-image |
| Activity 7.4 · Check Your Own Workstation | Per seat (`src/hosts/day7seat.ts`): `Get-Service` (CSFalconService), `Get-MpComputerStatus`, the Wazuh `ossec.log`, `Get-MpPreference` |

**Day 8: Manual Checking and Verification** (files in `~/day8` and `C:\Users\traineeNN\day8`; CS-ICT251101 Element 3, PC 3.1–3.4)

| Mission | What trainees do |
|---|---|
| Practice: Demos 1–3 | Repeat the three Day 8 videos (`~/demo8`; the WKS-TRN-07 update-and-scan) |
| Activity 8.1 · Verify the Detection | `sha256sum` / `Get-FileHash` on 5 samples (harmless text placeholders) vs console hash, threat intel and vendor known-good lists |
| Activity 8.2 · Check the Action | Defender events 1117/1118/1119 vs the after-action file check |
| Activity 8.3 · Check and Patch the Updates | Fleet versions vs the vendor bulletin; `Update-MpSignature` on the own seat, verified by event 2000 |
| Activity 8.4 · Scan the Infected System | Per seat (`src/hosts/day8seat.ts`): a hidden infection that update + `Start-MpScan -ScanType FullScan` finds; some seats' action fails (1118) |

Day 8 added `sha256sum`, `Get-FileHash`, `Test-Path`, `Update-MpSignature` and `Start-MpScan` (a simulation: it changes the host's Defender state, events and files). Linux arguments now get bash's `~` expansion. The Day 8 data comes from `_build/day08_data.py`.

**Day 9: Case Follow-up and Escalation** (files in `~/day9` and `C:\Users\traineeNN\day9`; CS-ICT251101 Element 4, PC 4.1–4.3)

| Mission | What trainees do |
|---|---|
| Practice: Demos 1–3 | Repeat the three Day 9 videos (`~/demo9`) |
| Activity 9.1 · Verify Results with the Stakeholder | 5 cases: directory contact, reply, close / re-open / follow up (rule F1.4) |
| Activity 9.2 · Check the Scan Logs for Failed Actions | 13 log lines; failures are 1118, 1119, 1002, 1005, 2001 |
| Activity 9.3 · Escalate to the Appropriate Authority | 6 failures through rules E1–E4 (CISO, Information Security Manager, vendor, IT Department Manager) and the FIN-PC-03 escalation record |
| Activity 9.4 · Follow Up Your Own Workstation | Per seat (`src/hosts/day9seat.ts`): the scan log after the seat's Day 8 scan |

The Day 9 data comes from `_build/day09_data.py`.

`Get-MpPreference` was added for Day 7. Day 7 never changes Defender's real-time state or the Wazuh service, so the Day 4 answers stay the same. The Day 7 data comes from `_build/day07_data.py`.

The lab loads the activity and demo files straight from the Day folders, so it always matches the Student Activities. The Day 3 narrative `.docx` is converted to text at build time by `tools/extract-docx.mjs`. The text tools (grep, awk, sort, uniq, wc, head, tail, cut) and the Python lab scripts compute their output from those files. The tests check that output byte for byte against the real tools.

## Develop

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # unit tests: lab output vs real Git Bash/Python, demo-screen fidelity, graders, step hints
npm run build          # dist/ (also copies the demo videos + captions into the build)
npx playwright test    # end-to-end in the installed Microsoft Edge; also produces the screenshots used in the demo videos
npm run dist:win       # portable Windows .exe in release/
npm run answer-key     # trainer/Virtual_Lab_Answer_Key_Days_2-9.html
```

**Adding a day:**
1. Write a scenario pack in `src/missions/dayNN.ts`: missions, steps (with a suggested command and a `match` regex), and worksheets with graders.
2. Add any new hosts or files in `src/hosts/`.
3. Add commands to `src/shell/linux.ts` or `src/shell/windows.ts` only if the day needs them.
4. Add a test for every new command that compares its output with the real tool.
