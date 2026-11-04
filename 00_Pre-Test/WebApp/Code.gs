/**
 * CYBER THREAT MONITORING LEVEL I — PRE-TEST WEB APP (Google Apps Script)
 * ----------------------------------------------------------------------
 * Files in this Apps Script project:
 *   Code.gs     (this file)  — server: exam delivery, scoring, security checks, Google Sheet recording
 *   Index.html               — the exam web page shown to trainees
 *
 * SETUP (details in README_PreTest_WebApp_Setup.txt)
 *   1. Create a Google Sheet > Extensions > Apps Script. Paste Code.gs and add Index.html.
 *   2. Run  setup  once (approve permissions). It creates all tabs and the auto-finalize trigger.
 *   3. Fill in the Roster tab (trainee emails and names).
 *   4. Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone.
 *
 * SECURITY FEATURES
 *   - Answer key never leaves the server; scoring happens here.
 *   - Roster: only listed, allowed emails can take the exam.
 *   - Email verification: a 6-digit code is emailed to the trainee to prove they own the email.
 *   - Access code: announced by the trainer at exam time (Settings tab).
 *   - Server-enforced deadline: answers are autosaved to the server; anything after
 *     duration + grace is ignored. Unsubmitted exams are finalized automatically.
 *   - Focus monitoring: leaving the page / switching apps / exiting full screen is logged,
 *     with auto-submit after the maximum number of violations.
 *   - One device per attempt (trainer can approve a new device in the Roster tab).
 *   - Name/email watermark, time per question, fast-answer flags, per-trainee shuffling.
 *   - Trainer-only functions (setup, resets) refuse to run when called from the web page.
 */

const APP = {
  TITLE: 'Cyber Threat Monitoring Level I — Pre-Test',
  SHEET_TITLE: 'CTM Level I — Pre-Test Results',
  SHUFFLE_QUESTIONS: true,    // shuffle question order within each part, per trainee
  SHUFFLE_CHOICES: true,      // shuffle choice order per trainee (except items marked fixed)
  FAST_ANSWER_SEC: 3,         // answers given in less than this many seconds are counted as "fast"
  MIN_AWAY_SEC: 2,            // leaving the page for less than this is ignored (accidental clicks)
  MAX_WRONG_CODES: 5,         // wrong access code attempts allowed per email per 10 minutes
  MAX_EVENTS: 60,             // focus events kept per trainee
  OTP_MINUTES: 10,            // verification code validity
  OTP_MAX_TRIES: 5,           // wrong verification code attempts before the code is cancelled
  OTP_MAX_SENDS: 3,           // verification emails per trainee per 10 minutes
  // Readiness levels (percent of total). The pre-test is diagnostic — not pass/fail.
  LEVELS: [
    { min: 75, label: 'Advanced — strong prior knowledge' },
    { min: 50, label: 'Developing — some prior knowledge' },
    { min: 0, label: 'Beginner — new to the topics' },
  ],
  // An attempt is flagged "REVIEW" in Results when any of these is reached
  FLAG: { focusLosses: 3, awaySec: 60, fullscreenExits: 2, fastAnswers: 5, deviceChanges: 1 },
};

const AREAS = {
  A: 'Part A — Foundations (Days 1–4)',
  B: 'Part B — CS-ICT251101 Monitor and Report Cyber Threats',
  C: 'Part C — CS-ICT251102 Conduct Vulnerability Scanning',
};

