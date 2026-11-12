/**
 * CTM VIRTUAL LAB — PROGRESS SYNC (Google Apps Script web app)
 * -------------------------------------------------------------
 * Trainees sign in to the CTM Virtual Lab with their email (a 6-digit code is emailed to them).
 * Their lab progress is saved here and restored on any computer. The trainer sees everyone's
 * progress live in the "Progress" tab of the Google Sheet.
 *
 * SETUP (details in lab/sync/README_Sync_Setup.txt)
 *   1. Create a Google Sheet > Extensions > Apps Script. Paste this file as Code.gs.
 *   2. Run  setup  once (approve permissions). It creates the tabs.
 *   3. Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone.
 *   4. Put the /exec URL in lab/sync.config.json and rebuild the lab.
 *
 * API: POST a JSON body (Content-Type text/plain) with { action, ... }:
 *   info · requestCode {email,name} · verify {email,code,name} · load {token} · save {token,state,summary} · status {token}
 *   report {token}  (trainer accounts only: the Class report in the lab)
 *   status {token,mission} also records who is online and returns the online list and chat versions
 *   chatGet {token,channel,ver} · chatSend {token,channel,text} · chatHide {token,id} (trainer)
 *   submit {token,day,act,title,score,max,payload} (a trainee turns in an activity; every attempt is kept) · mine {token}
 *   board {token} · submission {token,email,act,attempt?} · grade {token,email,act,verdict,feedback,attempt?} ·
 *   redo {token,email,act,note,cancel?}  (trainer accounts: the Trainer board in the lab)
 *   trainee {token,email} (one trainee's live work and activity log) · classLog {token,day?} (everyone's dated activity log, for the export)
 * The seat comes from the Roster tab (or is assigned automatically); a seat sent by the client is ignored.
 */

const APP = {
  TITLE: 'CTM Virtual Lab',
  OTP_MINUTES: 10, OTP_MAX_TRIES: 5, OTP_MAX_SENDS: 3,
  TOKEN_DAYS: 60,              // a signed-in device stays signed in this long
  CHUNK: 45000,                // characters per cell when storing the saved lab state
  MAX_STATE: 900000,           // reject absurdly large states
  SEATS: 40,                   // seat numbers 1..SEATS (each seat has its own lab hosts)
};
const SHEETS = { SETTINGS: 'Settings', ROSTER: 'Roster', PROGRESS: 'Progress', STATE: 'State', SESSIONS: 'Sessions', LOG: 'Sync Log', CHAT: 'Chat',
  SUBS: 'Submissions', REDO: 'Redo' };
// Submissions: one row per attempt. Columns 1-14 are light (read for lists); the work itself (JSON) is split over columns 15+.
const SUBS_HEAD = ['Time', 'Email', 'Name', 'Seat', 'Day', 'Activity ID', 'Activity', 'Attempt', 'Auto Score', 'Auto Max',
  'Verdict (C / NYC)', 'Trainer Feedback', 'Graded At', 'Late (Activities closed)', 'Submitted work (JSON, split across cells)'];
const SUBS_LIGHT = 14;
const REDO_HEAD = ['Time', 'Email', 'Day', 'Activity ID', 'Trainer Note', 'Status (OPEN / DONE / CANCELLED)', 'Done At'];
const MAX_PAYLOAD = 600000;
// Who is online and team chat. Teams come from the Roster tab, column E (Team).
const ONLINE_MS = 150000;      // seen in the last 2.5 minutes = online (the lab checks in every minute)
const CHAT = { MAX_LEN: 500, KEEP: 100, MIN_GAP_MS: 1500, ANNOUNCE: 'Announcements' };
const ROSTER_HEAD = ['Email', 'Full Name', 'Seat', 'Allowed (YES/NO)', 'Team'];
const CHAT_HEAD = ['Time', 'Channel', 'Email', 'Name', 'Message', 'ID', 'Hidden (YES = hidden by the trainer)'];
// Days 5–15 are appended after the original columns, so existing columns never move.
const LATER_DAYS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const PROGRESS_HEAD = ['Email', 'Full Name', 'Seat', 'Last Sync', 'Highest Day Unlocked', 'Day 2 Activities', 'Day 2 Checked Score',
  'Day 3 Activities', 'Day 3 Checked Score', 'Day 4 Activities', 'Day 4 Checked Score', 'Practice Missions Done', 'Commands Run', 'Current Mission']
  .concat([].concat.apply([], LATER_DAYS.map(function (d) { return ['Day ' + d + ' Activities', 'Day ' + d + ' Checked Score']; })));
const SETTINGS_SPEC = [
  ['Lab Status', 'OPEN', 'OPEN = trainees can sign in and sync. CLOSED = sign-in is refused (saved progress is kept).'],
  ['Open Days', '', 'Days whose Activities trainees can do today, e.g. 2 or 2,3 or ALL. Empty = Activities closed (Practice and Workspace stay open). Trainer Emails always see everything.'],
  ['Require Roster', 'NO', 'YES = only emails listed in the Roster tab (Allowed = YES) can sign in.'],
  ['Trainer Emails', '', 'Comma-separated. These accounts see every day unlocked (for testing and demonstrations).'],
];

// ------------------------------------------------------------------ web entry points
function doGet() {
  return json_({ ok: true, app: APP.TITLE, message: 'CTM Virtual Lab progress sync is running.' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'Bad request.' }); }
  // chatGet only reads (from the cache), so it does not wait for the lock: chat stays quick for a full class
  const lock = req.action === 'chatGet' ? null : LockService.getScriptLock();
  try {
    // Inside the try: an uncaught error makes Google answer with an HTML page that has no CORS header, which the
    // browser reports as "blocked by CORS policy" instead of a message the trainee can read.
    if (lock && !lock.tryLock(25000)) return json_({ ok: false, busy: true, error: 'The lab server is busy. Please try again in a few seconds.' });
    const ss = ss_();
    const handlers = { info: info_, requestCode: requestCode_, verify: verify_, load: load_, save: save_, status: status_, report: report_,
      chatGet: chatGet_, chatSend: chatSend_, chatHide: chatHide_,
      submit: submit_, mine: mine_, board: board_, submission: submission_, grade: grade_, redo: redo_,
      trainee: trainee_, classLog: classLog_ };
    const h = handlers[req.action];
    if (!h) throw new Error('Unknown action.');
    return json_(Object.assign({ ok: true }, h(ss, req)));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e) { /* not held */ } }
  }
}

// ------------------------------------------------------------------ actions
function info_(ss) {
  const s = getSettings_(ss);
  return { open: s.open, requireRoster: s.requireRoster, openDays: s.openDays };
}

