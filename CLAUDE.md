# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Curriculum materials for a 15-day blended TVET training program, **Cyber Threat Monitoring Level I** (TESDA Competency Standards, ICT sector), aimed at beginner Filipino trainees. It covers two units: **CS-ICT251101 Monitor and Report Cyber Threats** and **CS-ICT251102 Conduct Vulnerability Scanning**. Delivery is synchronous mornings on Google Meet and asynchronous afternoons for activities.

There are three pieces of software:
- `lab/`, the CTM Virtual Lab. This is where trainees do all hands-on work.
- `_build/`, the generators for documents, decks and demo videos.
- `00_Pre-Test/`, an Apps Script web app.

Everything else is course content.

## Common commands

The machine runs Windows. Use Git Bash (`C:\Program Files\Git\bin\bash.exe`) for real GNU tools; the `bash` on PATH is WSL. Run Python with `-I`, and add `-X utf8` for the document generators.

```bash
# lab/
npm test                                   # vitest: all unit tests (byte-for-byte vs Git Bash, graders, seats, sync)
npx vitest run tests/day08.test.ts         # one test file;  add -t "seat 7" to run one test by name
npx playwright test                        # e2e in installed Edge; builds its own dist-e2e/ with sync off (.env.e2e)
npx playwright test e2e/day08.spec.ts      # one e2e file
npx tsc --noEmit                           # type check
npm run answer-key                         # trainer/Virtual_Lab_Answer_Key_Days_2-N.html (trainer only)
npm run publish:web                        # unit tests -> e2e -> build -> push dist/ to GitHub Pages (stops on any failure)
npm run dist:win                           # portable .exe in release/ (close the running lab first, or the build hangs on a locked file)

# _build/  (one generator set per day, e.g. day 8)
python -I day08_data.py                    # writes Day_08…/assets/* and Day_08…/demo/*
python -X utf8 -I day08_docs.py            # Student Handout + Activities .docx
powershell -File tools/docx2pdf.ps1 -Docx <a.docx>,<b.docx>    # PDFs via installed Word
python -X utf8 -I video/demos_d8.py all    # the 3 narrated demo videos (needs internet for edge-tts)
python -X utf8 -I docgen.py live8          # DayNN_Live_Demo_Script.docx
```

## Layout and conventions

- `Day_NN_<Topic>/`: one folder per training day. Days 01–09 are built. Folders for Days 10–15 don't exist yet. Days 5–10 map onto CS-ICT251101 Elements 1–5:
  - Day 5 = Element 1, PC 1.1–1.3
  - Day 6 = PC 1.4–1.5
  - Day 7 = Element 2
  - Day 8 = Element 3
  - Day 9 = Element 4
  - Day 10 = Element 5 (alert reporting)
  - Days 11–14 cover CS-ICT251102, and Day 15 is the integrated simulation.
- **The official TESDA CS PDF is in `_reference/`.** Element, Performance Criteria, Range of Variables and Required Knowledge numbering must come from it and stay consistent across a day's prompt, handout and activities.
- A built day folder holds:
  - `DayNN_Presentation_Prompt.txt`, with a fixed template: SESSION DETAILS, LEARNING OBJECTIVES, HARD RULES (exactly 15 slides, ≤5 bullets, ≤12 words per bullet, 80–150-word notes, Philippine examples, `[verify latest figure]` instead of invented statistics, no malicious code), VISUAL DESIGN (navy `#1F3864`, blue `#2E75B6`, amber `#BF8F00`, green `#548235`, footer `Cyber Threat Monitoring Level I | Day N`), the outline, and OUTPUT FORMAT. New days copy the previous day's file and replace SESSION DETAILS, objectives and outline.
  - `DayNN_Student_Handout.docx/.pdf` and `DayNN_Student_Activities.docx/.pdf` (the PDF is a rendered copy; keep them in sync).
  - `DayNN_Live_Demo_Script.docx/.pdf`.
  - `assets/`: activity files. Every name in an activity's "Assets Needed" column must exist here.
  - `demo/`: demo files plus the `.mp4`/`.srt` videos. Demo files are deliberately different from `assets/`, so videos never reveal activity answers.