// answer = index (0-based) of the correct choice; fixed = keep choice order (ordered lists)
const QUESTIONS = [
  // ---------------- PART A: FOUNDATIONS ----------------
  { area: 'A', q: 'Ransomware encrypts the files of a municipal office so employees cannot open them. Which principle of the CIA triad is MOST affected?',
    choices: ['Confidentiality', 'Integrity', 'Availability', 'Authentication'], answer: 2 },
  { area: 'A', q: 'A weakness in a system that can be exploited by a threat is called a/an:',
    choices: ['Risk', 'Incident', 'Vulnerability', 'Asset'], answer: 2 },
  { area: 'A', q: 'Which Philippine law penalizes illegal access to computer systems?',
    choices: ['RA 10173 (Data Privacy Act of 2012)', 'RA 7796 (TESDA Act of 1994)', 'RA 10175 (Cybercrime Prevention Act of 2012)', 'RA 9184 (Government Procurement Reform Act)'], answer: 2 },
  { area: 'A', q: 'Customer names and contact numbers that appear in security logs and tickets must be protected mainly under:',
    choices: ['RA 10173 (Data Privacy Act of 2012)', 'RA 10175 (Cybercrime Prevention Act of 2012)', 'The Labor Code', 'The company dress code'], answer: 0 },
  { area: 'A', q: 'In a Security Operations Center (SOC), who FIRST receives and triages alerts?',
    choices: ['Tier 3 threat hunter', 'Tier 2 incident responder', 'Tier 1 analyst', 'Chief Information Security Officer'], answer: 2 },
  { area: 'A', q: 'Which Windows Security Event ID indicates a FAILED logon attempt?',
    choices: ['4624', '4625', '4688', '4720'], answer: 1, fixed: true },
  { area: 'A', q: 'Remote Desktop Protocol (RDP) uses which default port?',
    choices: ['22', '445', '443', '3389'], answer: 3, fixed: true },
  { area: 'A', q: 'Which of the following is a PRIVATE (internal) IP address?',
    choices: ['8.8.8.8', '192.168.1.25', '203.0.113.7', '1.1.1.1'], answer: 1 },
  { area: 'A', q: 'A firewall rule that sends traffic arriving on a public IP and port to a specific internal server is called:',
    choices: ['Port forwarding', 'Load balancing', 'Port mirroring', 'Network segmentation'], answer: 0 },
  { area: 'A', q: 'Malware that spreads BY ITSELF from computer to computer across a network is a:',
    choices: ['Trojan', 'Rootkit', 'Worm', 'Adware'], answer: 2 },
  { area: 'A', q: 'In the Cyber Kill Chain, the phase where malware creates a startup entry or scheduled task to survive a reboot is:',
    choices: ['Reconnaissance', 'Delivery', 'Installation', 'Weaponization'], answer: 2 },
  { area: 'A', q: 'MITRE ATT&CK is BEST described as:',
    choices: ['An antivirus product', 'A type of firewall', 'A Philippine cybersecurity law', 'A knowledge base of attacker tactics and techniques'], answer: 3 },
  { area: 'A', q: 'Which security solution is designed to protect websites from attacks such as SQL injection?',
    choices: ['DLP (Data Loss Prevention)', 'NDR (Network Detection and Response)', 'WAF (Web Application Firewall)', 'Backup software'], answer: 2 },
  { area: 'A', q: 'Which platform collects logs from many sources and correlates them to generate security alerts?',
    choices: ['SIEM', 'VPN', 'DNS', 'DHCP'], answer: 0 },

  // ---------------- PART B: CS-ICT251101 ----------------
  { area: 'B', q: 'A user calls the SOC: "All my files now end in .locked and there is a note on my desktop." What is the BEST immediate advice?',
    choices: ['Turn off the computer immediately', 'Disconnect the computer from the network but keep it powered on', 'Pay the ransom to recover the files', 'Delete the note and continue working'], answer: 1 },
  { area: 'B', q: 'According to the Competency Standards, which detections are considered RED FLAGS?',
    choices: ['Phishing and spam', 'Port scans and brute force', 'Ransomware and PE infection/virus', 'Adware and pop-ups'], answer: 2 },
  { area: 'B', q: 'Alerts are assessed using pre-identified criteria. Which set matches the Competency Standards?',
    choices: ['Threat, Detection, Routine', 'Cost, Time, Quality', 'People, Process, Technology', 'Identify, Protect, Recover'], answer: 0 },
  { area: 'B', q: 'A scheduled, approved vulnerability scan triggers a "port scan detected" alert. This alert is BEST classified as:',
    choices: ['Critical incident', 'Benign / routine activity', 'False negative', 'Red flag'], answer: 1 },
  { area: 'B', q: 'According to the Competency Standards, a ticket is issued:',
    choices: ['For every event in the log', 'Only at the end of the shift', 'Upon confirmation of detection', 'Only when a user complains'], answer: 2 },
  { area: 'B', q: 'Which incident report channel is LEAST reliable and should be verified with a call-back before acting?',
    choices: ['Walk-in with company ID', 'SMS from an unknown number claiming to be from IT', 'Video conference with camera on', 'Email from the official helpdesk system'], answer: 1 },
  { area: 'B', q: 'Which security solution action means the threat was NOT remediated?',
    choices: ['Quarantine', 'Blocked', 'Deleted', 'Failed'], answer: 3 },
  { area: 'B', q: 'A computer appears in the asset inventory but NOT in the security solution console. This means:',
    choices: ['The computer is fully protected', 'The alert is a false positive', 'There is a coverage gap — the asset may be unprotected', 'The computer is a server'], answer: 2 },
  { area: 'B', q: 'A security solution running in "detect-only (audit)" mode will:',
    choices: ['Alert but not clean or delete threats', 'Automatically quarantine all threats', 'Block all network traffic', 'Re-image the device'], answer: 0 },
  { area: 'B', q: 'Which PowerShell command shows the status of Microsoft Defender (real-time protection, signature age, etc.)?',
    choices: ['Get-Process', 'Get-MpComputerStatus', 'Get-ADUser', 'Test-Connection'], answer: 1 },
  { area: 'B', q: 'Why should an analyst look up a suspicious file\'s HASH on a reputation site instead of uploading the file itself?',
    choices: ['Hashes are more colorful', 'Hashes can repair the file', 'Uploading is always faster', 'Uploading may expose confidential company or personal data'], answer: 3 },
  { area: 'B', q: 'Before running a full scan on an infected system, the analyst should FIRST:',
    choices: ['Uninstall the security solution', 'Check and update the security solution signatures', 'Delete the user\'s profile', 'Disable the firewall'], answer: 1 },
  { area: 'B', q: 'Which of the following is NOT an "appropriate authority" for escalation listed in the Competency Standards?',
    choices: ['IT Department Manager', 'Information Security Manager', 'Security solution / security vendor', 'The affected user\'s co-worker'], answer: 3 },
  { area: 'B', q: 'During case follow-up, the results of the scan are verified with the:',
    choices: ['Attacker', 'Customer / client / stakeholder', 'Internet service provider only', 'Antivirus forum'], answer: 1 },
  { area: 'B', q: 'A file server suddenly uploads 3 GB of data at 2:00 AM to a cloud storage site never used by the company. This is suspicious:',
    choices: ['Ingress traffic', 'Internal backup traffic', 'Egress traffic (possible data exfiltration)', 'Normal DNS traffic'], answer: 2 },
  { area: 'B', q: 'An attacker uses a stolen administrator password to log in by RDP from one workstation to several servers. This is called:',
    choices: ['Reconnaissance', 'Defacement', 'Weaponization', 'Lateral movement'], answer: 3 },

  // ---------------- PART C: CS-ICT251102 ----------------
  { area: 'C', q: 'Vulnerability scanning is BEST described as:',
    choices: ['Automated checking of assets for known weaknesses', 'Deleting malware from computers', 'Monitoring employees\' social media', 'Encrypting data at rest'], answer: 0 },
  { area: 'C', q: 'CVE (e.g., CVE-2024-3400) is:',
    choices: ['A type of malware', 'A Philippine government agency', 'A firewall brand', 'A standard identifier for a publicly known vulnerability'], answer: 3 },
  { area: 'C', q: 'A vulnerability with a CVSS base score of 9.8 is rated:',
    choices: ['Low', 'Medium', 'High', 'Critical'], answer: 3, fixed: true },
  { area: 'C', q: 'Before conducting a vulnerability scan, the analyst should FIRST:',
    choices: ['Scan all IP addresses on the internet', 'Turn off the antivirus on all servers', 'Consult the vulnerability management schedule with the immediate supervisor', 'Ask users to log off permanently'], answer: 2 },
  { area: 'C', q: 'The list of assets to be scanned should be verified with the:',
    choices: ['Immediate supervisor and change manager', 'Vendor sales agent', 'Internet service provider', 'Security guard'], answer: 0 },
  { area: 'C', q: 'Which NIST publication is referenced in the Competency Standards for performing scanning of assets?',
    choices: ['NIST SP 800-53', 'NIST SP 800-115', 'NIST SP 800-61', 'NIST Cybersecurity Framework 2.0'], answer: 1 },
  { area: 'C', q: 'While a scan is running, users report that the network and their computers became very slow. The analyst should:',
    choices: ['Continue the scan until it finishes', 'Terminate the scan and immediately report to IT', 'Restart all servers', 'Ignore the users'], answer: 1 },
  { area: 'C', q: 'During vulnerability scanning, which should be monitored based on the software\'s capability?',
    choices: ['CPU usage, storage usage and network latency', 'Employee attendance', 'Printer ink levels', 'Number of emails received'], answer: 0 },
  { area: 'C', q: 'Which group lists the types of ASSETS named in the Competency Standards for vulnerability scanning?',
    choices: ['Servers, endpoints, mobile devices, web applications', 'Chairs, tables, cabinets', 'Employees, customers, vendors', 'Emails, chats, phone calls'], answer: 0 },
  { area: 'C', q: 'The completed vulnerability assessment report is submitted to the:',
    choices: ['Immediate supervisor and change manager', 'Public social media page', 'Every employee by email', 'Internet service provider'], answer: 0 },
];