/** The lab asks this every minute: which days' Activities are open right now. */
function status_(ss, req) {
  const who = auth_(ss, req.token);
  const me = touch_(ss, who, req.mission);
  return { trainer: who.trainer, openDays: getSettings_(ss).openDays, team: me.team, online: online_(me), chat: chatVersions_(ss, me), subs: mySubs_(ss, who.email) };
}

function requestCode_(ss, req) {
  const c = check_(ss, req);
  const cache = CacheService.getScriptCache();
  const sentKey = 'OTPN_' + c.email;
  const sent = Number(cache.get(sentKey) || 0);
  if (sent >= APP.OTP_MAX_SENDS) throw new Error('Too many codes requested. Please wait 10 minutes or ask your trainer.');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('OTP_' + c.email, JSON.stringify({ code: code, tries: 0 }), APP.OTP_MINUTES * 60);
  cache.put(sentKey, String(sent + 1), 600);
  MailApp.sendEmail({
    to: c.email,
    subject: 'Your CTM Virtual Lab code: ' + code,
    name: APP.TITLE,
    body: 'Hello ' + c.name + ',\n\nYour sign-in code for the CTM Virtual Lab is:\n\n    ' + code + '\n\n' +
      'It is valid for ' + APP.OTP_MINUTES + ' minutes. Do not share this code with anyone.\nIf you did not request it, ignore this email.',
    htmlBody: '<div style="font-family:Arial,sans-serif;color:#262626"><p>Hello ' + esc_(c.name) + ',</p><p>Your sign-in code for the <b>CTM Virtual Lab</b> is:</p>' +
      '<p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#1F3864">' + code + '</p>' +
      '<p>It is valid for ' + APP.OTP_MINUTES + ' minutes. <b>Do not share this code with anyone.</b></p></div>',
  });
  log_(ss, c.email, 'Code sent', 'Email ' + (sent + 1) + ' of ' + APP.OTP_MAX_SENDS);
  return { masked: maskEmail_(c.email) };
}

function verify_(ss, req) {
  const c = check_(ss, req);
  const cache = CacheService.getScriptCache();
  const key = 'OTP_' + c.email;
  const raw = cache.get(key);
  if (!raw) throw new Error('Your code has expired or was not requested. Click "Send code" again.');
  const otp = JSON.parse(raw);
  if (String(req.code || '').replace(/\D/g, '') !== otp.code) {
    otp.tries++;
    if (otp.tries >= APP.OTP_MAX_TRIES) { cache.remove(key); throw new Error('Too many incorrect codes. Request a new code.'); }
    cache.put(key, JSON.stringify(otp), APP.OTP_MINUTES * 60);
    throw new Error('Incorrect code. ' + (APP.OTP_MAX_TRIES - otp.tries) + ' attempt(s) left.');
  }
  cache.remove(key);
  const token = Utilities.getUuid();
  sheet_(ss, SHEETS.SESSIONS).appendRow([token, c.email, new Date(), new Date(Date.now() + APP.TOKEN_DAYS * 86400000)]);
  upsertProgress_(ss, c.email, { name: c.name, seat: c.seat });
  touch_(ss, { email: c.email, trainer: c.trainer }, '', { name: c.name, seat: c.seat });
  log_(ss, c.email, 'Signed in', 'Seat ' + c.seat + (c.trainer ? ' (trainer)' : ''));
  const saved = readState_(ss, c.email);
  return { token: token, email: c.email, name: c.name, seat: c.seat, trainer: c.trainer, state: saved.state, updated: saved.updated, openDays: getSettings_(ss).openDays };
}

function load_(ss, req) {
  const who = auth_(ss, req.token);
  const saved = readState_(ss, who.email);
  return { email: who.email, trainer: who.trainer, state: saved.state, updated: saved.updated, openDays: getSettings_(ss).openDays };
}

function save_(ss, req) {
  const who = auth_(ss, req.token);
  const text = JSON.stringify(req.state || {});
  if (text.length > APP.MAX_STATE) throw new Error('Saved lab state is too large.');
  const updated = Number((req.state && req.state.updatedAt) || Date.now());
  const prev = readState_(ss, who.email);
  if (prev.updated && prev.updated > updated) return { updated: prev.updated, stale: true }; // a newer copy is already saved
  writeState_(ss, who.email, text, updated);
  const sm = req.summary || {};
  upsertProgress_(ss, who.email, { summary: sm });
  touch_(ss, who, sm.mission);
  return { updated: updated };
}

/**
 * Trainer only: who has signed in, and what each trainee has started (videos, practice, activities).
 * Returns the raw progress of every trainee; the lab turns it into the Class report (src/ui/report.ts).
 * Trainees on the Roster who never signed in are included with signedIn = false. Trainer accounts are left out.
 */
function report_(ss, req) {
  const who = auth_(ss, req.token);
  if (!who.trainer) throw new Error('Only trainer accounts can open the class report.');
  const s = getSettings_(ss);
  const rows = function (name, cols) { const sh = ss.getSheetByName(name); return sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, cols).getValues() : []; };
  const ms = function (v) { const t = v instanceof Date ? v.getTime() : Number(v) || (v ? new Date(v).getTime() : 0); return isNaN(t) ? 0 : t; };
  const people = {};
  const person = function (email) {
    const e = String(email).trim().toLowerCase();
    if (!e || s.trainers.indexOf(e) >= 0) return null;
    return people[e] || (people[e] = { email: e, name: '', seat: 0, team: '', signedIn: false, firstSignIn: 0, lastSync: 0, updated: 0, done: {}, checked: {}, videos: {}, started: {}, filled: {} });
  };
  rows(SHEETS.ROSTER, 5).forEach(function (r) { const p = person(r[0]); if (p) { p.name = String(r[1] || '').trim(); p.seat = Number(r[2]) || 0; p.team = String(r[4] || '').trim(); } });
  rows(SHEETS.PROGRESS, 4).forEach(function (r) {
    const p = person(r[0]); if (!p) return;
    p.signedIn = true; p.name = p.name || String(r[1] || ''); p.seat = p.seat || Number(r[2]) || 0; p.lastSync = ms(r[3]);
  });
  rows(SHEETS.SESSIONS, 4).forEach(function (r) {
    const p = person(r[1]); if (!p) return;
    const t = ms(r[2]); if (t && (!p.firstSignIn || t < p.firstSignIn)) p.firstSignIn = t;
  });
  const st = ss.getSheetByName(SHEETS.STATE);
  if (st && st.getLastRow() > 1) {
    const width = st.getLastColumn();
    st.getRange(2, 1, st.getLastRow() - 1, width).getValues().forEach(function (r) {
      const p = person(r[0]); if (!p || !p.signedIn) return;
      let x = {};
      try { x = JSON.parse(r.slice(2).join('') || '{}'); } catch (err) { return; }
      p.updated = Number(r[1]) || 0;
      p.done = x.done || {}; p.checked = x.checked || {}; p.videos = x.videos || {}; p.started = x.started || {};
      // how many worksheet fields have an answer typed in (an activity can be started on its worksheet alone)
      Object.keys(x.ws || {}).forEach(function (id) {
        const n = Object.keys(x.ws[id] || {}).filter(function (k) { return String(x.ws[id][k] || '').trim() !== ''; }).length;
        if (n) p.filled[id] = n;
      });
    });
  }
  const list = Object.keys(people).map(function (k) { return people[k]; }).sort(function (a, b) { return (a.seat || 99) - (b.seat || 99) || a.email.localeCompare(b.email); });
  return { trainees: list, openDays: s.openDays, generated: Date.now() };
}