- Each day has its own fictional SOP in `assets/`, and the graders encode it: SOC-SOP-01 to SOC-SOP-05 for Days 5–9. The data is fictional: a bank in the assets, a school in the demos. It uses documentation IPs (`203.0.113.0/24`, `198.51.100.0/24`, `192.0.2.0/24`) and private ranges. CSV fields never contain commas, so `cut` and `awk` work.
- Training scripts in `assets/` follow `Day_02…/assets/log_counter.py`: standard library only, read-only, no network, with a docstring stating this.

## How a day is built (Days 5+): the pipeline across the repo

1. `_build/dayNN_data.py` writes `assets/` and `demo/`. Hashes, counts and similar values are computed there, so the data stays self-consistent.
2. `_build/dayNN_docs.py` holds the document content. `_build/daydocs.py` builds the documents by cloning the Day 4 `.docx` files as templates: their tables (by index), boxes, styles, list numbering, header and footer.
   - `table(proto_idx, rows, header)` reuses a template table that has the same column count.
   - `h1(..., new_page=True)` gives a page break without blank pages.
   - Days 1–4 documents have no generator.
3. Lab content:
   - `lab/src/hosts/files.ts` imports the day's files with `?raw` through the `@curriculum` alias (never copied).
   - `hosts.ts` mounts them on all hosts (`~/dayN`, `C:\Users\<u>\dayN`, demo hosts `~/demoN`).
   - `src/missions/dayNN.ts` holds the practice missions (one per video) and Activities N.1–N.4, with graders and exported answer keys (`KEYn1…`).
   - Register the pack in `PACKS` in `src/main.ts` and in `tests/missions.test.ts`.
   - `tools/lessons.mjs`: add the day to `VIDEO_PART` (which handout part each demo video belongs to).
4. Per-seat activity (N.4): `src/hosts/dayNseat.ts` adds evidence to the seat host and returns `facts.dayN` from `seatHosts()`.
   - Each one uses **its own seeded RNG stream**, so earlier days' seat values and answer keys never change. Don't add `r()` calls to the shared stream in `seatHosts`.
   - Demo-host state for a video (for example `plant()` and `applyDay7()` on WKS-TRN-07) is set in `demoWindows()`. Leave earlier days' outputs unchanged, and test that they stay so.
5. Tests:
   - `tests/dayNN.test.ts` re-derives every answer key from the data files and the SOP rules, checks graders on right and wrong answers, and runs all 40 seats.
   - `tests/shell.test.ts` compares the day's Linux commands byte for byte with Git Bash.
6. `e2e/dayNN.spec.ts` runs the day in the app and takes the end-card screenshots (`e2e/shots/NN-dayN-activityNx.png`) used by the videos. Each spec signs in with its own trainer email (`rosa.dayN@example.com`), because the sync server sends at most 3 codes per email per 10 minutes.
7. `_build/video/demos_dN.py` defines the video beats.
   - `labrun.lab()` beats get their output from the lab engine (`lab/tools/live-outputs.mjs`), one fresh pair of demo hosts per video. State changes, such as `Update-MpSignature` and `Start-MpScan`, persist within a video.
   - Before rendering, dump the outputs with `BEATS_ONLY=True` and check every number in the narration against them.
   - Register the day in `docgen.py` (`DAY_FOLDER`, the `plan` for the live script, and the `liveN` flag).
8. `tools/answer-key.mjs` gets a Day N section. The output file name includes the day range; update the `README.md` reference too.
9. `npm run publish:web`.

Day 2 differs: its videos (`_build/video/demos.py`) take output from real Git Bash runs. Days 1–2 decks are pptxgenjs builders (`_build/lib.js`, `day01_*.js`, `day02_lesson.js`) whose `say`/`ask`/`do` notes feed `docgen.py` presenter scripts. `_build/README.md` has those commands.

## CTM Virtual Lab (`lab/`)