const SHEETS = { SETTINGS: 'Settings', ROSTER: 'Roster', RESULTS: 'Results by Area', RESPONSES: 'Responses', TIMES: 'Question Times',
  ITEMS: 'Item Analysis', DASH: 'Dashboard', KEY: 'Answer Key', LOG: 'Attempt Log' };

const RESULT_HEAD = ['Timestamp', 'Email', 'Full Name', 'Prior Experience', 'Started', 'Minutes Used', 'Submission Status',
  'Focus Losses', 'Time Away (sec)', 'Fullscreen Exits', 'Fast Answers', 'Device Changes', 'Integrity Flag',
  'Total Score', 'Total %', 'Part A Score', 'Part A %', 'Part B Score', 'Part B %', 'Part C Score', 'Part C %', 'Readiness Level', 'Weakest Area'];

// label, default value, note, allowed values (optional). Read by label, so order can change safely.
const SETTINGS_SPEC = [
  ['Exam Status', 'CLOSED', 'OPEN = trainees can start. CLOSED = no new starts (exams in progress can still be submitted).', ['OPEN', 'CLOSED']],
  ['Access Code', '', 'Optional. Blank (recommended) = trainees only enter the 6-digit code emailed to them. Fill in a code only if you also want trainees to type a code you announce in Google Meet.'],
  ['Duration (minutes)', 45, 'Time limit per trainee, counted by the server from the moment the trainee starts.'],
  ['Grace period (minutes)', 2, 'Answers saved after duration + grace are ignored.'],
  ['Require Email Verification', 'YES', 'YES = a 6-digit code is emailed to the trainee before starting (proves they own the email). Uses your Gmail quota (100 emails/day).', ['YES', 'NO']],
  ['Require Roster', 'NO', 'NO = anyone with the link + access code who verifies their email can take the exam. YES = only emails listed in the Roster tab with Allowed = YES.', ['YES', 'NO']],
  ['Require Full Screen', 'YES', 'YES = exam runs in full screen; exiting is recorded (devices that cannot go full screen continue with focus monitoring).', ['YES', 'NO']],
  ['Max Focus Violations', 5, 'Exam is auto-submitted after this many violations (leaving the page/app or exiting full screen). 0 = never auto-submit.'],
  ['Show score to trainee after submit', 'NO', 'YES shows total score and readiness level on the thank-you screen.', ['YES', 'NO']],
];

/* ============================ WEB APP ============================ */

function doGet() {
  const t = HtmlService.createTemplateFromFile('Index');
  t.appTitle = APP.TITLE;
  return t.evaluate()
    .setTitle(APP.TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Called by the page on load: exam overview and whether it is open. */
function getExamInfo() {
  const s = getSettings_(ss_());
  const parts = ['A', 'B', 'C'].map((a) => ({ name: AREAS[a], items: QUESTIONS.filter((q) => q.area === a).length }));
  return { title: APP.TITLE, open: s.open, durationMin: s.durationMin, totalItems: QUESTIONS.length, parts,
    codeRequired: !!s.accessCode, verifyEmail: s.verifyEmail, requireFullscreen: s.requireFullscreen, maxViolations: s.maxViolations };
}

/**
 * Step 1 (Start button): checks access code, roster and attempts.
 * Returns { exam } to start/resume immediately, or { needCode, masked } after emailing a verification code.
 */
function requestAccess(info) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = ss_();
    const s = getSettings_(ss);
    const c = precheck_(ss, s, info);
    const sess = getSession_(c.email);
    // Resuming on the same device does not need a new code (the device token proves continuity)
    if (!s.verifyEmail || (sess && sess.deviceId === c.deviceId)) return { exam: startSession_(ss, s, c, info) };
    if (sess && !(c.roster && c.roster.allowNewDevice)) {
      log_(ss, c.email, c.name, 'Blocked — different device', 'Exam was started on another device');
      throw new Error('Your exam was started on a different device or browser. Continue on that device, or ask your trainer to approve a new device.');
    }
    sendCode_(ss, c);
    return { needCode: true, masked: maskEmail_(c.email) };
  } finally {
    lock.releaseLock();
  }
}