// ------------------------------------------------------------------ submissions (the trainee turns in an activity) + trainer board
/** Text for a cell: the leading apostrophe stops Sheets from reading "-..." or "=..." as a formula (it is not part of the value). */
function txt_(v) { return "'" + String(v === undefined || v === null ? '' : v); }
function ms_(v) { const t = v instanceof Date ? v.getTime() : Number(v) || (v ? new Date(v).getTime() : 0); return isNaN(t) ? 0 : t; }
const ACT_ID = /^d\d{1,2}-act\d{1,2}\.\d$/;

/** Every attempt (light columns only), oldest first. */
function subsRows_(ss) {
  const sh = sheet_(ss, SHEETS.SUBS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, SUBS_LIGHT).getValues().map(function (r, i) {
    return { row: i + 2, ts: ms_(r[0]), email: String(r[1]).trim().toLowerCase(), name: String(r[2]), seat: Number(r[3]) || 0, day: Number(r[4]) || 0,
      act: String(r[5]), title: String(r[6]), attempt: Number(r[7]) || 1, score: Number(r[8]) || 0, max: Number(r[9]) || 0,
      verdict: String(r[10] || ''), feedback: String(r[11] || ''), gradedAt: ms_(r[12]), late: String(r[13]).toUpperCase() === 'YES' };
  }).filter(function (x) { return x.email; });
}
/** Open redo requests: { email: { act: { note, at } } }. */
function redoOpen_(ss) {
  const sh = sheet_(ss, SHEETS.REDO), out = {};
  if (sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    const e = String(r[1]).trim().toLowerCase(), a = String(r[3]);
    if (!e || String(r[5]).toUpperCase() !== 'OPEN') return;
    (out[e] = out[e] || {})[a] = { note: String(r[4] || ''), at: ms_(r[0]) };
  });
  return out;
}
/** The latest attempt per email|act, with the number of attempts. */
function latest_(rows) {
  const m = {};
  rows.forEach(function (x) { const k = x.email + '|' + x.act; const n = (m[k] ? m[k].attempts : 0) + 1; m[k] = Object.assign({}, x, { attempts: n }); });
  return m;
}
function pub_(x) {
  return { act: x.act, day: x.day, title: x.title, attempt: x.attempt, attempts: x.attempts, ts: x.ts, score: x.score, max: x.max,
    verdict: x.verdict, feedback: x.feedback, gradedAt: x.gradedAt, late: x.late };
}

/** A trainee's own results (latest attempt per activity) and open redo requests. Cached: it rides on every status check. */
function mySubs_(ss, email) {
  const cache = CacheService.getScriptCache(), key = 'SUBS_' + email;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const last = latest_(subsRows_(ss).filter(function (x) { return x.email === email; }));
  const out = { latest: {}, redo: redoOpen_(ss)[email] || {} };
  Object.keys(last).forEach(function (k) { out.latest[last[k].act] = pub_(last[k]); });
  cache.put(key, JSON.stringify(out), 600);
  return out;
}
function forgetSubs_(email) { CacheService.getScriptCache().remove('SUBS_' + email); }

function mine_(ss, req) {
  const who = auth_(ss, req.token);
  return { subs: mySubs_(ss, who.email) };
}

function submit_(ss, req) {
  const who = auth_(ss, req.token);
  const act = String(req.act || ''), day = Number(req.day) || 0;
  if (!ACT_ID.test(act) || day < 1 || day > 15) throw new Error('Unknown activity.');
  const s = getSettings_(ss);
  const text = JSON.stringify(req.payload || {});
  if (text.length > MAX_PAYLOAD) throw new Error('Your submission is too large. Remove some pinned evidence and try again.');
  const score = Math.max(0, Number(req.score) || 0), max = Math.max(0, Number(req.max) || 0);
  const r = rosterEntry_(ss, who.email);
  let name = r && r.name, seat = r && r.seat;
  if (!name || !seat) {
    const pr = sheet_(ss, SHEETS.PROGRESS), row = findRow_(pr, who.email);
    if (row) { const v = pr.getRange(row, 1, 1, 3).getValues()[0]; name = name || String(v[1]); seat = seat || Number(v[2]); }
  }
  const prev = subsRows_(ss).filter(function (x) { return x.email === who.email && x.act === act; }).length;
  const late = !who.trainer && s.openDays.indexOf(day) < 0;
  const sh = sheet_(ss, SHEETS.SUBS);
  const chunks = [];
  for (let i = 0; i < text.length; i += APP.CHUNK) chunks.push("'" + text.slice(i, i + APP.CHUNK));
  const now = new Date();
  const values = [now, who.email, txt_(name || who.email), seat || '', day, txt_(act), txt_(String(req.title || act).slice(0, 120)), prev + 1, score, max, '', '', '', late ? 'YES' : ''].concat(chunks);
  sh.getRange(sh.getLastRow() + 1, 1, 1, values.length).setValues([values]);
  // an open redo request for this activity is answered
  const rd = sheet_(ss, SHEETS.REDO);
  if (rd.getLastRow() > 1) rd.getRange(2, 1, rd.getLastRow() - 1, 6).getValues().forEach(function (x, i) {
    if (String(x[1]).trim().toLowerCase() === who.email && String(x[3]) === act && String(x[5]).toUpperCase() === 'OPEN') rd.getRange(i + 2, 6, 1, 2).setValues([['DONE', now]]);
  });
  forgetSubs_(who.email);
  log_(ss, who.email, 'Submitted', act + ' attempt ' + (prev + 1) + ': ' + score + ' / ' + max + (late ? ' (late)' : ''));
  return { attempt: prev + 1, ts: now.getTime(), late: late, subs: mySubs_(ss, who.email) };
}

function trainerOnly_(ss, req) {
  const who = auth_(ss, req.token);
  if (!who.trainer) throw new Error('Only trainer accounts can open the trainer board.');
  return who;
}

