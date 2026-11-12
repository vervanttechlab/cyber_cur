CTM VIRTUAL LAB — PROGRESS SYNC: SETUP GUIDE (trainer)
======================================================

WHAT IT DOES
  • Trainees sign in to the CTM Virtual Lab with their email. A 6-digit code is emailed to them
    (no passwords, no accounts to create).
  • Their progress (steps done, worksheets, evidence, notes, command log) is saved to YOUR Google
    Sheet and restored automatically when they sign in on any other computer.
  • You see everyone's progress live in the "Progress" tab.
  • Without internet the lab keeps working and saves on the computer; it uploads when back online.

FILES
  lab/sync/Code.gs ............ the Apps Script code (paste it into the Sheet's Apps Script project)
  lab/src/sync.config.json .... where the web app URL goes, so the lab knows where to save

----------------------------------------------------------------
STEP 1 — CREATE THE SHEET AND SCRIPT
  1. https://sheets.google.com → blank spreadsheet → name it:  CTM Virtual Lab — Progress
  2. Extensions > Apps Script. Name the project:  CTM Virtual Lab Sync
  3. Delete the sample code, paste the whole lab/sync/Code.gs, Save.

STEP 2 — RUN SETUP
  1. Choose  setup  in the function dropdown, click Run, approve the permissions
     (Advanced > Go to CTM Virtual Lab Sync (unsafe) > Allow). It asks to "send email as you" for the codes.
  2. The Sheet now has: Settings, Roster, Progress, Sync Log (State and Sessions are hidden).

STEP 3 — SETTINGS TAB
  Lab Status ...... OPEN (CLOSED stops sign-ins; saved progress is kept)
  Require Roster .. NO  (YES = only emails in the Roster tab can sign in)
  Trainer Emails .. your email(s), comma-separated. Trainer accounts see every day unlocked,
                    so you can demonstrate Day 3 or Day 4 before trainees reach it.
  Open Days ....... which days' ACTIVITIES trainees can do right now:  2   or  2,3   or  ALL.
                    Empty = all Activities closed. Practice missions and the Workspace are ALWAYS open,
                    also offline without signing in. Change it on the training day; open labs pick it up
                    within a minute (no redeploy). Lab Status CLOSED also closes every Activity.
                    Activities also need an online sign-in (Roster email), and the usual rule still applies:
                    Day 3 opens for a trainee only after they finish Day 2.
  (Sheet made before Open Days existed? Paste the new Code.gs and run  setup  again: it adds the
   missing row and keeps your other values.)

STEP 4 — ROSTER TAB (recommended): YOU ASSIGN THE SEATS
  Email | Full Name | Seat | Allowed (YES/NO)
  e.g.  ana.reyes@gmail.com | Ana Reyes | 1 | YES
  Trainees type only their full name and email. They never type a seat.
  • Listed with a seat (1–40): the lab uses THIS seat and THIS name.
  • Not listed: the lab gives them the lowest free seat (one not used by another trainee and not
    reserved in the Roster) and keeps it for them on every sign-in.
  • Use each seat once. Fill the Roster BEFORE trainees first sign in: changing a trainee's seat later
    gives them new lab hosts (new IPs, PIDs, findings), so their earlier worksheet answers no longer match.
  • Trainer Emails never take a seat away from a trainee.

STEP 5 — DEPLOY
  1. Deploy > New deployment > gear > Web app.  Execute as: Me.  Who has access: Anyone.
  2. Copy the Web app URL (ends with /exec).

STEP 6 — CONNECT THE LAB
  1. Open lab/src/sync.config.json and paste the URL:   { "url": "https://script.google.com/macros/s/…/exec" }
  2. Rebuild:  cd lab  →  npm run build  (web)  and  npm run dist:win  (portable .exe)
  3. Give trainees the new .exe / web link. The sign-in screen now asks for name and email only;
     the lab shows their seat after they sign in.
  (To test without rebuilding: open the web lab with  ?sync=<your /exec URL>  at the end of the link.)

UPDATING Code.gs LATER: Deploy > Manage deployments > Edit > Version: New version > Deploy (URL stays).

----------------------------------------------------------------
THE PROGRESS TAB (one row per trainee)
  Email · Full Name · Seat · Last Sync · Highest Day Unlocked
  Day 2/3/4 Activities ...... finished / total   (finished = every step done + "Check my answers" used)
  Day 2/3/4 Checked Score ... correct / checked answers from the lab's automatic checks (a practice guide;
                              you still make the competency judgement)
  Practice Missions Done · Commands Run · Current Mission

SUBMISSIONS AND THE TRAINER BOARD (Code.gs of 12 Nov 2026 or later)
  Trainees press "Submit" (bottom right of an activity) to turn the activity in. Each attempt is one row in the
  Submissions tab: time, email, name, seat, day, activity, attempt, auto score / max, your verdict and feedback.
  The submitted work (answers, steps, evidence with notes, commands with outputs) is stored in the cells after
  column N. A trainee can submit again; the latest attempt counts and every attempt is kept.
  Trainer board: sign in with a Trainer Email > menu (☰) > Trainer board (or the side menu). Pick a day:
    one row per trainee, one column per activity. NEW = waiting for your verdict, C = Competent,
    NYC = Not Yet Competent, REDO = returned to the trainee, ×2 = attempts, LATE = sent while Activities were closed.
    Click a score: the answers are checked again on the trainee's own seat (a score that differs from the one the
    lab sent is shown in red), with the steps, evidence and commands. Choose Competent / Not Yet Competent, write
    feedback, Save (or Save & next). "Return for redo…" sends a note; the trainee sees it in the lab and the
    activity shows REDO until they submit again. The Redo tab keeps every request (OPEN / DONE / CANCELLED).
    "Grade next" opens the oldest submission without a verdict. "Download grades (CSV)" = all days, latest attempts.
  Trainees see your verdict and feedback within a minute (a notice, the Day page and My progress).
  UPDATE: paste the new Code.gs, run setup once (adds the Submissions and Redo tabs), deploy a new version.
  With an older Code.gs the lab hides the Submit button and the board says "Unknown action".