/** Step 2: checks the emailed verification code, then starts (or resumes) the exam. */
function verifyCode(info) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = ss_();
    const s = getSettings_(ss);
    const c = precheck_(ss, s, info);
    if (s.verifyEmail) {
      const cache = CacheService.getScriptCache();
      const key = 'OTP_' + c.email;
      const raw = cache.get(key);
      if (!raw) throw new Error('Your verification code has expired or was not requested. Click "Resend code".');
      const otp = JSON.parse(raw);
      if (String(info.otp || '').replace(/\D/g, '') !== otp.code) {
        otp.tries++;
        log_(ss, c.email, c.name, 'Wrong verification code', 'Attempt ' + otp.tries + ' of ' + APP.OTP_MAX_TRIES);
        if (otp.tries >= APP.OTP_MAX_TRIES) {
          cache.remove(key);
          throw new Error('Too many incorrect codes. Click "Resend code" to get a new one.');
        }
        cache.put(key, JSON.stringify(otp), APP.OTP_MINUTES * 60);
        throw new Error('Incorrect verification code. ' + (APP.OTP_MAX_TRIES - otp.tries) + ' attempt(s) left.');
      }
      cache.remove(key);
      log_(ss, c.email, c.name, 'Email verified', '');
    }
    return { exam: startSession_(ss, s, c, info) };
  } finally {
    lock.releaseLock();
  }
}

/** Validates the registration and exam rules shared by requestAccess and verifyCode. */
function precheck_(ss, s, info) {
  const email = String(info.email || '').trim().toLowerCase();
  const typedName = String(info.name || '').trim();
  const deviceId = String(info.deviceId || '').slice(0, 64);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  if (typedName.length < 3) throw new Error('Please enter your full name.');
  if (!deviceId) throw new Error('This browser cannot run the exam. Please use an updated Chrome, Edge or Firefox.');
  if (!s.open) throw new Error('The pre-test is currently CLOSED. Please wait for your trainer\'s instruction.');

  // Access code (with lockout after repeated wrong codes)
  const cache = CacheService.getScriptCache();
  const badKey = 'BAD_' + email;
  const bad = Number(cache.get(badKey) || 0);
  if (bad >= APP.MAX_WRONG_CODES) throw new Error('Too many wrong access codes. Please wait 10 minutes or ask your trainer.');
  if (s.accessCode && String(info.code || '').trim().toUpperCase() !== s.accessCode.toUpperCase()) {
    cache.put(badKey, String(bad + 1), 600);
    log_(ss, email, typedName, 'Wrong access code', 'Attempt ' + (bad + 1) + ' of ' + APP.MAX_WRONG_CODES);
    throw new Error('Incorrect access code. Listen for the code announced by your trainer.');
  }

  // Roster
  const r = rosterEntry_(ss, email);
  if (s.requireRoster && (!r || !r.allowed)) {
    log_(ss, email, typedName, 'Blocked — not on roster', '');
    throw new Error('Your email is not on the class list for this exam. Use the email you registered with, or ask your trainer.');
  }
  if (hasSubmitted_(ss, email)) throw new Error('This email has already submitted the pre-test. Only one attempt is allowed.');
  return { email, name: (r && r.name) || typedName, deviceId, roster: r };
}

/** Creates a new session or resumes an existing one, and returns what the page needs. */
function startSession_(ss, s, c, info) {
  const props = PropertiesService.getScriptProperties();
  let sess = getSession_(c.email);
  let event = 'Started', detail = '';
  if (sess) {
    event = 'Resumed';
    if (sess.deviceId !== c.deviceId) {
      if (c.roster && c.roster.allowNewDevice) {
        sess.deviceId = c.deviceId;
        sess.deviceChanges = (sess.deviceChanges || 0) + 1;
        clearAllowNewDevice_(ss, c.roster.row);
        detail = 'New device approved by trainer';
      } else {
        log_(ss, c.email, c.name, 'Blocked — different device', 'Exam was started on another device');
        throw new Error('Your exam was started on a different device or browser. Continue on that device, or ask your trainer to approve a new device.');
      }
    }
    if (Date.now() > sess.deadline + s.graceMin * 60000) {
      throw new Error('Your exam time has ended. Your saved answers will be recorded automatically.');
    }
  } else {
    sess = { token: Utilities.getUuid(), email: c.email, name: c.name, experience: String(info.experience || ''), deviceId: c.deviceId,
      start: Date.now(), deadline: Date.now() + s.durationMin * 60000, order: [], choices: {},
      answers: {}, times: {}, focus: { losses: 0, awaySec: 0, fsExits: 0 }, events: [], deviceChanges: 0 };
    ['A', 'B', 'C'].forEach((a) => {
      const idxs = QUESTIONS.map((q, i) => i).filter((i) => QUESTIONS[i].area === a);
      sess.order = sess.order.concat(APP.SHUFFLE_QUESTIONS ? shuffle_(idxs) : idxs);
    });
    sess.order.forEach((i) => {
      const ch = QUESTIONS[i].choices.map((_, j) => j);
      sess.choices[i] = APP.SHUFFLE_CHOICES && !QUESTIONS[i].fixed ? shuffle_(ch) : ch;
    });
  }
  props.setProperty('S_' + c.email, JSON.stringify(sess));
  log_(ss, c.email, c.name, event, detail);

  return {
    token: sess.token, email: c.email, name: sess.name, resumed: event === 'Resumed',
    remainingSec: remaining_(sess),
    answers: sess.answers, focus: sess.focus,
    maxViolations: s.maxViolations, requireFullscreen: s.requireFullscreen,
    questions: sess.order.map((i, n) => ({
      id: i, n: n + 1, part: QUESTIONS[i].area, partName: AREAS[QUESTIONS[i].area], text: QUESTIONS[i].q,
      choices: sess.choices[i].map((j) => ({ id: j, text: QUESTIONS[i].choices[j] })),
    })),
  };
}