/** Trainer board: the class (as in the Class report) plus everyone's latest attempt per activity and the open redo requests. */
function board_(ss, req) {
  trainerOnly_(ss, req);
  const rep = report_(ss, req);
  const last = latest_(subsRows_(ss));
  const subs = Object.keys(last).map(function (k) { return Object.assign({ email: last[k].email }, pub_(last[k])); });
  const redo = [];
  const ro = redoOpen_(ss);
  Object.keys(ro).forEach(function (e) { Object.keys(ro[e]).forEach(function (a) { redo.push({ email: e, act: a, note: ro[e][a].note, at: ro[e][a].at }); }); });
  return { trainees: rep.trainees, openDays: rep.openDays, generated: rep.generated, subs: subs, redo: redo, presence: presence_() };
}

// ------------------------------------------------------------------ monitoring: one trainee's live work, and everyone's dated activity log
/** Who used the lab in the last 6 hours: { email: { mission, ago (seconds) } }. Trainer accounts are left out. */
function presence_() {
  const pres = JSON.parse(CacheService.getScriptCache().get('PRESENCE') || '{}'), now = Date.now(), out = {};
  Object.keys(pres).forEach(function (e) { if (!pres[e].trainer) out[e] = { mission: pres[e].mission || '', ago: Math.round((now - pres[e].t) / 1000) }; });
  return out;
}
/** Each attempt row with the number of attempts of its trainee and activity (the export and trainee page need both). */
function withAttempts_(rows) {
  const n = {};
  rows.forEach(function (x) { n[x.email + '|' + x.act] = (n[x.email + '|' + x.act] || 0) + 1; });
  return rows.map(function (x) { return Object.assign({ email: x.email }, pub_(Object.assign({}, x, { attempts: n[x.email + '|' + x.act] }))); });
}
/** Every saved lab state: { email: { updated, state } } (the auth token is never stored). */
function allStates_(ss) {
  const out = {}, st = ss.getSheetByName(SHEETS.STATE);
  if (!st || st.getLastRow() < 2) return out;
  st.getRange(2, 1, st.getLastRow() - 1, st.getLastColumn()).getValues().forEach(function (r) {
    const e = String(r[0]).trim().toLowerCase();
    if (!e) return;
    try { out[e] = { updated: Number(r[1]) || 0, state: JSON.parse(r.slice(2).join('') || 'null') }; } catch (err) { out[e] = { updated: Number(r[1]) || 0, state: null }; }
  });
  return out;
}
/** Sync Log events per trainee: their sign-ins and submissions, and the trainer's grades and redo requests on their work. */
function events_(ss) {
  const out = {}, sh = ss.getSheetByName(SHEETS.LOG);
  if (!sh || sh.getLastRow() < 2) return out;
  const own = ['Signed in', 'Submitted'], onThem = ['Graded', 'Returned for redo', 'Redo cancelled'];
  sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(function (r) {
    const ev = String(r[2]), detail = String(r[3] || '');
    let email = '', by = '';
    if (own.indexOf(ev) >= 0) email = String(r[1]).trim().toLowerCase();
    else if (onThem.indexOf(ev) >= 0) { email = detail.split(' ')[0].toLowerCase(); by = String(r[1]).trim().toLowerCase(); }
    if (email) (out[email] = out[email] || []).push({ at: ms_(r[0]), event: ev, detail: by ? detail.slice(email.length + 1) : detail, by: by });
  });
  return out;
}
/** The parts of a saved state the activity log needs (command lines without their output, evidence without the pinned text). */
function slimState_(x, day) {
  if (!x) return null;
  const inDay = function (e) { return !day || Number(e.day || 2) === day; };
  return { seat: x.seat, missionId: x.missionId, done: x.done || {}, started: x.started || {}, finished: x.finished || {}, stepAt: x.stepAt || {},
    checked: x.checked || {}, checks: (x.checks || []).filter(function (c) { return !day || String(c.mission || '').indexOf('d' + day + '-') === 0; }),
    videos: x.videos || {}, watched: x.watched || {}, watchedAt: x.watchedAt || {}, lessonRead: x.lessonRead || {}, lessonAt: x.lessonAt || {},
    log: (x.log || []).filter(inDay).map(function (l) { return { at: l.at || 0, time: l.time, host: l.host, line: l.line, mission: l.mission, day: l.day }; }),
    evidence: (x.evidence || []).filter(inDay).map(function (e) { return { at: e.at || 0, time: e.time, host: e.host, cmd: e.cmd, note: e.note, mission: e.mission, day: e.day }; }) };
}

/** Trainer: one trainee in full: the live lab state (answers, steps, evidence, commands with output), every attempt, events, presence. */
function trainee_(ss, req) {
  trainerOnly_(ss, req);
  const email = String(req.email || '').trim().toLowerCase();
  const rep = report_(ss, req);
  const t = rep.trainees.filter(function (x) { return x.email === email; })[0];
  if (!t) throw new Error('Unknown trainee.');
  const saved = readState_(ss, email);
  const state = saved.state;
  if (state) delete state.token;
  return {
    email: email, name: t.name, seat: t.seat, team: t.team, signedIn: t.signedIn, firstSignIn: t.firstSignIn, lastSync: t.lastSync,
    updated: saved.updated, state: state, events: events_(ss)[email] || [], presence: presence_()[email] || null, generated: Date.now(),
    subs: withAttempts_(subsRows_(ss).filter(function (x) { return x.email === email; })),
    redo: (function () { const r = redoOpen_(ss)[email] || {}; return Object.keys(r).map(function (a) { return { email: email, act: a, note: r[a].note, at: r[a].at }; }); })(),
  };
}

/** Trainer: everyone's dated activity log (day = 0: all days), for the Activity log export and the accomplishments summary. */
function classLog_(ss, req) {
  trainerOnly_(ss, req);
  const day = Number(req.day) || 0;
  const rep = report_(ss, req), states = allStates_(ss), ev = events_(ss);
  const subs = withAttempts_(subsRows_(ss)).filter(function (x) { return !day || x.day === day; });
  return {
    day: day, generated: Date.now(), subs: subs,
    trainees: rep.trainees.map(function (t) {
      return { email: t.email, name: t.name, seat: t.seat, team: t.team, signedIn: t.signedIn, firstSignIn: t.firstSignIn, lastSync: t.lastSync,
        state: slimState_((states[t.email] || {}).state, day), events: ev[t.email] || [] };
    }),
  };
}

