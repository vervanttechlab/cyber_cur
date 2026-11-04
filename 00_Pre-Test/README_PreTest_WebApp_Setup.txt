CYBER THREAT MONITORING LEVEL I — PRE-TEST WEB APP: SETUP GUIDE
================================================================

FILES
  WebApp/Code.gs ......... server code (questions, answer key, scoring, security checks, Sheet recording)
  WebApp/Index.html ...... the exam page trainees see
  README_PreTest_WebApp_Setup.txt ... this guide (includes the trainer answer key)

WHAT TRAINEES SEE
  1. Welcome page: exam details, rules and monitoring notice, and registration
     (full name, email, prior experience, honesty statement), then
     EMAIL VERIFICATION: a 6-digit code is emailed to them and must be entered to start.
  2. Exam page (full screen): one question at a time, server-controlled timer, question
     navigator, "Flag for review", violations counter, "saved to server" status, and a
     watermark with their name and email.
  3. Review page: unanswered and flagged questions before submitting.
  4. Thank-you page (optionally shows score and readiness level).

----------------------------------------------------------------
SECURITY FEATURES
  Answer key ............. Stays on the server. Trainees only receive questions and choices.
  Shuffling .............. Question order (within each part) and choice order differ per trainee.
  Sign-in with email ..... Trainees sign in with their own email: a 6-digit code is sent to it
                           and must be entered to start. No class list needed (Require Roster = NO).
  Roster (optional) ...... Set Require Roster = YES to allow ONLY emails listed in the Roster tab.
                           Even when not required, the Roster is used for "Allow New Device".
  Access code (optional) . Blank by default: the emailed code is the only code trainees enter.
                           If you fill it in, trainees must also type it (5 wrong = 10-min lockout).
  Email verification ..... A 6-digit code is emailed to the trainee (valid 10 minutes, single use,
                           5 wrong tries cancels it, max 3 emails per 10 minutes). Proves the
                           trainee owns the email — same assurance as Google sign-in, without
                           permission screens. Resuming on the same device needs no new code.
  One attempt ............ An email that already submitted cannot start again.
  One device ............. The exam can only be resumed on the device/browser where it started,
                           unless the trainer ticks "Allow New Device" in the Roster.
  Server timer ........... Time is counted by the server. Answers are autosaved; anything sent
                           after duration + grace is ignored. Exams never submitted are
                           finalized automatically within 5 minutes after the deadline.
  Full screen ............ Exiting full screen pauses the exam behind a screen and is recorded.
                           (Phones/tablets that cannot go full screen continue with focus monitoring.)
  Focus monitoring ....... Leaving the page, switching tabs/apps (2 seconds or more) is recorded
                           with time away. Auto-submit when "Max Focus Violations" is reached.
  Time per question ...... Recorded for every item; answers in under 3 seconds count as "fast".
  Trainer-only functions . setup, resetInProgressSessions and refreshItemAnalysis refuse to run
                           when called from the exam page (only from your Apps Script editor).
  Deterrents ............. Copy/paste, right-click, print, save and developer-tool shortcuts are
                           blocked during the exam; screenshot key presses are recorded.
  Integrity Flag ......... Results show "REVIEW: ..." when an attempt reaches any of:
                           3+ focus losses, 60+ seconds away, 2+ full-screen exits, 5+ fast answers,
                           a device change, or a late / auto-submitted / not-submitted status.

  LIMITS (be honest with yourself): no web page can see a phone or a second device, or a
  person sitting beside the trainee. That is what the Google Meet camera is for.

----------------------------------------------------------------
THE GOOGLE SHEET (tabs created by setup)
  Dashboard ......... examinees, averages per part, readiness counts, integrity flags
  Settings .......... Exam Status, Access Code, Duration, Grace, Require Email Verification, Require Roster,
                      Require Full Screen, Max Focus Violations, Show score
  Roster ............ Email | Full Name | Allowed (YES/NO) | Allow New Device (checkbox)
  Results by Area ... one row per trainee: status, focus losses, time away, full-screen exits,
                      fast answers, device changes, Integrity Flag, scores, readiness, weakest area
  Item Analysis ..... % correct per question (Easy / Moderate / Difficult)
  Responses ......... answer letter for Q1–Q40 (Answer Key order, not the shuffled order)
  Question Times .... seconds spent on Q1–Q40
  Attempt Log ....... every event: started, resumed, wrong codes, blocked attempts, left page,
                      full-screen exits, device changes, recorded result
  Answer Key ........ (red tab) — hide it; never share this Sheet with trainees

----------------------------------------------------------------
STEP 1 — CREATE THE GOOGLE SHEET AND SCRIPT PROJECT
  1. Go to https://sheets.google.com and create a blank spreadsheet:
     CTM Level I — Pre-Test Results
  2. In the Sheet: Extensions > Apps Script. Name the project: CTM Level I Pre-Test.
  3. Code.gs: delete the sample code, paste the entire WebApp/Code.gs, Save.
  4. Click "+" beside Files > HTML, name it exactly  Index , paste the entire
     WebApp/Index.html, Save.

  ALREADY SET UP AN EARLIER VERSION? Replace BOTH files with the new versions, Save, and
  continue with Step 2 (running setup again is safe — see notes in Step 2).