MONITORING TRAINEES AND THE ACTIVITY LOG (Code.gs of 12 Nov 2026, monitoring update)
  The Trainer board updates itself every minute. Under each name: a green dot + "Online · <activity>" when the
  trainee is in the lab now, else "Active 12 min ago". A cell like "3/10 steps · 4 ans" = work not submitted yet
  (steps done, answers typed so far); the green dot = they are working on it right now. "N online now" is on top.
  Click a name (or a "steps" cell) to open the trainee page:
    Days        every day at a glance: lesson parts read, videos, each practice (D1-D3) and activity with its status.
    Live work   one mission as it is now (saved about 3 seconds after each change): answers re-checked on the
                trainee's seat, steps with the date and time each was done, evidence, every command with its output.
    Activity log  everything they did with its date and time, newest first: sign-ins, lessons, videos, missions
                started, steps done, commands, evidence, answer checks, finished missions, submissions, your grades.
                Filter: All / Accomplished / Lessons & videos / Commands & evidence / Sign-ins, and by day.
    "Download activity log (CSV)" = this trainee's full log with Date and Time columns.
  On the board, "Activity log (CSV)…" downloads the whole class (one day or all days):
    Accomplishments summary  one row per trainee and mission: started, steps done, answer checks and last score,
                             finished, submitted, attempts, verdict, graded, each with its date and time.
    Accomplished events      one row per step done, answer check, finished mission, submission and grade.
    Full activity log        all of the above plus sign-ins, lessons, videos, commands and evidence.
  Times are recorded from the lab update of 12 Nov 2026 on. Steps, answer checks and finished missions done
  before that have no recorded time (commands, evidence, videos and missions started keep the time they had).
  UPDATE: paste the new Code.gs and deploy a new version (no setup needed; no new tabs).

CLASS REPORT (trainer accounts only: menu ☰ > Class report, or the button on the Trainer board)
  Sign in to the online lab with an email listed in Settings > Trainer Emails. Pick a day to see, for every trainee:
    First sign-in · Last active · Videos watched · Practice started (and done) · Activities started (and done)
    Status: Not signed in · Signed in, not started · Following the demos · Doing activities · Day finished
  "Following the demos" = opened a demo video or worked on a practice mission of that day.
  Roster trainees who never signed in are listed as "Not signed in". Trainer accounts are not listed.
  Refresh reloads the numbers; "Download CSV (all days)" saves the whole class for Excel / Google Sheets.
  Videos watched is counted from the lab update of 7 Nov 2026 on (older video views were not recorded).
  NEEDS the Code.gs of 7 Nov 2026 or later: paste it and deploy a new version (see UPDATING Code.gs above).
  With an older Code.gs the report says "Unknown action".

TEAMS, WHO IS ONLINE AND TEAM CHAT
  Teams come from the Roster tab, column E "Team" (e.g. Blue Team). Type the same team name for every
  member. A transfer = change that one cell; the lab picks it up within a minute. Empty = no team yet.
  In the lab, every signed-in account gets a "👥 Team" button (trainers: "👥 Teams"):
    Online ... trainees see their own team members and the trainers; trainers see everyone, with the
               activity each person is on. Online = used the lab in the last 2–3 minutes.
    Chat ..... each team has a private chat. Trainers can read and post in every team and post
               Announcements (trainees read Announcements and get a notice; only trainers post there).
               Messages arrive within about 5 seconds. Max 500 characters, one message per 1.5 seconds.
  Every message is kept in the Chat tab (time, channel, email, name, message). A trainer can press
  "Hide" on a message: it disappears for everyone and is marked Hidden = YES in the Chat tab.
  NEEDS the Code.gs of 7 Nov 2026 (chat) or later: paste it, run setup once (adds the Team column
  header and the Chat tab), and deploy a new version.

DAY LOCKING (built into the lab)
  Day 2 is always open. Day 3 unlocks when all Day 2 activities are finished; Day 4 after Day 3.
  The Workspace (free practice) is always open. Trainer Emails see every day.

TROUBLESHOOTING
  • "Seat N is already used": the Roster gives this trainee a seat that another email already uses.
    Check the Progress/Roster tabs and give one of them a different seat.
  • "All 40 seats are taken": every seat is used or reserved. Remove unused Roster/Progress rows.
  • Code email not received: check Spam; wait a minute and press "Change details or resend" (max 3 per 10 min).
  • A trainee must sign in again on every device: run  signOutEverywhere("their@email")  from the editor.
  • "Offline: saved on this PC, will retry" in the lab: no internet; nothing is lost, it uploads later.
  • Gmail quota: personal Gmail sends about 100 emails/day — enough for a class (one code per new device).