/** One trainee's attempts at one activity (oldest first) and the full work of one attempt (default: the latest). */
function submission_(ss, req) {
  trainerOnly_(ss, req);
  const email = String(req.email || '').trim().toLowerCase(), act = String(req.act || '');
  const list = subsRows_(ss).filter(function (x) { return x.email === email && x.act === act; });
  if (!list.length) throw new Error('No submission yet.');
  const pick = list[Math.min(list.length, Math.max(1, Number(req.attempt) || list.length)) - 1];
  const sh = sheet_(ss, SHEETS.SUBS);
  const width = sh.getLastColumn();
  const cells = width > SUBS_LIGHT ? sh.getRange(pick.row, SUBS_LIGHT + 1, 1, width - SUBS_LIGHT).getValues()[0].map(String) : [];
  let payload = null;
  try { payload = JSON.parse(cells.join('') || 'null'); } catch (e) { payload = null; }
  const ro = (redoOpen_(ss)[email] || {})[act] || null;
  return {
    history: list.map(function (x) { return { attempt: x.attempt, ts: x.ts, score: x.score, max: x.max, verdict: x.verdict, feedback: x.feedback, gradedAt: x.gradedAt, late: x.late }; }),
    attempt: pick.attempt, latest: pick === list[list.length - 1], email: email, name: pick.name, seat: pick.seat, day: pick.day, act: act, title: pick.title,
    payload: payload, redo: ro,
  };
}

/** Trainer verdict (C = Competent, NYC = Not Yet Competent, '' = not graded) and feedback on an attempt (default: the latest). */
function grade_(ss, req) {
  const who = trainerOnly_(ss, req);
  const email = String(req.email || '').trim().toLowerCase(), act = String(req.act || '');
  const verdict = String(req.verdict || '').toUpperCase();
  if (['', 'C', 'NYC'].indexOf(verdict) < 0) throw new Error('Verdict must be C, NYC or empty.');
  const list = subsRows_(ss).filter(function (x) { return x.email === email && x.act === act; });
  if (!list.length) throw new Error('No submission yet.');
  const pick = list[Math.min(list.length, Math.max(1, Number(req.attempt) || list.length)) - 1];
  const fb = String(req.feedback || '').slice(0, 2000);
  sheet_(ss, SHEETS.SUBS).getRange(pick.row, 11, 1, 3).setValues([[verdict, fb ? txt_(fb) : '', verdict || fb ? new Date() : '']]);
  forgetSubs_(email);
  log_(ss, who.email, 'Graded', email + ' ' + act + ' attempt ' + pick.attempt + ': ' + (verdict || '-'));
  return { attempt: pick.attempt, verdict: verdict, feedback: fb };
}

/** Return an activity to a trainee for redo (with a note), or cancel the open request. */
function redo_(ss, req) {
  const who = trainerOnly_(ss, req);
  const email = String(req.email || '').trim().toLowerCase(), act = String(req.act || '');
  if (!email || !ACT_ID.test(act)) throw new Error('Unknown activity.');
  const sh = sheet_(ss, SHEETS.REDO), now = new Date();
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (x, i) {
    if (String(x[1]).trim().toLowerCase() === email && String(x[3]) === act && String(x[5]).toUpperCase() === 'OPEN') sh.getRange(i + 2, 6, 1, 2).setValues([['CANCELLED', now]]);
  });
  if (!req.cancel) sh.getRange(sh.getLastRow() + 1, 1, 1, 7).setValues([[now, email, Number(act.replace(/^d(\d+)-.*$/, '$1')), txt_(act), txt_(String(req.note || '').slice(0, 1000)), 'OPEN', '']]);
  forgetSubs_(email);
  log_(ss, who.email, req.cancel ? 'Redo cancelled' : 'Returned for redo', email + ' ' + act);
  return { redo: !req.cancel };
}

// ------------------------------------------------------------------ who is online + team chat
/** Record that this account is using the lab now. Returns { email, name, seat, team, trainer, mission }. */
function touch_(ss, who, mission, known) {
  const cache = CacheService.getScriptCache();
  const pres = JSON.parse(cache.get('PRESENCE') || '{}');
  const old = pres[who.email] || {};
  const r = rosterEntry_(ss, who.email);
  let name = (known && known.name) || old.name, seat = (known && known.seat) || old.seat;
  if (!name || !seat) {
    const pr = sheet_(ss, SHEETS.PROGRESS), row = findRow_(pr, who.email);
    if (row) { const v = pr.getRange(row, 1, 1, 3).getValues()[0]; name = name || String(v[1]); seat = seat || Number(v[2]); }
  }
  const now = Date.now();
  const me = { name: (r && r.name) || name || who.email, seat: seat || 0, team: (r && r.team) || '', trainer: !!who.trainer,
    mission: String(mission === undefined || mission === '' ? old.mission || '' : mission).slice(0, 80), t: now };
  pres[who.email] = me;
  Object.keys(pres).forEach(function (e) { if (now - pres[e].t > 6 * 3600000) delete pres[e]; }); // forget after 6 hours
  cache.put('PRESENCE', JSON.stringify(pres), 21600);
  return Object.assign({ email: who.email }, me);
}

/** Online now. Trainers see everyone; a trainee sees their own team and the trainers (no emails are sent). */
function online_(me) {
  const pres = JSON.parse(CacheService.getScriptCache().get('PRESENCE') || '{}');
  const now = Date.now();
  return Object.keys(pres).filter(function (e) {
    const p = pres[e];
    if (now - p.t > ONLINE_MS) return false;
    return me.trainer || p.trainer || e === me.email || (me.team !== '' && p.team === me.team);
  }).map(function (e) {
    const p = pres[e];
    return { name: p.name, seat: p.seat, team: p.team, trainer: p.trainer, mission: p.mission, me: e === me.email, ago: Math.round((now - p.t) / 1000) };
  }).sort(function (a, b) { return Number(b.trainer) - Number(a.trainer) || a.team.localeCompare(b.team) || (a.seat || 99) - (b.seat || 99); });
}

/** The chat channels this account can open: Announcements, plus their team (trainers: every team in the Roster). */
function channels_(ss, me) {
  if (!me.trainer) return [CHAT.ANNOUNCE].concat(me.team ? [me.team] : []);
  const ro = ss.getSheetByName(SHEETS.ROSTER);
  const teams = {};
  if (ro && ro.getLastRow() > 1) ro.getRange(2, 5, ro.getLastRow() - 1, 1).getValues().forEach(function (r) { const t = String(r[0] || '').trim(); if (t) teams[t] = true; });
  return [CHAT.ANNOUNCE].concat(Object.keys(teams).sort());
}

/** For each channel: its version (changes on every new or hidden message) and the newest message id. */
function chatVersions_(ss, me) {
  const out = {};
  channels_(ss, me).forEach(function (ch) { const c = channel_(ss, ch); out[ch] = { ver: c.ver, last: c.msgs.length ? c.msgs[c.msgs.length - 1].id : 0 }; });
  return out;
}