/** Emails a 6-digit verification code (limited to OTP_MAX_SENDS per 10 minutes). */
function sendCode_(ss, c) {
  const cache = CacheService.getScriptCache();
  const sentKey = 'OTPN_' + c.email;
  const sent = Number(cache.get(sentKey) || 0);
  if (sent >= APP.OTP_MAX_SENDS) throw new Error('Too many verification emails requested. Please wait 10 minutes or ask your trainer.');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('OTP_' + c.email, JSON.stringify({ code, tries: 0 }), APP.OTP_MINUTES * 60);
  cache.put(sentKey, String(sent + 1), 600);
  MailApp.sendEmail({
    to: c.email,
    subject: 'Your Pre-Test Verification Code: ' + code,
    name: 'CTM Level I Pre-Test',
    body: 'Hello ' + c.name + ',\n\nYour verification code for the ' + APP.TITLE + ' is:\n\n    ' + code + '\n\n' +
      'It is valid for ' + APP.OTP_MINUTES + ' minutes. Do not share this code with anyone.\n' +
      'If you did not request this code, you can ignore this email.',
    htmlBody: '<div style="font-family:Arial,sans-serif;color:#262626">' +
      '<p>Hello ' + c.name.replace(/[<>&]/g, '') + ',</p><p>Your verification code for the <b>' + APP.TITLE + '</b> is:</p>' +
      '<p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#1F3864">' + code + '</p>' +
      '<p>It is valid for ' + APP.OTP_MINUTES + ' minutes. <b>Do not share this code with anyone.</b></p>' +
      '<p style="color:#6B7280;font-size:12px">If you did not request this code, you can ignore this email.</p></div>',
  });
  log_(ss, c.email, c.name, 'Verification code sent', 'Email ' + (sent + 1) + ' of ' + APP.OTP_MAX_SENDS);
}

function maskEmail_(email) {
  const [u, d] = email.split('@');
  return u.slice(0, 2) + '*'.repeat(Math.max(1, u.length - 2)) + '@' + d;
}

/** Autosave from the page (on every answer and every 30 seconds). Rejected after the deadline. */
function saveProgress(p) {
  const email = String(p.email || '').trim().toLowerCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sess = checkSession_(email, p);
    const s = getSettings_(ss_());
    if (Date.now() > sess.deadline + s.graceMin * 60000) return { ok: false, expired: true, remainingSec: 0 };
    mergeProgress_(sess, p);
    PropertiesService.getScriptProperties().setProperty('S_' + email, JSON.stringify(sess));
    return { ok: true, remainingSec: remaining_(sess) };
  } finally {
    lock.releaseLock();
  }
}

/** Final submission. Scored on the server. */
function submitExam(p) {
  const email = String(p.email || '').trim().toLowerCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = ss_();
    if (hasSubmitted_(ss, email)) return { ok: true, already: true };
    const sess = checkSession_(email, p);
    const s = getSettings_(ss);
    let status;
    if (Date.now() > sess.deadline + s.graceMin * 60000) {
      // Too late: ignore what the page sent and score only what was autosaved before the deadline
      mergeProgress_(sess, { events: p.events, focus: p.focus });
      status = 'Late — scored from last autosave before deadline';
    } else {
      mergeProgress_(sess, p);
      status = p.reason === 'violations' ? 'Auto-submitted (focus violations)' : p.reason === 'time' ? 'Auto-submitted (time up)' : 'Submitted on time';
    }
    const sc = recordResult_(ss, sess, status);
    return s.showScore
      ? { ok: true, showScore: true, total: sc.total, max: QUESTIONS.length, pct: sc.totalPct, level: sc.level }
      : { ok: true, showScore: false };
  } finally {
    lock.releaseLock();
  }
}

/** Time-driven (every 5 min, installed by setup): records exams that were never submitted. */
function finalizeExpiredSessions() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = ss_();
    const s = getSettings_(ss);
    const props = PropertiesService.getScriptProperties();
    Object.keys(props.getProperties()).filter((k) => k.indexOf('S_') === 0).forEach((k) => {
      const sess = JSON.parse(props.getProperty(k));
      if (Date.now() > sess.deadline + (s.graceMin + 1) * 60000) {
        if (hasSubmitted_(ss, sess.email)) props.deleteProperty(k);
        else recordResult_(ss, sess, 'Not submitted — scored from last autosave');
      }
    });
  } finally {
    lock.releaseLock();
  }
}

/* ============================ SESSION HELPERS ============================ */

function getSession_(email) {
  const raw = PropertiesService.getScriptProperties().getProperty('S_' + email);
  return raw ? JSON.parse(raw) : null;
}

function checkSession_(email, p) {
  const sess = getSession_(email);
  if (!sess) throw new Error('No active exam session found for this email. Please contact your trainer.');
  if (sess.token !== p.token) throw new Error('Invalid exam session. Please reload the page and contact your trainer.');
  if (sess.deviceId !== p.deviceId) throw new Error('This exam is active on another device. Please contact your trainer.');
  return sess;
}

function remaining_(sess) {
  return Math.max(0, Math.round((sess.deadline - Date.now()) / 1000));
}