Vite + TypeScript + xterm.js. Trainees use https://vervanttechlab.github.io/ctm-virtual-lab/ or the Electron `.exe`.

- **Shell** (`src/shell/`): a parser and VFS (`vfs.ts`, over `Host.files`), with Linux commands (`linux.ts`, text tools in `text.ts`) and Windows commands (`windows.ts`, `windows2.ts`). Windows runs a small PowerShell object pipeline: Import-Csv, Where-Object, Format-Table/List with property lists, Group-Object, Get-WinEvent, the Defender cmdlets, Get-FileHash, Test-Path, Update-MpSignature and Start-MpScan. The last two are simulations that change host state.
  - Linux arguments get bash's leading `~` expansion.
  - `Get-WinEvent` sorts by real time, not by string.
  - When you add or change a command, add a test against the real tool: Git Bash, or Windows PowerShell for things like `Get-FileHash`.
  - `missions.test.ts` requires every step's `try` to match its own `match` regex and to produce output, so silent cmdlets print a `[lab]` line.
- **UI** (DAL3-style, after `D:\DAL3-2026\virtual-lab`): hash routes in `src/main.ts`: `#/` Home, `#/day/N` (Activities | Lesson | Files tabs), `#/lesson/N/k`, `#/files/N`, `#/m/<missionId>` work page (steps | terminal | Lab Notebook, status bar with Check), `#/workspace`, `#/progress`. Page HTML lives in `src/views/pages.ts`; theme tokens (light/dark) in `src/styles.css`.
  - An activity opens on its **Watch first** demo video (skippable, recorded in `st.watched`); the mapping is `src/missions/watch.ts` (Days 5–9 automatic, Days 2–4 by hand).
  - **Lessons** are generated from each `DayNN_Student_Handout.docx` by `tools/lessons.mjs` (runs in predev/prebuild) into `src/lessons/dayNN.json`; it also copies the student PDFs to `public/days/`. Its `VIDEO_PART` table puts each demo video on its handout part: add a row for every new day.
  - e2e specs navigate with `e2e/lab.ts` (`openDay`, `openMission` skips the video, `menu`); `body[data-route]` is set when a route has been drawn. The side nav is hidden on work pages so the terminal keeps its width (a narrow terminal wraps output and breaks matches).
- **Hosts** (`src/hosts/hosts.ts`):
  - Demo hosts WKS-TRN-07 and ubuntu-lab match the videos.
  - Seat hosts WKS-LAB-NN and ubuntu-lab-NN are seeded by seat number, 1–40.
  - Hosts are rebuilt on every app start (nothing persists), so a per-seat activity that continues an earlier day must regenerate its evidence from that day's facts, as `day9Seat(win, seat, d8)` does.