/** A channel's newest messages (cached; rebuilt from the Chat tab when the cache was cleared). */
function channel_(ss, ch) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('CH_' + ch);
  if (hit) return JSON.parse(hit);
  const sh = ss.getSheetByName(SHEETS.CHAT);
  const msgs = [];
  if (sh && sh.getLastRow() > 1) {
    const n = Math.min(sh.getLastRow() - 1, 3000);
    sh.getRange(sh.getLastRow() - n + 1, 1, n, CHAT_HEAD.length).getValues().forEach(function (r) {
      if (String(r[1]) === ch && String(r[6]).toUpperCase() !== 'YES') msgs.push(msg_(r));
    });
  }
  const c = { ver: Number(PropertiesService.getScriptProperties().getProperty('CHAT_SEQ') || 0), msgs: msgs.slice(-CHAT.KEEP) };
  cache.put('CH_' + ch, JSON.stringify(c), 21600);
  return c;
}
function msg_(r) {
  const t = r[0] instanceof Date ? r[0].getTime() : new Date(r[0]).getTime();
  return { id: Number(r[5]), t: t, email: String(r[2]), name: String(r[3]), text: String(r[4]) };
}
function canChat_(ss, me, ch, write) {
  if (channels_(ss, me).indexOf(ch) < 0) throw new Error(me.team || me.trainer ? 'You are not a member of that chat.' : 'You are not in a team yet. Ask your trainer to add your team in the Roster.');
  if (write && ch === CHAT.ANNOUNCE && !me.trainer) throw new Error('Only the trainer can post announcements.');
}
function meOf_(ss, req) {
  const who = auth_(ss, req.token);
  const r = rosterEntry_(ss, who.email);
  return { email: who.email, trainer: who.trainer, team: (r && r.team) || '' };
}

/** Messages of one channel. With ver = the version the lab already shows, returns { same: true } when nothing changed. */
function chatGet_(ss, req) {
  const me = meOf_(ss, req);
  const ch = String(req.channel || '');
  canChat_(ss, me, ch, false);
  const c = channel_(ss, ch);
  if (req.ver !== undefined && req.ver !== null && Number(req.ver) === c.ver) return { same: true, ver: c.ver };
  const trainers = getSettings_(ss).trainers;
  return { ver: c.ver, channel: ch, canPost: ch !== CHAT.ANNOUNCE || me.trainer, messages: c.msgs.map(function (m) {
    return { id: m.id, t: m.t, name: m.name, text: m.text, trainer: trainers.indexOf(m.email) >= 0, mine: m.email === me.email };
  }) };
}

function chatSend_(ss, req) {
  const me = meOf_(ss, req);
  const ch = String(req.channel || '');
  canChat_(ss, me, ch, true);
  const text = String(req.text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new Error('Type a message first.');
  if (text.length > CHAT.MAX_LEN) throw new Error('Messages can be at most ' + CHAT.MAX_LEN + ' characters.');
  const cache = CacheService.getScriptCache();
  const gap = Number(cache.get('CHATGAP_' + me.email) || 0);
  if (Date.now() - gap < CHAT.MIN_GAP_MS) throw new Error('Slow down a little: wait a second between messages.');
  cache.put('CHATGAP_' + me.email, String(Date.now()), 60);
  const props = PropertiesService.getScriptProperties();
  const id = Number(props.getProperty('CHAT_SEQ') || 0) + 1;
  props.setProperty('CHAT_SEQ', String(id));
  const p = touch_(ss, me, undefined);
  const row = [new Date(), ch, me.email, p.name, text, id, ''];
  sheet_(ss, SHEETS.CHAT).appendRow(row);
  const c = channel_(ss, ch);
  if (!c.msgs.some(function (m) { return m.id === id; })) c.msgs.push(msg_(row)); // (a rebuilt cache already has it)
  c.msgs = c.msgs.slice(-CHAT.KEEP); c.ver = id;
  cache.put('CH_' + ch, JSON.stringify(c), 21600);
  return { id: id, ver: c.ver };
}

/** Trainer: hide a message (it stays in the Chat tab, marked Hidden = YES). */
function chatHide_(ss, req) {
  const me = meOf_(ss, req);
  if (!me.trainer) throw new Error('Only the trainer can hide messages.');
  const sh = sheet_(ss, SHEETS.CHAT);
  const id = Number(req.id);
  if (sh.getLastRow() < 2) throw new Error('Message not found.');
  const ids = sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (Number(ids[i][0]) !== id) continue;
    sh.getRange(i + 2, 7, 1, 1).setValues([['YES']]);
    const ch = String(sh.getRange(i + 2, 2, 1, 1).getValues()[0][0]);
    const props = PropertiesService.getScriptProperties();
    const ver = Number(props.getProperty('CHAT_SEQ') || 0) + 1;
    props.setProperty('CHAT_SEQ', String(ver)); // a new version, so every open chat redraws without the message
    const c = channel_(ss, ch);
    c.msgs = c.msgs.filter(function (m) { return m.id !== id; }); c.ver = ver;
    CacheService.getScriptCache().put('CH_' + ch, JSON.stringify(c), 21600);
    log_(ss, me.email, 'Chat message hidden', ch + ' #' + id);
    return { hidden: id, ver: ver };
  }
  throw new Error('Message not found.');
}