/** Copies answers/times/focus data sent by the page into the session (validated). */
function mergeProgress_(sess, p) {
  if (p.answers) {
    const a = {};
    Object.keys(p.answers).forEach((k) => {
      const qi = Number(k), ci = Number(p.answers[k]);
      if (QUESTIONS[qi] && ci >= 0 && ci < QUESTIONS[qi].choices.length) a[qi] = ci;
    });
    sess.answers = a;
  }
  if (p.times) {
    Object.keys(p.times).forEach((k) => {
      const qi = Number(k), t = Number(p.times[k]);
      if (QUESTIONS[qi] && t >= 0) sess.times[qi] = Math.round(t * 10) / 10;
    });
  }
  if (p.focus) {
    // counters can only go up — a page reload cannot erase earlier violations
    sess.focus.losses = Math.max(sess.focus.losses, Number(p.focus.losses) || 0);
    sess.focus.awaySec = Math.max(sess.focus.awaySec, Math.round(Number(p.focus.awaySec) || 0));
    sess.focus.fsExits = Math.max(sess.focus.fsExits, Number(p.focus.fsExits) || 0);
  }
  if (Array.isArray(p.events)) {
    p.events.slice(0, 20).forEach((e) => sess.events.push({ at: Number(e.at) || Date.now(), type: String(e.type).slice(0, 60), detail: String(e.detail || '').slice(0, 80) }));
    sess.events = sess.events.slice(-APP.MAX_EVENTS);
  }
}

/** Scores the session, writes Results, Responses, Question Times and Log, then ends the session. */
function recordResult_(ss, sess, status) {
  const sc = scoreAnswers_(sess.answers);
  const now = new Date();
  const minutes = Math.round(((Math.min(Date.now(), sess.deadline + 15 * 60000) - sess.start) / 60000) * 10) / 10;
  const fast = Object.keys(sess.answers).filter((k) => sess.times[k] !== undefined && sess.times[k] < APP.FAST_ANSWER_SEC).length;
  const f = sess.focus;
  const reasons = [];
  if (f.losses >= APP.FLAG.focusLosses) reasons.push(f.losses + ' focus losses');
  if (f.awaySec >= APP.FLAG.awaySec) reasons.push(f.awaySec + 's away');
  if (f.fsExits >= APP.FLAG.fullscreenExits) reasons.push(f.fsExits + ' full-screen exits');
  if (fast >= APP.FLAG.fastAnswers) reasons.push(fast + ' fast answers');
  if ((sess.deviceChanges || 0) >= APP.FLAG.deviceChanges) reasons.push('device changed');
  if (status.indexOf('Late') === 0 || status.indexOf('Not submitted') === 0 || status.indexOf('violations') > -1) reasons.push('submission status');
  const flag = reasons.length ? 'REVIEW: ' + reasons.join(', ') : 'OK';

  const row = [now, sess.email, sess.name, sess.experience, new Date(sess.start), minutes, status,
    f.losses, f.awaySec, f.fsExits, fast, sess.deviceChanges || 0, flag, sc.total, sc.totalPct];
  ['A', 'B', 'C'].forEach((a) => row.push(sc.areas[a].score, sc.areas[a].pct));
  row.push(sc.level, sc.weakest);
  ss.getSheetByName(SHEETS.RESULTS).appendRow(row);

  ss.getSheetByName(SHEETS.RESPONSES).appendRow([now, sess.email, sess.name]
    .concat(QUESTIONS.map((q, i) => (sess.answers[i] === undefined ? '' : 'abcd'[sess.answers[i]]))));
  ss.getSheetByName(SHEETS.TIMES).appendRow([now, sess.email, sess.name]
    .concat(QUESTIONS.map((q, i) => (sess.times[i] === undefined ? '' : sess.times[i]))));

  const logRows = sess.events.map((e) => [new Date(e.at), sess.email, sess.name, e.type, e.detail]);
  logRows.push([now, sess.email, sess.name, 'Recorded', status + ' | ' + flag]);
  const lg = ss.getSheetByName(SHEETS.LOG);
  lg.getRange(lg.getLastRow() + 1, 1, logRows.length, 5).setValues(logRows);

  PropertiesService.getScriptProperties().deleteProperty('S_' + sess.email);
  refreshItemAnalysis_();
  return sc;
}

/* ============================ SCORING ============================ */

/** answers = { questionIndex: chosenChoiceIndex } */
function scoreAnswers_(answers) {
  const areas = { A: { score: 0, max: 0 }, B: { score: 0, max: 0 }, C: { score: 0, max: 0 } };
  QUESTIONS.forEach((q, i) => {
    areas[q.area].max += 1;
    if (answers[i] === q.answer) areas[q.area].score += 1;
  });
  let total = 0, max = 0, weakest = null;
  Object.keys(areas).forEach((a) => {
    const ar = areas[a];
    ar.pct = Math.round((ar.score / ar.max) * 1000) / 10;
    total += ar.score; max += ar.max;
    if (!weakest || ar.pct < areas[weakest].pct) weakest = a;
  });
  const totalPct = Math.round((total / max) * 1000) / 10;
  return { total, totalPct, areas, level: APP.LEVELS.find((l) => totalPct >= l.min).label, weakest: AREAS[weakest] };
}

/** Trainer: recomputes the Item Analysis tab (run from the editor). */
function refreshItemAnalysis() {
  requireOwner_();
  refreshItemAnalysis_();
}

/** Recomputes the Item Analysis tab from the Responses tab. */
function refreshItemAnalysis_() {
  const ss = ss_();
  const resp = ss.getSheetByName(SHEETS.RESPONSES);
  const n = Math.max(0, resp.getLastRow() - 1);
  const correct = QUESTIONS.map(() => 0);
  if (n) {
    resp.getRange(2, 4, n, QUESTIONS.length).getValues().forEach((r) => r.forEach((v, i) => {
      if (v === 'abcd'[QUESTIONS[i].answer]) correct[i]++;
    }));
  }
  const rows = correct.map((c) => {
    const pct = n ? c / n : 0;
    return [c, n, pct, !n ? '' : pct >= 0.7 ? 'Easy' : pct >= 0.4 ? 'Moderate' : 'Difficult'];
  });
  const ia = ss.getSheetByName(SHEETS.ITEMS);
  ia.getRange(2, 4, rows.length, 4).setValues(rows);
  ia.getRange(2, 6, rows.length, 1).setNumberFormat('0.0%');
}