- **Updates without a new `.exe`**: `electron/main.cjs` loads the URL in `electron/web.json` when it is reachable, and otherwise the built-in `dist/` (title "offline copy"). `npm run publish:web` pushes `dist/` to the `vervanttechlab/ctm-virtual-lab` Pages repo. A new `.exe` is only needed when `electron/` changes. `node e2e/electron.web.mjs` checks the start-up path. The site and the offline copy keep separate localStorage.
- **Sync** (`sync/Code.gs`, an Apps Script web app; client `src/ui/sync.ts`; URL in `src/sync.config.json`, empty = offline build):
  - Email-code sign-in. The server assigns seats: the Roster tab seat, else the lowest free seat. The client never sends one.
  - Progress columns: Days 5–15 are appended after the original columns, so columns never move.
  - `Settings > Open Days`: Activities work only for a signed-in trainee on an open day (`activityOpen` in `main.ts`, polled every minute). Practice missions and the Workspace are always open.
  - Day N unlocks when every Day N−1 activity is finished (all steps done and the worksheet checked).
  - Switch user flushes the pending save first.
  - Submissions (`submit`, `mine`, `board`, `submission`, `grade`, `redo` in `Code.gs`; client `src/ui/submit.ts`, board `src/views/board.ts`): one Submissions row per attempt (light columns 1–14, the work JSON chunked from column 15 with the apostrophe writer), Redo tab for returned work. `status` carries the trainee's latest results (`subs`, cached per email). The board re-grades the submitted answers on the trainee's seat with the same graders. Verdict = C / NYC (TESDA), not points. Day unlocking is unchanged (steps + Check), so submitting is not required to unlock.
  - Monitoring (`trainee`, `classLog`, and `presence` on `board` in `Code.gs`; page `src/views/monitor.ts` at `#/trainee/<email>[/<missionId>]`; log and CSVs `src/ui/activity.ts`): live work before Submit, who is online, and a dated activity log. The state records ms times (`at` on log/evidence, `stepAt`, `finished`, `checks`, `watchedAt`, `lessonAt`); `stamp()` in `main.ts` sets them on save, and `stamp(true)` at start-up marks older work 0 (no time), so it is never given today's date. CSV exports have Date and Time columns; `download()` adds the BOM, so CSV builders must not.
  - Teams (`room`, `typing`, `chatSend`, `chatHide`, `share`, `shared`, `teamSet` in `Code.gs`; panel `src/ui/social.ts`, share logic `src/ui/share.ts`, trainer page `src/views/teams.ts` at `#/teams`): one room per team (members, team chat, shared answers; announcements pinned in every room). The open room polls `room` every 2 s without the script lock (cache only; `{ same: true }` when unchanged). `Settings > Answer Sharing` = days on which teammates may share and copy answers; copies go to the Copies tab and are flagged ⧉ COPIED on the board. Answers right on the sharer's seat but wrong on the copier's are never copied (per-seat N.4 evidence). Team names live in Roster column E (`teamSet` writes it; the roster is cached 30 s and cleared on a change).
  - `sync/gas-fake.mjs` runs the real `Code.gs` on fake Google services for `tests/sync.test.ts` and `tools/sync-dev-server.mjs`, which the e2e tests use through `?sync=http://localhost:4180/exec`.
  - Every `Code.gs` change needs the trainer to paste it, run `setup` (which adds missing settings and headers), and deploy a **new version** of the existing deployment, so the URL stays the same.
- **Answer key**: `trainer/` is for the trainer only. Never put it in a Day folder or `dist/`; `publish-web.mjs` refuses.

## Pre-test web app (`00_Pre-Test/`)

A Google Apps Script project with no local tooling. Deployment is a manual paste into the Sheet-bound editor, then **Deploy > Manage deployments > New version**. `README_PreTest_WebApp_Setup.txt` is the trainer guide and holds the answer key.

- `WebApp/Code.gs` constants:
  - `APP`: thresholds.
  - `AREAS`: Part A Days 1–4, Part B CS-ICT251101, Part C CS-ICT251102.
  - `QUESTIONS`: 40 items; `answer` is the 0-based index; `fixed: true` keeps the choice order.
  - `SHEETS`, `RESULT_HEAD`, `SETTINGS_SPEC`: the Sheet schema.
- `WebApp/Index.html` calls only `getExamInfo`, `requestAccess`, `verifyCode`, `saveProgress` and `submitExam`.
- A trailing underscore marks a private function. Trainer entry points (`setup`, `resetInProgressSessions`, `refreshItemAnalysis`) are guarded by `requireOwner_()`.
- The answer key and scoring stay server-side. Never send them to the client.
- **When you change `QUESTIONS`**, update the README answer key; its letters follow the master (unshuffled) order. Then rerun `setup` and deploy a new version.

## Content rules (from the prompts' HARD RULES)

- Write for beginners: explain jargon and use Philippine examples (banks, BPOs, LGUs, schools, hospitals, e-wallets). Applicable laws: RA 10175 and RA 10173.
- Use accurate NIST, MITRE ATT&CK and TESDA terminology. Don't invent statistics.
- No working malicious code, real exploit steps or real credentials. Lab "malware samples" are harmless text placeholders. Never write the EICAR string or real malware bytes into the repo. Everything stays inside the simulated lab.