// ------------------------------------------------------------------ checks
function check_(ss, req) {
  const s = getSettings_(ss);
  const email = String(req.email || '').trim().toLowerCase();
  const name = String(req.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  if (!name) throw new Error('Please enter your full name.');
  const trainer = s.trainers.indexOf(email) >= 0;
  if (!s.open && !trainer) throw new Error('The lab is closed right now. Please wait for your trainer.');
  const r = rosterEntry_(ss, email);
  if (s.requireRoster && !trainer && !(r && r.allowed)) throw new Error('Your email is not on the class list. Ask your trainer to add it.');
  // The trainer assigns seats; trainees never type one. Order: Roster seat > the seat this email
  // already has > the lowest free seat (not used in Progress and not reserved in the Roster).
  const seat = (r && r.seat) || seatOf_(ss, email) || (trainer ? 1 : freeSeat_(ss, email, s.trainers));
  if (!(seat >= 1 && seat <= APP.SEATS)) throw new Error('Seat ' + seat + ' in the Roster is not valid (use 1–' + APP.SEATS + '). Ask your trainer.');
  if (!trainer) {
    const owner = seatOwner_(ss, seat, s.trainers);
    if (owner && owner !== email) throw new Error('Seat ' + seat + ' is already used by another trainee. Ask your trainer to check the Roster.');
  }
  return { email: email, name: (r && r.name) || name, seat: seat, trainer: trainer };
}

/** Lowest seat not used by another trainee in Progress and not reserved for another email in the Roster. */
function freeSeat_(ss, email, trainers) {
  const taken = {};
  const pr = sheet_(ss, SHEETS.PROGRESS);
  if (pr.getLastRow() > 1) pr.getRange(2, 1, pr.getLastRow() - 1, 3).getValues().forEach(function (r) {
    const e = String(r[0]).trim().toLowerCase();
    if (e !== email && trainers.indexOf(e) < 0) taken[Number(r[2])] = true;
  });
  const ro = ss.getSheetByName(SHEETS.ROSTER);
  if (ro && ro.getLastRow() > 1) ro.getRange(2, 1, ro.getLastRow() - 1, 3).getValues().forEach(function (r) {
    if (String(r[0]).trim().toLowerCase() !== email) taken[Number(r[2])] = true;
  });
  for (let n = 1; n <= APP.SEATS; n++) if (!taken[n]) return n;
  throw new Error('All ' + APP.SEATS + ' seats are taken. Ask your trainer.');
}

function auth_(ss, token) {
  if (!token) throw new Error('Not signed in.');
  // the sign-in is cached for 6 hours, so frequent requests (chat) do not read the Sessions tab every time
  const cache = CacheService.getScriptCache();
  const hit = cache.get('TOK_' + token);
  if (hit) {
    const x = JSON.parse(hit);
    if (x.exp > Date.now()) return { email: x.email, trainer: getSettings_(ss).trainers.indexOf(x.email) >= 0 };
  }
  const sh = sheet_(ss, SHEETS.SESSIONS);
  const n = sh.getLastRow();
  if (n > 1) {
    const rows = sh.getRange(2, 1, n - 1, 4).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i][0] === token) {
        if (new Date(rows[i][3]).getTime() < Date.now()) throw new Error('Your sign-in has expired. Please sign in again.');
        const email = String(rows[i][1]);
        cache.put('TOK_' + token, JSON.stringify({ email: email, exp: new Date(rows[i][3]).getTime() }), 21600);
        return { email: email, trainer: getSettings_(ss).trainers.indexOf(email) >= 0 };
      }
    }
  }
  throw new Error('Your sign-in is no longer valid. Please sign in again.');
}

// ------------------------------------------------------------------ storage
function readState_(ss, email) {
  const sh = sheet_(ss, SHEETS.STATE);
  const row = findRow_(sh, email);
  if (!row) return { state: null, updated: 0 };
  const width = sh.getLastColumn();
  const range = sh.getRange(row, 1, 1, width);
  const vals = range.getValues()[0];
  const updated = Number(vals[1]) || 0;
  const cells = vals.slice(2).map(String);
  const text = cells.join('');
  if (!text) return { state: null, updated: updated };
  try { return { state: JSON.parse(text), updated: updated }; } catch (e) { /* repaired below */ }
  // States saved before the apostrophe fix (writeState_): Sheets read a chunk that began with = + or - as a
  // formula, so the cell shows an error (#ERROR!, #NAME?) instead of the text. The text is still in the formula.
  const forms = range.getFormulas()[0].slice(2);
  let tries = [cells];
  forms.forEach(function (f, i) {
    if (!f) return;
    // "-rw-r--r--" comes back as "=-rw-r--r--": drop the added = first when a + or - follows it
    const opts = f.charAt(0) !== '=' ? [f] : /^=[+-]/.test(f) ? [f.slice(1), f] : [f, f.slice(1)];
    const next = [];
    tries.forEach(function (t) { opts.forEach(function (o) { const c = t.slice(); c[i] = o; next.push(c); }); });
    if (next.length <= 64) tries = next;
  });
  for (let k = 0; k < tries.length; k++) {
    try { return { state: JSON.parse(tries[k].join('')), updated: updated }; } catch (e) { /* next */ }
  }
  // Still unreadable: do not block sign-in. The row is left as it is (the next save replaces it), and the
  // trainer can restore it from File > Version history if needed.
  log_(ss, email, 'Saved state unreadable', 'Signed in without the online copy; ' + text.length + ' characters kept in the State tab until the next save');
  return { state: null, updated: 0 };
}

function writeState_(ss, email, text, updated) {
  const sh = sheet_(ss, SHEETS.STATE);
  const chunks = [];
  // The leading apostrophe makes Sheets store each chunk as plain text (it is not part of the value). Without it,
  // a chunk that starts with = + or - is read as a formula and the saved state can no longer be parsed.
  for (let i = 0; i < text.length; i += APP.CHUNK) chunks.push("'" + text.slice(i, i + APP.CHUNK));
  let row = findRow_(sh, email);
  if (!row) { sh.appendRow([email]); row = sh.getLastRow(); }
  const width = Math.max(sh.getLastColumn(), chunks.length + 2);
  const values = [email, updated].concat(chunks);
  while (values.length < width) values.push('');
  sh.getRange(row, 1, 1, width).setValues([values]);
}

function upsertProgress_(ss, email, p) {
  const sh = sheet_(ss, SHEETS.PROGRESS);
  let row = findRow_(sh, email);
  if (!row) { sh.appendRow([email]); row = sh.getLastRow(); }
  const cur = sh.getRange(row, 1, 1, PROGRESS_HEAD.length).getValues()[0];
  const sm = p.summary;
  const v = [email, p.name || cur[1], p.seat || cur[2], new Date()];
  if (sm) {
    const practice = sm.practiceTotal ? (sm.practiceDone || 0) + ' / ' + sm.practiceTotal : (sm.practiceDone || 0);
    const mission = (sm.mission || '') + (sm.missionSteps ? ' (' + sm.missionSteps + ')' : '');
    v.push(sm.highestDay || '', act_(sm, 2), score_(sm, 2), act_(sm, 3), score_(sm, 3), act_(sm, 4), score_(sm, 4), practice, sm.commands || 0, mission);
    LATER_DAYS.forEach(function (d) { v.push(act_(sm, d), score_(sm, d)); });
  } else {
    for (let i = 4; i < PROGRESS_HEAD.length; i++) v.push(cur[i]);
  }
  sh.getRange(row, 1, 1, PROGRESS_HEAD.length).setValues([v]);
  sh.getRange(row, 4, 1, 1).setNumberFormat('yyyy-mm-dd hh:mm'); // Last Sync with the time
}
// "1 / 4 (12/40 steps)": activities finished, plus steps done across that day's activities
function act_(sm, d) { const x = (sm.days || {})[d]; return x ? x.done + ' / ' + x.total + (x.stepsTotal ? ' (' + (x.steps || 0) + '/' + x.stepsTotal + ' steps)' : '') : ''; }
function score_(sm, d) { const x = (sm.days || {})[d]; return x && x.checked ? x.correct + ' / ' + x.checked : ''; }