/* ============================ SETUP ============================ */

/** Run ONCE from the script editor (safe to run again after updating the code). */
function setup() {
  requireOwner_();
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) ss = SpreadsheetApp.create(APP.SHEET_TITLE);
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  buildSheets_(ss);
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'finalizeExpiredSessions').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('finalizeExpiredSessions').timeBased().everyMinutes(5).create();
  Logger.log('Results Google Sheet: ' + ss.getUrl());
  Logger.log('Access Code: ' + (getSettings_(ss).accessCode || '(blank — trainees only use the emailed code)'));
  Logger.log('Email verification: ' + (getSettings_(ss).verifyEmail ? 'ON' : 'OFF') + '. Gmail quota remaining today: ' + MailApp.getRemainingDailyQuota());
  Logger.log('NEXT: Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone.');
}

/** Clears ALL unfinished sessions without recording them. Use only when nobody is taking the exam. */
function resetInProgressSessions() {
  requireOwner_();
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).filter((k) => k.indexOf('S_') === 0).forEach((k) => props.deleteProperty(k));
  Logger.log('All in-progress sessions cleared.');
}

function buildSheets_(ss) {
  const total = QUESTIONS.length;

  // Settings — keep existing values, add missing rows
  const st = sheet_(ss, SHEETS.SETTINGS);
  const old = {};
  if (st.getLastRow() > 1) st.getRange(2, 1, st.getLastRow() - 1, 2).getValues().forEach((r) => { old[r[0]] = r[1]; });
  st.clear();
  st.getRange(1, 1, 1, 3).setValues([['Setting', 'Value', 'Notes']]);
  const rows = SETTINGS_SPEC.map((sp) => {
    let v = old[sp[0]] !== undefined && old[sp[0]] !== '' ? old[sp[0]] : sp[1];
    return [sp[0], v, sp[2]];
  });
  st.getRange(2, 1, rows.length, 3).setValues(rows);
  SETTINGS_SPEC.forEach((sp, i) => {
    if (sp[3]) st.getRange(i + 2, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(sp[3]).build());
  });
  st.getRange(2, 2, rows.length, 1).setNumberFormat('@').setFontWeight('bold');
  st.getRange(2, 3, rows.length, 1).setWrap(true);
  header_(st, 3);
  st.setColumnWidth(1, 240).setColumnWidth(2, 120).setColumnWidth(3, 560);

  // Roster
  const ro = sheet_(ss, SHEETS.ROSTER);
  ro.getRange(1, 1, 1, 4).setValues([['Email', 'Full Name (as it should appear in results)', 'Allowed (YES/NO)', 'Allow New Device (tick once)']]);
  header_(ro, 4);
  ro.setColumnWidth(1, 280).setColumnWidth(2, 300).setColumnWidth(3, 140).setColumnWidth(4, 200);
  ro.getRange(2, 3, 300, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['YES', 'NO']).build());
  ro.getRange(2, 4, 300, 1).insertCheckboxes();
  ro.setFrozenRows(1);

  // Results — if columns changed and there is old data, keep the old tab and start a new one
  let res = ss.getSheetByName(SHEETS.RESULTS);
  if (res && res.getLastRow() > 1 && res.getRange(1, 1, 1, res.getLastColumn()).getValues()[0].join('|') !== RESULT_HEAD.join('|')) {
    res.setName(SHEETS.RESULTS + ' (old ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm') + ')');
    res = null;
  }
  res = res || ss.insertSheet(SHEETS.RESULTS);
  if (res.getLastRow() <= 1) res.clear();
  res.getRange(1, 1, 1, RESULT_HEAD.length).setValues([[...RESULT_HEAD]]);
  header_(res, RESULT_HEAD.length);
  res.setFrozenRows(1);

  [[SHEETS.RESPONSES, 'Q'], [SHEETS.TIMES, 'Q']].forEach(([name, p]) => {
    const sh = sheet_(ss, name);
    sh.getRange(1, 1, 1, total + 3).setValues([['Timestamp', 'Email', 'Full Name'].concat(QUESTIONS.map((_, i) => p + (i + 1) + (name === SHEETS.TIMES ? ' (sec)' : '')))]);
    header_(sh, total + 3);
    sh.setFrozenRows(1);
  });

  const key = sheet_(ss, SHEETS.KEY);
  key.clear();
  key.getRange(1, 1, 1, 5).setValues([['No.', 'Area', 'Question', 'Correct Letter', 'Correct Answer']]);
  key.getRange(2, 1, total, 5).setValues(QUESTIONS.map((q, i) => [i + 1, 'Part ' + q.area, q.q, 'abcd'[q.answer], q.choices[q.answer]]));
  header_(key, 5);
  key.setColumnWidth(3, 520).setColumnWidth(5, 300).setTabColor('#C00000');
  key.setFrozenRows(1);
  key.getRange(2, 3, total, 3).setWrap(true);

  const ia = sheet_(ss, SHEETS.ITEMS);
  ia.clear();
  ia.getRange(1, 1, 1, 7).setValues([['No.', 'Area', 'Question', 'No. Correct', 'No. of Examinees', '% Correct', 'Difficulty']]);
  ia.getRange(2, 1, total, 3).setValues(QUESTIONS.map((q, i) => [i + 1, 'Part ' + q.area, q.q]));
  header_(ia, 7);
  ia.setColumnWidth(3, 520);
  ia.setFrozenRows(1);
  ia.getRange(2, 3, total, 1).setWrap(true);

  const lg = sheet_(ss, SHEETS.LOG);
  lg.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Email', 'Full Name', 'Event', 'Detail']]);
  header_(lg, 5);
  lg.setFrozenRows(1);

  const db = sheet_(ss, SHEETS.DASH);
  db.clear();
  const R = "'" + SHEETS.RESULTS + "'!";
  db.getRange('A1').setValue(APP.TITLE + ' — Class Summary').setFontSize(14).setFontWeight('bold').setFontColor('#1F3864');
  const dash = [
    ['Number of examinees', '=COUNTA(' + col_(R, 'Full Name') + ')'],
    ['Class average (total %)', '=IFERROR(AVERAGE(' + col_(R, 'Total %') + ')/100,"")'],
    ['Highest total score (out of ' + total + ')', '=IFERROR(MAX(' + col_(R, 'Total Score') + '),"")'],
    ['Lowest total score (out of ' + total + ')', '=IFERROR(MIN(' + col_(R, 'Total Score') + '),"")'],
    ['Average — ' + AREAS.A, '=IFERROR(AVERAGE(' + col_(R, 'Part A %') + ')/100,"")'],
    ['Average — ' + AREAS.B, '=IFERROR(AVERAGE(' + col_(R, 'Part B %') + ')/100,"")'],
    ['Average — ' + AREAS.C, '=IFERROR(AVERAGE(' + col_(R, 'Part C %') + ')/100,"")'],
    ['Attempts flagged for integrity REVIEW', '=COUNTIF(' + col_(R, 'Integrity Flag') + ',"REVIEW*")'],
    ['Late / auto-submitted / not submitted', '=COUNTA(' + col_(R, 'Submission Status') + ')-COUNTIF(' + col_(R, 'Submission Status') + ',"Submitted on time")'],
  ];
  APP.LEVELS.forEach((l) => dash.push(['Trainees: ' + l.label, '=COUNTIF(' + col_(R, 'Readiness Level') + ',"' + l.label + '")']));
  db.getRange(3, 1, dash.length, 2).setValues(dash);
  db.getRange('B4').setNumberFormat('0.0%');
  db.getRange('B7:B9').setNumberFormat('0.0%');
  db.getRange(3, 1, dash.length, 1).setFontWeight('bold').setBackground('#DEEAF6');
  db.setColumnWidth(1, 440).setColumnWidth(2, 140);

  [SHEETS.DASH, SHEETS.SETTINGS, SHEETS.ROSTER, SHEETS.RESULTS, SHEETS.ITEMS, SHEETS.RESPONSES, SHEETS.TIMES, SHEETS.LOG, SHEETS.KEY].forEach((n, i) => {
    ss.setActiveSheet(ss.getSheetByName(n)); ss.moveActiveSheet(i + 1);
  });
  const def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0) ss.deleteSheet(def);
}