STEP 2 — RUN SETUP
  1. Choose  setup  in the function dropdown and click Run. Approve the permissions
     (Advanced > Go to CTM Level I Pre-Test (unsafe) > Allow). This version also asks
     permission to:
       • "run when you are not present" — to finalize unsubmitted exams, and
       • "send email as you" — to email verification codes (sent from your Gmail account).
  2. The Execution log shows the Sheet link, the Access Code (blank = not used), and your remaining
     Gmail quota for the day (personal Gmail: 100 emails/day — enough for a class).
  Notes on running setup again:
    • Your Settings values and Roster are kept.
    • If Results by Area already has rows with the OLD columns, it is renamed
      "Results by Area (old …)" and a new Results tab is created.
    • The auto-finalize trigger is re-created (never duplicated).

STEP 3 — ROSTER (OPTIONAL — skip if Require Roster = NO)
  Only needed if you set Require Roster = YES. Roster tab, one trainee per row:
    Email ............. the exact email the trainee will type
    Full Name ......... Last Name, First Name M.I.
    Allowed ........... YES
    Allow New Device .. leave unticked
  Tip: copy emails from your enrollment list. To bar someone, set Allowed = NO.

STEP 4 — DEPLOY AS A WEB APP
  1. Deploy > New deployment > gear icon > Web app.
  2. Execute as: Me    |    Who has access: Anyone
  3. Deploy, and copy the Web app URL (ends with /exec).
  UPDATING CODE LATER: Deploy > Manage deployments > Edit (pencil) > Version: New version >
  Deploy. The URL stays the same.

STEP 5 — TEST IT YOURSELF (important)
  1. Settings: Exam Status = OPEN.
  2. Open the URL in Chrome, register, enter the emailed verification
     code (check that the email arrives and how long it takes), answer a few items, switch to
     another tab once, exit full screen once, then submit.
  3. Check Results by Area (Focus Losses, Fullscreen Exits, Integrity Flag), Attempt Log,
     Question Times and Dashboard.
  4. Delete your test rows from Results by Area, Responses, Question Times and Attempt Log.
     Set Exam Status = CLOSED.

----------------------------------------------------------------
EXAM DAY (Day 1 morning, Google Meet)
  Before
    • Leave Access Code blank in Settings (the emailed code is enough).
    • Hide the Answer Key tab. Do not share the Sheet with trainees.
    • Ask trainees to use a laptop/desktop with Chrome or Edge, close other apps,
      and charge their device.
    • Tell them to have their email open on their PHONE to receive the verification code
      (then put the phone away once the exam starts).
  Start
    • Cameras ON, gallery view. Ask each trainee to show their desk and place their phone
      face-down out of reach.
    • Paste the Web app URL in the Meet chat.
    • Set Exam Status = OPEN only when everyone is in the Meet — this is your "start" switch.
  During
    • Watch the Attempt Log for "Blocked", "Left exam page".
    • A trainee whose browser crashed reopens the link on the SAME device and continues.
      If they must change device, add their email to the Roster (Allowed = YES) and tick
      "Allow New Device".
  End
    • Set Exam Status = CLOSED when everyone has started (exams in progress can still be
      submitted). Unsubmitted exams are recorded automatically after the deadline.
  After
    • Check Results by Area for unfamiliar emails/names (no class list is enforced).
    • Review rows with "REVIEW" in Integrity Flag and the Attempt Log. A flag is a reason
      to talk with the trainee, not proof of cheating.

----------------------------------------------------------------
READING THE RESULTS
  Readiness Level (based on total %; diagnostic only, not pass/fail):
    75–100%  Advanced — strong prior knowledge
    50–74%   Developing — some prior knowledge
     0–49%   Beginner — new to the topics
  Weakest Area: the part where the trainee scored lowest — use for grouping and support.
  Item Analysis: "Difficult" items (< 40% correct) show topics to emphasize.

TROUBLESHOOTING
  • "Your email is not on the class list": Require Roster is YES — set it to NO, or add the
    email to the Roster with Allowed = YES.
  • Verification email not received: check Spam/Promotions; wait 60 seconds and click
    "Resend code" (max 3 per 10 minutes); check the trainee typed their email correctly.
    Emergency only: set "Require Email Verification" = NO in Settings.
  • "This function can only be run by the trainer": you ran a trainer function outside the
    editor, or while signed in to a different Google account than the script owner.
  • "Started on a different device": add the trainee's email to the Roster (Allowed = YES) and
    tick "Allow New Device"; it unticks itself after use.
  • "Exam time has ended": the saved answers are recorded automatically within 5 minutes.
  • Full screen does not work on a device: the exam continues and this is logged.
  • A trainee must retake (trainer decision): delete their row in Results by Area,
    Responses and Question Times.
  • Stuck sessions (nobody taking the exam): run  resetInProgressSessions.
  • Item Analysis looks wrong after deleting rows: run  refreshItemAnalysis.
  • Changing a question: edit the QUESTIONS list in Code.gs, run setup, then deploy a
    New version.
  • Adjusting thresholds (fast-answer seconds, flag limits): APP section at the top of Code.gs.

ANSWER KEY (trainer copy — do not distribute)
  Part A:  1-c  2-c  3-c  4-a  5-c  6-b  7-d  8-b  9-a 10-c 11-c 12-d 13-c 14-a
  Part B: 15-b 16-c 17-a 18-b 19-c 20-b 21-d 22-c 23-a 24-b 25-d 26-b 27-d 28-b
          29-c 30-d
  Part C: 31-a 32-d 33-d 34-c 35-a 36-b 37-b 38-a 39-a 40-a
  (Letters follow the master order in Code.gs / the Answer Key tab. Trainees see shuffled
   questions and choices, so their on-screen letters differ — scoring is automatic.)