/** The trainee (not trainer) who already uses this seat in Progress. */
function seatOwner_(ss, seat, trainers) {
  const sh = sheet_(ss, SHEETS.PROGRESS);
  const n = sh.getLastRow();
  if (n < 2) return null;
  const rows = sh.getRange(2, 1, n - 1, 3).getValues();
  for (let i = 0; i < rows.length; i++) {
    const e = String(rows[i][0]).trim().toLowerCase();
    if (Number(rows[i][2]) === Number(seat) && trainers.indexOf(e) < 0) return e;
  }
  return null;
}

/** The seat this email already has in Progress (0 if none). */
function seatOf_(ss, email) {
  const sh = sheet_(ss, SHEETS.PROGRESS);
  const row = findRow_(sh, email);
  return row ? Number(sh.getRange(row, 3, 1, 1).getValues()[0][0]) || 0 : 0;
}

function findRow_(sh, email) {
  const n = sh.getLastRow();
  if (n < 2) return 0;
  const col = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < col.length; i++) if (String(col[i][0]).toLowerCase() === email) return i + 2;
  return 0;
}

// ------------------------------------------------------------------ trainer functions (run from the editor)
function setup() {
  requireOwner_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  const set = sheet_(ss, SHEETS.SETTINGS);
  if (set.getLastRow() < 1) set.getRange(1, 1, 1, 3).setValues([['Setting', 'Value', 'Notes']]);
  // add any setting that is missing (keeps the values the trainer already typed)
  const have = set.getLastRow() > 1 ? set.getRange(2, 1, set.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  SETTINGS_SPEC.forEach(function (r) { if (have.indexOf(r[0]) < 0) set.appendRow(r); });
  header_(set, 3);
  const ro = sheet_(ss, SHEETS.ROSTER);
  ro.getRange(1, 1, 1, ROSTER_HEAD.length).setValues([ROSTER_HEAD]); // row 1 is the header (adds Team to older sheets)
  header_(ro, ROSTER_HEAD.length);
  const pr = sheet_(ss, SHEETS.PROGRESS);
  pr.getRange(1, 1, 1, PROGRESS_HEAD.length).setValues([PROGRESS_HEAD]);
  header_(pr, PROGRESS_HEAD.length);
  pr.setFrozenRows(1);
  const st = sheet_(ss, SHEETS.STATE);
  if (st.getLastRow() < 1) st.getRange(1, 1, 1, 3).setValues([['Email', 'Updated (ms)', 'Saved lab state (JSON, split across cells)']]);
  header_(st, 3);
  st.hideSheet();
  const se = sheet_(ss, SHEETS.SESSIONS);
  if (se.getLastRow() < 1) se.getRange(1, 1, 1, 4).setValues([['Token', 'Email', 'Created', 'Expires']]);
  header_(se, 4);
  se.hideSheet();
  const ch = sheet_(ss, SHEETS.CHAT);
  if (ch.getLastRow() < 1) ch.getRange(1, 1, 1, CHAT_HEAD.length).setValues([CHAT_HEAD]);
  header_(ch, CHAT_HEAD.length);
  ch.setFrozenRows(1);
  const sb = sheet_(ss, SHEETS.SUBS);
  if (sb.getLastRow() < 1) sb.getRange(1, 1, 1, SUBS_HEAD.length).setValues([SUBS_HEAD]);
  header_(sb, SUBS_HEAD.length);
  sb.setFrozenRows(1);
  const rd = sheet_(ss, SHEETS.REDO);
  if (rd.getLastRow() < 1) rd.getRange(1, 1, 1, REDO_HEAD.length).setValues([REDO_HEAD]);
  header_(rd, REDO_HEAD.length);
  rd.setFrozenRows(1);
  const lg = sheet_(ss, SHEETS.LOG);
  if (lg.getLastRow() < 1) lg.getRange(1, 1, 1, 4).setValues([['Time', 'Email', 'Event', 'Detail']]);
  header_(lg, 4);
  Logger.log('Setup complete. Sheet: ' + ss.getUrl() + '\nNext: Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).');
}

/** Trainer: let a trainee sign in again on every device (e.g., after a lost phone or a typo in the seat). */
function signOutEverywhere(email) {
  requireOwner_();
  const ss = ss_();
  const sh = sheet_(ss, SHEETS.SESSIONS);
  const n = sh.getLastRow();
  if (n < 2) return;
  const rows = sh.getRange(2, 1, n - 1, 4).getValues();
  const cache = CacheService.getScriptCache();
  for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i][1]).toLowerCase() === String(email).toLowerCase()) { cache.remove('TOK_' + rows[i][0]); sh.deleteRow(i + 2); }
}

// ------------------------------------------------------------------ helpers
function getSettings_(ss) {
  const sh = ss.getSheetByName(SHEETS.SETTINGS);
  const m = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { m[String(r[0]).trim()] = r[1]; });
  const open = String(m['Lab Status'] || 'OPEN').trim().toUpperCase() !== 'CLOSED';
  const od = String(m['Open Days'] === undefined ? '' : m['Open Days']).trim().toUpperCase();
  const openDays = !open ? [] : od === 'ALL' ? Array.from({ length: 15 }, function (_, i) { return i + 1; })
    : od.split(/[\s,;]+/).map(Number).filter(function (n) { return n >= 1 && n <= 15; });
  return {
    open: open,
    openDays: openDays,
    requireRoster: String(m['Require Roster'] || 'NO').trim().toUpperCase() === 'YES',
    trainers: String(m['Trainer Emails'] || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(String),
  };
}

function rosterEntry_(ss, email) {
  const sh = ss.getSheetByName(SHEETS.ROSTER);
  if (!sh || sh.getLastRow() < 2) return null;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === email) {
      return { name: String(rows[i][1] || '').trim(), seat: Number(rows[i][2]) || 0, allowed: String(rows[i][3] || 'YES').trim().toUpperCase() !== 'NO', team: String(rows[i][4] || '').trim() };
    }
  }
  return null;
}

function log_(ss, email, event, detail) { sheet_(ss, SHEETS.LOG).appendRow([new Date(), email, event, detail]); }
function maskEmail_(email) { const p = email.split('@'); return p[0].slice(0, 2) + '*'.repeat(Math.max(1, p[0].length - 2)) + '@' + p[1]; }
function esc_(s) { return String(s).replace(/[<>&"]/g, ''); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheet_(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }
function header_(sh, cols) { sh.getRange(1, 1, 1, cols).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1F3864').setWrap(true); }
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('The lab sync is not set up yet. Trainer: run the setup function first.');
  return SpreadsheetApp.openById(id);
}
function requireOwner_() {
  const active = Session.getActiveUser().getEmail();
  if (!active || active !== Session.getEffectiveUser().getEmail()) throw new Error('This function can only be run by the trainer from the Apps Script editor.');
}