/* ============================ HELPERS ============================ */

/** Blocks trainer-only functions when they are called from the web page instead of the editor. */
function requireOwner_() {
  const active = Session.getActiveUser().getEmail();
  if (!active || active !== Session.getEffectiveUser().getEmail()) {
    throw new Error('This function can only be run by the trainer from the Apps Script editor.');
  }
}

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('The exam is not set up yet. Trainer: run the setup function first.');
  return SpreadsheetApp.openById(id);
}

function getSettings_(ss) {
  const sh = ss.getSheetByName(SHEETS.SETTINGS);
  const m = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach((r) => { m[String(r[0]).trim()] = r[1]; });
  const yes = (k, d) => String(m[k] === undefined || m[k] === '' ? d : m[k]).trim().toUpperCase() === 'YES';
  const num = (k, d) => (m[k] === undefined || m[k] === '' || isNaN(Number(m[k])) ? d : Number(m[k]));
  return {
    open: String(m['Exam Status'] || '').trim().toUpperCase() === 'OPEN',
    accessCode: String(m['Access Code'] === undefined ? '' : m['Access Code']).trim(),
    durationMin: num('Duration (minutes)', 45),
    graceMin: num('Grace period (minutes)', 2),
    requireRoster: yes('Require Roster', 'NO'),
    verifyEmail: yes('Require Email Verification', 'YES'),
    requireFullscreen: yes('Require Full Screen', 'YES'),
    maxViolations: num('Max Focus Violations', 5),
    showScore: yes('Show score to trainee after submit', 'NO'),
  };
}

function rosterEntry_(ss, email) {
  const sh = ss.getSheetByName(SHEETS.ROSTER);
  if (!sh || sh.getLastRow() < 2) return null;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
  for (let i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim().toLowerCase() === email) {
      return { row: i + 2, name: String(v[i][1]).trim(), allowed: String(v[i][2]).trim().toUpperCase() === 'YES', allowNewDevice: v[i][3] === true };
    }
  }
  return null;
}

function clearAllowNewDevice_(ss, row) {
  ss.getSheetByName(SHEETS.ROSTER).getRange(row, 4).setValue(false);
}

function hasSubmitted_(ss, email) {
  const sh = ss.getSheetByName(SHEETS.RESULTS);
  if (sh.getLastRow() < 2) return false;
  return sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().some((r) => String(r[0]).toLowerCase() === email);
}

function log_(ss, email, name, event, detail) {
  ss.getSheetByName(SHEETS.LOG).appendRow([new Date(), email, name, event, detail || '']);
}

function shuffle_(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 'Results by Area'!X2:X for the column with the given header. */
function col_(prefix, header) {
  const i = RESULT_HEAD.indexOf(header);
  if (i < 0) throw new Error('Unknown results column: ' + header);
  let n = i + 1, letter = '';
  while (n > 0) { const m = (n - 1) % 26; letter = String.fromCharCode(65 + m) + letter; n = Math.floor((n - 1) / 26); }
  return prefix + letter + '2:' + letter;
}

function sheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function header_(sh, cols) {
  sh.getRange(1, 1, 1, cols).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1F3864').setWrap(true);
}
